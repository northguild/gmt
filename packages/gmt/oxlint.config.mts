import { defineConfig } from "oxlint";
import { recommendedRules } from "@northguild/gmt-oxlint";

/**
 * `pnpm --filter @northguild/gmt lint` runs bare `oxlint` from this directory,
 * and oxlint auto-discovers a config only from the directory it runs in — so
 * the root `oxlint.config.mts` does not apply here. Without this file the
 * library linted with the built-in rules alone, which is the one place the
 * `Date` ban matters most: GMT exists because `Date` is the wrong tool.
 *
 * The rules are the shared `recommendedRules`, so they cannot drift from the
 * root config or from what the package publishes to its own consumers.
 */
export default defineConfig({
  jsPlugins: ["@northguild/gmt-oxlint"],
  ignorePatterns: [
    "**/node_modules/**",
    "dist/**",
    "coverage/**",
    "**/*.tsbuildinfo",
  ],
  rules: {
    ...recommendedRules,
    "no-unused-vars": "warn",
  },
});
