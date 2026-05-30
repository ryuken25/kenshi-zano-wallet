/**
 * In-memory unlock session + auto-lock (§1.1 auto-lock, §1.8a, §5).
 *
 * The password lives ONLY here, in a module-private variable, while unlocked. It is
 * wiped on lock. Two Pearl bug-fixes are baked in:
 *   (a) AUTO-LOCK ON FULL RELOAD — we never persist the unlocked state, and we mark
 *       a sessionStorage flag so a reload always starts locked. (Reproduced as a
 *       deliberate invariant, not an accident.)
 *   (b) ASYNC SEED RACE — seed reveal is gated behind an explicit ready promise so
 *       the UI only renders the seed after state is loaded (see ui/screens/Seed).
 */
import { log } from "./logger";

type Listener = (unlocked: boolean) => void;

let password: string | null = null;
let lastActivity = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let autoLockMs = 5 * 60 * 1000;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l(password !== null);
}

export function onLockChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function isUnlocked(): boolean {
  return password !== null;
}

/** Returns the in-memory password. Throws if locked — callers must handle. */
export function requirePassword(): string {
  if (password === null) throw new Error("Wallet is locked.");
  return password;
}

export function configureAutoLock(ms: number): void {
  autoLockMs = ms;
  if (password !== null) touch();
}

export function unlock(pw: string): void {
  password = pw;
  touch();
  notify();
  log.info("session unlocked");
}

export function lock(): void {
  // Best-effort wipe. JS strings are immutable so we can't zero memory, but we drop
  // the only reference and clear timers/flags so it becomes collectable (§5).
  password = null;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  try {
    sessionStorage.removeItem("kenshi.session");
  } catch {
    /* non-browser env */
  }
  notify();
  log.info("session locked");
}

/** Record user activity and (re)arm the idle timer. */
export function touch(): void {
  if (password === null) return;
  lastActivity = Date.now();
  try {
    // Never store the password — only a heartbeat. A FULL RELOAD wipes the
    // in-memory password regardless, so reload always lands locked (§1.8a).
    sessionStorage.setItem("kenshi.session", String(lastActivity));
  } catch {
    /* ignore */
  }
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    log.info("auto-lock: idle timeout");
    lock();
  }, autoLockMs);
}

/** Wire DOM activity listeners. Idempotent-ish; call once on app mount. */
export function installActivityListeners(): void {
  if (typeof window === "undefined") return;
  const handler = () => touch();
  ["click", "keydown", "mousemove", "touchstart", "visibilitychange"].forEach((ev) =>
    window.addEventListener(ev, handler, { passive: true }),
  );
}
