# Performance and bundle-size audit — `@northguild/gmt`

Measured on the 1.19.0 source (branch `feature/197-…`), Node 24.21.0, esbuild 0.28.2.
Timings are averages of a few runs on one laptop. Read them as orders of magnitude, not as
benchmarks.

## Summary

- **Size.** Importing everything costs 467.6 kB minified, 119.6 kB gzipped (bundlephobia).
  About a third of that, 44 kB gzipped, is `@js-temporal/polyfill`. **Every** GMT import pays
  that 44 kB, even a 0.8 kB function such as `isValidDate`. Tree-shaking works for GMT's own
  code. It cannot remove the polyfill.
- **Speed.** Most of the 209 loops in the source are bounded by a small constant or by the
  size of the output. Five families grow with the input span or log size, and each has a
  closed-form or binary-search replacement. The worst is the duty-log scan, which grows with
  the **square** of the log: 390 ms for a 1-year log with one rule.
- **GNSS, leap seconds and time scales are already arithmetic.** `gnssWeek.ts`,
  `leapSeconds.ts` and `timescale/` use division, modulus and table lookups. No loop there
  grows with the span.
- **Nothing guards either.** There is no benchmark, no size budget, and no performance rule in
  `tdd-dev`, `gmt-reviewer`, the review checklist or the coding standards. The only related
  rule is "an exhausted loop returns the sentinel".

## Part 1 — Bundle size

### Where the bytes are

Root entry, every export, minified (esbuild, measured from `src/`; it matches bundlephobia's
figure within 4%):

| Area                   | Minified | Note                                                 |
| ---------------------- | -------: | ---------------------------------------------------- |
| `@js-temporal/polyfill` + `jsbi` | 153 kB | 44 kB gzipped. Flagged side-effectful (`./tsc-out/calendar.js`) |
| `internal/`            |   160 kB | Largest: `dutyEngine` 21.9, `zonedWallClockDifference` 14.8, `temporalCompat/repros` 12.0, `operatingSchedule` 6.7, `dutyRules` 6.6 |
| `plain/`               |    63 kB |                                                      |
| `zoned/`               |    26 kB |                                                      |
| `utc/` + `unix/`       |    31 kB |                                                      |
| All realm namespaces   |    30 kB | `intermodal`, `transport`, `calendar`, `workforce`, `gnss`, `timescale`, … |
| **Total**              | **486 kB** | **126.5 kB gzipped**                               |

### What a real user pays (tree-shaken, one function imported)

| Import                 | Minified | Gzipped | Polyfill share | GMT code | Of which `repros.ts` |
| ---------------------- | -------: | ------: | -------------: | -------: | -------------------: |
| `isValidDate`          | 153.3 kB | 44.7 kB |       152.5 kB |   0.8 kB |                    — |
| `formatDate`           | 155.4 kB | 45.4 kB |       152.5 kB |   2.8 kB |                    — |
| `businessDaysBetween`  | 172.5 kB | 50.2 kB |       152.6 kB |  19.9 kB |              12.0 kB |
| `addBusinessDays`      | 173.6 kB | 50.7 kB |       152.6 kB |  21.0 kB |              12.0 kB |
| `chargeableDays`       | 197.3 kB | 58.0 kB |       152.6 kB |  44.7 kB |              12.0 kB |
| `operatingTimeBetween` | 200.8 kB | 59.0 kB |       152.6 kB |  48.2 kB |              12.0 kB |
| `dutyViolations`       | 226.7 kB | 67.3 kB |       152.6 kB |  74.1 kB |              12.0 kB |

For reference, bundlephobia's whole-package figures: `temporal-polyfill@0.3.0` 54.4 kB / 19.9 kB
gzipped; `date-fns@4.1.0` 70.7 / 17.5; `luxon@3.7.2` 69.8 / 21.9. The npm tarball unpacks to
4.66 MB in 1,837 files (JSDoc kept in `dist/*.js`, plus `skills/`).

### Findings

