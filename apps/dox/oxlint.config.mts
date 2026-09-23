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
    // DOX-C0 (#171): vendored shadcn registry source. `ui/**` is genuinely untouched — 18
    // files, no local pragmas, no `Date` — so it is reviewed as copied, not linted as ours.
    // `ai-elements/**` is deliberately NOT exempt. It was modified before it landed (all 15
    // oxlint pragmas were in the vendoring commit) and again after, and its own README says
    // we re-theme every component there. It lints clean today (CORE-8 review, #253).
    "src/components/ui/**",
  ],
  rules: {
    ...recommendedRules,
    "no-unused-vars": "warn",
  },
});
