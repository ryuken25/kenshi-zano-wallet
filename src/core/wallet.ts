/**
 * Wallet service (§1, §2.1, §2.4).
 *
 * Wraps the wallet-RPC (`getbalance`, `getaddress`, `transfer`, `get_assets_list`)
 * and the daemon (`getinfo`) behind a domain API. Implements:
 *   - generic multi-asset list with Zano pinned to the top, even at zero balance;
 *   - per-account stale-while-revalidate caching;
 *   - connection status (connected / syncing / offline).
 */
import { type Atomic } from "./amounts";
import { ZANO_ASSET_ID, ZANO_DECIMALS, ZANO_NAME, ZANO_TICKER } from "./constants";
import { rpcCall, type RpcOptions } from "./rpc";
import { log } from "./logger";
import type { Asset, ConnStatus, TransferPlan } from "./types";

/** Raw asset entry as returned by the wallet RPC `getbalance` balances array. */
interface RawBalanceEntry {
  asset_info?: {
    asset_id?: string;
    full_name?: string;
    ticker?: string;
    decimal_point?: number;
  };
  total?: string | number;
  unlocked?: string | number;
}

interface RawBalanceResult {
  balance?: string | number;
  unlocked_balance?: string | number;
  balances?: RawBalanceEntry[];
}

function toBig(v: string | number | undefined): Atomic {
  if (v === undefined || v === null) return 0n;
  return BigInt(typeof v === "number" ? Math.trunc(v) : v.split(".")[0]);
}

/** Build the asset list with Zano pinned at index 0 (§2.1), merging RPC data. */
export function normalizeAssets(raw: RawBalanceResult): Asset[] {
  const byId = new Map<string, Asset>();

  // Seed the native pin first so it is always present, even at zero.
  byId.set(ZANO_ASSET_ID, {
    assetId: ZANO_ASSET_ID,
    name: ZANO_NAME,
    ticker: ZANO_TICKER,
    decimalPoint: ZANO_DECIMALS,
    balance: 0n,
    unlockedBalance: 0n,
  });

  // Legacy top-level native balance form.
  if (raw.balance !== undefined || raw.unlocked_balance !== undefined) {
    const z = byId.get(ZANO_ASSET_ID)!;
    z.balance = toBig(raw.balance);
    z.unlockedBalance = toBig(raw.unlocked_balance);
  }

  for (const e of raw.balances ?? []) {
    const id = e.asset_info?.asset_id ?? ZANO_ASSET_ID;
    const existing = byId.get(id);
    const asset: Asset = existing ?? {
      assetId: id,
      name: e.asset_info?.full_name ?? id.slice(0, 8),
      ticker: e.asset_info?.ticker ?? "?",
      decimalPoint: e.asset_info?.decimal_point ?? ZANO_DECIMALS,
      balance: 0n,
      unlockedBalance: 0n,
    };
    asset.balance = toBig(e.total);
    asset.unlockedBalance = toBig(e.unlocked);
    // Keep native metadata authoritative for the pinned entry.
    if (id === ZANO_ASSET_ID) {
      asset.name = ZANO_NAME;
      asset.ticker = ZANO_TICKER;
      asset.decimalPoint = ZANO_DECIMALS;
    }
    byId.set(id, asset);
  }

  const native = byId.get(ZANO_ASSET_ID)!;
  const rest = [...byId.values()].filter((a) => a.assetId !== ZANO_ASSET_ID);
  return [native, ...rest]; // Zano pinned at top.
}

interface CacheEntry {
  assets: Asset[];
  at: number;
}

export class WalletService {
  private cache = new Map<string, CacheEntry>();
  status: ConnStatus = "offline";

  constructor(private rpc: RpcOptions) {}

  setEndpoints(endpoints: string[], authToken?: string): void {
    this.rpc = { ...this.rpc, endpoints, authToken };
  }

  /** Return cached assets immediately (may be undefined) for instant render. */
  cachedAssets(accountId: string): Asset[] | undefined {
    return this.cache.get(accountId)?.assets;
  }

  /** Fetch assets, updating cache + status. Throws are caught by caller/UI. */
  async refreshAssets(accountId: string): Promise<Asset[]> {
    try {
      const raw = await rpcCall<RawBalanceResult>("getbalance", {}, this.rpc);
      const assets = normalizeAssets(raw);
      this.cache.set(accountId, { assets, at: Date.now() });
      this.status = "connected";
      return assets;
    } catch (e) {
      this.status = "offline";
      log.warn("refreshAssets failed:", (e as Error).message);
      throw e;
    }
  }

  /** Daemon height/sync probe → connection status (§2.4). */
  async probe(): Promise<ConnStatus> {
    try {
      const info = await rpcCall<{ synchronized?: boolean; height?: number }>(
        "getinfo",
        {},
        this.rpc,
      );
      this.status = info.synchronized === false ? "syncing" : "connected";
    } catch {
      this.status = "offline";
    }
    return this.status;
  }

  /** Fetch the wallet's single primary receive address (§1.3). */
  async getPrimaryAddress(): Promise<string> {
    const res = await rpcCall<{ address?: string }>("getaddress", {}, this.rpc);
    if (!res.address) throw new Error("Wallet RPC returned no address.");
    return res.address;
  }

  /**
   * Broadcast a built transfer plan via the wallet RPC `transfer` method. Returns
   * the tx hash. The plan's destinations already include the dev tip when enabled.
   */
  async sendTransfer(plan: TransferPlan): Promise<string> {
    const params = {
      destinations: plan.destinations.map((d) => ({
        address: d.address,
        amount: d.amount.toString(), // atomic units as string — no float
        asset_id: d.assetId,
      })),
      fee: plan.fee.toString(),
      comment: plan.comment ?? "",
      mixin: 10,
    };
    const res = await rpcCall<{ tx_hash?: string }>("transfer", params, this.rpc);
    if (!res.tx_hash) throw new Error("Transfer did not return a tx hash.");
    return res.tx_hash;
  }
}
