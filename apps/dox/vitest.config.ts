import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // DOX-C0 (#171): mirrors tsconfig.json's `~/*` path mapping, which Astro
    // resolves on its own but Vitest does not. Without this, tests reach
    // generated files by absolute path instead of `~/...` — wire it rather
    // than keep doing that by accident.
    alias: {
      "~": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    name: "dox",
    globals: true,
    root: ".",
    include: ["scripts/**/*.test.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
