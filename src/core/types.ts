/** Shared domain types. Mirrors the shapes used by zano_web3 where practical. */
import type { Atomic } from "./amounts";

/** An asset as held by a wallet (§2.1). decimalPoint drives all display/math. */
export interface Asset {
  assetId: string;
  name: string;
  ticker: string;
  decimalPoint: number;
  balance: Atomic; // total, atomic units
  unlockedBalance: Atomic; // spendable, atomic units
}

/** A wallet/account managed locally. The seed/keys live only in the encrypted
 * keystore at rest and in memory only while unlocked — never on this object
 * once persisted (§5). */
export interface Account {
  id: string;
  label: string;
  primaryAddress: string; // the single receive address (§1.3)
}

/** One output of a transfer. */
export interface Destination {
  address: string;
  amount: Atomic;
  assetId: string;
}

/** A fully-built transfer ready to hand to the wallet RPC `transfer` method. */
export interface TransferPlan {
  fromAccountId: string;
  destinations: Destination[];
  fee: Atomic;
  comment?: string;
  /** Convenience flag: true when a dev-tip destination is present. */
  includesDevTip: boolean;
}

export type ConnStatus = "connected" | "syncing" | "offline";
