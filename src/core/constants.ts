/**
 * Single source of truth for chain + dev-tip configuration (§3).
 * Editing these constants is the only supported way to change the tip.
 */
import { toAtomic } from "./amounts";

/** Zano native coin asset id (mainnet). */
export const ZANO_ASSET_ID =
  "d6329b5b1f7c0805b5c345f4957554002a2f557845f64d7645dae0e051a6498a";

/** Zano native coin metadata. decimalPoint is NOT hardcoded elsewhere — only here. */
export const ZANO_DECIMALS = 12;
export const ZANO_TICKER = "ZANO";
export const ZANO_NAME = "Zano";

/** §3 — developer tip, applied to multi-send and merge only. */
export const DEV_TIP_ZANO = "0.01";
export const DEV_TIP_ADDRESS =
  "iZ2q2xfw9AdX8YpGrcrjEPTG2ie8FMuXMFdDNKqRRbGo15zbuUfMAzDbtEDxcDpJcXGijaADG2WVs41p8PMiBnzrV94bWuisSKk2U53u3Wyg";

/** Dev tip expressed in atomic units of native Zano (computed once). */
export const DEV_TIP_ATOMIC = toAtomic(DEV_TIP_ZANO, ZANO_DECIMALS);

/**
 * Default network fee assumption for pre-flight checks (atomic, native Zano).
 * The real fee is set by the wallet RPC at sign time; this is the conservative
 * value used for "<= balance" validation so we never let a user start a tx that
 * can't pay its fee. Zano's default consolidated fee is 0.01 ZANO.
 */
export const DEFAULT_FEE_ZANO = "0.01";
export const DEFAULT_FEE_ATOMIC = toAtomic(DEFAULT_FEE_ZANO, ZANO_DECIMALS);

/** Idle auto-lock timeout (ms). Also enforced on full reload (§1.8a). */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

/**
 * Default remote daemon/wallet-RPC fallback list (§2.4). Tried in order on
 * timeout. Users can override / prepend their own node in Settings. These are
 * public endpoints; full privacy requires the local zanod sidecar (EXE).
 */
export const DEFAULT_NODES: string[] = [
  "http://127.0.0.1:11211/json_rpc", // local zanod (sidecar / advanced)
];

/** Default wallet-RPC (simplewallet) endpoint. */
export const DEFAULT_WALLET_RPC = "http://127.0.0.1:11212/json_rpc";
