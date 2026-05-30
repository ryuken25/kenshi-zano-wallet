/**
 * Merge / consolidation planner (§2.3).
 *
 * For each participating source wallet, build a transfer that moves
 * (unlocked_balance − network_fee − dev_tip) of the chosen asset to the target,
 * PLUS the 0.01 ZANO dev tip — all inside that wallet's own signed tx. Each wallet
 * is processed sequentially; one failure must not block or corrupt the others.
 *
 * Minimum rule: a participating wallet must hold >= dev_tip (0.01 ZANO) PLUS native
 * Zano for the network fee. Under-funded wallets are EXCLUDED with a clear message
 * (Indonesian, matching the spec) — they are never silently dropped.
 */
import type { Atomic } from "./amounts";
import { DEV_TIP_ADDRESS, DEV_TIP_ATOMIC, ZANO_ASSET_ID } from "./constants";
import type { Destination, TransferPlan } from "./types";

export interface MergeSourceState {
  accountId: string;
  label: string;
  /** Unlocked balance of the chosen asset being merged (atomic). */
  unlockedAsset: Atomic;
  /** Unlocked NATIVE Zano balance (atomic) — pays fee + dev tip. */
  unlockedNativeZano: Atomic;
}

export interface MergeParticipant {
  accountId: string;
  label: string;
  plan: TransferPlan;
  /** Atomic amount of the chosen asset actually moved to the target. */
  movedAmount: Atomic;
  fee: Atomic;
  devTip: Atomic;
}

export interface MergeExclusion {
  accountId: string;
  label: string;
  reason: string;
}

export interface MergePlan {
  targetAccountId: string;
  assetId: string;
  participants: MergeParticipant[];
  excluded: MergeExclusion[];
}

export interface BuildMergeInput {
  targetAccountId: string;
  targetAddress: string;
  /** Asset being consolidated. */
  assetId: string;
  /** Network fee (atomic native Zano) used for planning. */
  fee: Atomic;
  sources: MergeSourceState[];
}

/**
 * Build the full merge plan. The target account is never a source of itself.
 * When the merged asset IS native Zano, the moved amount already accounts for the
 * fee + tip coming out of the same native balance. When the merged asset is a
 * Confidential Asset, the full unlocked asset balance is moved and the fee+tip are
 * paid from the wallet's native Zano (which is why we still require native funds).
 */
export function buildMergePlan(input: BuildMergeInput): MergePlan {
  const participants: MergeParticipant[] = [];
  const excluded: MergeExclusion[] = [];
  const isNative = input.assetId === ZANO_ASSET_ID;
  const minNative = DEV_TIP_ATOMIC + input.fee; // §2.3 minimum rule

  for (const s of input.sources) {
    if (s.accountId === input.targetAccountId) {
      // Skip the target itself silently — it is the destination, not a source.
      continue;
    }

    // Every participant needs native Zano >= dev tip + network fee.
    if (s.unlockedNativeZano < minNative) {
      excluded.push({
        accountId: s.accountId,
        label: s.label,
        reason: `Wallet ${s.label} dilewati: minimal 0.01 ZANO + fee jaringan.`,
      });
      continue;
    }

    let movedAmount: Atomic;
    if (isNative) {
      // moved = unlocked native − fee − dev tip
      movedAmount = s.unlockedNativeZano - input.fee - DEV_TIP_ATOMIC;
    } else {
      // moved = full unlocked asset balance (fee + tip paid from native)
      movedAmount = s.unlockedAsset;
    }

    if (movedAmount <= 0n) {
      excluded.push({
        accountId: s.accountId,
        label: s.label,
        reason: `Wallet ${s.label} dilewati: tidak ada saldo yang bisa dipindahkan setelah fee + tip.`,
      });
      continue;
    }

    const destinations: Destination[] = [
      { address: input.targetAddress, amount: movedAmount, assetId: input.assetId },
      // Dev tip — same atomic signed tx (§3).
      { address: DEV_TIP_ADDRESS, amount: DEV_TIP_ATOMIC, assetId: ZANO_ASSET_ID },
    ];

    participants.push({
      accountId: s.accountId,
      label: s.label,
      movedAmount,
      fee: input.fee,
      devTip: DEV_TIP_ATOMIC,
      plan: {
        fromAccountId: s.accountId,
        destinations,
        fee: input.fee,
        comment: "Kenshi merge",
        includesDevTip: true,
      },
    });
  }

  return {
    targetAccountId: input.targetAccountId,
    assetId: input.assetId,
    participants,
    excluded,
  };
}

