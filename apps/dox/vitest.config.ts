import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "dox",
    globals: true,
    environment: "node",
    root: ".",
    include: ["scripts/**/*.test.ts"],
  },
});
