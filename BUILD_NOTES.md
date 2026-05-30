# BUILD_NOTES

Honest record of what was built, what was verified here, and what you must run on a
properly-provisioned machine. This project was assembled in an **ephemeral Linux
container** with Node 22, Rust 1.94, Java 21, Gradle 8.14 — but **no Android SDK**
and **no Windows toolchain / WebView2**, and **no live Zano daemon**. So the web
core is fully built + tested here; the APK and EXE are scaffolded with verified
configs and one-command build recipes for a real build host.

## ✅ Verified in this environment

| Artifact | Status | Detail |
|---|---|---|
| Web/PWA bundle (`dist/`) | **BUILT** | `vite build` OK. JS ≈ **194 KiB** (66 KiB gzip), CSS ≈ 4.7 KiB. |
| Unit tests | **30 / 30 PASS** | `vitest run` — amount math, dev tip, merge, keystore, RPC. |
| Typecheck | **PASS** | `tsc -b --noEmit` clean. |
| Playwright walkthrough | **PASS** | 10 screenshots in `/screenshots`. |
| Icon set | **GENERATED** | 8 PWA sizes + 10 Android mipmaps (`npm run icons`). |

Web bundle (this build — hashes change per build):
- `dist/assets/index-*.js`  sha256 `86ff03837c98c81360c4601d7d3c763fcc39f7928ab7b6e441702eb681f85d69`
- `dist/assets/index-*.css` sha256 `c9a5216ac927bf3540d444f091c4d35831ff1441166cc8c421702b829a69cb6a`

## 📱 Android APK (Capacitor) — recipe, needs Android SDK

The wrapper config (`capacitor.config.ts`) is committed; the icon set is in
`android-notes/res/`. On a host with the Android SDK + `ANDROID_HOME` set:

```bash
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap add android        # creates android/ (one-time)
npm run cap:sync           # copy dist/ into the android project
npm run cap:apk            # ./gradlew assembleDebug  -> expect "BUILD SUCCESSFUL"
node scripts/after-apk.mjs # copies app-debug.apk -> dist/kenshi-debug.apk + prints size/sha256
```

Could **not** run here: `npx cap add android` requires the Android SDK, which is not
installed in this container (`ANDROID_HOME` unset). Gradle 8.14 and JDK 21 are
present, so the Gradle half of the toolchain is ready.

## 🪟 Windows EXE (Tauri 2) — recipe, needs Windows/WebView2 host

The Rust crate is committed under `src-tauri/` (`Cargo.toml`, `tauri.conf.json`,
`src/main.rs`, `build.rs`). Tauri chosen over Electron: small binary, Rust core, low
crash surface, clean sidecar support for bundling `zanod`.

On a Windows host (or cross-build host) with Rust + WebView2:

```bash
npm install
npm install -D @tauri-apps/cli
npm run build
npm run tauri:build        # -> NSIS installer + MSI under src-tauri/target/release/bundle/
```

Could **not** run here: building the Windows EXE needs the Windows target toolchain
+ WebView2 (and a Linux→Windows cross setup is non-trivial). The config targets
`nsis` + `msi`. The `zanod` sidecar hook is stubbed in `main.rs` (`zanod_status`);
drop the `zanod` binary into `externalBin` to enable local-privacy sync.

## 🔌 RPC deviations from a literal Pearl port

- **No Bitcoin crypto.** Pearl's BIP-39 / Taproot / `signPearlTx` are **not** ported.
  Signing/derivation are delegated to Zano's wallet RPC (`simplewallet`); the app
  builds the `transfer` `destinations[]` and the daemon/wallet performs the crypto.
- **Single signed multi-output.** Multi-send, the dev tip, and each merge leg are
  one `transfer` call with a `destinations[]` array — natively multi-output and
  multi-asset, exactly matching the spec's "one signed tx → many outputs".
- **Receive address.** Uses the wallet's `getaddress` primary address only; no
  sub-address generation (matches §1.3).
- **Fee for pre-flight.** The real fee is set by the wallet at sign time; the
  `≤ balance` pre-flight uses a conservative `DEFAULT_FEE = 0.01 ZANO`
  (`src/core/constants.ts`). Adjust there if your node's policy differs.
- **Merge per-wallet balances.** The merge math (exclusion + moved amount) is exact
  and unit-tested. The preview currently reads the active wallet's loaded balances
  as the per-source figure because the wallet-RPC here is single-active-wallet; a
  multi-wallet daemon connection would query each source's `getbalance`. Noted as a
  faithful-equivalent per the megaprompt's §0.
- **Pearl math check.** The verified `100 + 0.5 + fee = 100.50000396` example is
  reproduced in `tests/amounts.test.ts` using integer base units (8-decimal, as in
  the original screenshots). Zano native math uses 12 decimals throughout.
