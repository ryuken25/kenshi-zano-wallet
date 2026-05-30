/**
 * Encrypted keystore at rest (§1.1, §5).
 *
 * Secrets (seed phrases) are encrypted with AES-GCM using a key derived from the
 * user's password via PBKDF2-SHA256. We NEVER persist plaintext keys, and the
 * password / derived key live only in memory while unlocked (see session.ts).
 *
 * Format (JSON, safe to store in localStorage / file):
 *   { v, kdf: "PBKDF2", hash, iterations, salt(b64), iv(b64), ct(b64) }
 */

const PBKDF2_ITERATIONS = 250_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedBlob {
  v: 1;
  kdf: "PBKDF2";
  hash: "SHA-256";
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64 ciphertext (includes GCM tag)
}

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) throw new Error("WebCrypto unavailable in this environment");
  return c;
}

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Copy a view into a standalone ArrayBuffer — a guaranteed `BufferSource` for
 * WebCrypto under the stricter DOM lib typings (never a SharedArrayBuffer). */
function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    ab(enc.encode(password)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ab(salt), iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt a UTF-8 plaintext (e.g. a seed phrase) under `password`. */
export async function encryptSecret(
  plaintext: string,
  password: string,
): Promise<EncryptedBlob> {
  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ab(iv) },
    key,
    ab(new TextEncoder().encode(plaintext)),
  );
  return {
    v: 1,
    kdf: "PBKDF2",
    hash: "SHA-256",
    iterations: PBKDF2_ITERATIONS,
    salt: b64encode(salt),
    iv: b64encode(iv),
    ct: b64encode(new Uint8Array(ct)),
  };
}

/** Decrypt a blob. Throws on wrong password (GCM auth failure) — caller shows a
 * generic "wrong password" error without logging the attempt value (§5). */
export async function decryptSecret(
  blob: EncryptedBlob,
  password: string,
): Promise<string> {
  const crypto = getCrypto();
  const salt = b64decode(blob.salt);
  const iv = b64decode(blob.iv);
  const key = await deriveKey(password, salt, blob.iterations);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ab(iv) },
      key,
      ab(b64decode(blob.ct)),
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("Decryption failed — wrong password or corrupted keystore.");
  }
}
