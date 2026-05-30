import { describe, it, expect } from "vitest";
import { buildMergePlan } from "../src/core/merge";
import { toAtomic } from "../src/core/amounts";
import { DEV_TIP_ATOMIC, ZANO_ASSET_ID } from "../src/core/constants";

const TARGET_ADDR =
  "Ztarget1111111111111111111111111111111111111111111111111111111111111111111111111111111111111";
const fee = toAtomic("0.01", 12);

describe("merge planner (§2.3)", () => {
  it("excludes under-funded wallets with the Indonesian message", () => {
    const plan = buildMergePlan({
      targetAccountId: "target",
      targetAddress: TARGET_ADDR,
      assetId: ZANO_ASSET_ID,
      fee,
      sources: [
        // Funded: 1 ZANO native.
        {
          accountId: "a",
          label: "A",
          unlockedAsset: toAtomic("1", 12),
          unlockedNativeZano: toAtomic("1", 12),
        },
        // Under-funded: only 0.015 ZANO (< 0.01 tip + 0.01 fee = 0.02).
        {
          accountId: "b",
          label: "B",
          unlockedAsset: toAtomic("0.015", 12),
          unlockedNativeZano: toAtomic("0.015", 12),
        },
      ],
    });
    expect(plan.participants.map((p) => p.accountId)).toEqual(["a"]);
    expect(plan.excluded).toHaveLength(1);
    expect(plan.excluded[0].accountId).toBe("b");
    expect(plan.excluded[0].reason).toContain("minimal 0.01 ZANO + fee jaringan");
  });

  it("native merge moves (unlocked − fee − tip) and includes the tip destination", () => {
    const plan = buildMergePlan({
      targetAccountId: "target",
      targetAddress: TARGET_ADDR,
      assetId: ZANO_ASSET_ID,
      fee,
      sources: [
        {
          accountId: "a",
          label: "A",
          unlockedAsset: toAtomic("5", 12),
          unlockedNativeZano: toAtomic("5", 12),
        },
      ],
    });
    const p = plan.participants[0];
    // 5 − 0.01 fee − 0.01 tip = 4.98
    expect(p.movedAmount).toBe(toAtomic("4.98", 12));
    expect(p.devTip).toBe(DEV_TIP_ATOMIC);
    // destinations: [moved to target, dev tip]
    expect(p.plan.destinations).toHaveLength(2);
    expect(p.plan.destinations[0].address).toBe(TARGET_ADDR);
    expect(p.plan.destinations[0].amount).toBe(toAtomic("4.98", 12));
    expect(p.plan.destinations[1].amount).toBe(DEV_TIP_ATOMIC);
  });

  it("confidential-asset merge moves full asset balance, fee+tip from native", () => {
    const CA = "aaaa000000000000000000000000000000000000000000000000000000000002";
    const plan = buildMergePlan({
      targetAccountId: "target",
      targetAddress: TARGET_ADDR,
      assetId: CA,
      fee,
      sources: [
        {
          accountId: "a",
          label: "A",
          unlockedAsset: toAtomic("42", 6),
          unlockedNativeZano: toAtomic("1", 12), // enough for fee + tip
        },
      ],
    });
    const p = plan.participants[0];
    expect(p.movedAmount).toBe(toAtomic("42", 6));
    expect(p.plan.destinations[0].assetId).toBe(CA);
    expect(p.plan.destinations[1].assetId).toBe(ZANO_ASSET_ID); // tip native
  });

  it("never makes the target a source of itself", () => {
    const plan = buildMergePlan({
      targetAccountId: "target",
      targetAddress: TARGET_ADDR,
      assetId: ZANO_ASSET_ID,
      fee,
      sources: [
        {
          accountId: "target",
          label: "Target",
          unlockedAsset: toAtomic("5", 12),
          unlockedNativeZano: toAtomic("5", 12),
        },
      ],
    });
    expect(plan.participants).toHaveLength(0);
    expect(plan.excluded).toHaveLength(0);
  });
});
