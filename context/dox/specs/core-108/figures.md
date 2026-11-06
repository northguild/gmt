# Slice 1 — Figures module and the comparison table

[← spec index](./index.md)

Everything numeric that the section shows is computed in one place, and that place has no
corpus import. The table built on it is the text alternative for both charts and the Markdown twin.

## `apps/dox/src/lib/bundle-size-figures.ts` (new)

Imports only `../generated/bundle-size.json` and types. It must never import `gmt-corpus.json`,
`bundle-size.ts`, `gmt-stats` or anything that reaches them. The chart module imports this file, and
the chart module is in the client graph (Decision 7).

Exports (names are binding; the shapes are a guide):

| Export | What it is |
| ------ | ---------- |
| `BundleReport` | The JSON's type, `polyfills[]` included (`entries` values may be `null` in the previous set) |
| `polyfillSets(report = data)` | `{ shipped, previous }`, found by `shipped === true` / `false`. Throws a plain `Error` when there is not exactly one of each, so a JSON from before slice 6 fails the build with a clear message |
| `formatBytes(n)` | `n < 1000` → `"817 B"`; otherwise `kb(n)` + `" kB"` → `"23.3 kB"`. Uses the existing one-decimal `kb()`, moved here from `bundle-size.ts`, which re-imports it. Non-breaking space between number and unit |
| `splitOf(set, name)` | `{ total, floor, code }` for each measure (`minified`, `gzipped`). `code = total − floor`. `null` when the entry is `null` or missing |
| `comparisonRows(report = data)` | One row per entry name in shipped-set order, `report.floor` excluded, `root` included: `{ name, shipped: Split, previous: Split \| null }` |
| `chartRows(report = data)` | `comparisonRows` without `root` and without rows whose `previous` is `null` (Decision 5). A `null` previous entry is listed in the table, not drawn |
| `smallestFunction(report = data)` | The function entry (not `root`, not the floor) with the smallest shipped minified total. The lead uses it. Today it is `isValidDate`; a test never names it |
| `leadFigures(report = data)` | Strings for the lead and the section, see [page.md § Figures in prose](./page.md#figures-in-prose) |

Rules:

- **No package name, version or entry name is typed in.** They come from `set.package`,
  `set.version`, `set.import` and the entries' keys. The only literals allowed are the measure names
  and `report.floor` / `"root"`, which the JSON contract defines.
- **`shipped.gmt` is never printed.** `packages/gmt/package.json` keeps the last release's version
  until the release PR, so it would name the wrong release. Only `previous.gmt` is printed, as "the
  last release on {previous.package}" ([page.md § Wording](./page.md#wording)).
- `previous.from` is `"npm"`. A method sentence says the previous set is measured from the published
  `@northguild/gmt@{previous.gmt}`. If `from` is ever `"source"`, the sentence says so instead (two
  strings, chosen by the field).

## `apps/dox/src/lib/bundle-size.ts` (modify)

- Import `kb` and `formatBytes` from the figures module. Keep the existing `importOf`, which slice 6
  changes to read `shipped.import`. If slice 6 has not landed (no `polyfills` in the JSON), stop and
  report.
- `bundleCells`: the two "over the polyfill" columns use `formatBytes`. The Minified, Gzipped and
  Budget columns stay in kB, because their values are all ≥ 1,000 B. Then the existing table and the
  new table read GMT's code in the same units (Decision 6).
- `bundle-size.test.ts` (`src/data/`): unchanged assertions stay. Add one: the floor row's import
  names `polyfillSets().shipped.import`.

## `apps/dox/src/components/PolyfillCompare.astro` (new)

The same markup as `BundleSize.astro`: `<div class="gmt-ref-table" data-kind="content"
data-label="Gzipped size on each polyfill">` around a `<table>`, so `table-fit` and the twin treat
it the same way. Columns:

| Column | Cell |
| ------ | ---- |
| Import | `codeBreakHtml` of the entry's import line for the shipped set, as `BundleSize` does. `root` reads `import * as gmt from "@northguild/gmt"` |
| `{shipped.package}` gzipped | Total (`formatBytes`) |
| `{previous.package}` gzipped | Total, or the text `not in GMT {previous.gmt}` when `null` |
| GMT code over `{shipped.package}` | `code.gzipped` |
| GMT code over `{previous.package}` | `code.gzipped`, or the same `not in` text |

- The first row is the floor, built from `splitOf(set, report.floor)` and not from `comparisonRows`
  (which leaves the floor out). Its GMT code cells read `floor`, as `BundleSize` does.
- Minified figures are in the existing table. Only gzipped is compared here, because gzipped is what
  goes over the network and the charts' default view is gzipped. The caption says "Gzipped bytes".
- Header text is built from `set.package` and is wrapped in `<code>`.
- Numbers right-align with `font-variant-numeric: tabular-nums`, as `.num` does in `BundleSize`.
  Copy the `.gmt-bundle` rules into this component's scoped style. No colour on text, no
  swatches in cells, no row accents. Rows keep the bottom hairline that `.gmt-ref-table` already
  draws. No left border anywhere.
- The column headers name each package, so each figure's identity never rests on colour.

## Markdown twin (`src/lib/mdx-jsx.ts`)

- Add `renderPolyfillCompare()` beside `renderBundleSize()`. It emits the same columns and rows as a
  Markdown table from `comparisonRows()`.
- Register it with `replaceElements(out, "PolyfillCompare", renderPolyfillCompare)`.
- The `ChartContainer` unwrapping already reduces each chart to its caption. Check that the new
  charts' captions reach the twin, and that `llms.test.ts` stays green (no capitalised tag left over).

## Tests

All use a **fixture report** built in the test file (two sets, three function entries, one `null`
in the previous set, a `root`, a floor). None of them read the live JSON's numbers, so they
survive any re-measure.

`src/lib/bundle-size-figures.test.ts` (new):

- `polyfillSets` finds the sets by the flag when the fixture lists the previous set first.
  It throws for zero shipped sets, for two shipped sets, and for a report with no `polyfills`.
- `formatBytes`: 0 → `0 B`, 999 → `999 B`, 1000 → `1.0 kB`, 23_349 → `23.3 kB`, with U+00A0 between
  number and unit.
- `splitOf` returns `code = total − floor` for both measures, and `null` for a `null` entry.
- `comparisonRows` keeps the shipped-set order, drops the floor and keeps `root`. `chartRows` also
  drops `root` and the `null` row.
- `smallestFunction` ignores `root` and the floor even when the floor is smaller.
- **Figures follow the data:** change one fixture byte count, and `leadFigures` and `comparisonRows`
  change with it. Rename the shipped package in the fixture, and no output still holds the old name.
- **No literal names:** read the module's source text and assert that it contains neither
  `"temporal-polyfill"` nor `"@js-temporal/polyfill"` nor any entry name from the live JSON.
- Live smoke (one test): `polyfillSets()` on the real JSON returns two sets whose `entries` keys
  equal the top-level `entries` keys. This shows that slice 6 landed.

`src/lib/mdx-jsx.test.ts` (or the existing twin test): the rendered Markdown holds a table whose
header names both packages and whose row count equals `comparisonRows().length + 1` (floor).

## Done when

- The tests above are green.
- The existing `/bundle-size` table renders, with its "over the polyfill" columns in B or kB.
- `PolyfillCompare` renders on a scratch page or the real page (slice 3) with no hard-coded figure.
