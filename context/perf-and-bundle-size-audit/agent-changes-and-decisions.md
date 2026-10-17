# Performance audit — Part 3, agent changes, owner decisions and method

Part of [the index](../perf-and-bundle-size-audit.md).

## Part 3 — Recommended agent and rule changes

The goal: new code reaches for a formula before a loop, and size growth is a choice someone
made, not drift. Correctness still comes first. An optimisation that changes any output is a
defect.

### `tdd-dev` (`.agents/tdd-dev.md`)

Add a **Performance shape** section after "Implementation shape":

- **Name the growth before writing the loop.** For every loop, say in the handoff what bounds
  its iteration count. "Bounded by a constant" and "bounded by the output size" are fine. A
  count that grows with the input span, log length or holiday count needs a stated reason why
  no closed form exists.
- **Formula first.** Before stepping day by day, use:
  - integer epoch-day arithmetic (`epochDayOf` / `isoFieldsOf` in `internal/businessCalendar.ts`);
  - the weekday formula `((epochDay + 3) mod 7) + 1`;
  - whole-week jumps;
  - prefix sums with binary search over sorted arrays.

  Walk only the remainder, which is at most 7 days.
- **Temporal at the edges.** Parse inputs once on the way in, and format once on the way out.
  Never construct or parse a Temporal object per loop step or inside a sort comparator.
- **Resolve once.** A calendar, schedule, zone or rule set is validated and resolved once per
  public call. Pass the resolved form to an `internal/` core. A public function never calls
  another public function inside a loop.
- **Cache what is pure and expensive**: `Intl.DateTimeFormat` by locale and options, validated
  zone ids, zone transitions. Use module-level `Map`s with no work at import time.
- **Nothing runs at import and no fixtures ship.** No top-level Temporal or `Intl` calls. Test
  data, repros and canary tables never live in a module that shipped code imports.
- **Measure what you add.** A function with a span-dependent loop gets a `*.bench.ts` row
  covering a short, a 1-year and a 10-year input. Put the numbers in the handoff, with the
  bundle-size delta of the affected entry from the size script (S3). Timing assertions never go
  in `it` rows, because they are flaky across the 30-leg CI matrix.
- **The existing rows are the contract when optimising.** A rewrite keeps every row green on
  the full zone matrix. A differential run of old against new implementation over random
  inputs is a useful **check**. It is never the source of an expected value: GMT is never its
  own oracle.

### `gmt-reviewer` (`.agents/gmt-reviewer.md`)

Add a Process step, **"Cost"**, after step 9 (invariants):

- For each loop in the diff, find what bounds it.
  - Flag growth with input span, log or holiday count where a closed form or binary search
    exists.
  - Flag any nested loop over the same input (O(n²)).
  - Flag per-iteration Temporal parsing or construction, and parsing inside a comparator.
  - Flag a public function called in a loop, and an uncached `Intl` constructor on a hot path.
- Run the size script. Report the entry-size delta for every function the diff touches, and
  flag growth past the budget.
- Flag module-level work, shipped test data, and a new static import that drags a large
  internal module into a small function.
- The finding format is unchanged. "The oracle" becomes the measurement, with input sizes and
  times, before and after.
- Add **cost** to the "what was checked and found clean" list.

Mechanical items belong in the shared checklist, not in the reviewer file, which says not to
restate it. Add these to `context/code-review-checklist.md` under Architecture:

- [ ] No loop's iteration count grows with the input span where a closed form exists; no
  Temporal parse or construction per iteration or in a comparator
- [ ] Calendars, schedules and zones resolved once per call; no public function called in a loop
- [ ] No module-level work and no test data in shipped modules; the size script passes its budget

Extend `context/coding-standards.md § Loop Style` with a **Loop cost** paragraph holding the
`tdd-dev` rules above, so `architect` and `tester` read the same text. `architect` should
state the target complexity in each spec that has a loop over a span.

## Owner decisions this audit raises

1. **Polyfill strategy (S1):** keep `@js-temporal/polyfill`, go native-first with a polyfilled
   fallback entry, or move to `temporal-polyfill`. Removing the root re-export is a
   prerequisite for the last two.
2. **Size budgets (S3):** the figures to fail `validate` on, for the root entry and for single
   functions.
3. **Whether cost findings block.** Proposal: they block in new code, and existing hot spots
   (P1–P6) become backlog stories that this audit seeds.
4. **Tracker placement** of the work below.

### Suggested story split

| Story             | Scope                                                     | Size win / speed win            |
| ----------------- | --------------------------------------------------------- | ------------------------------- |
| Bench and size harness | `*.bench.ts` for P1–P5, `scripts/bundle-size.mjs`, budgets in `validate` | Makes every other story measurable |
| Temporal seam     | One internal `Temporal` import; drop the root re-export   | Unblocks S1                     |
| Polyfill strategy | Native-first or `temporal-polyfill` (after decision 1)   | Up to −44 kB gzipped per import |
| Repro split       | S2                                                        | −12 kB minified on arithmetic imports |
| Duty engine       | P1                                                        | 390 ms → milliseconds for a 1-year log |
| Epoch-day walks   | P2, P3, P4 (transition cache first)                       | ~40 ms/year → near-constant     |
| Calendar resolution | P5, P6                                                  | Flat 1.6–3 ms per call → microseconds |

## Appendix — how the figures were measured

Size: esbuild in memory, so nothing touches `dist`. Run from `packages/gmt`:

```js
const r = await esbuild.build({
  stdin: { contents: `export { addBusinessDays } from "./src/index.ts";`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, minify: true, format: "esm", platform: "neutral",
  mainFields: ["module", "main"], target: "es2022", write: false, metafile: true,
});
// r.outputFiles[0].contents.length → minified; zlib.gzipSync(...) → gzipped;
// r.metafile.outputs[*].inputs[file].bytesInOutput → per-file share
```

Speed: the same build without `minify`, `platform: "node"`, imported from a `data:` URL, and
timed with `performance.now()`. The inputs were:

- **Duty log:** a repeating 24-hour day (10 h off, 1 h on, 5 h driving, 0.5 h off, 5.5 h
  driving, 2 h on), checked against an 11-hour driving cap that resets after 10 hours off.
- **Schedule:** Mon–Fri 09:00–17:00 with a split Wednesday, in `Europe/London`.
- **Holidays:** 480, 12 a year over 2020–2059.
