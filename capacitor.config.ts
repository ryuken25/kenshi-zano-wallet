import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wrapper config (§1.7). After `npm run build`, run:
 *   npx cap add android      # one-time, requires Android SDK
 *   npm run cap:sync         # copies dist/ into the android project
 *   npm run cap:apk          # ./gradlew assembleDebug -> debug-signed APK
 *
 * The generated APK lands at android/app/build/outputs/apk/debug/app-debug.apk;
 * the build script copies it into dist/ and prints its size + sha256 (see
 * scripts/after-apk.mjs and BUILD_NOTES.md).
 */
const config: CapacitorConfig = {
  appId: "id.kenshi.zano.wallet",
  appName: "Kenshi",
  webDir: "dist",
  android: {
    allowMixedContent: true, // permit user http nodes (LAN zanod); https preferred
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
