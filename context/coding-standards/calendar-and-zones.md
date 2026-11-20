# Coding Standards: Calendar and Zone Semantics

## Calendar & zone semantics

Decisions of record for date arithmetic and zone-aware boundaries. Code, tests and reviews follow these; do not re-open them without a new primary source.

### 1. TC39 Temporal is the authority

Where calendar semantics are ambiguous, GMT does what [Temporal](https://tc39.es/proposal-temporal/docs/plaindate.html) does.

- **Arithmetic clamps.** A day that does not exist follows Temporal's default `overflow: "constrain"`: `2024-02-29` plus one year is `2025-02-28`; Jan 31 plus one month is Feb 29/28.
- **Parsers reject.** `parse*` functions and the scoped grammars above use `overflow: "reject"` and return the sentinel for `"31 Feb"`. A parser must not invent a date.
- **Why clamp.** ISO 8601-1 defines calendar dates and durations, but it gives no rule for adding a month or a year to a day the result's month does not have. Temporal does: `add`, `subtract` and `with` default to `overflow: "constrain"`, which moves a day that does not exist to the last day of that month (the `RegulateISODate` operation in the [Temporal specification](https://tc39.es/proposal-temporal/)). Temporal is the highest rung in the [source order](../../apps/dox/src/content/docs/guides/concepts/standards.mdx), so GMT follows it. Stated as a GMT rule: a date or period that would land on a day that does not exist lands on the last day of that month instead.
- **Known divergence, documented and not built:** a "month-end" rule would put a Feb-28 anchor on 02-29 in leap years. Temporal gives 02-28, and so does GMT (e.g. `getFiscalPeriod`'s `yearEndsOn`).

### 2. Zone-aware unit boundaries are never truncate-and-re-resolve

Never compute a zoned start-of-unit by truncating the wall clock and resolving it again — `zdt.round({ roundingMode: "trunc" })`, or `.with({ … })` plus `"compatible"` disambiguation. When the truncated wall time does not exist or occurs twice, Temporal relocates it, and the "start" lands after its own input or before an earlier boundary.

- Use `internal/zonedBucket.ts` (`zonedUnitStart`, `nextZonedBucketStart`), or Temporal's own `zdt.startOfDay()` / `zdt.hoursInDay` for days.
- **Probe zones** — every boundary function is tested against these transitions:

| Zone                                                                               | Transition                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Pacific/Chatham`                                                                  | 2024-09-29 spring (+45 min offset), 2024-04-07 fall                                                                                                                                          |
| `Antarctica/Casey`                                                                 | 2020-10-04 (three-hour jump)                                                                                                                                                                 |
| `America/New_York`                                                                 | 2024-11-03 fall-back                                                                                                                                                                         |
| `Australia/Lord_Howe`                                                              | 30-minute DST                                                                                                                                                                                |
| `America/Santiago`                                                                 | 2024-09-08 (skipped local midnight)                                                                                                                                                          |
| `America/Havana`                                                                   | 2024-11-03 (midnight repeated on the same date)                                                                                                                                              |
| `America/Goose_Bay`                                                                | 2010-11-07 (fall-back reopens the previous date)                                                                                                                                             |
| `Pacific/Apia`                                                                     | 2011-12-30 (deleted day)                                                                                                                                                                     |
| `Asia/Manila`, `Pacific/Guam`, `Pacific/Saipan`, `Pacific/Kosrae`, `Pacific/Palau` | 1844-12-31 (deleted day crossing the date line, before the polyfill's 1847-01-01 transition search floor; `dateLineCrossingTimeZones` in `src/test/timeZoneMatrix.ts`, workaround `zoned.E`) |

- **When a transition opens a new bucket.** Hours: when the clock lands on an hour boundary or the label jumps — New York's repeated 01:00 is its own hour, so a fall-back day has 25 hour buckets. Day and larger: only when the local label changes — Havana's repeated midnight on 2024-11-03 stays one 25-hour day (matching `hoursInDay`), while Goose_Bay's fall-back into 6 November is its own 59-minute bucket because the date changed.

### 3. Boundary functions take no resolution options (the TC39 pattern)

TC39 splits the API in two ([ZonedDateTime docs](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)): **field-setting** methods (`with`, `from`) take `disambiguation`/`offset`, while **boundary** methods take none — `startOfDay()` has no options and returns the day's earliest real instant, `round()` accepts only rounding options, and `hoursInDay` derives from `startOfDay`. GMT follows the same split.

- Field-setting functions keep their resolution options: `setZoned`/`setUnix`/`cycleZoned` take `disambiguation` and `offset` (default `"prefer"`, as `ZonedDateTime#with`); `addZoned`/`subtractZoned`, `intervalFromDurationZoned`, `convertPlainDateTimeToZoned` and `resolveLocal` take `disambiguation` only, because they resolve a plain date-time that has no offset (`PlainDateTime#toZonedDateTime` reads only `disambiguation`). An option a function cannot act on is not accepted "for consistency"; it is left off the signature.
- Boundary functions — `startOf*`/`endOf*`, quarter and locale-week variants, and everything built on them (`areZonedEqualBy`, `areUnixEqualBy`, `intervalCount*`) — **always** return the real boundary: `start ≤ input < next start`, end = next start − 1 ns. They take no `disambiguation`/`offset` options, and neither does `mapZonedHoursInDay` (the ignored options were removed in 1.16.0). Do not reintroduce an opt-in: any value, including the documented defaults, used to bring the bug back.
- **Day-length functions follow the TC39 date day.** `getHoursInZonedDay` and `mapZonedHoursInDay` use `startOfDay()`/`hoursInDay`: the day is the input's calendar date, from its earliest instant to the next date's. That equals the walker's day bucket everywhere except a fall-back that re-enters the previous date — America/Goose_Bay, 2010-11-07: an input at `2010-11-06T23:30-04:00` gets 6 November's 24 hours (ending 00:00-03:00 on the 7th, before the input), while `startOfZoned(…, "day")` returns the reopened 59-minute bucket. Documented and pinned by tests; do not "fix" one side to match the other.
- Equality helpers compare boundary **instants** when both values share a zone, so both passes of a repeated hour are different hours. Across zones `areZonedEqualBy` compares each value's own local unit label (New York 10:00 and Berlin 20:00 on the same date are the same day); `areUnixEqualBy` always resolves in one zone, so it always compares instants.

### 4. `roundZoned` / `roundUnix` pass TC39 through

They keep `ZonedDateTime.prototype.round` semantics exactly, including its behaviour around transitions. Their JSDoc says so; callers who need a floor use `floorToZone`. Do not "fix" them.

### 5. Repeated steps are computed from the anchor

For **calendar units** (years, months, weeks, days), step k of a split or series is `start.add({ [unit]: amount * k })`, never `previous.add(…)`. Compounding clamped results drifts: Jan 31 by month must give Mar 31 and Apr 30, not Mar 29/Apr 29. This matches Temporal and Luxon's `Interval.splitBy`.

- **Exact time units** (hours and smaller) never clamp, so they step from the previous boundary — `amount * k` would lose precision past 2^53.
- **A step that lands on the previous boundary is skipped, not fatal.** Anchored steps into a deleted local day (Apia, 2011-12-30) resolve to the same instant; drop that empty slice and continue. Only a step that goes backwards, or a bounded run of non-advancing steps, returns the sentinel.
- **Caps are per contract.** `bucketRange` caps at 10,000 buckets (it materialises a list); `intervalCount*` caps at 10,000 transitions (it only counts). Counts equal `bucketRange(...).length` only while `bucketRange` is within its cap.

### 6. Loop exhaustion → sentinel

See [§ Loop Style](./design-rules.md#loop-style).

### 7. Validate-then-parse is intentional

See [§ Always Wrap Temporal Calls](./api-contract.md#always-wrap-temporal-calls-in-try-catch).

### 8. Intervals are half-open `[start, end)`

An instant, date or time `t` is inside an interval when `start ≤ t < end`: SQL:2011's closed-open
application-time `PERIOD` (ISO/IEC 9075-2:2011), RFC 5545 §3.6.1's non-inclusive `DTEND` and
EWD831. This holds for `interval/` and for every positional `plain|utc|zoned|unix/interval`
function (all since 1.16.0). Tie-breaks and empty-interval edges follow the `interval/` functions' JSDoc and tests; the rules below derive the relations those functions do not state.

- **No one-unit steps.** Pieces end and start exactly at a cut: no nanosecond, day or `epochUnit`
  step in `intervalDifference*`/`intervalXor*`, and no one-unit gap in `intervalAbuts*`.
- **Instant-typed variants delegate.** After its UTC-string gate, a `Utc` variant calls the
  `interval/` function with the same relation (`intervalsOverlap`, `intervalContains`,
  `intersectIntervals`, `mergeIntervals`, `subtractIntervals`). Relations with no `interval/`
  function, and the `Date`/`DateTime`/`Time` variants, use `internal/halfOpenIntervals.ts`.
- **Outputs are re-serialised** in the type's canonical spelling (`toString()`, or
  `formatDateInCalendar`). `interval/`'s echo-the-caller's-string rule applies to caller-owned
  `Interval` records only.
- **Empty intervals** (`start === end`) hold no instant:
  - *contains / engulfs:* `inner ⊆ outer` and the two overlap, so an empty `inner` counts only
    strictly inside `outer` (`[end, end)` is not contained, as the point `end` is not);
  - *union:* the single run of `mergeIntervals([a, b])`, else `null`; a stranded empty interval is
    ignored, and two empty intervals give `null`;
  - *abuts:* Allen's "meets", one non-empty interval's `end` equal to the other non-empty
    interval's `start`; an empty interval abuts nothing;
  - *XOR:* the maximal runs covered an odd number of times, sorted by start; touching pieces join;
  - *overlapping days:* the calendar days holding at least one instant of the non-empty
    intersection, so an empty intersection counts `0`;
  - *count:* a zero-length interval touches no unit and counts `0`.
- **Tiling functions partition.** `intervalSplitAt*`, `splitIntervalByUnit*` and
  `intervalDivideEqually*` give each piece's `end` as the next piece's `start`; the pieces share no
  instant. JSDoc never describes a shared endpoint as belonging to both pieces.
- **A `Date` interval excludes its `end` day.** "The last day of the period" is passed as the next
  day: `addDate(end, { days: 1 })`.

### 9. Zone equality is by name

Two zoned values are in one zone when their identifiers are the same ignoring ASCII case, or both are one of ECMA-402 §6.5.1's UTC names (`UTC`, `Etc/UTC`, `Etc/GMT`, `GMT`). A Link and its Zone (`Asia/Calcutta`, `Asia/Kolkata`) are two zones. Use `internal/zoneNamesEqual.ts`. Never ask Temporal or the host whether two names are one zone: no API gives a Link's primary identifier on every host, and GMT owns no link data.
