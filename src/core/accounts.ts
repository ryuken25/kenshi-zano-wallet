/**
 * Multi-account manager (§1.5).
 *
 * Persists a list of accounts + their encrypted seed blobs. ONE shared password
 * unlocks all of them; it is held in memory only while unlocked (session.ts) and
 * never written to disk. Changing the password re-encrypts every account's blob.
 *
 * Storage is abstracted behind a tiny KV interface so the same code runs on web
 * (localStorage), Capacitor (Preferences) and Tauri (fs) — the UI injects one.
 */
import { encryptSecret, decryptSecret, type EncryptedBlob } from "./keystore";
import type { Account } from "./types";

export interface KV {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

const STORE_KEY = "kenshi.accounts.v1";

interface StoredAccount extends Account {
  blob: EncryptedBlob;
}

interface StoreShape {
  accounts: StoredAccount[];
  activeId: string | null;
}

export class AccountStore {
  constructor(private kv: KV) {}

  private async load(): Promise<StoreShape> {
    const raw = await this.kv.get(STORE_KEY);
    if (!raw) return { accounts: [], activeId: null };
    try {
      return JSON.parse(raw) as StoreShape;
    } catch {
      // Corrupt store: do NOT throw away silently — surface empty and let the UI
      // warn. (We never overwrite until an explicit successful save.)
      return { accounts: [], activeId: null };
    }
  }

  private async save(shape: StoreShape): Promise<void> {
    await this.kv.set(STORE_KEY, JSON.stringify(shape));
  }

  async list(): Promise<Account[]> {
    const { accounts } = await this.load();
    return accounts.map(({ blob: _blob, ...pub }) => pub);
  }

  async getActiveId(): Promise<string | null> {
    return (await this.load()).activeId;
  }

  async setActive(id: string): Promise<void> {
    const shape = await this.load();
    if (!shape.accounts.some((a) => a.id === id)) throw new Error("Unknown account.");
    shape.activeId = id;
    await this.save(shape);
  }

  /** Import an account from its seed, encrypting the seed under `password`. */
  async importAccount(args: {
    label: string;
    seed: string;
    primaryAddress: string;
    password: string;
  }): Promise<Account> {
    const shape = await this.load();
    const id = cryptoRandomId();
    const blob = await encryptSecret(args.seed, args.password);
    const stored: StoredAccount = {
      id,
      label: args.label,
      primaryAddress: args.primaryAddress,
      blob,
    };
    shape.accounts.push(stored);
    if (!shape.activeId) shape.activeId = id;
    await this.save(shape);
    const { blob: _b, ...pub } = stored;
    return pub;
  }

  /** Remove an account. If it was active, activate the first remaining one. */
  async removeAccount(id: string): Promise<void> {
    const shape = await this.load();
    shape.accounts = shape.accounts.filter((a) => a.id !== id);
    if (shape.activeId === id) shape.activeId = shape.accounts[0]?.id ?? null;
    await this.save(shape);
  }

  /** Decrypt and return a single account's seed (memory only — never persisted). */
  async revealSeed(id: string, password: string): Promise<string> {
    const shape = await this.load();
    const acct = shape.accounts.find((a) => a.id === id);
    if (!acct) throw new Error("Unknown account.");
    return decryptSecret(acct.blob, password);
  }

  /**
   * Verify the password unlocks at least one account (used at unlock). Returns
   * true if any account decrypts. With zero accounts, any password is accepted
   * (first-run onboarding) — the UI gates import separately.
   */
  async verifyPassword(password: string): Promise<boolean> {
    const shape = await this.load();
    if (shape.accounts.length === 0) return true;
    for (const a of shape.accounts) {
      try {
        await decryptSecret(a.blob, password);
        return true;
      } catch {
        /* try next */
      }
    }
    return false;
  }

  /** Re-encrypt every account's seed under a new password (§1.5). Atomic: the
   * new store is only written after all re-encryptions succeed. */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const shape = await this.load();
    const reencrypted: StoredAccount[] = [];
    for (const a of shape.accounts) {
      const seed = await decryptSecret(a.blob, oldPassword); // throws on wrong pw
      const blob = await encryptSecret(seed, newPassword);
      reencrypted.push({ ...a, blob });
    }
    await this.save({ ...shape, accounts: reencrypted });
  }
}

function cryptoRandomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `acct_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
