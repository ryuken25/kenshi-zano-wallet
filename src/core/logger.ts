/**
 * Local-only, secret-redacting logger (§4, §5).
 * Keeps a bounded in-memory ring of recent events for a crash card. Nothing is
 * transmitted. Known-sensitive substrings are scrubbed before storage.
 */

type Level = "info" | "warn" | "error";

interface LogEntry {
  t: number;
  level: Level;
  msg: string;
}

const RING_MAX = 200;
const ring: LogEntry[] = [];

/** Patterns we never want to land in a log line. */
const SEED_WORDS = /\b([a-z]+\s+){11,}[a-z]+\b/gi; // 12+ lowercase words = likely a seed
const LONG_B58 = /\b[1-9A-HJ-NP-Za-km-z]{40,}\b/g; // long base58 (addresses/keys)

export function redact(input: string): string {
  return input
    .replace(SEED_WORDS, "[REDACTED_SEED]")
    .replace(LONG_B58, (m) => `${m.slice(0, 6)}…[REDACTED]`)
    .replace(/("?(?:password|seed|secret|privkey|spend_key|view_key)"?\s*[:=]\s*)("?)[^"\s,}]+/gi,
      "$1$2[REDACTED]");
}

function push(level: Level, parts: unknown[]) {
  const msg = redact(parts.map((p) => (typeof p === "string" ? p : safeStr(p))).join(" "));
  ring.push({ t: Date.now(), level, msg });
  if (ring.length > RING_MAX) ring.shift();
  // Mirror to console in dev only; still redacted.
  if (import.meta.env?.DEV) console[level](`[kenshi] ${msg}`);
}

function safeStr(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const log = {
  info: (...p: unknown[]) => push("info", p),
  warn: (...p: unknown[]) => push("warn", p),
  error: (...p: unknown[]) => push("error", p),
};

export function getLogs(): readonly LogEntry[] {
  return ring;
}

export function clearLogs(): void {
  ring.length = 0;
}