// ---------------------------------------------------------------------------
// "Merge ALL assets" — consolidate every token a wallet holds (Zano + every
// Confidential Asset, e.g. FUSD) into the target in ONE signed tx per wallet.
// This is a MOVE, never a swap: each asset is sent as itself to the target.
// ---------------------------------------------------------------------------

/** One asset's unlocked balance for a source wallet. */
export interface MergeAssetBalance {
  assetId: string;
  ticker: string;
  decimalPoint: number;
  unlocked: Atomic;
}

/** A source wallet with its full asset list (must include native Zano). */
export interface MergeSourceFull {
  accountId: string;
  label: string;
  assets: MergeAssetBalance[];
}

/** Per-asset amount actually moved, for the confirmation breakdown. */
export interface MovedAsset {
  assetId: string;
  ticker: string;
  decimalPoint: number;
  amount: Atomic;
}

export interface MergeAllParticipant {
  accountId: string;
  label: string;
  plan: TransferPlan;
  /** Every asset moved from this wallet (native + confidential). */
  moved: MovedAsset[];
  fee: Atomic;
  devTip: Atomic;
}

export interface MergeAllPlan {
  targetAccountId: string;
  participants: MergeAllParticipant[];
  excluded: MergeExclusion[];
}

export interface BuildMergeAllInput {
  targetAccountId: string;
  targetAddress: string;
  fee: Atomic;
  sources: MergeSourceFull[];
}

/**
 * Build a plan that moves ALL of each source wallet's assets to the target.
 *
 * Per wallet (one signed tx):
 *   - native Zano output = unlocked_native − fee − dev_tip (only if > 0)
 *   - each other asset output = its full unlocked balance (only if > 0)
 *   - one dev-tip output (0.01 ZANO, native)
 * Fee + tip are always paid from native, so the same minimum rule applies:
 * native >= 0.01 ZANO + network fee, else the wallet is excluded with a message.
 */
export function buildMergeAllPlan(input: BuildMergeAllInput): MergeAllPlan {
  const participants: MergeAllParticipant[] = [];
  const excluded: MergeExclusion[] = [];
  const minNative = DEV_TIP_ATOMIC + input.fee;

  for (const s of input.sources) {
    if (s.accountId === input.targetAccountId) continue; // target is not its own source

    const native = s.assets.find((a) => a.assetId === ZANO_ASSET_ID);
    const nativeUnlocked = native?.unlocked ?? 0n;

    if (nativeUnlocked < minNative) {
      excluded.push({
        accountId: s.accountId,
        label: s.label,
        reason: `Wallet ${s.label} dilewati: minimal 0.01 ZANO + fee jaringan.`,
      });
      continue;
    }

    const destinations: Destination[] = [];
    const moved: MovedAsset[] = [];

    // Native: move what's left after fee + tip.
    const nativeMove = nativeUnlocked - input.fee - DEV_TIP_ATOMIC;
    if (nativeMove > 0n) {
      destinations.push({ address: input.targetAddress, amount: nativeMove, assetId: ZANO_ASSET_ID });
      moved.push({
        assetId: ZANO_ASSET_ID,
        ticker: native?.ticker ?? "ZANO",
        decimalPoint: native?.decimalPoint ?? 12,
        amount: nativeMove,
      });
    }

    // Every other asset: move the full unlocked balance.
    for (const a of s.assets) {
      if (a.assetId === ZANO_ASSET_ID) continue;
      if (a.unlocked <= 0n) continue;
      destinations.push({ address: input.targetAddress, amount: a.unlocked, assetId: a.assetId });
      moved.push({
        assetId: a.assetId,
        ticker: a.ticker,
        decimalPoint: a.decimalPoint,
        amount: a.unlocked,
      });
    }

    if (moved.length === 0) {
      excluded.push({
        accountId: s.accountId,
        label: s.label,
        reason: `Wallet ${s.label} dilewati: tidak ada saldo yang bisa dipindahkan setelah fee + tip.`,
      });
      continue;
    }

    // Dev tip — same atomic signed tx (§3).
    destinations.push({ address: DEV_TIP_ADDRESS, amount: DEV_TIP_ATOMIC, assetId: ZANO_ASSET_ID });

    participants.push({
      accountId: s.accountId,
      label: s.label,
      moved,
      fee: input.fee,
      devTip: DEV_TIP_ATOMIC,
      plan: {
        fromAccountId: s.accountId,
        destinations,
        fee: input.fee,
        comment: "Kenshi merge (all assets)",
        includesDevTip: true,
      },
    });
  }

  return { targetAccountId: input.targetAccountId, participants, excluded };
}
