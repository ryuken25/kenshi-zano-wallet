/**
 * Transfer builder (§1.4, §1.6, §3).
 *
 * Builds the `destinations[]` array for the wallet-RPC `transfer` method. The dev
 * tip (§3) is added as ONE extra destination inside the SAME atomic transfer — it
 * is never a separate broadcast. The tip is always represented explicitly so the
 * confirmation UI can show it transparently with its address and a default-checked
 * box.
 */
import { checkBalance, sumAtomic, type Atomic } from "./amounts";
import {
  DEV_TIP_ADDRESS,
  DEV_TIP_ATOMIC,
  ZANO_ASSET_ID,
} from "./constants";
import type { Destination, TransferPlan } from "./types";

export interface BuildTransferInput {
  fromAccountId: string;
  /** User-chosen outputs (may mix assets — §2.2). */
  destinations: Destination[];
  /** Network fee in atomic native Zano. */
  fee: Atomic;
  /** Include the developer tip (§3). Default true for multi-send/merge. */
  includeDevTip: boolean;
  comment?: string;
}

/**
 * Build the transfer plan, appending the dev-tip destination when requested.
 * The tip is always native Zano (ZANO_ASSET_ID) regardless of what assets the
 * user is sending.
 */
export function buildTransfer(input: BuildTransferInput): TransferPlan {
  const destinations: Destination[] = [...input.destinations];
  if (input.includeDevTip) {
    destinations.push({
      address: DEV_TIP_ADDRESS,
      amount: DEV_TIP_ATOMIC,
      assetId: ZANO_ASSET_ID,
    });
  }
  return {
    fromAccountId: input.fromAccountId,
    destinations,
    fee: input.fee,
    comment: input.comment,
    includesDevTip: input.includeDevTip,
  };
}

/**
 * Pre-flight check for a transfer plan against the source wallet's unlocked
 * balances. Native Zano must cover: (sum of native outputs) + tip(already in
 * outputs if present) + fee. Each non-native asset must cover its own output sum.
 *
 * Returns ok=false with human-readable reasons when short. Nothing is signed
 * unless ok=true (§4 atomic state).
 */
export interface PreflightResult {
  ok: boolean;
  errors: string[];
  /** Per-asset required atomic totals, for display. */
  requiredByAsset: Record<string, Atomic>;
}

export function preflight(
  plan: TransferPlan,
  unlockedByAsset: Record<string, Atomic>,
): PreflightResult {
  const errors: string[] = [];
  const requiredByAsset: Record<string, Atomic> = {};

  // Group output sums by asset.
  for (const d of plan.destinations) {
    requiredByAsset[d.assetId] = (requiredByAsset[d.assetId] ?? 0n) + d.amount;
  }
  // Fee always rides on native Zano.
  requiredByAsset[ZANO_ASSET_ID] = (requiredByAsset[ZANO_ASSET_ID] ?? 0n) + plan.fee;

  for (const [assetId, required] of Object.entries(requiredByAsset)) {
    const have = unlockedByAsset[assetId] ?? 0n;
    if (have < required) {
      const label = assetId === ZANO_ASSET_ID ? "ZANO (for outputs + tip + fee)" : assetId;
      errors.push(
        `Insufficient unlocked balance for ${label}: need ${required} atomic, have ${have}.`,
      );
    }
  }
  return { ok: errors.length === 0, errors, requiredByAsset };
}

/** Convenience for the single-send screen: one destination + optional tip. */
export function buildSingleSend(args: {
  fromAccountId: string;
  to: string;
  amount: Atomic;
  assetId: string;
  fee: Atomic;
  includeDevTip: boolean;
  comment?: string;
}): TransferPlan {
  return buildTransfer({
    fromAccountId: args.fromAccountId,
    destinations: [{ address: args.to, amount: args.amount, assetId: args.assetId }],
    fee: args.fee,
    includeDevTip: args.includeDevTip,
    comment: args.comment,
  });
}

/** Re-export for the UI's verifiable "amount + tip + fee <= balance" line (§1.4). */
export { checkBalance, sumAtomic };
