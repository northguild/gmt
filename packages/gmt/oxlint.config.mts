import { defineConfig } from "oxlint";
import { recommendedRules } from "@northguild/gmt-oxlint";
import {
  CORE_NESTED_RULE,
  CORE_RULE,
  POLYFILL_RULE,
  PUBLIC_RULE,
} from "./oxlint.boundary.mts";

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
  overrides: [
    {
      // CORE-80: `internal/temporal.ts` is the one file that names the Temporal implementation.
      files: ["src/**", "bench/**"],
      rules: { "no-restricted-imports": POLYFILL_RULE },
    },
    {
      // PUBLIC_RULE: a public function never calls another public function (coding-standards § Loop cost).
      files: ["src/**"],
      rules: { "no-restricted-imports": PUBLIC_RULE },
    },
    {
      // CORE_RULE: an internal core never imports a public module.
      files: ["src/internal/*.ts", "src/regex/*.ts", "src/types/*.ts"],
      rules: {
        "no-restricted-imports": CORE_RULE,
      },
    },
    {
      // CORE_NESTED_RULE: the same for `internal/*/**`.
      files: ["src/internal/*/**"],
      rules: {
        "no-restricted-imports": CORE_NESTED_RULE,
      },
    },
    {
      // Barrels, tests and browser entries may import public modules; they keep the polyfill ban.
      files: [
        "src/**/index.ts",
        "src/**/*.test.ts",
        "src/test/**",
        "src/**/*.browser.ts",
      ],
      rules: { "no-restricted-imports": POLYFILL_RULE },
    },
    {
      files: ["src/internal/temporal.ts"],
      rules: { "no-restricted-imports": "off" },
    },
  ],
});
