# Slice 8b — cascade layers, zero `!important`, Stylelint, jsx-a11y, the markup lint

The global sheets move into cascade layers, so a widget's CSS Module (unlayered) always wins
and no rule needs `!important`. Stylelint becomes the CSS gate inside `pnpm lint`. Oxlint gains
jsx-a11y for the `/dox` TSX, plus a source rule that stops mounts hand-typing kit markup.

## Current state (verified)

- `astro.config.mjs:306-373` `customCss` lists 67 sheets, all unlayered.
- Starlight is layered (`starlight.core`, `starlight.components`; Pagefind at `Search.astro:295`;
  Expressive Code `cascadeLayer: 'starlight.components'`). It imports user CSS first, so a user
  `@layer` statement sets the order. Its one unlayered rule is `Page.astro:56`.
- Chat sheets load from `DoxChat.tsx:17-19`. `gmt-ask-tailwind.css:15` declares
  `@layer theme, base, components, utilities;`, while `gmt-ask.css` and `gmt-hive.css` are
  unlayered so that they beat Tailwind. `katex.min.css` is imported unlayered in
  `ai-elements/message.tsx`.
- Nine Astro `<style>` blocks are unlayered: Head, UpstreamDefects, Footer, WhyDateBug,
  BundleSize, WhyDateAlternatives, ButtonLink, SectionHeading and `pages/dox.astro`. Eight
  already use `@layer starlight.core` or `starlight.components`.
- `vite.build.cssTarget` is `["chrome107","edge107","firefox104","safari16"]`.
- `!important`: 29 hits, which are 23 declarations and 6 comments (appendix A). Other counts:
  `outline: none` or `0` ×20, `font-size: <n>px` ×12, `z-index` ×37, hand-written
  `-webkit-backdrop-filter` ×37, `-webkit-mask*` ×6, `transition` ×74 and `animation` ×43.
- jsx-a11y in oxlint 1.78 has 36 rules. Enabled on `src`, outside `components/ui/**`, they find
  seven errors in six files (list below).

## 1 · Layer order

Create `src/styles/gmt.css` as the only `customCss` entry. Its first statement names the
order. Then it imports each sheet in today's `customCss` order:

```css
@layer starlight, theme, base, components, utilities, vendor,
  gmt.tokens, gmt.base, gmt.shell, gmt.content, gmt.controls, gmt.tools, gmt.chat,
  gmt.thirdparty, gmt.a11y;
@import "./gmt-tokens.css" layer(gmt.tokens);
/* … one import per sheet, each in its layer … */
```

- Tailwind's four layers are named here, so they sort before `gmt` on every page, including
  `/dox`.
- `gmt.thirdparty` holds only rules for DOM we do not render: Starlight, Pagefind, and chart
  and map library output (`gmt-charts.css`, the map tooltip shell). Every element we render is
  styled by a CSS Module (slices 8c–11).
- Import `katex.min.css` as `layer(vendor)` from `gmt-ask-tailwind.css`, and delete the JS
  import.
- Import `gmt-ask.css` and `gmt-hive.css` as `layer(gmt.chat)` from a `src/styles/chat.css`
  that `DoxChat.tsx` imports.
- Vite inlines `@import … layer()` through postcss-import, as Starlight's Pagefind import shows.
- Delete the six `!important` comments. Rewrite the layer note at the top of `gmt-hive.css`.
- **Unlayered Astro styles now beat the global sheets.** For each of the nine blocks, list every
  selector that a global sheet also styles. Move each one into `@layer gmt.shell`, or move the
  global rule into the component. Prove the result with `visual-diff` (below).

## 2 · Every `!important`, by cause

