# Slice 3 — The page: placement, text and verification

[← spec index](./index.md) · needs slices [1](./figures.md) and [2](./charts.md)

## Placement on `/bundle-size`

`src/content/docs/bundle-size.mdx`, top to bottom:

1. **Lead paragraph (rewritten).** The polyfill is the floor and GMT's code is the small part above
   it, with figures. This replaces the paragraph that types `@js-temporal/polyfill`.
2. The existing `root` sentence, with `formatCount(gmtStats.functions)` kept.
3. `<BundleSize />`, unchanged except for the over-floor units from slice 1.
4. The existing method paragraph, plus one sentence on how the previous set is measured.
5. **`## Why GMT uses temporal-polyfill` (new).** The heading text is static, so the table of
   contents and the anchor `#why-gmt-uses-temporal-polyfill` stay stable. In order:
   - the section prose
   - Chart 1
   - one paragraph
   - Chart 2
   - `<PolyfillCompare />`
   - the link out
6. The existing #316 closing paragraph, last, unchanged.

The section goes after the table because a reader comes for the table. The lead gives the main
point before the table; the section explains it after.

## Figures in prose

The MDX writes each figure as an expression over one object, `polyfillFigures` (`leadFigures()`
evaluated once and exported from `bundle-size-figures.ts`). Every value is a ready string:

| Key | Example (live JSON, illustration only) |
| --- | ------------------------------------- |
| `shippedVersion`, `previousVersion` | `1.0.8`, `0.5.1` |
| `previousGmt` | `1.21.0` |
| `floorGzipped`, `floorMinified` | shipped floor |
| `previousFloorGzipped`, `previousFloorMinified` | previous floor |
| `floorDifferenceGzipped`, `floorDifferenceMinified` | previous − shipped, `formatBytes` |
| `smallestName`, `smallestCodeMinified`, `smallestCodeGzipped`, `smallestTotalGzipped` | `isValidDate`, `817 B`, `377 B` |
| `largestName`, `largestCodeGzipped` | the function entry with the most GMT code, gzipped, on the shipped set |
| `rootGzipped`, `previousRootGzipped` | the whole package on each set |

- **Text surfaces.** `page-expression-values.ts` gains one entry per key, built by iterating
  `Object.entries(polyfillFigures)` into `"polyfillFigures.<key>"`, so a new key cannot be
  forgotten. Add `"bundle-size.mdx"` to `PAGES` in `page-expression-values.test.ts`.
- **Code in prose.** Function names come from expressions, so they cannot sit inside backticks.
  Write them as `<code>{polyfillFigures.smallestName}</code>`. In `stripMdx`, after values are
  substituted, turn `<code>x</code>` (no nested tags) into `` `x` ``. Test that in
  `page-markdown.test.ts`.
- **Package names.** The section is about these two packages, so the prose and the heading name them
  as literals in backticks. `bundle-size.test.ts` asserts that the `.mdx` source contains
  `polyfillSets().shipped.package` and `.previous.package`. If the shipped polyfill ever changes, the
  test fails and the page gets rewritten. Versions are never literal.
- `smallestName` is the entry with the smallest shipped total. The floor is the same for every
  row of a set, so it is also the entry with the least GMT code, and the owner's example
  (`isValidDate`, 817 B / 377 B over the polyfill) stays true and moves with the data.

## Wording

**Plain English, ISO 24495-1:**

- Short sentences and the active voice.
- No marketing words: no "lean", "blazing", "tiny", "dramatic", "huge", "massive" or "just".
- Figures and named facts only.

**True on any day:**

- No "now", "recently", "new", "old", "used to", "switched", "moved" or "this release".
- Never print `shipped.gmt` ([figures.md](./figures.md)).
- Name the previous set by its last release: "the last release on `@js-temporal/polyfill`, GMT
  {previousGmt}".

**Draft text.** The builder may tighten it, but must keep every figure an expression and every
rule above. `{…}` stands for `{polyfillFigures.…}`.

