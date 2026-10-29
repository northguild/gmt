/**
 * Stylelint: the Dox CSS gate, run by `pnpm lint` (`stylelint "src/**\/*.{css,astro}"`).
 *
 * - `declaration-no-important` binds every file, third-party layer included.
 * - `LEGACY_FILES` is the by-path list of files that still break a legacy rule.
 *   It has no globs and only shrinks.
 * - `*.module.css` files (src/widgets/**) are held to the strictest set.
 */

/** Vendor-prefixed selectors with no standard form. */
const NO_STANDARD_FORM = [
  "/^::-webkit-slider-/",
  "/^::-moz-range-/",
  "/^::-webkit-scrollbar/",
  "::-webkit-details-marker",
  "::-webkit-calendar-picker-indicator",
  "::-webkit-search-cancel-button",
  "::-moz-focus-inner",
  "::-moz-selection",
];

const NO_STANDARD_FORM_PROPS = [
  "/^-webkit-(scrollbar|mask)/",
  "-webkit-text-size-adjust",
];

/** Rules every sheet must pass today. */
const baseRules = {
  // Durations must be tokens; see the note on `a11y/media-prefers-reduced-motion` above.
  "scale-unlimited/declaration-strict-value": [
    [
      "z-index",
      "transition-duration",
      "animation-duration",
      "text-shadow",
      "backdrop-filter",
    ],
    {
      ignoreValues: ["none", "0s", "auto", "0", "inherit", "/^-?\\d+$/"],
      expandShorthand: true,
    },
  ],
  // Module classes are named `gmt-<file>__<local>` with no hash, so a global sheet could reach
  // them. A global class never has `__`; a module sheet is exempt below.
  "selector-disallowed-list": [/\.gmt-[a-z0-9-]+__/],
  "declaration-no-important": true,
  "selector-max-id": 0,
  "selector-no-qualifying-type": [true, { ignore: ["attribute"] }],
  "property-no-vendor-prefix": [
    true,
    { ignoreProperties: NO_STANDARD_FORM_PROPS },
  ],
  "value-no-vendor-prefix": true,
  "selector-no-vendor-prefix": [true, { ignoreSelectors: NO_STANDARD_FORM }],
  "declaration-property-value-disallowed-list": {
    outline: ["none", "0"],
    "outline-style": ["none"],
  },
  "declaration-property-unit-allowed-list": [
    { "font-size": ["rem", "em", "%"] },
    { ignore: ["inside-function"] },
  ],
  "a11y/selector-pseudo-class-focus": true,
  "a11y/font-size-is-readable": true,
  "plugin/use-baseline": [
    true,
    {
      available: 2024,
      // Progressive enhancements: a browser without them shows a working page. Each one
      // is a feature that is not yet Baseline 2024 and has no standard replacement.
      ignoreProperties: {
        "corner-shape": ["/^.+$/"],
        "forced-color-adjust": ["/^.+$/"],
        "user-select": ["/^.+$/"],
        "overscroll-behavior": ["/^.+$/"],
        resize: ["/^.+$/"],
        "position-anchor": ["/^.+$/"],
        "position-try-fallbacks": ["/^.+$/"],
        "view-transition-name": ["/^.+$/"],
        "scrollbar-color": ["/^.+$/"],
        "accent-color": ["/^.+$/"],
      },
      ignoreSelectors: ["selection", "marker", "/^view-transition/"],
      ignoreAtRules: ["view-transition"],
    },
  ],
};

/**
 * Standard-config rules that fight the house design, off for every sheet:
 * - class, id and custom-property patterns: Starlight and Astro own names such as
 *   `--__sidebar-pad`; module classes get their own pattern below.
 * - `no-duplicate-selectors`, `no-descending-specificity`: cascade layers, not source order,
 *   decide which sheet wins, and the same selector recurs across media blocks by design.
 */
