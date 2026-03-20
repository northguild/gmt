import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "gmt",
    globals: true,
    environment: "node",
    include: ["packages/gmt/src/**/*.test.ts"],
  },
});
