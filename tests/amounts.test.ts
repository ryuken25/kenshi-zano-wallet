import { describe, it, expect } from "vitest";
import {
  toAtomic,
  fromAtomic,
  sumAtomic,
  checkBalance,
  AmountError,
} from "../src/core/amounts";

describe("integer base-unit amount math", () => {
  it("round-trips Zano native (12 decimals)", () => {
    const a = toAtomic("100", 12);
    expect(a).toBe(100_000_000_000_000n);
    expect(fromAtomic(a, 12)).toBe("100");
  });

  it("handles fractional values without float error", () => {
    expect(toAtomic("0.01", 12)).toBe(10_000_000_000n);
    expect(fromAtomic(10_000_000_000n, 12)).toBe("0.01");
    expect(toAtomic("0.000000000001", 12)).toBe(1n);
  });

  it("honors a different asset's decimalPoint (no hardcoding)", () => {
    // A hypothetical 6-decimal Confidential Asset.
    expect(toAtomic("1.5", 6)).toBe(1_500_000n);
    expect(fromAtomic(1_500_000n, 6)).toBe("1.5");
  });

  it("rejects too many decimals (would silently truncate value)", () => {
    expect(() => toAtomic("1.1234567", 6)).toThrow(AmountError);
  });

  it("rejects negative and malformed amounts", () => {
    expect(() => toAtomic("-1", 12)).toThrow(AmountError);
    expect(() => toAtomic("1.2.3", 12)).toThrow(AmountError);
    expect(() => toAtomic("abc", 12)).toThrow(AmountError);
    expect(() => toAtomic("", 12)).toThrow(AmountError);
  });

  /**
   * PEARL PARITY (§1.4): the old build verified "100 + 0.5 + fee = 100.50000396"
   * in screenshots. We reproduce that exact arithmetic here in integer base units
   * to keep the same math rigor. That example used 8-decimal units, so:
   *   amount = 100, tip = 0.5, fee = 0.00000396  =>  100.50000396
   */
  it("reproduces Pearl's verified 100 + 0.5 + fee = 100.50000396", () => {
    const DEC = 8;
    const amount = toAtomic("100", DEC);
    const tip = toAtomic("0.5", DEC);
    const fee = toAtomic("0.00000396", DEC);
    const total = sumAtomic([amount, tip, fee]);
    expect(total).toBe(10_050_000_396n);
    expect(fromAtomic(total, DEC)).toBe("100.50000396");
  });

  it("checkBalance computes shortfall correctly", () => {
    const ok = checkBalance({
      unlocked: toAtomic("101", 12),
      spend: toAtomic("100", 12),
      tip: toAtomic("0.01", 12),
      fee: toAtomic("0.01", 12),
    });
    expect(ok.ok).toBe(true);
    expect(ok.shortfall).toBe(0n);

    const short = checkBalance({
      unlocked: toAtomic("100", 12),
      spend: toAtomic("100", 12),
      tip: toAtomic("0.01", 12),
      fee: toAtomic("0.01", 12),
    });
    expect(short.ok).toBe(false);
    expect(short.shortfall).toBe(toAtomic("0.02", 12));
  });
});
