// Vitest setup. jsdom provides WebCrypto via Node's global crypto in modern Node,
// but ensure it's present for keystore tests.
import { webcrypto } from "node:crypto";

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  // @ts-expect-error assign node webcrypto to global
  globalThis.crypto = webcrypto;
}