**S1 — The polyfill is the floor under every import (44 kB gzipped).**
`src/index.ts:1` re-exports the whole polyfill (`export * from "@js-temporal/polyfill"`), and
698 source lines import it directly. The polyfill ships as one 129 kB ESM file that declares a
side effect, so no bundler can trim it. This is the single biggest lever. Options, in order of
effort:

1. **One import seam.** Route every `Temporal` import through one internal module
   (`internal/temporal.ts`). No change in behaviour. Every option below depends on it.
2. **Drop the root re-export.** GMT's contract is string-in, string-out (Core Rule 2), so
   handing out the polyfill's `Temporal` from the root is outside that contract. It also ties
   the public surface to one polyfill. Removing it is a breaking change, and a breaking change
   is acceptable here.
3. **Native-first.** Chromium already ships native Temporal (the `compat:oracle` scan runs on
   it). A build that reads `globalThis.Temporal` and loads the polyfill only where it is
   missing removes the 44 kB for those users. It needs a second entry or a conditional export,
   because a static `import` of the polyfill always bundles it. The `temporalCompat` probes
   already test behaviour rather than versions, so the workarounds keep working on whichever
   implementation is present. Engine support in Firefox, Safari and Node must be confirmed
   from each vendor's release notes before choosing.
4. **A smaller polyfill.** `temporal-polyfill` is 19.9 kB gzipped against 45.2 kB. The
   probes would gate its defects the same way. It needs the full zone, locale and calendar
   matrix plus `pnpm compat:oracle` before adopting.

**S2 — Canary fixtures ship to production (12 kB minified).**
`internal/temporalCompat/capabilities.ts:1` imports the whole `repros` table from
`repros.ts`. That table holds every repro with its `expected` value, including the
canary-only groups (`zoned.A`, `zoned.B`, `zoned.D`, `zoned.E`, `D9`) that no probe reads. So
any function that reaches a calendar or zone workaround carries all of it. Fix: move the
canary-only repros into their own module that only the canary script loads. Then key the
probe repros so each probe imports only its own, which lets the bundler drop the rest.

**S3 — No size budget or measurement.** No `size-limit`, no CI step, no script. Size has grown
each release from 1.14.2 to 1.19.0 without anyone choosing it.
Fix: a `scripts/bundle-size.mjs` that bundles in memory with esbuild (`write: false`, so `dist`
and the Dox dev server are untouched). It reports these three figures, and `validate` fails
when any of them grows past a budget:

- (a) the root entry,
- (b) the polyfill floor,
- (c) a fixed set of single-function imports (the table above).

The measurement used for this audit is in the appendix.

**S4 — The headline figure is the wrong one to read.** Bundlephobia shows the cost of
importing everything. Nobody does that, and the per-function table above is what a user
actually pays. Once S3 exists, generate that table into a Dox guide page so the true cost is
published rather than argued.

**S5 — Large internals are feature-sized, not waste.** `dutyEngine.ts` (21.9 kB) and
`zonedWallClockDifference.ts` (14.8 kB) are paid only by users of those functions. They are not
a priority for size. Comments are already stripped by any minifier. Keeping JSDoc in
`dist/*.js` only affects install size, not bundle size.

Clean: no TypeScript `enum`, no `Intl` object built at module load, `sideEffects: false` is
declared, and tree-shaking demonstrably drops unused GMT modules.

## Part 2 — Loop performance

### What "Big O" means here

- O(1) means the cost does not change with the input.
- O(n) means it grows in step with n. Here n is days in a span, entries in a log, or
  holidays in a calendar.
- O(n²) means doubling n quadruples the cost.

A loop that walks a span one day at a time, doing Temporal work every day, is O(days). That
work is about 10–30 object builds or parses per step. A formula reaches the same answer in
O(1) or O(log n). Examples are whole weeks × business days per week, prefix sums, and a binary
search over a sorted table.

### Measured

