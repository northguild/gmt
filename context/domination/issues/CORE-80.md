# CORE-80 — Core: Faster span arithmetic and a smaller bundle

**Scope:** Lower what one GMT import costs a user, replace the loops that walk a span day by day with closed forms, and add the benchmarks, size budget and agent rules that keep both from drifting back. The findings, measurements and fixes are in [perf-and-bundle-size-audit.md](../../perf-and-bundle-size-audit.md); this story builds them.

## Gap

**Size.** Importing everything costs 467.6 kB minified, 119.6 kB gzipped. Tree-shaking works for GMT's own code, but every import also carries `@js-temporal/polyfill`, 44 kB gzipped, which declares a side effect and cannot be trimmed. `isValidDate`, 0.8 kB of GMT code, costs 44.7 kB. `src/index.ts` re-exports the whole polyfill (it still does: removing the re-export saves 0 bytes, because the polyfill is bundled either way). `internal/temporalCompat/repros.ts` puts 12 kB of canary fixtures into every function that reaches a calendar or zone workaround. Nothing measures size, so it has grown every release without anyone choosing it.

**Speed.** Five loop families grow with the input instead of with the answer:

| Where                                                    | Measured                                     | Growth                    |
| -------------------------------------------------------- | -------------------------------------------- | ------------------------- |
| `internal/dutyEngine.ts` (`dutyViolations`)              | 99 ms for a 6-month log, 390 ms for 1 year   | Quadratic in log length   |
| `internal/operatingSchedule.ts` (`operatingTimeBetween`) | 44 ms for 1 year, 395 ms for 10 years        | Linear in days            |
| `internal/freeTimeLedger.ts` (`chargeableDays`)          | 0.8 ms for 2 weeks, 36 ms for 2 years        | Linear in days            |
| `internal/zonedTransitionSearch.ts`, `zoneBucketCap.ts`  | Up to ~370k zone reads for one pre-check     | Linear in span, uncached  |
| `internal/businessCalendar.ts` and its callers           | Flat 1.6–3 ms per call with 480 holidays     | Linear in holidays        |

`Intl.DateTimeFormat` is also built on every call, often twice.

**Rules.** No agent or checklist asks what bounds a loop or what a change adds to the bundle.

## Scope

In build order. Each part leaves `pnpm run validate` green on its own.

1. **Harness.** `*.bench.ts` (Vitest bench) for every function in the speed table, each at a short, a 1-year and a 10-year input. `scripts/bundle-size.mjs` bundles in memory with esbuild (`write: false`) and reports the root entry, the polyfill floor and a fixed set of single-function imports. `validate` fails when one grows past its budget.
2. **Temporal seam.** Every library `Temporal` import goes through one internal module, `internal/temporal.ts`. The root and the namespace entry points keep re-exporting `Temporal`, `Intl` and `toTemporalInstant`, now from the seam, so no export changes.
3. **Repro split.** Canary-only repros (`zoned.A`, `zoned.B`, `zoned.D`, `zoned.E`, `D9`) move to a module only the canary loads. Each probe imports only its own repros.
4. **Duty engine.** Per-status runs and prefix sums built once per context. Time in a status between two instants is a difference of two prefix sums found by binary search. Drop the per-candidate `clip`. Target O((N + C) log N).
5. **Zone transitions.** Pass `until` in `certainlyTouchesMoreBuckets`. Keep a per-zone memo of transitions found and of stretches verified to have none. Read the clock once per public call.
6. **Epoch-day walks.** `walkSchedule` and `walkFreeTime` work in epoch days and epoch nanoseconds inside each stretch with no offset change. Counts use whole weeks times the weekly total, plus the leftover days, minus holidays found by binary search. Wall times resolve straight to epoch nanoseconds, with no string round-trip.
7. **Calendar resolution and formatter caches.** Holidays parsed once, by integer arithmetic, into a sorted array of epoch days. Calendars, schedules and zones resolved once per public call and handed to an internal core. Formatters cached by locale and resolved options.
8. **Polyfill strategy.** `@js-temporal/polyfill` stays the only engine in the published package. The seam from part 2 exists so CORE-82 can run the suite on native `Temporal`, not to switch engines. Host `Temporal` is reconsidered only when both hold: a stable Safari release ships `Temporal`, and CORE-82's weekly leg has passed on Node 26, Chromium and Firefox for 12 consecutive weekly runs. Until then a host engine would change GMT's answers by browser, and the bundle saving would reach only some users.
9. **Agent and rule changes.** A *Performance shape* section in `.agents/tdd-dev.md`, a *Cost* step in `.agents/gmt-reviewer.md`, three items in `context/code-review-checklist.md`, and a *Loop cost* paragraph in `context/coding-standards.md § Loop Style`. The text is in Part 3 of the audit.

