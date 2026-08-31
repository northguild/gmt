import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "dox",
    globals: true,
    root: ".",
    include: ["scripts/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
  },
});
