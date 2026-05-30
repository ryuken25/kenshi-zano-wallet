import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "../src/core/keystore";
import { AccountStore, type KV } from "../src/core/accounts";

class MemKV implements KV {
  private m = new Map<string, string>();
  get(k: string) {
    return this.m.get(k) ?? null;
  }
  set(k: string, v: string) {
    this.m.set(k, v);
  }
  remove(k: string) {
    this.m.delete(k);
  }
}

const SEED =
  "tattoo sketch ozone vanish jealous bicycle yellow narrate plug victory humble omen rinse";

describe("keystore (PBKDF2 + AES-GCM)", () => {
  it("encrypts and decrypts round-trip", async () => {
    const blob = await encryptSecret(SEED, "hunter2");
    expect(blob.kdf).toBe("PBKDF2");
    expect(blob.ct).not.toContain(SEED);
    const out = await decryptSecret(blob, "hunter2");
    expect(out).toBe(SEED);
  });

  it("fails to decrypt with the wrong password", async () => {
    const blob = await encryptSecret(SEED, "right");
    await expect(decryptSecret(blob, "wrong")).rejects.toThrow();
  });

  it("never stores plaintext seed in the persisted blob", async () => {
    const blob = await encryptSecret(SEED, "pw");
    const serialized = JSON.stringify(blob);
    expect(serialized).not.toContain("tattoo");
    expect(serialized).not.toContain("victory");
  });
});

describe("account store (§1.5)", () => {
  const ADDR =
    "Zaddr11111111111111111111111111111111111111111111111111111111111111111111111111111111111111";

  it("imports, lists, switches and removes accounts", async () => {
    const store = new AccountStore(new MemKV());
    const a = await store.importAccount({
      label: "Main",
      seed: SEED,
      primaryAddress: ADDR,
      password: "pw",
    });
    const b = await store.importAccount({
      label: "Savings",
      seed: SEED + " two",
      primaryAddress: ADDR,
      password: "pw",
    });
    expect((await store.list()).map((x) => x.label)).toEqual(["Main", "Savings"]);
    expect(await store.getActiveId()).toBe(a.id);
    await store.setActive(b.id);
    expect(await store.getActiveId()).toBe(b.id);
    await store.removeAccount(b.id);
    expect((await store.list()).map((x) => x.label)).toEqual(["Main"]);
    expect(await store.getActiveId()).toBe(a.id);
  });

  it("list() never leaks the encrypted blob", async () => {
    const store = new AccountStore(new MemKV());
    await store.importAccount({ label: "X", seed: SEED, primaryAddress: ADDR, password: "pw" });
    const list = await store.list();
    expect((list[0] as unknown as Record<string, unknown>).blob).toBeUndefined();
  });

  it("change-password re-encrypts all accounts atomically", async () => {
    const store = new AccountStore(new MemKV());
    const a = await store.importAccount({ label: "A", seed: SEED, primaryAddress: ADDR, password: "old" });
    await store.changePassword("old", "new");
    // old password no longer works, new does
    await expect(store.revealSeed(a.id, "old")).rejects.toThrow();
    expect(await store.revealSeed(a.id, "new")).toBe(SEED);
  });

  it("verifyPassword accepts any password on first run (no accounts)", async () => {
    const store = new AccountStore(new MemKV());
    expect(await store.verifyPassword("anything")).toBe(true);
  });
});
