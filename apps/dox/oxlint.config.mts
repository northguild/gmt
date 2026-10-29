import { defineConfig } from "oxlint";
import { recommendedRules } from "@northguild/gmt-oxlint";
import { LEGACY_TEST_FILES } from "./lint/legacy-test-files.mjs";
import { LEGACY_SRC_FILES } from "./lint/legacy-src-files.mjs";

const DOX_TEST_RULES = [
  "dox-test/no-dispatch-event",
  "dox-test/no-class-query",
  "dox-test/no-data-role",
  "dox-test/no-house-class",
  "dox-test/no-markup-read",
  "dox-test/no-implementation-assert",
] as const;

const DOX_SRC_RULES = [
  "dox-src/no-hand-markup",
  "dox-src/no-nth-selector",
  "dox-src/no-module-counter",
  "dox-src/no-define-at-top",
] as const;

/** Every jsx-a11y rule oxlint ships, at error. */
const JSX_A11Y_RULES = Object.fromEntries(
  [
    "jsx-a11y/alt-text",
    "jsx-a11y/anchor-ambiguous-text",
    "jsx-a11y/anchor-has-content",
    "jsx-a11y/anchor-is-valid",
    "jsx-a11y/aria-activedescendant-has-tabindex",
    "jsx-a11y/aria-props",
    "jsx-a11y/aria-proptypes",
    "jsx-a11y/aria-role",
    "jsx-a11y/aria-unsupported-elements",
    "jsx-a11y/autocomplete-valid",
    "jsx-a11y/click-events-have-key-events",
    "jsx-a11y/control-has-associated-label",
    "jsx-a11y/heading-has-content",
    "jsx-a11y/html-has-lang",
    "jsx-a11y/iframe-has-title",
    "jsx-a11y/img-redundant-alt",
    "jsx-a11y/interactive-supports-focus",
    "jsx-a11y/label-has-associated-control",
    "jsx-a11y/lang",
    "jsx-a11y/media-has-caption",
    "jsx-a11y/mouse-events-have-key-events",
    "jsx-a11y/no-access-key",
    "jsx-a11y/no-aria-hidden-on-focusable",
    "jsx-a11y/no-autofocus",
    "jsx-a11y/no-distracting-elements",
    "jsx-a11y/no-interactive-element-to-noninteractive-role",
    "jsx-a11y/no-noninteractive-element-interactions",
    "jsx-a11y/no-noninteractive-element-to-interactive-role",
    "jsx-a11y/no-noninteractive-tabindex",
    "jsx-a11y/no-redundant-roles",
    "jsx-a11y/no-static-element-interactions",
    "jsx-a11y/prefer-tag-over-role",
    "jsx-a11y/role-has-required-aria-props",
    "jsx-a11y/role-supports-aria-props",
    "jsx-a11y/scope",
    "jsx-a11y/tabindex-no-positive",
  ].map((rule) => [rule, "error"] as const),
);

const TEST_RULES = Object.fromEntries(
  [
    ...[
      "prefer-screen-queries",
      "no-node-access",
      "no-container",
      "prefer-user-event",
      "await-async-events",
      "await-async-queries",
      "prefer-find-by",
      "no-unnecessary-act",
      "no-wait-for-side-effects",
      "prefer-presence-queries",
      "prefer-query-by-disappearance",
    ].map((rule) => `testing-library/${rule}`),
    ...[
      "prefer-checked",
      "prefer-empty",
      "prefer-enabled-disabled",
      "prefer-focus",
      "prefer-in-document",
      "prefer-pressed",
      "prefer-required",
      "prefer-to-have-attribute",
      "prefer-to-have-class",
      "prefer-to-have-style",
      "prefer-to-have-text-content",
      "prefer-to-have-value",
    ].map((rule) => `jest-dom/${rule}`),
    ...DOX_TEST_RULES,
  ].map((rule) => [rule, "error"] as const),
);

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
  // Listing `plugins` replaces the defaults, so the three defaults are named again.
  plugins: ["typescript", "unicorn", "oxc", "jsx-a11y"],
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
    ...JSX_A11Y_RULES,
    // `<HiveNode role="assistant">` passes a prop named `role` to a component, not an ARIA role.
    "jsx-a11y/aria-role": ["error", { ignoreNonDOM: true }],
    "no-unused-vars": "warn",
  },
  overrides: [
    // Mounts and widgets stay on the component kit.
    {
      files: ["src/lib/**/*.ts", "src/widgets/**/*.{ts,tsx}"],
      jsPlugins: ["./lint/dox-src-rules.mjs"],
      rules: Object.fromEntries(
        DOX_SRC_RULES.map((rule) => [rule, "error"] as const),
      ),
    },
    // Mounts not yet on the kit. Explicit paths, no globs; the list only shrinks
    // (`lint/legacy-src-files.mjs`).
    {
      files: [...LEGACY_SRC_FILES],
      rules: Object.fromEntries(
        DOX_SRC_RULES.map((rule) => [rule, "off"] as const),
      ),
    },
    // Widget tests stay on the test kit (`src/test/render-widget.ts`). The community
    // plugins catch what they can trace to Testing Library; `dox-test` catches the raw DOM.
    {
      files: ["src/**/*.test.{ts,tsx}"],
      jsPlugins: [
        "eslint-plugin-testing-library",
        "eslint-plugin-jest-dom",
        "./lint/dox-test-rules.mjs",
      ],
      rules: {
        ...TEST_RULES,
      },
    },
    // The kit itself builds events and listens by hand; that is its job.
    {
      files: ["src/test/render-widget.ts"],
      jsPlugins: ["./lint/dox-test-rules.mjs"],
      rules: Object.fromEntries(
        DOX_TEST_RULES.map((rule) => [rule, "off"] as const),
      ),
    },
    // Test files not yet on the kit. Explicit paths, no globs; the list only shrinks
    // (`lint/legacy-test-files.mjs`).
    {
      files: [...LEGACY_TEST_FILES],
      rules: Object.fromEntries(
        Object.keys(TEST_RULES).map((rule) => [rule, "off"] as const),
      ),
    },
  ],
});
