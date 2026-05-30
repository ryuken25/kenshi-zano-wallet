import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Content-Security-Policy enforced for the dev server and emitted into index.html
// for production builds (see index.html <meta http-equiv>). The connect-src is kept
// tight; node URLs are validated at runtime by the RPC allowlist (src/core/rpc.ts).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2021",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
