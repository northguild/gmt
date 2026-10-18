---
story: CORE-80
issue: 316
status: approved
dox: none
---

# CORE-80 — Faster span arithmetic and a smaller bundle

Story: [issues/CORE-80.md](../../issues/CORE-80.md). Findings and method:
[perf-and-bundle-size-audit.md](../../../perf-and-bundle-size-audit.md). Not blocked (tracker row
24, `Blocked by` empty). No new story dependency: every primitive used is in the story's
"What gmt provides" list.

## Scope

Eleven slices in build order. Each leaves `pnpm run validate` green on its own and changes no output
of any public function, and the public surface is unchanged.

Corrections to the story text, found while planning:

- `epochDayOf` and `isoFieldsOf` exist in `internal/businessCalendar.ts` but are not exported.
  Slice 6 moves them, with `isoDateString`, into `internal/epochDay.ts`.
- Holidays are not parsed "by integer arithmetic": manual string parsing is forbidden
  ([coding-standards § Forbidden](../../../coding-standards.md#forbidden)). They are parsed by
  Temporal once per distinct string and memoised (slice 6). Reading a caller's holiday array is
  still linear in its length; what stops growing with the count is the Temporal work and every
  lookup.
- Slice 6 (holidays as epoch days) comes before the schedule and free-time walks, which need it.
- The Intl formatter caches are their own slice (9), after the walks.
- A sweep of every other shipped loop (slice 10) found two loops and one sort comparator whose
  cost grows beyond their output; it fixes them and lists the 104 safe loops.

## Baselines (Node 24.21.0, this branch, audit inputs)

Planning figures. The PR compares against the snapshot slice 1 takes before slice 2
([harness.md § C](./harness.md#c-the-before-snapshot)).

| Function                                     | Short          | 1 year   | 10 years / long  |
| -------------------------------------------- | -------------- | -------- | ---------------- |
| `dutyViolations` (log length)                | 7 d 1.56 ms    | 90 d 25.9 ms, 180 d 93.4 ms | 365 d 383 ms (14.8x 90 d) |
| `operatingTimeBetween` (`Europe/London`)     | 1 w 2.69 ms    | 44.9 ms  | 408 ms           |
| `chargeableDays` (`America/Port_of_Spain`)   | 2 w 3.16 ms    | 23.0 ms  | 196 ms           |
| `businessDaysBetween`, 480 holidays          | —              | 3.37 ms  | 30 y 2.60 ms     |
| `addBusinessDays`, 480 holidays              | 0 holidays 0.01 ms | 2.16 ms | 30 y 2.51 ms  |

| Entry (esbuild, minified / gzipped kB) | Size          | Of which                         |
| -------------------------------------- | ------------- | -------------------------------- |
| root `@northguild/gmt`                 | 487.1 / 128.4 | polyfill 153.1, `repros.ts` 12.0 |
| polyfill alone (the floor)             | 152.5 / 44.3  |                                  |
| `isValidDate`                          | 153.3 / 44.7  |                                  |
| `formatDate`                           | 155.4 / 45.4  |                                  |
| `businessDaysBetween`                  | 172.5 / 50.2  | `repros.ts` 12.0                 |
| `addBusinessDays`                      | 173.6 / 50.7  |                                  |
| `chargeableDays`                       | 197.3 / 58.0  |                                  |
| `operatingTimeBetween`                 | 200.8 / 59.0  |                                  |
| `dutyViolations`                       | 226.7 / 67.3  |                                  |

## Signatures

No public function signature, output or export changes. The root and the 16 namespace entry
points keep re-exporting `Temporal`, `Intl` and `toTemporalInstant`, now from the seam (slice 2).
Changeset: `patch`, carrying the headline savings (slice 2 § B, owner decision 4).

Internal signatures each slice adds are in that slice.

## Files

| Slice | Files (`packages/gmt/src/` unless rooted)                                                 |
| ----- | ----------------------------------------------------------------------------------------- |
| 1     | `packages/gmt/bench/*.bench.ts`, `packages/gmt/vitest.bench.config.ts`, `scripts/bundle-size.mjs`, `scripts/bundle-size.budgets.json`, root and gmt `package.json`, `tsconfig.json`, `context/domination/specs/CORE-80/baseline/*` |
| 2     | `internal/temporal.ts`; every file importing the polyfill; 17 `index.ts`; both `oxlint.config.mts` |
| 3     | `internal/temporalCompat/{repros,probeRepros,capabilities,README}.*`, `scripts/temporal-compat.mjs` |
| 4     | `internal/dutyEngine.ts`, `internal/dutyLog.ts`, `internal/dutyPeriods.ts`, `workforce/calculate/{qualifyingRestPairs,longestRun,qualifyingRests,dutyTotals}.ts` |
| 5     | `internal/zonedTransitionSearch.ts`, `internal/zoneBucketCap.ts`, `internal/zonedWallClockOperations.ts` |
| 6     | `internal/epochDay.ts`, `internal/businessCalendar.ts`, `internal/operatingSchedule.ts` (holiday type only), `calendar/business/{businessDaysBetween,mergeCalendars}.ts`; callers in the slice's table compile unchanged |
| 7     | `internal/offsetTimeline.ts`, `internal/operatingSchedule.ts`, `calendar/hours/{operatingTimeBetween,addOperatingTime}.ts` |
| 8     | `internal/freeTimeLedger.ts`, `intermodal/calculate/{chargeableDays,freeTimeExpiry}.ts` |
| 9     | `internal/formatterCache.ts`, `internal/rollBusinessDate.ts`, the formatter sites listed in the slice, `transport/calculate/{cutoffAt,cutoffSchedule}.ts`, `calendar/business/rollDate.ts`, `zoned/validate/isValidTimeZone.ts` |
| 10    | `internal/zonedBucket.ts`, `internal/zonedLocalDates.ts`, `internal/offsetTimeline.ts` (`maxChanges`), `zoned/interval/intervalSplitAtZoned.ts`, `scripts/bundle-size.budgets.json` |
| 11    | `.agents/tdd-dev.md`, `.agents/gmt-reviewer.md`, `context/code-review-checklist.md`, `context/coding-standards.md`, `.agents/architect.md` |

## Authority — what each rule rests on

| Rule | Source |
| ---- | ------ |
| Epoch days count from 1970-01-01; proleptic Gregorian year, month and day from them | ECMA-262 §21.4.1 time-value operations `Day`, `DayFromYear`, `MakeDay`; TC39 Temporal `ISODateToEpochDays`, `EpochDaysToISODate` (in `GetISOPartsFromEpoch`) |
| ISO weekday = `((epochDay + 3) mod 7) + 1`, Monday = 1 | ECMA-262 §21.4.1 `WeekDay(t)` = (Day(t) + 4) modulo 7 with Sunday = 0, so 1970-01-01 is a Thursday; TC39 Temporal `ISODayOfWeek` numbers Monday 1 to Sunday 7 |
| Dates outside -271821-04-19 .. +275760-09-13 never reach the integer path | TC39 Temporal `ISODateWithinLimits` |
| A wall time maps to exactly `wall - offset` when the offset is the same a day either side of it | TC39 Temporal `GetPossibleEpochNanoseconds` (one candidate when no transition is near); `DisambiguatePossibleEpochNanoseconds` applies only with zero or two candidates |
| A day starts at its first instant; a skipped midnight starts the day at the change that ends the gap | TC39 Temporal `GetStartOfDay` |
| A wall time read as UTC is `epochDay · 86,400 s + time of day`; a gap moves it by the offset difference, back for `"earlier"`, forward otherwise | TC39 Temporal `GetUTCEpochNanoseconds`, `DisambiguatePossibleEpochNanoseconds` |
| A transition search with no limit may stop at an implementation horizon, so every search the closed forms make passes one | TC39 Temporal `GetNamedTimeZoneNextTransition` (horizon left to the implementation) |
| Transitions are found by the runtime, never inferred | TC39 Temporal `GetNamedTimeZoneNextTransition`, `GetNamedTimeZonePreviousTransition`; `ZonedDateTime.prototype.getTimeZoneTransition` |
| An instant's local date is `⌊(epochNs + offsetNs) / day⌋` epoch days | TC39 Temporal `GetISODateTimeFor`; ECMA-262 §21.4.1 `Day` |
| Instants order by epoch nanoseconds; a sort keeps equal elements in input order | TC39 Temporal `Temporal.Instant.compare` (`CompareEpochNanoseconds`); ECMA-262 `Array.prototype.sort` (stable since ES2019) |
| Transitions fall on whole seconds | RFC 9636 §3.2 (TZif transition times are 64-bit seconds) |
| Intervals are half-open; the length of a union is the sum of its lengths over disjoint pieces | EWD831; [coding-standards § Calendar & zone semantics 8](../../../coding-standards.md#8-intervals-are-half-open-start-end) |
| A day is not always 24 hours; boundaries come from the zone | [coding-standards § Calendar & zone semantics 2](../../../coding-standards.md#2-zone-aware-unit-boundaries-are-never-truncate-and-re-resolve) |
| Caps return the sentinel, never a partial value | [coding-standards § Loop Style](../../../coding-standards.md#loop-style); [§ API Contract](../../../coding-standards.md#api-contract) |
| A speed or size change with no output change is `patch` | **GMT rule**, owner decision 4; added to [coding-standards § Changesets](../../../coding-standards.md#changesets) in slice 11 |
| No output changes; old-vs-new runs are a check, never an expected value | **GMT rule.** The story's design note: GMT is never its own oracle |
| A per-process memo of zone transitions and of parsed holiday strings is sound | **GMT rule.** Both are pure functions of their key for the life of the process: the polyfill reads offsets from the host's `Intl` data, loaded once. A horizon-dependent `null` is never stored (slice 5) |
| Memo and cache bounds; the formatter cache key | **GMT rule.** Bounded so a long-running process cannot grow without limit. Reasoning in slices 5, 6 and 9 |
| Size budgets and what they gate | **GMT rule** (owner decision 2): each entry's minified size after slice 10, the last code slice, plus 1%, rounded up to the next 0.1 kB; `validate` fails above it; a budget is raised only by a reviewed edit to the budgets file |

## Slices

| # | Slice | Target |
| - | ----- | ------ |
| 1 | [harness.md](./harness.md) | Benches for the five families; size script and budgets in `validate` |
| 2 | [temporal-seam.md](./temporal-seam.md) | One import site for `Temporal`; entries re-export from it; polyfill strategy |
| 3 | [repro-split.md](./repro-split.md) | Canary-only repros out of every shipped bundle |
| 4 | [duty-engine.md](./duty-engine.md) | O((N + C) log N); 365 d ≤ 5x 90 d |
| 5 | [zone-transitions.md](./zone-transitions.md) | Bounded searches, per-zone memo, lazy clock |
| 6 | [holiday-days.md](./holiday-days.md) | Sorted epoch-day holidays; counts by binary search |
| 7 | [schedule-walk.md](./schedule-walk.md) | `operatingTimeBetween` 10 y ≤ 2x 1 y |
| 8 | [free-time-walk.md](./free-time-walk.md) | `chargeableDays` 10 y ≤ 2x 1 y |
| 9 | [resolve-once-and-formatters.md](./resolve-once-and-formatters.md) | One resolution per call; cached formatters |
| 10 | [loop-sweep.md](./loop-sweep.md) | Three span-growing loops fixed; warm 100 y ≤ 0.1x before; final budgets |
| 11 | [agent-rules.md](./agent-rules.md) | Part 3 text in the four rule files |

## Owner decisions

1. **Polyfill strategy.** Keep `@js-temporal/polyfill` (reasoning in slice 2 § C).
2. **Size budgets.** Each entry's minified size after the last code slice (10), plus 1%,
   rounded up to the next 0.1 kB. A budget is raised only through a reviewed edit to the
   budgets file.
3. **Cost findings.** A Cost finding blocks in new or changed code only. One in code the diff did
   not touch is reported, not blocking.
4. **Temporal re-export and changeset.** Removing the re-export saves 0 bytes (measured), so it
   stays, routed through the seam. Changeset `patch`, carrying the headline savings; slice 11
   adds the "speed or size, no output change = `patch`" row to coding-standards.

## PR description (finalizer)

From slice 1's snapshot and an after run on the same machine (`pnpm size --compare …/size.json`,
`pnpm bench --compare …/bench.json`), the PR description carries two tables, headed with the
Node version and the date of both runs:

- **Size**, every entry: minified and gzipped kB before and after, change in kB and in %.
- **Speed**, every bench row: ms before and after, and the growth ratio (10 y ÷ 1 y; 100 y ÷
  10 y for slice 10's rows; 365 d ÷ 90 d for the duty log) before and after.
