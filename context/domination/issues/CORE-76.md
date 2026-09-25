# CORE-76 — Core: Hours of work — a duty-log engine

**Scope:** Every hours-of-work rule the epic's realms run — driver, seafarer, rail crew, flight crew, resident — evaluated as composable rule objects over one duty log, with every number the caller's.

## Gap

Five realms keep a status log (off, rest, driving, on duty, flight, call, …) and test it against rules of about a dozen shapes: a cumulative cap since a reset; an elapsed window that rest inside it does not extend; a required interruption after N cumulative hours, sometimes as an ordered split; rolling caps over elapsed hours, operator-designated days or local calendar periods; caps over adjacent fixed weeks and averages over several; quotas of reduced rests; "due by the end of N periods"; N-of-M patterns; paired rests excluded from a window; caller-declared extensions; lookback exclusions; composite off-duty periods; counters keyed by the date a period starts; a free period of Z hours inside every rolling Y-hour window that contains n local nights; pre-duty rest as the larger of k × the preceding duty and a floor. Strip the numbers and the shapes are identical across every regime; only the numbers differ, and the numbers are the caller's. Eight one-body stories were the same engine each time (painpoints, "One duty-log shape, five regulators"; "Road — zero coverage").

The two facts every hand-built implementation gets wrong are generic too. The day is operator-designated: a start time in a reference zone, not the local midnight where the person happens to be. And a "24-hour period" in a rule is every sliding 24-hour window unless the rule names a fixed period, so a check that buckets by calendar day passes logs that a sliding window fails.

## Scope

- `packages/gmt/src/types/duty.ts`:
  - `DutyEntry<S extends string = string>` is `{ status: S, start: string, end: string }` — instants; `S` is the caller's status vocabulary.
  - `DutyDay` is `{ timeZone: string, dayStartTime: string }` — the operator-designated day; no field has a default.
  - `Period` is `{ elapsed: string } | { operatorDays: number } | { calendarDays: number } | { calendarMonths: number } | { calendarYears: number } | { isoWeeks: number }` — an elapsed duration, or a count of local periods in the reference zone.
  - `Reset<S>` is `{ statuses: S[], consecutive: string }` — a run of at least `consecutive` in any of `statuses` resets a counter.
  - `PairSpec` is `{ eachAtLeast: string, oneAtLeast: string, combinedAtLeast: string }` — a paired rest is two periods that satisfy all three.
  - `DutyRule<S>` — the discriminated union in the table below; every member carries `{ label: string, severity?: 'violation' | 'advisory' }` and `severity` defaults to `'violation'`.
  - `RuleOutcome` is `{ label: string, kind: DutyRule['kind'], severity, satisfied: boolean, used: string | number | null, limit: string | number | null, remaining: string | number | null, window: Interval | null, periodBasis: 'elapsed' | 'operatorDay' | 'calendar' | null, dueBy: string | null, resetAt: string | null }`.
  - `DutyReport` is `{ at: string, outcomes: RuleOutcome[], violations: RuleOutcome[], advisories: RuleOutcome[] }`.
  - `DutyViolation` is `{ label: string, window: Interval, used: string | number, limit: string | number }`.
- `packages/gmt/src/duty/get/dutyDayFor.ts`:
  - `dutyDayFor(instant: string, day: DutyDay): Interval | null` — The operator-designated 24-hour period an instant falls in: the most recent `dayStartTime` in `timeZone` at or before the instant, to the next one. A `dayStartTime` that is nonexistent or ambiguous on a transition day resolves under the documented CORE-4 policy (`'compatible'`), stated in the JSDoc with the [LOCAL_TIME_RESOLUTION.md](../../reference/LOCAL_TIME_RESOLUTION.md) vocabulary; the period is then 23 or 25 hours long and the JSDoc says so.
