# Dox theme: implementation rules

The visual language ("maximal chrome, disciplined content surface") is
[visual-design.md](visual-design.md). This file holds the stylesheet rules. Scoped companions:

- [design-system-widgets.md](design-system-widgets.md): custom elements, form controls, smooth growth.
- [design-system-charts.md](design-system-charts.md): drawn charts and held-still readouts.
- [design-system-motion.md](design-system-motion.md): the entrance gesture, the landing entrance, the header.
- [design-system-chat.md](design-system-chat.md): the `/dox` chat island, its rail and Tailwind.

## The stylesheet stack

The theme is plain CSS custom properties, with no Tailwind outside the chat island. One `customCss`
entry, `src/styles/gmt.css`, sets the layer order and imports every sheet into a `gmt.*` layer, so a
later layer beats Starlight's defaults without `!important`. The core sheets import in this order:
`gmt-tokens.css` (palette, every `--gmt-*` token, `@font-face`, the light value block; custom
properties only), `gmt-theme.css` (maps `--gmt-*` onto `--sl-*`), `gmt-primitives.css` (reusable
recipes), `gmt-glass.css` (glass on Starlight's elements), `gmt-shell.css`, `gmt-content.css`,
`gmt-controls.css`, `gmt-light.css` (light overrides that are neither a re-tint nor next to a base
rule). `dox.css` and `gmt-a11y.css` load after these. `gmt.css` has the full list.

- A tool's own style is a CSS Module in `src/widgets/tools/`, a family's in `src/widgets/families/`.
  There is no per-tool global sheet. `gmt-widget-reset.css` holds the `not-content` restore, the
  syntax-token colours and the load-failure notice.
- Component `<style>` blocks stay in their `.astro` files, consume the tokens and never redefine them.
- The chat's sheets (`gmt-ask-tailwind.css`, `gmt-ask.css`, `gmt-hive.css`) are imported from
  `src/components/ask/DoxChat.tsx`, never from `customCss`, so no other page loads them.
- Prose tables (Markdown, `/compare/`, `/upstream/`, `/migrate/*`, `/bundle-size/`, the reference
  tables) take one style from `gmt-content-tables.css`, modelled on the kit `table` builder:
  - Body cells are weight 400 in the body font, the first column included. A row header differs by
    ink (`--gmt-ice` against `--gmt-ice-dim`), not by weight. Only `<code>` is monospace.
  - A status word is a kit chip (`badge()`), never a table-only class.
  - On a narrow box a row becomes an entry card. Its `data-col` label floats into the start padding
    (`--gmt-card-label`, 7rem), body font, `--gmt-text-xs`, weight 600, `--gmt-ice-dim`.
  - The chat's Markdown tables keep the island's own sheet.
- A checker's browser card has two-line offset heads: the label, then its note in `--gmt-ice-dim`,
  weight 400, no brackets, both `nowrap`. The note wraps at spaces only in a card under 25rem.
- A code frame that opens a tab panel is square at its start-start corner and bevelled on the other
  three. A frame lower in the panel keeps all four.
- **The heading font is inlined.** `gmt-tokens.css` names the Michroma file with Vite's `?inline`, so
  the `@font-face` carries a `data:font/woff2` URI, with `font-display: block` and no preload. An
  inline script (`src/lib/display-face.ts`) adds the same face to `document.fonts` before the held
  first paint, because Chromium and WebKit fetch a data-URI face only when layout asks. Any external
  font file, even preloaded, arrives after first layout in Firefox and moves the page. The Display
  Fallback face keeps `size-adjust: 130%` with `local("Liberation Mono")` so the fallback draws at
  the same advance.

## Tokens

Values live in `gmt-tokens.css`; these are the rules around them.

- **Palette:** `--gmt-void / cyan / spring / teal / ice / signal`, each re-tinted in the light block.
- `--gmt-glass-tint / -subtle / -scrim` carry extra alpha in light mode. Keep them apart from `--gmt-fill-*`.
- **Series tokens** (`--gmt-series-1` to `-4`, each with an `-ink` partner) colour one series of a
  chart. They alias palette colours, so they re-tint and need no light block. Series 3 and 4 inks
  reach only 5.7 to 6.7:1, so a series colour goes on marks, stems, edges and swatches, never on
  text. The series' name in `--gmt-ice` carries its meaning.
- **Polyfill tokens** (`--gmt-polyfill-shipped` green, `--gmt-polyfill-previous` slate grey)
  colour the two polyfills on `/bundle-size`. Each has one value for both themes and reaches 3:1
  against void, surface, surface-2 and the glass composite (`polyfill-tokens.test.ts`). They are
  not spring or signal: spring is the site's accent and amber is NO SIGNAL alone. Marks and
  swatches only, never text.
  - A `/bundle-size` bar is the token itself, not the `/why-gmt` gradient, so the colour matches
    the key. In the split chart the polyfill is solid and GMT's code is hatched in the same hue
    (`barHatch`). The shipped bar sits above the previous one by the report's `shipped` flag,
    never by position. Under forced colours the hatched edge goes dashed and the shipped bars
    take `CanvasText`. The key and the hidden summary name the packages in words.
- **Theme-role tokens** (`--gmt-code-surface`, `--gmt-sidebar-link`, ...) resolve to a different
  token per theme, so the rule that uses one needs no light block.
- **`-ink` tokens** are the text-safe variant of an accent (rule 6).
- **`--gmt-ice-dim`** is the muted text tier. Every `color:` use clears 7:1 in both themes on every
  surface it sits on (the worst-pixel method below proves it) and stays clearly quieter than
  `--gmt-ice`.
  - A widget never overrides the token for itself. If a surface makes it fall short, fix the surface.
  - A chip's border sits clear of its glyphs (`.gmt-hint-chip` has 2px of vertical padding), and a
    label has the width of its text (`--gmt-interval-label-w`).
  - `--gmt-ice-dim-fill` keeps the dimmer value for non-text uses (a low-alpha wash, a hatch, a
    disabled thumb), never a rule's `color:`.

## Maintenance rules

1. **Never add a `[data-theme="light"]` block for a colour.** Use the re-tinted token, or add a
   theme-role token in `gmt-tokens.css`. A light rule is only for a non-colour effect (a
   `backdrop-filter`, a scrollbar tweak) and goes in `gmt-light.css` unless a base rule for the same
   selector lives elsewhere.
2. **No colour literals in rules.** One-off gradient stops are the only exception.
3. **Widgets compose primitives** and never touch a Starlight-override sheet.
4. **Respect the layer order.** The layer a rule sits in decides what it beats. Moving a rule to
   another layer can change the winner: verify with the visual gate below.
5. **The layer order is fixed in `gmt.css`:** `starlight, theme, base, components, utilities, vendor,
   gmt.tokens, gmt.base, gmt.shell, gmt.content, gmt.controls, gmt.tools, gmt.chat, gmt.thirdparty,
   gmt.a11y`. Unlayered rules beat every layer, so CSS Modules and Astro component styles win over
   every global rule without `!important`.
6. **An accent used as text uses its `-ink` theme-role token; the bright accent is for fills,
   borders and non-text only.** The bright accents are tuned for a 3:1 fill or border bar, and
   several light re-tints fall to about 2.5 to 3.7:1 as `color:`, under the site's 7:1 text floor
   ([verification-and-risks.md](verification-and-risks.md)). Each has an `-ink` sibling in
   `gmt-tokens.css`: the dark value aliases the base token, the light value is the same hue darkened
   until every surface it sits on clears 7:1.
   - `--gmt-cyan-bright` reuses `--gmt-cyan-ink`; a second token would only duplicate it.
   - `--gmt-severity-critical-ink`, `--gmt-severity-high-ink` and `--gmt-dst-gold-ink` follow the
     same pattern for tokens whose base value is already a fill or border colour.
   - A drag handle, an SVG icon glyph or any other non-text use stays on the bright token. A focus
     ring needs only 3:1.
   - `--gmt-ice-dim` is the one token retuned directly rather than split, because it is almost
     always a `color:` use.

## Verifying a change is visually safe

From `apps/dox`:

```sh
pnpm build && pnpm visual:before   # baseline, on a clean tree
# ... make the change ...
pnpm build && pnpm visual:after
pnpm visual:diff                   # exits non-zero over threshold
```

- The harness captures the landing page, a dense reference page, the tool pages and one page per
  teaching widget, plus the search modal and mobile menu, in both themes at 1440x900 and 390x844.
- The diff is perceptual (pixelmatch), not a hash, because GPU blur re-encodes differently on every
  capture. `MAX_DIFF_PIXEL_RATIO` is 0.2%. Never loosen it. A diff over threshold is a regression
  unless it is the deliberate change; then re-baseline and say so.
- Masked: live clock text and the globe canvas. `prefers-reduced-motion` emulation stops the globe's spin.
- A page whose height changed reports `ERROR (size mismatch)`. Judge those by eye, and run an
  overlap and sideways-scroll sweep at 390 and 1440, which the pixel gate cannot see.
- The `/dox` mobile captures can cross the threshold from the header clock text alone, in a
  different theme each run. Confirm with html-diff and a repeat capture before calling it a regression.
- **`scripts/html-diff.mjs`** is the structural gate for widget markup the pixel diff cannot see (a
  dropped `selected`, a missing `data-role`): `capture <dir>`, then `compare <dir>`. It separates
  "the widget changed" from "only the page around it changed".
- **Measure text contrast against the worst pixel behind the glyphs.** `pnpm run contrast:measure`
  (`scripts/contrast-measure.mjs`, against a served build) checks every element whose colour is
  `--gmt-ice-dim`, in both themes, and fails under 7:1. It screenshots twice, as the page is and
  with every glyph transparent (`-webkit-text-fill-color`). The pixels that differ are the glyphs;
  the text colour is composed over the transparent-glyph pixel at each glyph pixel and one around
  it. That covers gradients, hatches and glows a flat swatch misses.
  - Measure a text node from its first to its last visible character, whole pixels only.
  - Skip text in a closed `<details>` (it keeps geometry but is not painted) and text inside a 1px
    visually hidden box (a text range reports its full glyph rect even when an ancestor clips it).
  - Hide fixed and sticky chrome first, because it lands in clip screenshots.
