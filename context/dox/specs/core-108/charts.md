# Slice 2 — Tokens, chart registry and the two charts

[← spec index](./index.md) · needs [slice 1](./figures.md)

## Forms

The data has one job: show **magnitude, split into two parts, for two packages**. Each import's size
is the polyfill (the floor) plus GMT's own code. Each part exists for both packages.

| Chart | Form | Why this form |
| ----- | ---- | ------------- |
| 1 · Polyfill floor | Horizontal bars (`barX`), one per set, shipped first. The y band labels read `{package} {version}` | Two magnitudes on one axis. Horizontal bars keep the package names on one line at 300px. A stat tile would hide that both are bars of the same kind |
| 2 · Each import: polyfill and GMT code | Horizontal bars, one band per function entry (`chartRows()` order). Inside each band, two grouped bars, shipped above previous. Each bar has a solid floor segment and a hatched GMT-code segment in the same hue | Part-to-whole per import, compared across two packages. Grouping keeps the two packages next to each other, and segments show the split. The function names are code and are long, so they sit on the y axis unrotated |

Rules for both charts:

- One axis, zero baseline, linear scale, `nice: true`, grid on the value axis. Never a log scale:
  the page's point is the size of the floor, and a log scale would hide it.
- Two views in each `ChartContainer`: **Gzipped** (default, first) and **Minified**. Each view is its
  own registry id, as `/why-gmt` does. Both views keep the same row order and colours.
- `root` is never drawn (Decision 5), and neither is a `null` previous entry. Both stay in the table.
- No direct value labels on bars. The y labels name the rows, the key names the colours and fills,
  and the tooltip, the summary and the table give exact figures.
