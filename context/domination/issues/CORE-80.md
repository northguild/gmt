# CORE-80 — Core: Faster span arithmetic and a smaller bundle

**Scope:** Lower what one GMT import costs a user, replace the loops that walk a span day by day with closed forms, and add the benchmarks, size budget and agent rules that keep both from drifting back. The findings, measurements and fixes are in [perf-and-bundle-size-audit.md](../../perf-and-bundle-size-audit.md); this story builds them.

## Gap

**Size.** Importing everything costs 467.6 kB minified, 119.6 kB gzipped. Tree-shaking works for GMT's own code, but every import also carries `@js-temporal/polyfill`, 44 kB gzipped, which declares a side effect and cannot be trimmed. `isValidDate`, 0.8 kB of GMT code, costs 44.7 kB. `src/index.ts` re-exports the whole polyfill. `internal/temporalCompat/repros.ts` puts 12 kB of canary fixtures into every function that reaches a calendar or zone workaround. Nothing measures size, so it has grown every release without anyone choosing it.

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
2. **Temporal seam.** Every `Temporal` import goes through one internal module. Remove `export * from "@js-temporal/polyfill"` from `src/index.ts`.
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
- **Removing the root polyfill re-export is a breaking change.** It takes a `minor` changeset with a **Breaking changes** section, per the changeset rule. GMT's contract is string-in, string-out, so no public function changes.

## Decisions needed before building

1. **Size budgets.** The figures that fail `validate` for the root entry and for single-function imports.
2. **Whether cost findings block** new code in review.

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
- **Size:** the script runs in `validate` and passes its budgets. `repros.ts`'s canary-only groups are absent from an `addBusinessDays` bundle. The root entry no longer re-exports the polyfill.
- **Correctness:** the full gmt suite passes across CI's 10 zones × Node 22/24/26. `pnpm compat:oracle` exits 0 after any change under `internal/temporalCompat/` or `internal/zonedWallClock*`.
- **Rules:** the four agent and rule files carry the text from Part 3 of the audit.
- `pnpm run validate` stays green