- `packages/gmt/src/duty/calculate/evaluateDutyLog.ts`:
  - `evaluateDutyLog<S>(log: DutyEntry<S>[], at: string, rules: DutyRule<S>[], options: { timeZone: string, dayStartTime?: string }): DutyReport | null` — Every rule evaluated at one instant, each reported whether or not it binds. `dayStartTime` is required by any rule whose `Period` is `operatorDays`; a rule that needs it without it returns the sentinel. A planned roster is the same call with the plan appended to the log and `at` set to the plan's end.
  - `dutyViolations<S>(log: DutyEntry<S>[], range: Interval, rules: DutyRule<S>[], options): DutyViolation[] | null` — Every violation inside a range, each with the window that failed it: the monthly record, not the dispatch check.
- `packages/gmt/src/duty/calculate/dutyTotals.ts`:
  - `dutyTotals<S>(log: DutyEntry<S>[], window: Interval, statuses: S[]): string` — Merged, summed time in any of `statuses` inside `window`, as an ISO duration.
  - `longestRun<S>(log, window: Interval, statuses: S[]): { interval: Interval, duration: string } | null` — The longest unbroken stretch in `statuses` inside the window; the sentinel when there is none.
  - `qualifyingRests<S>(log, spec: { statuses: S[], minimum: string, pair?: PairSpec }): Interval[] | { first: Interval, second: Interval }[]` — Rest periods of at least `minimum`, or, with `pair`, the pairs that satisfy all three constraints.
- `packages/gmt/src/duty/validate/validateDutyLog.ts`:
  - `validateDutyLog(log: unknown): boolean` — Entries are ordered by `start`, non-overlapping, each `end` after its `start`, every bound a parseable instant, every status a string. Everything else returns the sentinel from the functions above.
- Docs site (`apps/dox/src/content/docs/`, per [../docs-site.md](../docs-site.md)):
  - `guides/intervals/hours-of-work.mdx` — a Core guide, not an industry guide, so `duty` is charted as a core namespace: the operator-designated day, sliding versus fixed periods, one `##` per rule kind, and five example rule arrays labelled by their numbers only (an 11-hour cap inside a 14-hour window with a 60-hour rolling cap over 7 operator days; 10 hours of rest in every 24 in at most two periods; a 12-hour cap with a 10-hour rest before duty; a 100-hour cap over 672 hours and 1,000 over a year; an 80-hour average over four weeks with one 24-hour free period in seven).
  - Scenarios: `duty-day-is-not-midnight` (`dutyDayFor`), `sliding-window-not-calendar-day` (`evaluateDutyLog`), `paired-rest-that-does-not-qualify` (`qualifyingRests`).
  - `mistakes/duty.mdx` — bucketing by local midnight; a fixed week where the rule says a sliding window and the reverse; a break that extends the elapsed window; a paired rest checked as two integers; a monthly cap that does not split the tour at the boundary; elapsed hours where the rule says calendar days across a fall-back; a nested cap folded into one number.
  - Index entries in `guides/index.mdx` and `mistakes/index.mdx`.

### Rule kinds (`DutyRule.kind`), every number caller-supplied