## Tool

None. The story changes no output and adds no function. The size budgets and benchmark results are reported by `validate` and the PR, not by a widget.

## Design notes

- **No output changes.** Every existing row stays green on the full zone, locale and calendar matrix. An optimisation that changes any output is a defect. Running the old and new implementations side by side over random inputs is a useful check, but never the source of an expected value: GMT is never its own oracle.
- **Closed forms hold only between offset changes.** Find the transitions first, then apply the formula to each stretch between them. A local day is not always 24 hours.
- **Output stays O(output).** A function that returns one item per day, such as `chargedDates`, still emits one item per day, but builds it from integers, not Temporal objects.
- **Timing is never asserted in an `it` row.** It is flaky across the 30-leg CI matrix. Benchmarks report; the size budget fails `validate`.
- **Size is measured without building.** The script bundles in memory, so `dist` and the Dox dev server are untouched.
- **The root polyfill re-export stays.** Removing it saves 0 bytes (measured), and the story changes no export. The changeset is `patch`, per [coding-standards § Changesets](../../coding-standards.md#changesets), and states the savings.

## What gmt provides (do not re-implement)

- `internal/businessCalendar.ts` — `epochDayOf` and `isoFieldsOf`, integer date arithmetic
- `internal/zonedBucket.ts` — real zone boundaries (coding-standards § Calendar & zone semantics)
- `internal/dutyEngine.ts` — `logRuns` and `runsBetween`, the cached runs and binary search `freePeriod` already uses
- `internal/temporalCompat/` — workarounds gated by behaviour probes, which keep working on any `Temporal` implementation

## Verification

- **Benchmarks**, recorded before and after in the PR, against the baselines in the speed table:
  - `dutyViolations`: a 365-day log takes no more than 5× a 90-day log (it is 13× today).
  - `operatingTimeBetween` and `chargeableDays`: a 10-year span takes no more than 2× a 1-year span.
  - `businessDaysBetween` and `addBusinessDays` with 480 holidays: no per-call cost that grows with the holiday count beyond a binary search.
- **Size:** the script runs in `validate` and passes its budgets. `repros.ts`'s canary-only groups are absent from an `addBusinessDays` bundle.
- **Correctness:** the full gmt suite passes across CI's 10 zones × Node 22/24/26. `pnpm compat:oracle` exits 0 after any change under `internal/temporalCompat/` or `internal/zonedWallClock*`.
- **Rules:** the four agent and rule files carry the text from Part 3 of the audit.
- `pnpm run validate` stays green

## Decisions

Stated as current rules. Where each rule is enforced is named beside it.

**Order and budgets**

- CORE-80 lands before CORE-86 and CORE-87. CORE-87 adds its own subpath budget to `scripts/bundle-size.budgets.json` when it lands.
- A size budget is an entry's minified size after the last code change, plus 1%, rounded up to the next 0.1 kB. `pnpm run validate` fails above it. A budget is raised only by a reviewed edit to the budgets file.
- Interim budgets follow one rule: cut bytes first, then raise. The root and `operatingTimeBetween` budgets were raised because the day-by-day schedule walk stays beside the new walk, near Temporal's limits.
- A cost finding blocks in new or changed code only. One in code the diff did not touch is reported, not blocking.
- The polyfill stays the only engine in the published package. The seam exists so CORE-82 can run the suite on native `Temporal`. Host `Temporal` is reconsidered only when a stable Safari ships it and CORE-82's weekly leg has passed on Node 26, Chromium and Firefox for 12 consecutive weekly runs.
- A speed or size change with no output change is a `patch`, and its changeset states the savings (row in [coding-standards § Changesets](../../coding-standards.md#changesets)).

**Rules the change adds** (live in [coding-standards § Loop cost](../../coding-standards.md#loop-cost), the tdd-dev and gmt-reviewer personas, and the code-review checklist)

- No output changes. Old against new over random inputs is a check, never an expected value: GMT is never its own oracle.
- Closed forms hold only between offset changes. Find the changes first (the runtime finds them, never inference), then apply the formula to each stretch. Every transition search a closed form makes passes a limit, because a search with none may stop at an implementation horizon.
- Holidays are parsed by Temporal once per distinct string and memoised, never by hand-written string parsing. What stops growing with the holiday count is the Temporal work and every lookup.
- A per-process memo is sound only for a pure function of its key for the life of the process: zone transitions, parsed holiday strings, validated zone ids, formatters built from explicit arguments. Each is bounded and cleared on overflow. A horizon-dependent `null` is never stored. The formatter cache drops a kind once `Intl[kind]` is replaced, so a polyfill loaded later or a test stub is always the one that answers.
- Caps return the sentinel, never a partial value.
- Timing is never asserted in an `it` row; benchmarks report and the size budget fails `validate`.

**Free time (`chargeableDays`, `freeTimeExpiry`)**

- The closed-form walk counts dates by epoch day. It falls back to the day-by-day walk for the whole call when the clock is within `MAX_WALKED_DAYS + 100` days of Temporal's first or last instant (the dwell's last instant counts at the far end), and when the clock sits in a pass that re-enters its date, such as `America/Goose_Bay` 2010-11-07.
- A change back of a whole day or more needs no fallback: visited dates fold a re-entered date into one visit. `America/Sitka` 1867-10-18, `Pacific/Apia` 1892-07-04 and `Asia/Manila` 1844-12-31 answer the same as the day-by-day walk.
- The pre-check `certainlyTouchesMoreBuckets` runs only when the UTC day count exceeds `MAX_WALKED_DAYS - 2`.
- The speed target is on the walk excluding output. `chargedDates` is one string per charged day, so its output grows about 10 times from 1 year to 10. A 10-year dwell with small output runs in 1.9 times the 1-year time.

**Resolve once and formatters**

- A formatter is cached only when its locale is a string or non-empty array (an array is read once through `Intl.getCanonicalLocales`), a `DateTimeFormat` has a `timeZone` string, and every option value is a string, number, boolean or `undefined`. Anything else, including a call with the locale omitted, is built fresh, because the default locale and default zone are process state.
- The key is the kind plus `JSON.stringify([locale, options])`. Options are read through property descriptors, so an accessor is never run. The bound is 256 formatters per kind, cleared on overflow. `clearFormatterCache()` is the test seam.
- `checkFormatterArguments` builds a formatter once to raise the error `Intl` raises, and never caches a failure.
- Every `new Intl.*Format` in shipped code goes through `internal/formatterCache.ts`, except the default-locale read in `internal/resolveLocale.ts`.
- `isValidTimeZone` remembers ids that passed (bound 1,024, cleared on overflow) and never stores a failure. The `isValid*` validators are one-line wrappers over cores in `internal/inputChecks.ts`, so no public function calls another.
- `cutoffAt` and `cutoffSchedule` share `internal/cutoffAtResolved.ts`; `rollDate` and the cutoff code share `internal/rollBusinessDate.ts`. `cutoffSchedule` reads `options` once and resolves its zone, calendar and anchor lazily at the first entry, so an empty list reads none of them. A repeated hour takes its first occurrence; a skipped one gives `null`.
- `addBusinessDays` and `businessDaysBetween` carry `internal/zonedWallClock.ts` and `internal/temporalCompat/probeRepros.ts` in their `absent` lists, so the zone check cannot pull the workarounds back in.

**Loop sweep**

- Three loops grew with the span beyond their answer: `countZonedBuckets`, `countZonedLocalDates` and the `intervalSplitAtZoned` sort comparator. They are fixed. The other shipped loops are bounded by a constant, by the output, or by one pass over the caller's own array.
- Bucket counts use the integer day rule over memoised offset changes. `offsetTimeline` takes a `maxChanges` limit and answers `null` past it.
- `intervalSplitAtZoned` pairs each point with its epoch nanoseconds once, then filters, sorts and de-duplicates on the bigint. With 1,000 points it reaches 0.86 times the old time, not 0.6 times: the rest is per-point parsing and formatting, which this change does not touch.
- Warm 100-year spans cost about 2 ms, against 42 to 48 ms. A cold 100-year span is bounded by the raw transition search, which waits on the upstream D13 fix.

**Baseline.** The before figures in the PR were taken on Node 24.21.0 (esbuild 0.28.2, Vitest 4.1.4, macOS arm64) on 2026-10-18, at commit bc53b3e7 plus the benchmark harness, before the `Temporal` seam. The raw files, `baseline/size.json` and `baseline/bench.json` under the CORE-80 spec folder, stay in git history at commit 6f18e6a0 (`git show 6f18e6a0:context/domination/specs/CORE-80/baseline/size.json`); `pnpm size --compare` and `pnpm bench --compare` read that format. No script or bench file reads them.
