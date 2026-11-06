---
story: CORE-108
issue: 460
status: approved
---

# CORE-108 — `/bundle-size`: the polyfill floor and the move to `temporal-polyfill`

Library spec: [`domination/specs/CORE-108`](../../../domination/specs/CORE-108/index.md). This spec
covers the Dox page only. It **starts after library slice 6**
([bundle-size.md](../../../domination/specs/CORE-108/bundle-size.md)): `report --json` writes
`polyfills[]` into `apps/dox/src/generated/bundle-size.json` and `importOf` reads the shipped
`import`. Before that lands, nothing here can render.

The page answers "GMT is too big" with measured figures. Its message: the Temporal polyfill is the
floor of every bundle, and GMT's own code is a small amount above it. The page leads with that split
and then explains, with two charts and a table, why GMT uses `temporal-polyfill`.

## What ships

| Part | Where | Slice |
| ---- | ----- | ----- |
| A figures module with no corpus import: both polyfill sets, the split, a byte formatter, the prose figures | `src/lib/bundle-size-figures.ts` (new); `bundle-size.ts` reads it | [1](./figures.md) |
| A comparison table of both sets, plus its Markdown twin | `src/components/PolyfillCompare.astro` (new), `src/lib/mdx-jsx.ts` | [1](./figures.md) |
| Two series tokens, green and slate grey, the same in both themes | `src/styles/gmt-tokens.css` | [2](./charts.md) |
| The bar-chart registry moved out of the `/why-gmt` module; two bundle-size charts | `src/lib/bar-charts.ts` (new), `src/lib/bundle-size-charts.ts` (new), `ChartContainer.astro`, `scripts/render-charts.ts` | [2](./charts.md) |
| The chart key takes a hue and a fill | `src/widgets/builders/chart-key.ts` + `.module.css` | [2](./charts.md) |
| The page text, the new section and the figures in its prose | `src/content/docs/bundle-size.mdx`, `src/lib/page-expression-values.ts` | [3](./page.md) |

No new tool and no chat button: this is a page section, not a tool. React stays inside `/dox`.

## Data contract (read, never written)

From the slice-6 JSON. Every figure on the page is computed from these; nothing is typed in.

| Field | Used for |
| ----- | -------- |
| `polyfills[i].package`, `.version`, `.import` | Legend, axis, table header, prose names (`temporal-polyfill 1.0.8`) |
| `polyfills[i].shipped` | Which set is green (shipped: true) and which is grey. Always found by the flag, never by index |
| `polyfills[i].gmt`, `.from` | The method sentence: "the published `@northguild/gmt@1.21.0` from npm" |
| `polyfills[i].entries[report.floor]` | The floor of that set |
| `polyfills[i].entries[name]` (`null` allowed in the previous set) | Each import's total; total − floor is GMT's own code |
| `entries` (top level) | The existing table, unchanged |

Entry names, their order, the smallest and largest function and every byte count are read from the
JSON. A test that names an entry uses a fixture, not the live file.

## Decisions

