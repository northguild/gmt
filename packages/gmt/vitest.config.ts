import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Support running from repository root or package cwd
    include: ["packages/gmt/src/**/*.test.ts", "src/**/*.test.ts"],
    setupFiles: [path.resolve(__dirname, "src/test/setupTests.ts")],
  },
});
