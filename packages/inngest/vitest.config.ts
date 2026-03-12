import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@meridian/types": path.resolve(__dirname, "../types/src/index.ts"),
      "@meridian/api": path.resolve(__dirname, "../api/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    // Integration tests that hit real APIs are slower; allow up to 30s per test
    testTimeout: 30_000,
  },
});
