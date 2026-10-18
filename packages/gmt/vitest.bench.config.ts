import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: [path.resolve(import.meta.dirname, "src/test/setupTests.ts")],
    benchmark: {
      include: ["bench/**/*.bench.ts"],
    },
  },
});
