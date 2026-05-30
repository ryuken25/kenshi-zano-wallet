import { describe, it, expect } from "vitest";
import { buildTransfer, buildSingleSend, preflight } from "../src/core/txbuilder";
import { toAtomic } from "../src/core/amounts";
import {
  DEV_TIP_ADDRESS,
  DEV_TIP_ATOMIC,
  ZANO_ASSET_ID,
} from "../src/core/constants";

const CA = "aaaa000000000000000000000000000000000000000000000000000000000001"; // fake confidential asset

describe("transfer builder + dev tip (§3)", () => {
  it("appends dev tip as one extra native destination when enabled", () => {
    const plan = buildSingleSend({
      fromAccountId: "acct1",
      to: "Zdest11111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
      amount: toAtomic("5", 12),
      assetId: ZANO_ASSET_ID,
      fee: toAtomic("0.01", 12),
      includeDevTip: true,
    });
    expect(plan.destinations).toHaveLength(2);
    const tip = plan.destinations[1];
    expect(tip.address).toBe(DEV_TIP_ADDRESS);
    expect(tip.amount).toBe(DEV_TIP_ATOMIC);
    expect(tip.assetId).toBe(ZANO_ASSET_ID);
    expect(plan.includesDevTip).toBe(true);
  });

  it("omits dev tip when disabled", () => {
    const plan = buildSingleSend({
      fromAccountId: "acct1",
      to: "Zdest11111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
      amount: toAtomic("5", 12),
      assetId: ZANO_ASSET_ID,
      fee: toAtomic("0.01", 12),
      includeDevTip: false,
    });
    expect(plan.destinations).toHaveLength(1);
    expect(plan.includesDevTip).toBe(false);
  });

  it("tip is native even when sending a confidential asset (mixed)", () => {
    const plan = buildTransfer({
      fromAccountId: "acct1",
      destinations: [{ address: "Zdest", amount: toAtomic("2", 6), assetId: CA }],
      fee: toAtomic("0.01", 12),
      includeDevTip: true,
    });
    expect(plan.destinations[1].assetId).toBe(ZANO_ASSET_ID);
    expect(plan.destinations[1].amount).toBe(DEV_TIP_ATOMIC);
  });

  it("preflight fails when native cannot cover outputs + tip + fee", () => {
    const plan = buildTransfer({
      fromAccountId: "acct1",
      destinations: [{ address: "Zd", amount: toAtomic("100", 12), assetId: ZANO_ASSET_ID }],
      fee: toAtomic("0.01", 12),
      includeDevTip: true,
    });
    const r = preflight(plan, { [ZANO_ASSET_ID]: toAtomic("100", 12) });
    expect(r.ok).toBe(false);
    // need 100 + 0.01 tip + 0.01 fee = 100.02
    expect(r.requiredByAsset[ZANO_ASSET_ID]).toBe(toAtomic("100.02", 12));
  });

  it("preflight passes with sufficient native + asset balances", () => {
    const plan = buildTransfer({
      fromAccountId: "acct1",
      destinations: [{ address: "Zd", amount: toAtomic("2", 6), assetId: CA }],
      fee: toAtomic("0.01", 12),
      includeDevTip: true,
    });
    const r = preflight(plan, {
      [ZANO_ASSET_ID]: toAtomic("1", 12), // covers tip + fee (0.02)
      [CA]: toAtomic("2", 6),
    });
    expect(r.ok).toBe(true);
  });
});
