/**
 * App store: a thin React context over the core services. Holds no secrets beyond
 * what core/session.ts keeps in memory while unlocked. Provides actions used by the
 * screens and a stale-while-revalidate asset cache (§2.4).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AccountStore, type KV } from "../core/accounts";
import { WalletService } from "../core/wallet";
import { DEFAULT_NODES, AUTO_LOCK_MS, DEFAULT_WALLET_RPC } from "../core/constants";
import * as session from "../core/session";
import { log } from "../core/logger";
import type { Account, Asset, ConnStatus } from "../core/types";

/** localStorage-backed KV with a graceful no-op fallback. */
const localKV: KV = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

const NODES_KEY = "kenshi.nodes.v1";

function loadNodes(): string[] {
  try {
    const raw = localStorage.getItem(NODES_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return [...DEFAULT_NODES, DEFAULT_WALLET_RPC];
}

interface Store {
  unlocked: boolean;
  accounts: Account[];
  activeId: string | null;
  active: Account | null;
  assets: Asset[];
  status: ConnStatus;
  nodes: string[];
  accountStore: AccountStore;
  wallet: WalletService;
  toast: (msg: string, kind?: "ok" | "err") => void;
  toasts: { id: number; msg: string; kind: "ok" | "err" }[];
  // actions
  unlock: (pw: string) => Promise<boolean>;
  lock: () => void;
  refresh: () => Promise<void>;
  setActive: (id: string) => Promise<void>;
  reloadAccounts: () => Promise<void>;
  setNodes: (nodes: string[]) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const accountStore = useMemo(() => new AccountStore(localKV), []);
  const [nodes, setNodesState] = useState<string[]>(loadNodes);
  const wallet = useMemo(() => new WalletService({ endpoints: nodes }), []); // eslint-disable-line
  const [unlocked, setUnlocked] = useState(session.isUnlocked());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [status, setStatus] = useState<ConnStatus>("offline");
  const [toasts, setToasts] = useState<Store["toasts"]>([]);
  const toastSeq = useRef(0);

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  // §1.8a: always start locked; auto-lock listeners + reload safety.
  useEffect(() => {
    session.configureAutoLock(AUTO_LOCK_MS);
    session.installActivityListeners();
    const off = session.onLockChange((u) => {
      setUnlocked(u);
      if (!u) {
        setAssets([]); // clear sensitive view on lock
      }
    });
    return off;
  }, []);

  const reloadAccounts = useCallback(async () => {
    const list = await accountStore.list();
    setAccounts(list);
    const id = await accountStore.getActiveId();
    setActiveId(id);
  }, [accountStore]);

  const refresh = useCallback(async () => {
    const id = await accountStore.getActiveId();
    if (!id) return;
    // Render from cache first (instant), then revalidate (§2.4).
    const cached = wallet.cachedAssets(id);
    if (cached) setAssets(cached);
    try {
      const fresh = await wallet.refreshAssets(id);
      setAssets(fresh);
    } catch (e) {
      toast(`Tidak bisa memuat saldo: ${(e as Error).message}`, "err");
    }
    setStatus(await wallet.probe());
  }, [accountStore, wallet, toast]);

  const unlock = useCallback(
    async (pw: string) => {
      const ok = await accountStore.verifyPassword(pw);
      if (!ok) {
        toast("Password salah.", "err");
        return false;
      }
      session.unlock(pw);
      await reloadAccounts();
      await refresh();
      return true;
    },
    [accountStore, reloadAccounts, refresh, toast],
  );

  const lock = useCallback(() => session.lock(), []);

  const setActive = useCallback(
    async (id: string) => {
      await accountStore.setActive(id);
      setActiveId(id);
      await refresh();
    },
    [accountStore, refresh],
  );

  const setNodes = useCallback(
    (n: string[]) => {
      setNodesState(n);
      try {
        localStorage.setItem(NODES_KEY, JSON.stringify(n));
      } catch {
        /* ignore */
      }
      wallet.setEndpoints(n);
      log.info("nodes updated", `${n.length} endpoint(s)`);
    },
    [wallet],
  );

  const active = accounts.find((a) => a.id === activeId) ?? null;

  const value: Store = {
    unlocked,
    accounts,
    activeId,
    active,
    assets,
    status,
    nodes,
    accountStore,
    wallet,
    toast,
    toasts,
    unlock,
    lock,
    refresh,
    setActive,
    reloadAccounts,
    setNodes,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used within StoreProvider");
  return s;
}
