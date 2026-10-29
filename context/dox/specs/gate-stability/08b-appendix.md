# Slice 8b appendix — the tables

[Slice 8b](./08b-cascade-and-lint.md) links each table here.

## A · Every `!important`, by cause

| Where | Today | Fix |
|---|---|---|
| `gmt-a11y.css:50-51`, `:62-63` | reduced transparency: `backdrop-filter: none` | Each blur reads `var(--gmt-glass-blur)`. Under `(prefers-reduced-transparency: reduce)`, set it to `none` on `:root, ::backdrop`. |
| `gmt-a11y.css:104` | `prefers-contrast`: `*{text-shadow:none}` | All 19 `text-shadow` declarations read `var(--gmt-text-glow)`, which is `none` under `(prefers-contrast: more)`. |
| `gmt-controls.css:430-432` | the reduced-motion `*` blanket | Durations come from `--gmt-duration-*` and `--gmt-motion-*`, which are `0s` under reduced motion. Keep the blanket, without `!important`, in `gmt.a11y`: as the last layer it beats every Starlight and Tailwind rule. |
| `gmt-delivery-scheduler.css:525-526`, `gmt-charts.css:269-270` | scoped `animation/transition: none` | Delete them: the tokens and the blanket cover these. Pass TanStack Charts `motion: false` when `matchMedia("(prefers-reduced-motion: reduce)")` matches. |
| `gmt-map.css:53` | beats the inline `display:grid` on `.ts-chart-tooltip__row` (`@tanstack/charts` 0.16.0 `tooltip.js:500`) | Delete the rule and use the library's grid. Return `title` plus rows from `tooltip.content` (`timezone-map.ts:198`). The owner approves before-and-after screenshots (8b done line 10). |
| `gmt-light.css:145` | Card `.title` colour | Starlight's Card is in `starlight.components`, so a plain declaration wins. Drop the flag. |
| `dox.css:20` | `.sl-container` max-width | The `max-width` rule is in `starlight.core`. The plain declaration wins from `gmt.shell`. |
| `dox.css:335`, `:340` | `.card-grid` columns | CardGrid is in `starlight.components`. Drop the flag. |
| `gmt-content.css:168-169`, `:175`, `:198` | Pagefind form and input | Pagefind is in `starlight.core`. Drop the flag. Replace `#starlight__search` with `site-search`, because ids are banned. |
| `gmt-column-timestamp-bridge.css:24` | `[hidden]{display:none}` | The module rule is `&[hidden] { display: none }` on the field class (slice 9a). Until then, use a plain rule at (0,2,0). |
| `gmt-dst-inspector.css:71` | empty-cell padding vs `.gmt-widget td` | The module class is unlayered and wins (slice 9b). Until then, the plain rule in `gmt.tools` wins on specificity. |

## B · Stylelint rules

| Rule | Setting |
|---|---|
| `declaration-no-important` | `true` for every file, with no exceptions |
| `selector-pseudo-class-disallowed-list` | `nth-child`, `nth-last-child`, `nth-of-type`, `nth-last-of-type`, `global` |
| `selector-max-id` | `0` |
| `selector-max-specificity` | `"0,3,0"` (modules), `"0,4,1"` (global) |
| `selector-no-qualifying-type` | `true` |
| `selector-class-pattern` (modules) | `^[a-z][a-zA-Z0-9]*$`, so no `gmt-` class is used across widgets |
| `color-no-hex`, `color-named: "never"`, `function-disallowed-list` `rgb`, `rgba`, `hsl`, `hsla`, `hwb`, `lab`, `lch`, `oklab`, `oklch` | modules only. Colour comes from tokens, through `color-mix()` or relative `color(from var(…))`. |
| `csstools/use-logical` | `"always"` |
| `property-no-vendor-prefix`, `value-no-vendor-prefix`, `selector-no-vendor-prefix` | on. The `ignoreSelectors` list is the range-thumb, `::-webkit-scrollbar*`, `::-webkit-details-marker` and `::-webkit-calendar-picker-indicator` pseudo-elements, which have no standard form. |
| `declaration-property-value-disallowed-list` | `outline: ["none", "0"]`, `outline-style: ["none"]`, and a negative `margin*` in modules |
| `declaration-property-unit-allowed-list` | `font-size: ["rem", "em", "%"]`, `ignore: ["inside-function"]` (for `clamp()`) |
| `scale-unlimited/declaration-strict-value` | `z-index`, `transition-duration`, `animation-duration`, `text-shadow`, `backdrop-filter` must be `var()` (`expandShorthand: true`) |
| `a11y/media-prefers-reduced-motion`, `a11y/selector-pseudo-class-focus`, `a11y/font-size-is-readable` | on |
| `plugin/use-baseline` | `available: 2024`, `ignoreProperties: {"corner-shape": []}`, `ignoreAtRules: ["view-transition"]`. Features inside `@supports` pass. |
| `reportDescriptionlessDisables`, `reportNeedlessDisables` | `true` |

## C · `dox-src-rules.mjs`

  | Rule | Reports |
  |---|---|
  | `no-hand-markup` | a string or template literal that contains `<section`, `role="slider"`, `<output`, `type="range"`, `type="checkbox"`, `type="radio"` or `class="gmt-` outside `src/widgets/**` |
  | `no-nth-selector` | `:nth-` in a string |
  | `no-module-counter` | a top-level `let` that is assigned a number in a `*-mount.ts` |
  | `no-define-at-top` | `customElements.define` outside a function |