const standardOff = {
  // Reduced motion is guaranteed by tokens, not per-rule overrides (08b-appendix.md row 12).
  // `scale-unlimited/declaration-strict-value` (below, expandShorthand) forces every
  // transition and animation duration to be a `var(--gmt-*duration*)` token, and
  // gmt-tokens.css sets all of those tokens to 0s in its top-level
  // `prefers-reduced-motion: reduce` block. The a11y rule only looks for a
  // reduced-motion media query beside the declaration, so it cannot see that guarantee.
  "a11y/media-prefers-reduced-motion": null,
  // Token readers in src/test parse six-digit hex only.
  "color-hex-length": "long",
  "selector-class-pattern": null,
  "selector-id-pattern": null,
  "custom-property-pattern": null,
  "no-duplicate-selectors": null,
  "no-descending-specificity": null,
  "import-notation": "string",
  "selector-pseudo-class-no-unknown": [
    true,
    { ignorePseudoClasses: ["global"] },
  ],
  "at-rule-no-unknown": [
    true,
    { ignoreAtRules: ["source", "theme", "utility", "custom-variant"] },
  ],
};

/** Rules each sheet meets once its widget moves onto the kit. Off only for LEGACY_FILES. */
const legacyRules = {
  "selector-pseudo-class-disallowed-list": [
    [
      "nth-child",
      "nth-last-child",
      "nth-of-type",
      "nth-last-of-type",
      "global",
    ],
  ],
  "selector-max-specificity": "0,4,1",
  "csstools/use-logical": "always",
};

/**
 * Files that still break a `legacyRules` rule. Exact paths, no globs. A file leaves the list
 * when it moves onto the kit; the list only shrinks.
 */
const LEGACY_FILES = [
  "src/components/Footer.astro",
  "src/components/Header.astro",
  "src/components/LinkButton.astro",
  "src/components/SidebarSublist.astro",
  "src/styles/dox.css",
  "src/styles/gmt-a11y.css",
  "src/styles/gmt-bl-date-stamp.css",
  "src/styles/gmt-content.css",
  "src/styles/gmt-cron-in-a-zone.css",
  "src/styles/gmt-cutoff-widgets.css",
  "src/styles/gmt-elapsed-vs-clock.css",
  "src/styles/gmt-form-controls.css",
  "src/styles/gmt-gnss-rollover-checker.css",
  "src/styles/gmt-leap-day-birthday.css",
  "src/styles/gmt-ledger-widgets.css",
  "src/styles/gmt-migrate.css",
  "src/styles/gmt-primitives.css",
  "src/styles/gmt-reveal.css",
  "src/styles/gmt-satellite-clock-converter.css",
  "src/styles/gmt-timetable-reader.css",
  "src/styles/gmt-widget.css",
];

/** Colour comes from tokens in a module: no literal, and no negative margin nudge. */
const moduleRules = {
  "selector-max-specificity": "0,3,0",
  "selector-class-pattern": [
    "^[a-z][a-zA-Z0-9]*$",
    { resolveNestedSelectors: false },
  ],
  "color-no-hex": true,
  "color-named": "never",
  "function-disallowed-list": [
    "rgb",
    "rgba",
    "hsl",
    "hsla",
    "hwb",
    "lab",
    "lch",
    "oklab",
    "oklch",
  ],
  "declaration-property-value-disallowed-list": {
    outline: ["none", "0"],
    "outline-style": ["none"],
    "/^margin/": ["/^-/"],
  },
};

/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  reportDescriptionlessDisables: true,
  reportNeedlessDisables: true,
  plugins: [
    "stylelint-plugin-use-baseline",
    "stylelint-use-logical",
    "@double-great/stylelint-a11y",
    "stylelint-declaration-strict-value",
  ],
  rules: {
    ...standardOff,
    ...baseRules,
    ...legacyRules,
  },
  overrides: [
    { files: ["**/*.astro"], customSyntax: "postcss-html" },
    // Its only <style> is filled at build time from set:html, so the source holds no CSS.
    {
      files: ["src/components/Head.astro"],
      rules: { "no-empty-source": null },
    },
    {
      files: LEGACY_FILES,
      rules: Object.fromEntries(Object.keys(legacyRules).map((r) => [r, null])),
    },
    {
      files: ["**/*.module.css"],
      rules: {
        ...legacyRules,
        ...moduleRules,
        "selector-disallowed-list": null,
      },
    },
  ],
};
