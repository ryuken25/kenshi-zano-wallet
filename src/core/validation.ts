/** Address + transfer validation (§4: validation everywhere). */
import type { Atomic } from "./amounts";
import type { Destination } from "./types";

/**
 * Zano addresses are Base58, start with "Z" (standard), "i" (integrated/auditable)
 * or "a" (auditable), and are long. We do a structural check — the wallet RPC is
 * the final authority, but this catches typos and empty fields before signing.
 */
const ZANO_ADDR = /^[Zia][1-9A-HJ-NP-Za-km-z]{90,120}$/;

export function isValidAddress(addr: string): boolean {
  return typeof addr === "string" && ZANO_ADDR.test(addr.trim());
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validate a set of destinations for a single signed transfer.
 * - every address well-formed
 * - every amount strictly > 0
 * - no self-send to the source primary address (guards accidental loops)
 */
export function validateDestinations(
  destinations: Destination[],
  sourceAddress: string,
): ValidationResult {
  const errors: string[] = [];
  if (destinations.length === 0) errors.push("No destinations specified.");
  destinations.forEach((d, i) => {
    if (!isValidAddress(d.address)) {
      errors.push(`Destination ${i + 1}: invalid Zano address.`);
    }
    if (d.amount <= 0n) {
      errors.push(`Destination ${i + 1}: amount must be greater than zero.`);
    }
    if (d.address.trim() === sourceAddress.trim()) {
      errors.push(`Destination ${i + 1}: cannot send to your own source address.`);
    }
  });
  return { ok: errors.length === 0, errors };
}

/** Guard a single amount against an asset's declared decimal precision is done at
 * parse time (toAtomic). This helper validates a positive atomic amount. */
export function isPositiveAtomic(a: Atomic): boolean {
  return typeof a === "bigint" && a > 0n;
}
