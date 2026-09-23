import { defineConfig } from "oxlint";
import { recommendedRules } from "@northguild/gmt-oxlint";

/**
 * The `@northguild/gmt-oxlint` rules are the point of this file: a library that
 * exists because `Date` is the wrong tool for a date has no business calling it.
 *
 * Three things are load-bearing and easy to break:
 *
 * - **The filename.** Oxlint auto-discovers `.oxlintrc.json`, `.oxlintrc.jsonc`,
 *   `oxlint.config.ts` and `oxlint.config.mts` — and nothing else. Named
 *   `oxlint.config.js`, this file was silently never loaded.
 * - **The default export is an object**, not an array. `defineConfig([...])`
 *   type-checks but oxlint refuses it at load time.
 * - **`jsPlugins` takes specifiers**, which oxlint resolves itself; handing it an
 *   imported plugin object does not register the rules.
 *
 * `apps/dox` has its own copy of this, because oxlint only auto-discovers from
 * the directory it runs in and that package lints itself. `.astro` and `.mdx`
 * are deliberately absent — oxlint cannot parse either — which is why
 * `apps/dox/src/lib/date-ban.test.ts` scans the source as well.
 */
export default defineConfig({
  jsPlugins: ["@northguild/gmt-oxlint"],
  // `ignorePatterns`, not `files: { include, ignore }` — oxlint rejects the
  // latter outright. There is no include list: oxlint walks what the CLI is
  // pointed at, and lints the extensions it can parse.
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "**/*.tsbuildinfo",
    "**/out/**",
    "apps/dox/.astro/**",
    "apps/dox/src/generated/**",
    "apps/dox/src/content/docs/reference/**",
    // DOX-C0 (#171): vendored shadcn registry source. `ui/**` is genuinely untouched — 18
    // files, no local pragmas, no `Date` — so it is reviewed as copied, not linted as ours.
    // `ai-elements/**` is deliberately NOT exempt. It was modified before it landed (all 15
    // oxlint pragmas were in the vendoring commit) and again after, and its own README says
    // we re-theme every component there. It lints clean today (CORE-8 review, #253).
    "apps/dox/src/components/ui/**",
    // The plugins' own fixtures and matchers necessarily name the APIs they ban.
    "packages/gmt-oxlint/**",
    "packages/gmt-eslint/**",
    "packages/gmt-biome/**",
  ],
  rules: {
    ...recommendedRules,
    // Was `noUnusedImports` / `noUnusedVariables` — Biome's names, which oxlint
    // rejects. It has one rule covering both, so the two severities collapse
    // into the weaker of them.
    "no-unused-vars": "warn",
  },
});