| Function                  | Input                   |      Time | Growth                 |
| ------------------------- | ----------------------- | --------: | ---------------------- |
| `dutyViolations` (1 rule) | 7 / 90 / 180 / 365 days of log (42–2,190 entries) | 7 / 29 / 99 / 390 ms | **quadratic**: ×4 per doubling |
| `operatingTimeBetween`    | 1 week / 1 year / 10 years, `Europe/London` | 3 / 44 / 395 ms | linear, ~40 ms per year |
| `chargeableDays`          | 2-week / 2-year dwell   | 0.8 / 36 ms | linear, ~18 ms per year |
| `businessDaysBetween`     | 1 year / 30 years, 480 holidays | 3.0 / 3.0 ms | flat: all cost is holiday parsing |
| `addBusinessDays`         | 10 days no holidays / 1 y / 10 y / 30 y with 480 holidays | 0.08 / 1.7 / 1.8 / 2.8 ms | mostly holiday parsing; the span walk adds ~1 ms over 30 years |

### Findings, ranked by real-world impact

**P1 — Duty-log scan is O(N² log N). `internal/dutyEngine.ts`.**
`ruleViolations` (`:2289`) evaluates every candidate instant. `evaluateRule` (`:1109`) then
copies the log up to that instant with `clip` (`:208`, O(N)) and rebuilds and re-sorts runs with
`runsOf` (O(N log N)). It does this at `:1126`, `:1145`, `:1235`, `:1281`, `:1294`, `:959`,
`:1461` and `:1544`. `timeIn` (`:335`) adds another O(N). Only `freePeriod` uses the cached runs.
A 2-year log would take about 1.6 s per rule.
**Fix:** build per-status runs and prefix sums once per context.

- `timeIn(S, a, b)` becomes `cum_S(b) − cum_S(a)`, where `cum_S` is a binary search into the
  prefix-sum array plus the one straddling entry.
- "The log as of `at`" becomes the whole-log runs cut at `at` by binary search. Only the
  straddling run changes.
- `lastAtLeast(c)` becomes a binary search over the precomputed runs of length ≥ c.
- Drop `clip`.

The total becomes O((N + C) log N). Also:

- `candidateInstants` (`:2050`) has an R × R loop over rest runs that only `continue`s. Break
  once the gap exceeds 2 × shift.
- The forward 30-day chunks (`:2353`) rebuild candidates from the whole log each time.
- `dutyPeriods.ts:212` inserts into a sorted cache with `splice`, which is O(n) per insert at
  the front.

**P2 — Operating-hours schedule walks every local day. `internal/operatingSchedule.ts:714`.**
`walkSchedule` runs under `operatingTimeBetween`, `operatingIntervals`, `recurringWindows`,
`nextOpenAt`, `nextCloseAt` and `addOperatingTime`. Each day it computes the next day start
(8–12 Temporal ops plus a transition search). Each window edge then goes through `resolveEdge`
(`:473`), which builds a string, calls the public `resolveLocal`, and parses the result again
with `Temporal.Instant.from`. That is 5–6 Temporal parses per edge, about 30 ops per day.
**Fix:**

1. Resolve wall times straight to epoch nanoseconds, with no string round-trip, and validate
   the zone once.
2. Use a closed form inside each stretch with no offset change. With `W` = open time in one
   week:
   `total = ⌊d/7⌋·W + (open time on the leftover days) − (open time lost to holidays in range) + (override deltas in range)`.
3. `addOperatingTime`: jump `⌊remaining / W⌋` whole weeks, correct for holidays and overrides
   in the jump, then walk at most 7 days.
4. `nextOpenAt`: skip runs of closed days by holiday lookup instead of walking.

The cost becomes O(transitions + holidays in range), not O(days).

**P3 — Free-time and demurrage ledger walks one local day at a time.
`internal/freeTimeLedger.ts:321`.** `walkFreeTime` runs under `chargeableDays`,
`freeTimeExpiry` and `billingTimeline`. It does about 15 Temporal ops per day.
**Fix:**

- Between offset changes, a local day start is `epochDay × 86 400 s − offset`.
  `businessCalendar.ts` already has integer `isoFieldsOf` / `epochDayOf` to turn that into a
  date.
- Counts and expiry follow from the weekday-count formula minus holidays found by binary
  search.
