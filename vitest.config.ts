import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "gmt",
    globals: true,
    environment: "node",
    include: ["packages/gmt/src/**/*.test.ts"],
    setupFiles: [
      path.resolve(import.meta.dirname, "packages/gmt/src/test/setupTests.ts"),
    ],
  },
});
