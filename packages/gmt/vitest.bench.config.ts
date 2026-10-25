import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Vitest 5 prints a benchmark row's figures (ops/s, mean, percentiles) only in verbose mode.
    reporters: ["verbose"],
    setupFiles: [path.resolve(import.meta.dirname, "src/test/setupTests.ts")],
    benchmark: {
      include: ["bench/**/*.bench.ts"],
    },
  },
});
