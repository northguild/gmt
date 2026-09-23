import { defineConfig } from "oxlint";
import { recommendedRules } from "@northguild/gmt-oxlint";

/**
 * `pnpm --filter dox lint` runs bare `oxlint` with this directory as the
 * working directory, and oxlint auto-discovers a config only from the directory
 * it runs in — so the root `oxlint.config.mts` never applies here. This is that
 * file's dox-scoped twin; the rules are the shared `recommendedRules`, so they
 * cannot drift.
 *
 * `.astro` files are absent because oxlint cannot parse them, which is why
 * `src/lib/date-ban.test.ts` scans the source as well as running these rules.
 */
export default defineConfig({
  jsPlugins: ["@northguild/gmt-oxlint"],
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "**/*.tsbuildinfo",
    "**/out/**",
    ".astro/**",
    "src/generated/**",
    "src/content/docs/reference/**",
    // DOX-C0 (#171): vendored, unmodified shadcn/AI Elements registry source —
    // reviewed as "copied from upstream", not linted as our own.
    "src/components/ui/**",
    "src/components/ai-elements/**",
  ],
  rules: {
    ...recommendedRules,
    "no-unused-vars": "warn",
  },
});