| kind | fields | covers |
| --- | --- | --- |
| `cumulativeCap` | `statuses, cap, since: Reset` | A cap on time in `statuses` since the last reset: an 11-hour driving cap since a 10-hour off reset; a 14-hour on-duty cap |
| `elapsedWindow` | `startStatuses, length, restrictedStatuses, exclude?: PairSpec, extension?: { by, from }` | A window that opens when work starts and closes `length` later regardless of rest inside it; a qualifying paired rest excluded from the window; a caller-declared extension (2 hours from an instant the caller names) |
| `requiredInterruption` | `countedStatuses, after, interruption: { minimum, outsideStatuses?, orderedSplit?: string[] }` | A 30-minute interruption after 8 cumulative hours; an ordered split (15 then 30) that counts only in that order |
| `rollingCap` | `statuses, cap, window: Period, precondition?: { restStatuses, minimum, beforeHours }` | 60 hours in 7 operator days; 70 in 8; 100 hours in 672 elapsed hours; 1,000 in 365 calendar days; a cap that applies only after a stated rest inside the preceding hours |
| `fixedPeriodCap` | `statuses, cap, period: Period, adjacent?: number, average?: boolean, buckets?: Record<string, S[]>` | 56 per ISO week; 90 over two adjacent weeks; 80 averaged over 4 weeks; per-calendar-month caps by status bucket, with a tour split at the month boundary |
| `restRequirement` | `restStatuses, per: Period, minimum, composition?: { maxPeriods, longestAtLeast, othersAtLeast }, composite?: { consecutive, additional, blockMinimum }, maxGap?` | 10 hours of rest in every sliding 24 in at most two periods, one at least 6; 8 consecutive plus 2 more in blocks of at least 30 minutes; no more than 14 hours between rests |
| `freePeriod` | `restStatuses, minimum, within: Period, containing?: { window: LocalWindow, count }, atLeast?: number` | 30 consecutive hours off within every 168; 36 hours off containing two local nights; one 24-hour free period in every seven days, on average over four weeks |
| `restBeforeDuty` | `restStatuses, minimum, within, orFactor?: { k, floor }` | 10 hours off in the 24 before a duty; rest before duty of at least the larger of k × the preceding duty and a floor |
| `quota` | `event: { statuses, minimum, maximum }, count, reset: Reset \| { every: Period }` | At most 3 reduced rests between two full rests; reduced weekly rests per period |
| `dueBy` | `event: { statuses, minimum }, within: { periods, period }, reset?` | A rest of at least N due by the end of six operator days after the last one; 48 hours off after 6 initiation days |
| `pattern` | `period, lookback, classes: { label, statuses, minimum }[], require: { label, atLeast }[]` | At least 4 rests in any 4 weeks, at least 2 of them regular; a return-within-window rule |
| `occurrenceCap` | `statuses, per: Period, lookback, maximum, byInitiationDate?: boolean` | Night duty no more often than every third night; consecutive initiation days counted by the local date a period starts |
| `usageLookback` | `uses: string[], notWithin: Period, reset: Reset` | An allowance not used within the previous N days, restored by M hours off |

Nested caps (a 13-hour cap inside a 14-hour cap inside a 16-hour window) are three rules and are reported separately.

## Design notes

- **Rules, not regimes.** A regime is an array of rule objects the caller assembles and labels; the report is keyed by those labels and never by a clause, and no rule kind carries a number of its own. The docs show five example arrays labelled by their numbers only.
- **The day is operator-designated.** `dutyDayFor` and every `operatorDays` period use `{ timeZone, dayStartTime }`; there is no default day start and local midnight is never assumed. A log whose entries cross zones still buckets by the reference zone.
- **Elapsed and calendar periods are different arithmetic.** `{ elapsed }` is exact time and ignores transitions; `{ calendarDays | calendarMonths | calendarYears | isoWeeks }` are local periods in `timeZone` and are 23 or 25 hours long on transition days; `{ operatorDays }` are `dutyDayFor` periods. Every outcome states which basis it used in `periodBasis`.
- **Sliding is the default reading of a duration.** A rule written as a `Period` of `{ elapsed: 'PT24H' }` is every sliding 24-hour window ending at `at`; only `isoWeeks`, `calendarMonths`, `calendarYears` and `fixedPeriodCap` are fixed periods. A caller who wants a fixed 24-hour period says `{ operatorDays: 1 }`.
- **Ship's time and acclimatisation are caller pre-processing.** A log kept in ship's time is converted with MAR-18's `fromShipTime` before it is evaluated; a crew member's reference zone comes from AV-27's `acclimatisedZone` or from the caller. This engine sees instants and one reference zone.
- **Statuses are the caller's strings.** `DutyEntry<S>` is generic; a third state such as deadhead-from-assignment is just another status named in the rules that count it, and a status a rule names that the log never uses is fine. A status in the log that no rule names is ignored.
- **Every rule is reported, not just the binding one**, with `used`, `limit`, `remaining`, `window`, `satisfied`, `dueBy` and `resetAt`, so a dispatcher can see the second-tightest limit before it binds. `severity: 'advisory'` outcomes list under `advisories`, never under `violations`.
- **Facts GMT cannot know are parameters.** A declared condition, a return to a location, an agreement in force, a caller-approved extension: each is a rule field (`extension`, `precondition`) or a status the caller writes into the log. The engine tests the time part only.
- **Paired rests are three constraints, not two integers.** `PairSpec` states each period's floor, the floor of the longer one and the combined floor; 7.5 + 2.5 and 8 + 2 both satisfy `{ eachAtLeast: 'PT2H', oneAtLeast: 'PT7H', combinedAtLeast: 'PT10H' }` and 6 + 4 does not.
- **Interval algebra, not loops over minutes.** Totals are `mergeIntervals` then `intersectIntervals` with the window then `sumIntervals` (CORE-6); calendar periods come from `bucketRange` (CORE-5); a tour that crosses a period boundary is cut with `splitIntervalAt` and each part counted in its own period.
- GMT reports totals, remaining time and violations. It does not decide dispatch, fitness or eligibility, and the JSDoc says the function implements no standard and takes every number from the caller.

