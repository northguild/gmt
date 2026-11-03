# Slice 1 · Header and mark

[Index](./index.md) · Binding rules: [built.md § Tier 3](../../built.md#tier-3--hud-chrome),
[built.md § Base `/gmt`](../../built.md#tiers-01--site-generator-ai-surface-brand-guides),
[design-system.md § `/dox` and the header](../../reference/design-system.md#dox-and-the-header).

## Goal

The Dox header shows the same mark, the same "NorthGuild" wordmark and the same bar height as the
northguild.dev header. Someone who clicks from northguild.dev to /gmt sees the left of the bar stay
the same.

## The northguild.dev header, as measured

Live measurements, matched pixel for pixel in [`prototype/proto.css.txt`](./prototype/proto.css.txt)
and [`header.js.txt`](./prototype/header.js.txt) (port the values; never its `innerHTML` swap):

- `header.site-header`: `block-size: 3.5rem` (56 px), padding `.75rem 1rem`, background teal at
  10 % alpha, `backdrop-filter: blur(4px)`, one bottom border of 1 px cyan at 18 % alpha, its
  `::before` and `::after` hidden.
- Left: one inline-flex link, gap 1.5rem: the mark at 1.75rem tall, then "NorthGuild" in Michroma
  1rem, `line-height: 1.6`, `letter-spacing: .04em`, `#cfeaf2` (`--gmt-ice`), hidden below 30rem.
  On northguild.dev the wordmark is a bare text node; slice 5's companion wraps it.
- Right: GitHub and Discord icon buttons. The site is dark only.
- In the preview, on both `/` and `/gmt/`: mark at 16, 14, 21 × 28 and wordmark at 61, 15,
  118 × 26 (x, y, width × height in CSS px, at 1440×900).

## Mark

Replace the filled badge with the site's ice-frost mark. Create `src/assets/northguild-mark.svg`
from the paths below (viewBox `0 0 1000 1317`): the pane, the sheen, the inner pane, the edge,
the ridge and the glyph. Keep them verbatim, because the two sites must draw the same shape.

```text
pane   M500 0 L0 179.1 L0 709.1 C0 1018.6 373.1 1206.2 500 1317 C626.9 1206.2 1000 1018.6 1000 709.1 L1000 179.1 Z
sheen  M500 0 L0 179.1 L0 709.1 C0 1018.6 373.1 1206.2 500 1317 Z
inner  M93.3 243.9 L500 99 L906.7 243.9 L906.7 686.5 L709.3 390.2 L654.9 470.3 L500 239.5 L345.1 470.3 L290.7 390.2 L93.3 686.5 Z
edge   (same d as pane)
ridge  M93.3 686.5 L290.7 390.2 L345.1 470.3 L500 239.5 L654.9 470.3 L709.3 390.2 L906.7 686.5
glyph  M366 640 L212 736.5 L366 833 M634 640 L788 736.5 L634 833 M560 560 L443 910
```

Paint, all from `--gmt-ice`:

- Pane gradient: top stop-opacity .07, bottom 0, vertical.
- Sheen gradient: top .05, bottom 0 at offset .7, diagonal.
- Edge and ridge: stroke 1 px with `vector-effect: non-scaling-stroke`, opacity .5 and .35.
- Glyph: stroke width 36, opacity .75, round joins and caps, no fill.
- `forced-colors: active`: every stroke `CanvasText`, fills `none`.

`NorthGuildMark.astro` inlines the SVG and rewrites both gradient ids with a per-instance suffix
(`ng-mark-pane-<n>`), so two marks on one page never share an id. The SVG is `aria-hidden` and
`focusable="false"`. Remove the old badge rules from `gmt-primitives.css` (lines 229–271) and
`gmt-a11y.css` (the two rules around lines 134 and 187). Replace them with the rules above.

## Header layout

`Header.astro` left group, in order:

1. One link, `href={LANDING_URL}`, class `gmt-ng-link gmt-sonar-focus`, `display: inline-flex`,
   `align-items: center`, gap 1.5rem, accessible name "NorthGuild home". It contains the mark
   (block-size 1.75rem) and a `span.gmt-ng-wordmark` "NorthGuild" (`var(--gmt-font-display)`
   1rem, `line-height: 1.6`, `letter-spacing: .04em`, `--gmt-ice`). Name the link
   with `aria-label="NorthGuild home"`: it starts with the visible text (WCAG 2.5.3 label in name)
   and still names the link when the wordmark hides on narrow screens. Drop the sr-only span and
   the `title`.
2. `span.gmt-ng-divider` (unchanged).
3. `<SiteTitle/>`, unchanged text, set in the wordmark's type. Add three tokens to
   `gmt-tokens.css`: `--gmt-wordmark-size: 1rem`, `--gmt-wordmark-tracking: .04em`,
   `--gmt-wordmark-leading: 1.6`. `.gmt-ng-wordmark` and `.site-title` (`gmt-shell.css`) both
   read them; `.site-title` drops `1.25rem` and `var(--gmt-tracking-tight)`. Both forms ("Give Me
   Temporal" and "GMT" below 50rem) inherit them.

Centre and right groups are unchanged.

- `--sl-nav-height: 3.5rem` at every width (today 64 px wide, 56 px narrow). Padding
  `0.75rem 1rem` at ≥50rem. Everything that reads `--sl-nav-height` (hero block size, sidebar,
  scroll padding) follows by itself; grep for hard-coded `64px` and `4rem` header offsets and fix
  each one.
- Glass: background `color-mix(in oklab, var(--gmt-teal) 10%, transparent)` over the existing
  void backing. `backdrop-filter: blur(4px)`, as on northguild.dev (Dox has 24 px today). The
  .92 void backing keeps docs text legible under it. Bottom border 1 px
  `rgb(34 211 238 / 18%)`; no other border. Starlight's and the HUD's `::before`/`::after` on
  the bar are `display: none`.
- Below 30rem, hide the wordmark text (`display: none` on `.gmt-ng-wordmark`); the link keeps its
  name through its `aria-label`. Then verify at 320, 375 and 390 px that the bar has no overflow
  (`scrollWidth === clientWidth` on `.header`) and that Search, the Dox button, the theme select
  and the language select are all reachable.

## Light theme

The header carries `gmt-theme-dark` on every page (index § Theme). Its glass sits on an
opaque `--gmt-void` backing at 0.92 alpha, so light page content scrolling under it never lowers
text contrast.

- Starlight's search button and dialog: the button sits inside the island and follows it. The
  dialog (`site-search` modal) renders inside the header in the DOM, so it inherits dark tokens.
  Verify the dialog in light theme with `a11y:axe` and `contrast:measure`. If it inherits
  incorrectly, scope it back to the page theme with `.gmt-theme-light` on the `dialog` element,
  and record which one shipped in `built.md`.
- `ThemeSelect` still switches the page theme; only the bar stays dark.

## Constraints

- `LANDING_URL` appears only in `<a href>`; the `dist-base` guard enforces this, and the URL does
  not change.
- Styles stay in `@layer starlight.core`, as the rest of `Header.astro`.
- The header keeps `view-transition-name: gmt-header` in this slice; slice 5 renames it.
- No left-border accents anywhere in the bar.

## Tests

- `NorthGuildMark.test.ts`: the six paths match the strings above exactly; two marks rendered in
  one page have distinct gradient ids; every `url(#…)` reference resolves to an id in the same
  SVG; the SVG is `aria-hidden` and `focusable="false"`.
- A header render test: the link's accessible name is "NorthGuild home" and starts with the
  visible text; the link is the first focusable after the skip link.
- `font-floor.test.ts` stays green with the 16 px wordmark.

## Definition of done

- [ ] Index gates pass. `contrast-measure` covers the header in both themes, including the open
      search dialog.
- [ ] At 1440×900 the bar is 56 px tall, measured with `getBoundingClientRect` on `.header`.
- [ ] At 1440×900 the mark measures 16, 14, 21 × 28 and the wordmark 61, 15, 118 × 26 on `/gmt/`,
      matching the preview's `/`; every edge within 0.5 px (slice 5's cross-site check keeps it).
- [ ] Computed `font-size`, `letter-spacing` and `line-height` of `.gmt-title-long` (and of
      `.gmt-title-short` at 390 px) equal the wordmark's: 16px, 0.64px, 25.6px, with the same
      vertical centre (±0.5 px).
- [ ] No horizontal overflow at 320, 375 and 390 px, on `/`, a guide and `/dox/`.
- [ ] `visual-diff`: only the header region changes on guide pages.
- [ ] Every use of `northguild-logo.svg` is gone and the file is deleted.
- [ ] `built.md` Tier 3 and `design-system.md` § `/dox` and the header describe the mark, the
      wordmark, the 3.5rem bar and the dark-island rule, in present tense.
