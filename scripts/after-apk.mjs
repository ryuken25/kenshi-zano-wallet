/**
 * Copies the freshly-built debug APK into dist/ and prints its size + sha256 so
 * BUILD_NOTES.md can record a verifiable artifact (§7). Run after `npm run cap:apk`.
 */
import { copyFileSync, statSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const src = resolve("android/app/build/outputs/apk/debug/app-debug.apk");
if (!existsSync(src)) {
  console.error("APK not found. Run `npm run cap:apk` first (needs Android SDK).");
  process.exit(1);
}
mkdirSync("dist", { recursive: true });
const dest = resolve("dist/kenshi-debug.apk");
copyFileSync(src, dest);
const buf = readFileSync(dest);
const sha = createHash("sha256").update(buf).digest("hex");
console.log(`APK: ${dest}`);
console.log(`size: ${(statSync(dest).size / 1_048_576).toFixed(2)} MiB`);
console.log(`sha256: ${sha}`);