- Only `chargedDates` stays O(days), because it is output. It can be emitted from integers
  without Temporal.

**P4 — Zone transition search has no cache. `internal/zonedTransitionSearch.ts:174, 196, 235`,
`internal/zoneBucketCap.ts:62`.**

- The search samples every 5 days, building a `ZonedDateTime` each time. It is active on
  polyfill 0.5.1 because the D13 probe fails.
- With no limit, a zone with no further changes scans to 3 years past `max(from, now)`. That is
  about 6,000 reads from 1950 in `Asia/Kolkata`.
- `Temporal.Now.instant()` is read on every call.
- `certainlyTouchesMoreBuckets` calls `zonedNextTransition` **without `until`**. That can mean
  about 370k builds for a yes/no pre-check.

**Fix:**

1. Pass `prefixEndNs` as `until`.
2. Keep a per-zone memo of transitions found and of intervals verified to have no change.
   P2, P3, P1's period walk and `bucketRange` then reuse it.
3. Read the clock once per public call.

**P5 — Holidays are re-parsed through Temporal on every call. `internal/businessCalendar.ts`,
`calendar/business/businessDaysBetween.ts:32`, `transport/calculate/cutoffSchedule.ts:95`,
`calendar/business/mergeCalendars.ts:67`.**

- `businessDaysBetween` parses each holiday three times per call (twice to validate, once to
  count) and compares it twice. That is the whole 3 ms in the table.
- `isBusinessEpochDay` (`businessCalendar.ts:220`) builds an ISO string for every day stepped,
  to look it up in a `Set<string>`.
- `cutoffSchedule` re-validates and re-parses the full calendar once per cutoff.
- `mergeCalendars` sorts with a comparator that parses both strings on every comparison.

**Fix:**

- Parse each holiday once, with integer arithmetic (`YYYY-MM-DD` → epoch day; validation
  already guarantees the shape), into a sorted `Int32Array` with weekend holidays removed.
- Count holidays in a range with two binary searches: O(log H).
- Resolve the calendar once and pass the resolved form to an internal core, so no public
  function calls another public function in a loop.
- For `addBusinessDays`:
  1. Jump `⌊(n − 1)/b⌋` whole weeks, where `b` is the number of business days per week.
  2. Add back the holidays that fall inside the jump.
  3. Walk at most 7 days.

  This matters less than the parsing: the measured span cost is about 1 ms over 30 years.

**P6 — `Intl.DateTimeFormat` built on every call, often twice.**

- `formatDate.ts:57/69`, `formatTime.ts:54/63`, `instantFormatOptions.ts:105/114/121` and
  `joinDateTimeConnector.ts:58/73` each build a formatter on every call.
- `getLocaleMonthNames.ts:55` and `getLocaleWeekdayNames.ts` call `toLocaleString` 12 and 7
  times, building a formatter each time.

These costs are constant per call, not span-dependent, but formatter construction is one of
the most expensive operations in `Intl`. **Fix:** a small cache keyed by locale plus resolved
options, and one formatter per name loop.

**Lower impact:**

- `isValidTimeZone` builds a `ZonedDateTime` on every call; caching the zone ids already
  validated removes it.
- `intervalDivideEqually*` formats each inner boundary twice.
- `zonedLocalDates.ts:56` uses `PlainDate.until` where integer `epochDayOf` would do.
- `leapSeconds.ts` scans its 28 rows linearly. That cost is fixed, and a binary search is
  optional.

**Already closed-form or bounded (about 185 loop sites):**

- GNSS week, rollover and pivot-era arithmetic.
- Time scales and `leapSecondsBetween`.
- Weekday and week-of-month arithmetic.
- `countZonedBuckets`, `countZonedLocalDates`, `dwellTime` and `intervalCount*`, which are
  O(transitions).
- Bisections and fixed-cap searches in `zonedWallClock*` and `temporalCompat/*`.
- Parsers, which are O(input length).
- `mapDatesInRange` and `bucketRange`, which are O(output) and anchored at `start + k·step`.

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