> Every import of `@northguild/gmt` carries the `temporal-polyfill` polyfill, {floorGzipped}
> gzipped ({floorMinified} minified). That is the floor row: no import is smaller than it. GMT's
> own code is what a row adds above the floor. <code>{smallestName}</code> adds {smallestCodeMinified}
> minified, {smallestCodeGzipped} gzipped. The last four columns show that part for every row.

Method paragraph, one added sentence:

> The comparison below also bundles the last release on `@js-temporal/polyfill`, the published
> `@northguild/gmt@{previousGmt}`, with the same esbuild settings.

Section prose:

> ## Why GMT uses temporal-polyfill
>
> GMT reads and returns ISO 8601 strings and does its date arithmetic with `Temporal`. Every bundle
> includes a polyfill for it until a stable Safari ships `Temporal` (see the end of this page). The
> polyfill is the largest part of almost every import, so its size sets how large GMT is to install.
>
> `temporal-polyfill` {shippedVersion} is {floorGzipped} gzipped. `@js-temporal/polyfill`
> {previousVersion}, the polyfill of GMT releases up to {previousGmt}, is {previousFloorGzipped}: a
> difference of {floorDifferenceGzipped} on every import.

"Almost every import" holds while `root` and every function entry are more polyfill than GMT code.
Assert it against the live JSON (shipped set: `floor > code` for at least all but one row); if it
fails, cut "almost every" to the measured count.

Chart 1 caption: `Gzipped size of each polyfill on its own, the floor of every import.` The
minified view reads the same with "Minified".

Between the charts:

> GMT's own code stays the same size whichever polyfill it runs on. Each pair of bars below is one
> import: the solid part is the polyfill, the hatched part is GMT's code. Across the functions
> measured, GMT's code is {smallestCodeGzipped} to {largestCodeGzipped} gzipped. The whole package
> is {rootGzipped} gzipped on `temporal-polyfill` and {previousRootGzipped} on `@js-temporal/polyfill`.

**Check before you print it.** "Stays the same size" is a claim. Assert it in
`bundle-size-figures.test.ts` against the live JSON: for every chart row, the gzipped `code` on the
two sets differs by less than 10%. If it fails, cut the sentence; do not loosen the test.

Chart 2 caption: `Gzipped size of each single-function import, split into the polyfill and GMT's
code.` `root` is in the table.

Link out, after the table:

> Size is one reason. The others, bounded month arithmetic and a maintained release line, are on
> [Upstream fixes](/upstream/#why-this-polyfill).

Do not restate the `/upstream` reasons here. Slice 7 of the library spec owns that text.

## Verify by reading (dox-tester)

Judge the page by reading it top to bottom, not from a screenshot.

1. `pnpm --filter @gmt/dox run generate`, then `pnpm --filter dox build`, then preview.
   **Do not build `packages/gmt/dist`**: the owner's dev server reads it. The Dox build reads the
   JSON only.
2. Every figure in the lead, prose, captions, tooltips and table matches
   `src/generated/bundle-size.json` by hand. Check five figures, including `isValidDate`.
3. `/bundle-size.md` holds the lead figures, both captions and the comparison table, with no `{` and
   no capitalised tag.
4. Both themes, at 1440, 390, 360 and 300:
   - the bars are green for `temporal-polyfill` and slate grey for `@js-temporal/polyfill`
   - the key matches the bars
   - no page-level horizontal scroll
   - the toggle does not move the content below the chart by more than the chart's own height change
     (`grow-measure`)
5. Keyboard:
   - Tab reaches each view toggle, and `aria-pressed` follows the toggle
   - the hidden summaries are read by VoiceOver (one pass on macOS Safari) or are present in the
     accessibility tree (`a11y-axe`)
6. Forced colours (Chromium emulation): the solid and hatched segments stay distinct.
7. Sample the plot pixels of one solid bar of each colour in both themes, and confirm that both
   values are ≥ 3:1 against the sampled background.

## Done when

- The page renders as above.
- The gates in [index.md § Gates](./index.md#gates-from-appsdox) are green.
- `built.md` and `design-system.md` are updated ([index.md § Definition of done](./index.md#definition-of-done)).