1. **Two charts and a table, not one chart.** Chart 1 shows the floor of each polyfill (two bars).
   Chart 2 shows, for each function entry, a bar per set divided into the polyfill (solid) and GMT's
   code (hatched). Together they show the split the page exists to make. The table is the exact-value
   alternative, as dataviz requires. Forms and why: [charts.md § Forms](./charts.md#forms).
2. **Dedicated tokens, not `--gmt-spring` / `--gmt-signal`.** `--gmt-polyfill-shipped: #0f9a47` and
   `--gmt-polyfill-previous: #ea580c`, one value for both themes. The reasons:
   - Light `--gmt-spring` (#16a34a) is 2.96:1 on the light glass panel (#dcf8fc), so it fails the
     3:1 bar for marks.
   - `--gmt-signal` is amber, which is reserved for NO SIGNAL ([built.md § Rules](../../built.md#rules-that-bind-every-change)).
   - The chosen pair passes every dataviz validator check in both modes, CVD ΔE 8.5 included.
   - Measured contrast: [charts.md § Colour](./charts.md#colour).
3. **Marks are solid, not the `/why-gmt` 0.23–0.32 opacity gradient.** That tint would fall under
   3:1. The bars keep the rest of that chart family: `ChartContainer`, a TanStack definition,
   build-time SVG plus a live mount for the tooltip, `chartKey`/`chartSummary`, views behind a toggle.
4. **Token names say shipped and previous, and the text never says "new", "old" or "now".** The
   prose names packages and versions. "The last GMT release on `@js-temporal/polyfill` was 1.21.0"
   reads true on any day ([page.md § Wording](./page.md#wording)).
5. **`root` is in the table, not in chart 2.** Its bar is about 3× the next largest and would flatten
   the function bars. The prose states its figure.
6. **One byte format** (`formatBytes`): under 1,000 B the figure is in bytes ("817 B"); from 1,000 B
   it is in kB with one decimal ("23.3 kB"). 1 kB is 1,000 bytes, as the page already says. The
   existing table's two "over the polyfill" columns use it too, so GMT's code is not rounded to "0.4 kB".
7. **The chart module never reaches the reference corpus.** `ChartContainer`'s client script imports
   the registry. `bundle-size.ts` imports `gmt-corpus.json` for `importOf`, so the charts read
   `bundle-size-figures.ts` instead, and a graph test enforces it.

## Constraints that apply (link, don't copy)

- [built.md § Rules that bind every change](../../built.md#rules-that-bind-every-change): counts
  drift; a series colour goes on marks, never on text; every label in a chart sits on an opaque plate;
  no `backdrop-filter` inside a chart; 12px text floor.
- [design-system.md § Drawn charts](../../reference/design-system.md#drawn-charts): an accent edge is
  a bottom edge; legend words carry the meaning; forced colours. No card or row gets a left-only
  accent. The comparison table uses the entries layout's bottom hairline, and no callout is added.
- [design-system.md § Maintenance rules](../../reference/design-system.md#maintenance-rules): no
  `[data-theme="light"]` block for a colour, and no colour literal in a rule.
- [built.md § Code in a table cell](../../built.md#tiers-01--site-generator-ai-surface-brand-guides):
  table code cells use `codeBreakHtml`.
- `mdx-jsx.ts` header: every new component tag gets a Markdown render, or `llms.test.ts` fails.

## Tests own their lifetimes

Chart tests render through `createChartRuntime()`. Each test calls `runtime.destroy()` in a
`finally` block or an `afterEach`, the way `render-charts.ts` does. No test mounts the live chart
(`mountChart`): the browser gates cover it. No test uses timers or real-time sleeps.

## Gates (from `apps/dox`)

| Gate | Pass when |
| ---- | --------- |
| `pnpm test`, `pnpm check`, `pnpm build` | Green, including `llms.test.ts`, `font-floor.test.ts`, `client-graph.test.ts` and `page-expression-values.test.ts` |
| `pnpm gates --pages /bundle-size/` (PR tier: contrast-measure, a11y-axe, a11y-tab-walk, a11y-media, grow-measure) | Both themes, all engines in the registry. No findings |
| `pnpm gates --only table-fit --pages /bundle-size/` | Both tables fit at 300, 360, 390 and 1440 with no page-level horizontal scroll |
| Root `pnpm run validate` | Green. `packages/gmt` is untouched by this spec |

dox-tester also follows [page.md § Verify by reading](./page.md#verify-by-reading).

## Definition of done

- Slices 1–3 are done, each with its own tests green.
- Every figure in the section, its captions, tooltips, keys and table changes when the JSON changes.
  A fixture test proves it ([figures.md § Tests](./figures.md#tests)).
- Green is `temporal-polyfill` and slate grey is `@js-temporal/polyfill` on every mark and swatch. Both
  marks reach 3:1 or more on every chart surface in both themes, measured.
- `/bundle-size.md` and `llms-full.txt` carry the lead figures and the comparison table.
- Close-out: `built.md` gains a `/bundle-size` entry under Tiers 0–1, saying what the page shows,
  that it reads `polyfills[]`, and why `root` is out of chart 2. `design-system.md` § Tokens names the
  two polyfill tokens and why they are not spring and signal. § Drawn charts names the solid-mark
  rule for comparison bars. Present tense, no history.
- No changeset (`apps/dox` only). No `tracker.md` row: CORE-108's row in `domination/tracker.md`
  tracks this work.