Fix each row of [appendix A](./08b-appendix.md#a--every-important-by-cause). Prove each removal
with `getComputedStyle` before and after, in Chromium, both themes, one element per row.

## 3 · Stylelint (the CSS gate)

Install exact versions: `stylelint` 17.16.0, `stylelint-config-standard` 40.0.0,
`stylelint-plugin-use-baseline` 1.4.7 (1.4.8 is under two weeks old), `stylelint-use-logical`
2.1.3, `@double-great/stylelint-a11y` 3.8.1, `stylelint-declaration-strict-value` 1.12.1 and
`postcss-html` 1.8.1 (for `.astro`). Each peer range admits Stylelint 17.

Create `apps/dox/stylelint.config.mjs`, and set the script to
`"lint": "oxlint && stylelint \"src/**/*.{css,astro}\""`.

The rules and their settings are in [appendix B](./08b-appendix.md#b--stylelint-rules).
They apply to every sheet, third-party layer included, `declaration-no-important` too.

**Baseline target: 2024** ([decided](./index.md#decided)). Set `vite.build.cssTarget` to
`["chrome130","edge130","firefox132","safari18.2"]`. `corner-shape` and cross-document view
transitions stay progressive enhancements. esbuild emits any prefix still needed, so delete the
37 hand-written `-webkit-backdrop-filter` and the 6 `-webkit-mask*`.

Replace the 20 `outline: none` with nothing. The ring is `outline` on `:focus-visible`, which
survives forced colours, where `box-shadow` does not. Replace the 12 px font sizes with `rem`.
Add `--gmt-z-*` scale tokens that keep today's 37 values in order.

If `plugin/use-baseline` reports `prefers-reduced-transparency`, give that block a described
disable comment: engines without the query ignore it.

**Legacy list.** The rules that 9a–11 retire (`nth-*`, specificity, logical properties, strict
values, module-only rules) are off for the sheets that break them today, in one by-path
`overrides` entry with no globs. It only shrinks; slice 11 deletes it.

## 4 · Oxlint: jsx-a11y and the markup rule

- In `oxlint.config.mts`, add `plugins: ["typescript", "unicorn", "oxc", "jsx-a11y"]`. Listing
  `plugins` replaces the defaults, so name them. Take every `jsx_a11y` rule from
  `oxlint --rules --format json` at `"error"`.
- Set `jsx-a11y/aria-role` with `{ ignoreNonDOM: true }`: `<HiveNode role="assistant">` is a
  prop, not ARIA.
- Fix the findings:
  - `role="status"` becomes `<output>` at `MountedWidget.tsx:188`, `chat-warning.tsx:134` and
    `DoxChat.tsx:617` and `:644`.
  - `prompt-input.tsx:1392`: rename the dead `eslint-plugin-jsx-a11y(...)` disable comment to
    `jsx-a11y/heading-has-content`, with its reason.
  - `RailResizer.tsx:168`: the APG [Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
    needs a focusable separator. Use `<hr>` if it can carry the `tabindex` and `aria-value*`
    attributes with no children. Otherwise, add a disable comment that cites the pattern.
- **`apps/dox/lint/dox-src-rules.mjs`** (local JS plugin), for `src/lib/**` and `src/widgets/**`,
  with the four rules in [appendix C](./08b-appendix.md#c--dox-src-rulesmjs). Mounts that break
  a rule today go on a by-path legacy list that only shrinks.

## 5 · The footer surface and the display font (causes 5 and 9b)

- **Cause 5, the footer.** Starlight's last-updated line (`footer .meta`, styled in
  `Footer.astro:35-41`) and the licence note sit on whatever is behind them. Give `footer` an
  opaque `--gmt-surface-page` token (`color-mix()` over `--gmt-void`, both themes, same colour
  as today) in `gmt.shell`. Its text contrast then depends only on that token. The
  `layout-moved-during-measure` guard (slice 5) still catches late growth above it.
- **Cause 9b, the font swap.** `@font-face` for Michroma (`gmt-tokens.css:468-476`) uses
  `font-display: swap` over a monospace fallback, so text widens when the font arrives. Add a
  `"Michroma Fallback"` face, `src: local(...)` from the mono stack, whose `size-adjust` makes its
  advance match Michroma on digits, `:`, `−`, `T`, `Z` and capitals. Measure the ratio in
  Chromium with a script and record it beside the rule. `--gmt-font-display` becomes `"Michroma", "Michroma Fallback", <mono stack>`.
  Line heights of display text are unitless tokens, so the swap cannot change a block size.
  Do not use `ascent-override`: it is not Baseline.
- The widget side of 9b (reserved sizes, `<gmt-grow>`) lands in 9a, 9c, 10e and 10f.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, with Stylelint inside.
2. `rg -n '!important' apps/dox/src` returns nothing.
3. Capture `visual-diff` and `html-diff` baselines on a build of HEAD before step 1. After the
   change, run every page of both gates in Chromium, in both themes, at 390 and 1440. Explain
   each `✗` or each pixel change in the report, then capture again.
4. Run the full slice-index gate command (`--browsers chromium`).
5. In the Chromium gates `a11y-axe`, `a11y-tab-walk` and `contrast-measure`, with forced colours,
   `prefers-contrast` and reduced motion emulated, no new finding appears.
6. Run `node scripts/verdict.mjs validate`. Paste `npx browserslist "baseline 2024"` beside
   the new `cssTarget`.
7. **Reduced motion.** Every `transition` and `animation` duration in the touched sheets reads a
   `--gmt-duration-*` or `--gmt-motion-*` token, and each token is `0s` under
   `prefers-reduced-motion: reduce` (Stylelint `declaration-strict-value` proves it). In
   Chromium with reduced motion emulated, `getAnimations()` on `/`, `/dox/` and one tool page
   returns only finished or zero-length animations.
8. **Z-index tokens.** Every `z-index` in `apps/dox/src` reads a `--gmt-z-*` token, and the
   stacking order of header, sidebar, rail, dialogs and toasts is unchanged in `visual-diff`.
9. **Logical properties.** `csstools/use-logical` passes on every sheet off the legacy list.
   The whole tree passes it in slice 11.
10. **Map tooltip.** Before-and-after screenshots of the `/why-gmt/` map tooltip on hover, in
    both themes, go to the owner. Slice 9a starts only after the owner approves them.
11. **Footer and font.** The `contrast-measure` cell for the footer `time` on the #429 pages
    passes in both themes at 1440, and `grow-measure` on `/tools/moving-feasts/` shows no frame
    where the deepest resized element changed because of `document.fonts` loading. Paste the
    `size-adjust` measurement.