## Corrections

- Eight realm stories — four over road driver hours, one over seafarer rest, one over rail-crew hours, one over cumulative flight-crew limits, one over resident work hours — each specced one body's numbers as a status function named for that body or its jurisdiction (three driver-status functions, `restHoursStatus`, a rail-hours status, `cumulativeLimits`, a resident-hours status, and their companions). Each was this engine with a regime's constants and clause citations inside it. They are absorbed here, the constants are the caller's, and no clause is named anywhere (tracker, "GMT tracks no law").
- Their sound findings survive as rule kinds: the operator-designated day; a fixed week versus a rolling window; an ordered split break; paired rests defined by three constraints, not integers; a precondition on a rolling cap; caps per local calendar month with tours split at the boundary; consecutive days counted by the date a period starts; "must" versus "should" as `severity`.
- `DutyEntry` was `{ status: 'off' | 'sleeper' | 'driving' | 'onDuty' | … }` with a different union per regime; it is generic over the caller's status strings.
- The road realm's only content was those numbers, so the realm is gone from the tracker; its examples live on this story's guide, labelled by numbers.

## What gmt provides (do not re-implement)

- `mergeIntervals` / `subtractIntervals` / `sumIntervals` / `intersectIntervals` / `splitIntervalAt` from CORE-6 — the algebra under every total, window and boundary split
- `bucketRange` / `floorToZone` / `getIsoWeekDate` from CORE-5 — local calendar periods and ISO weeks in the reference zone
- `resolveLocal` / `classifyLocal` from CORE-4 — the day start on a transition day
- `spanMs` from CORE-2 — elapsed windows and `remaining`

## Verification

One row per rule kind, number-labelled, and an example array each for a driver, a seafarer, a rail crew, a flight crew and a resident, every result checked against the built package:

- `cumulativeCap`: an 11-hour cap on `driving` since a 10-hour `off` reset reports `remaining: 'PT0S'` at exactly 11 hours and a violation at 11:01; a 9:59 off period does not reset it and a 10:00 one does
- `elapsedWindow`: a 14-hour window is not extended by a 2-hour `off` break inside it; with `exclude: { eachAtLeast: 'PT2H', oneAtLeast: 'PT7H', combinedAtLeast: 'PT10H' }` the window is recalculated from the end of the first period of a qualifying pair, 7.5 + 2.5 qualifies and 6 + 4 does not; `extension: { by: 'PT2H', from }` moves the close by two hours from the instant the caller names and not otherwise
- `requiredInterruption`: after 8 cumulative hours, 30 minutes in any status outside the counted set satisfies it; `orderedSplit: ['PT15M', 'PT30M']` is satisfied by 15-then-30 and not by 30-then-15
- `rollingCap`: a 60-hour cap over `{ operatorDays: 7 }` and a 70-hour cap over `{ operatorDays: 8 }` report different `remaining` for the same log; a 34-hour reset zeroes it and 33:59 does not; a 100-hour cap over `{ elapsed: 'PT672H' }` across a fall-back spans exactly 672 elapsed hours while `{ calendarDays: 28 }` spans 671, asserted side by side with `periodBasis` differing
- `fixedPeriodCap`: 56 per `{ isoWeeks: 1 }` and 90 over `adjacent: 2`: two adjacent weeks totalling 91 violate; the same hours straddling three weeks do not; an 80-hour cap with `average: true` over 4 weeks passes 100/60/80/80 and still reports the 100-hour week in `used`; a per-`{ calendarMonths: 1 }` cap splits a tour spanning local midnight on the last day of the month and counts each part in its own month
- `restRequirement`: 10 hours in every sliding 24 with `composition: { maxPeriods: 2, longestAtLeast: 'PT6H' }`: 6 + 4 passes, 5 + 5 fails, three periods fail; `composite: { consecutive: 'PT8H', additional: 'PT2H', blockMinimum: 'PT30M' }`: 8 + four 30-minute blocks passes, 8 + six 20-minute blocks fails; `maxGap: 'PT14H'`: 15 hours between rests fails
- `freePeriod`: 30 consecutive hours within `{ elapsed: 'PT168H' }` reports `dueBy` as the instant the window closes; 36 hours `containing` two `{ from: '22:00', to: '08:00' }` windows passes with two nights and fails with one; one 24-hour free period in seven with `atLeast: 4` over `{ calendarDays: 28 }`: three fails, four passes; a one-hour `homeCall` entry breaks the run
- `restBeforeDuty`: 10 hours within the prior 24: 9:59 fails; `orFactor: { k: 1, floor: 'PT12H' }` requires 12 after a 10-hour duty and 13 after a 13-hour duty
- `quota`: 3 reduced rests reset at the next full rest accepts the third and rejects the fourth, with `remaining: 0` after the third
- `dueBy`: a rest due within six operator days of the last qualifying one reports `dueBy` as the end of the sixth operator day, computed from `dayStartTime`, not from midnight
- `pattern`: over 4 weeks requiring 4 rests with 2 regular: 4 with 2 regular passes, 4 with 1 regular fails, 3 with 2 regular fails
- `occurrenceCap`: night duty every third night over 28 days: nine passes, ten fails; `byInitiationDate: true` counts two tours starting on one local date once and a `dueBy` of 48 hours triggers after the sixth date
- `usageLookback`: `false` on the sixth day after a use with `notWithin: { calendarDays: 7 }`, `true` after a 34-hour reset, with `resetAt` set to the end of that reset
- `severity: 'advisory'` outcomes appear under `advisories` only and never under `violations`; `dutyViolations` over a month lists one entry per failed window with `used` and `limit`
- `dutyDayFor` with `dayStartTime: '04:00'`: 03:59 local belongs to the previous day and 04:00 to the next; a log spanning a zone crossing still buckets by the reference zone; `'02:30'` on the spring-forward day resolves per the documented CORE-4 policy and the period is 23 hours long, asserted, never the sentinel silently
- A rule using `operatorDays` without `dayStartTime`, overlapping or inverted entries, an unknown status in a rule, a malformed period, an invalid zone or a duration of zero as a cap returns the sentinel; `validateDutyLog` is `false` for each
- `dutyTotals` equals the sum of `intersectIntervals(mergeIntervals(...), [window])` lengths, asserted; `longestRun` returns the sentinel for a window with no matching status
- Docs: the guide, three scenarios and `mistakes/duty.mdx` show five example rule arrays labelled by numbers only, every result checked against the built package, no jurisdiction, body or clause named
- `battleTestTimeZones` coverage plus probe-zone transition rows for `dutyDayFor`, `evaluateDutyLog` and `dutyViolations` (see `context/coding-standards.md` § Calendar & zone semantics)
- `pnpm run validate` stays green
