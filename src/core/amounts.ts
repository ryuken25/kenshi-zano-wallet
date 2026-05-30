/**
 * Integer base-unit amount math.
 *
 * RULE (Pearl parity + §4 stability): every amount is carried as a BigInt of the
 * asset's smallest unit ("atomic units"). We NEVER do float arithmetic on money.
 * Floats are only ever produced at the very last step for display, and only via a
 * decimal-string formatter that itself uses integer math.
 *
 * Each asset declares its own `decimalPoint` (Zano native = 12). Nothing here
 * hardcodes a decimal count, so any present or future Confidential Asset works
 * unchanged (§2.1).
 */

export type Atomic = bigint;

/** Thrown for any malformed amount input. Callers surface this as a toast. */
export class AmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmountError";
  }
}

const DIGITS = /^[0-9]+$/;

/**
 * Parse a human decimal string (e.g. "100.5") into atomic units for an asset with
 * `decimals` decimal places. Rejects anything that isn't a clean non-negative
 * decimal, and rejects more fractional digits than the asset supports (which would
 * otherwise silently truncate value).
 */
export function toAtomic(human: string, decimals: number): Atomic {
  if (typeof human !== "string") throw new AmountError("Amount must be a string");
  const trimmed = human.trim();
  if (trimmed === "") throw new AmountError("Amount is empty");
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new AmountError(`Invalid decimals: ${decimals}`);
  }

  const neg = trimmed.startsWith("-");
  if (neg) throw new AmountError("Amount cannot be negative");

  const [intPart, fracPartRaw = ""] = trimmed.split(".");
  if (trimmed.split(".").length > 2) throw new AmountError("Malformed amount");

  const intDigits = intPart === "" ? "0" : intPart;
  if (!DIGITS.test(intDigits)) throw new AmountError(`Malformed integer part: "${intPart}"`);
  if (fracPartRaw !== "" && !DIGITS.test(fracPartRaw)) {
    throw new AmountError(`Malformed fractional part: "${fracPartRaw}"`);
  }
  if (fracPartRaw.length > decimals) {
    throw new AmountError(
      `Too many decimal places: asset supports ${decimals}, got ${fracPartRaw.length}`,
    );
  }

  const fracPadded = fracPartRaw.padEnd(decimals, "0");
  const combined = `${intDigits}${fracPadded}`.replace(/^0+(?=\d)/, "");
  return BigInt(combined === "" ? "0" : combined);
}

/**
 * Format atomic units back to a human decimal string, trimming trailing zeros but
 * keeping at least one digit after the point only when there is a fractional value.
 */
export function fromAtomic(atomic: Atomic, decimals: number): string {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new AmountError(`Invalid decimals: ${decimals}`);
  }
  const neg = atomic < 0n;
  const abs = neg ? -atomic : atomic;
  const s = abs.toString().padStart(decimals + 1, "0");
  const cut = s.length - decimals;
  const intPart = s.slice(0, cut);
  let fracPart = s.slice(cut).replace(/0+$/, "");
  const out = fracPart === "" ? intPart : `${intPart}.${fracPart}`;
  return neg ? `-${out}` : out;
}

/** Sum a list of atomic amounts. */
export function sumAtomic(values: Atomic[]): Atomic {
  return values.reduce((acc, v) => acc + v, 0n);
}

/**
 * Pre-flight balance check used by send / multi-send / merge (§4).
 * Returns whether `unlocked >= spend + tip + fee`, plus the shortfall when short.
 * All four arguments are atomic units of the SAME asset (native Zano for fees/tip).
 */
export interface BalanceCheck {
  ok: boolean;
  required: Atomic;
  shortfall: Atomic; // 0n when ok
}

export function checkBalance(parts: {
  unlocked: Atomic;
  spend: Atomic;
  tip: Atomic;
  fee: Atomic;
}): BalanceCheck {
  const required = parts.spend + parts.tip + parts.fee;
  const ok = parts.unlocked >= required;
  return { ok, required, shortfall: ok ? 0n : required - parts.unlocked };
}