- No animation and no `backdrop-filter` ([built.md § Rules](../../built.md#rules-that-bind-every-change)).

### Chart 2 geometry

TanStack `0.16.0`. `layout` takes one `GroupLayout` or one `StackLayout`, not both. Draw the
segments as two `barX` marks that use explicit endpoints, so neither mark stacks:

- floor mark: `x1: 0`, `x2: floor`, solid fill
- code mark: `x1: floor`, `x2: total`, hatched fill

Both marks use `y: "name"`, `z: "package"`, `layout: group({ scale })`. The group scale's domain is
fixed to `[shipped.package, previous.package]`, so both marks place each package in the same slot
([bar-and-rect.md § Grouped bars](../../../../apps/dox/node_modules/@tanstack/charts/docs/reference/marks/bar-and-rect.md)).
Set `inset: 2` to keep a 2px surface gap between the two bars in a band. A unit test checks that the
code rect starts where the floor rect ends ([§ Tests](#tests)).

**Fallback, if `group` will not take explicit endpoints:** draw the total as a hatched bar, then draw
the floor as a solid bar with the same `group` placement over it. The visible result is the same. Say
in `built.md` which form shipped.

Sizes: width 1200, as every bar chart does. Chart 1 is 200 high. Chart 2's height comes from its row
count: `chartRows().length × 64 + 80`. Never type a fixed row count.

## Colour

Two new tokens. Each is declared once in `:root` in `gmt-tokens.css`, with **no light-theme
override**: one value passes on every surface in both themes.

```css
/* Series pair for the polyfill comparison on /bundle-size: green is the shipped polyfill, a neutral
   slate grey the previous one, so the old package recedes. Not --gmt-spring / --gmt-signal: light spring is under 3:1 on the light glass, and
   amber is kept for NO SIGNAL. One value for both themes; every chart surface measures ≥ 3:1. */
--gmt-polyfill-shipped: #0f9a47;
--gmt-polyfill-previous: #64748b;
```

Measured contrast (WCAG relative luminance, mark against surface):

| Surface | `#0f9a47` | `#64748b` |
| ------- | --------- | --------- |
| light `--gmt-void` #ffffff | 3.66 | 4.76 |
| light `--gmt-surface` #f5f5f5 | 3.36 | 4.36 |
| light `--gmt-surface-2` #ececec | 3.10 | 4.03 |
| light glass (teal 16% on white) #dcf8fc | 3.29 | 4.28 |
| dark `--gmt-void` #03080c | 5.49 | 4.23 |
| dark `--gmt-surface` #061018 | 5.24 | 4.03 |
| dark glass (teal 10% on void) #041319 | 5.15 | 3.97 |

The grey is neutral on purpose: the previous package recedes and the shipped one carries the
colour. Simulated colour-vision ΔE (CIE76) between the pair is 28 at worst (tritan), against 16
(protan) for the orange it replaced. Green on `#ececec` is 3.10, the thinnest margin. **Do not lighten either token.** These are mark colours only: never use them for text
([built.md § Rules](../../built.md#rules-that-bind-every-change)).

Fills (and every key swatch) use the tokens at full strength:

- **Solid floor segment:** `fill: var(--gmt-polyfill-<set>)`, `stroke: var(--gmt-border-strong)`,
  `strokeWidth: 1`. Not the `/why-gmt` gradient: its 0.23–0.32 opacity would fall below 3:1.
- **Hatched code segment:** a page-level pattern, `tint: 0.12`, `line: 1`, `lineWidth: 2`, `size: 7`,
  and `stroke: var(--gmt-polyfill-<set>)`, `strokeWidth: 1.5`. The full-strength outline carries the
  3:1. The hatch carries the solid-versus-hatched difference without colour.
- **Forced colours:** follow the existing `gmt-charts.css` forced-colors block. Solid fills map to
  `CanvasText`, and the hatch lines and outline do too, so the two segments still differ.

## Registry split

`ChartContainer.astro` and `scripts/render-charts.ts` import `BAR_CHARTS` from
`why-gmt-charts.ts`. Move the shared parts out so both pages register charts without importing each
other:

- **`src/lib/bar-chart-kit.ts` (new):** `BarHue`, `BarGradient`, `BarPattern`, `barGradient`,
  `barHatch` (with `line`/`tint` overridable), `barGradientId`, `barHatchId`, `withTooltip` and the
  `BarChart` interface, moved unchanged from `why-gmt-charts.ts`.
  - `BarHue` gains `"polyfill-shipped" | "polyfill-previous"`. `ChartContainer` already builds
    `var(--gmt-${hue})`, so no template change is needed for the hue.
- **`src/lib/bar-charts.ts` (new):** the registry only:
  `BAR_CHARTS = { ...WHY_GMT_CHARTS, ...BUNDLE_SIZE_CHARTS }`, `BarChartId`, `isBarChartId`, and type
  re-exports for `ChartContainer`. Both registries import the kit, and only this file imports both,
  so nothing cycles.
- **`why-gmt-charts.ts`:** keeps its chart code and exports `WHY_GMT_CHARTS`. It imports the kit
  from `bar-chart-kit.ts`. Every existing `/why-gmt` id, label and SVG stays byte-identical. Check this
  with the `html-diff` local gate on `/why-gmt/`.
- **`src/lib/bundle-size-charts.ts` (new):** imports only `@tanstack/charts`, `bar-chart-kit.ts` and `bundle-size-figures.ts`. Exports:
  - `BUNDLE_SIZE_CHARTS`, with ids `polyfill-floor-gzipped`, `polyfill-floor-minified`,
    `polyfill-split-gzipped` and `polyfill-split-minified`
  - `polyfillLegendHtml()` and `polyfillSummaryHtml(chart, measure)`
- **Callers:** update `ChartContainer.astro` (the client script and the frontmatter types),
  `scripts/render-charts.ts`, `why-gmt-charts.test.ts` and `delivery-scheduler-charts.ts` (it names
  `why-gmt-charts.ts` only in a comment; correct the comment).
- `render-charts.ts` gains `polyfillFloorSvg` and `polyfillSplitSvg` (gzipped and minified each),
  built through the existing `renderBarChart(id)`, plus the legend and summary HTML exports. The
  `idPrefix` values are unique across the site.

Tooltips (through `withTooltip`):

- Chart 1: `{package} {version}`, then `Polyfill: 23.3 kB`.
- Chart 2: `{name}` (code), `{package} {version}`, then the `Polyfill`, `GMT code` and `Total` rows,
  all through `formatBytes`.
- Text goes in the tooltip's ink tokens, never in the series colour.

## Key and summary

`chartKey` gains a hue (`ChartKeyItem.hue?: "spring" | "polyfill-shipped" | "polyfill-previous"`,
default `"spring"`). Its CSS keys on `data-hue` as well as `data-kind`, so `/why-gmt` is unchanged.

- `own`: solid at full strength.
- `shared`: the hatch, with a full-strength border.
- **No colour literals.** The CSS uses `var(--gmt-polyfill-*)`, as the existing swatches use
  `var(--gmt-spring)`.

Chart 1 key: two items, `{shipped.package} {version}` and `{previous.package} {version}`.

Chart 2 key: four items:

- `Polyfill — {shipped.package}`
- `GMT code — {shipped.package}`
- `Polyfill — {previous.package}`
- `GMT code — {previous.package}`

The words carry every meaning.

`chartSummary` holds one line per bar, built from the figures. For example:
`isValidDate, temporal-polyfill: polyfill 23.3 kB, GMT code 377 B, total 23.7 kB.` (the example is
for illustration, and the test uses the fixture).

## Tests

Teardown: every test that calls `createChartRuntime()` calls `destroy()` in `finally`
([index.md § Tests own their lifetimes](./index.md#tests-own-their-lifetimes)).

- `bundle-size-charts.test.ts` (new), with the slice-1 fixture injected (the definitions take a
  report argument that defaults to the live JSON):
  - each id renders a scene with no throw
  - Chart 1 has one bar per set
  - Chart 2 has `2 × chartRows().length` floor rects and as many code rects
  - each code rect's start x equals its floor rect's end x (±0.5px), and the pair shares y and height
  - the shipped bar sits above the previous bar in every band
  - fills name `--gmt-polyfill-shipped` / `--gmt-polyfill-previous` by the `shipped` flag, so
    swapping the fixture's order does not swap colours
  - the summary has one line per bar, and the key has 2 and 4 items
- `bar-charts.test.ts` (new):
  - `BAR_CHARTS` holds every `/why-gmt` id and the four new ids, with `idPrefix` values unique
  - `importsOf`-walk `bar-charts.ts`: no reachable file ends in `gmt-corpus.json` or is
    `src/lib/bundle-size.ts`. Extend `client-graph.test.ts` instead if it already walks the
    `ChartContainer` script's imports.
- `polyfill-tokens.test.ts` (new, next to `NorthGuildMark.test.ts`), using `src/test/token-contrast.ts`:
  - both tokens resolve to the same hex in both themes
  - each is ≥ 3:1 against `--gmt-void`, `--gmt-surface`, `--gmt-surface-2` and the glass composite
    (`--gmt-teal` at the theme's `--gmt-glass-tint` alpha over `--gmt-void`), in both themes
  - read the alpha from the token file, not a typed 10 or 16
- `why-gmt-charts.test.ts`: still green, with only its imports changed.

## Done when

- The tests above are green.
- `/why-gmt/` is unchanged (`html-diff`).
- The new SVGs build, and the tokens contain no light override.
