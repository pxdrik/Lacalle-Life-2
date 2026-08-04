import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // `fake-indexeddb/auto` installs a spec-compliant IndexedDB onto
    // globalThis, so the real adapter is exercised rather than mocked away.
    setupFiles: ["./vitest.setup.ts"],
  },
});
