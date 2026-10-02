---
"@northguild/gmt": minor
---

Add `scheduleDeviation`, `classifyPunctuality`, `punctualityRate`, `bestAvailable`, `estimateDrift` and `nextDeparture` to the `transport/` namespace (Story TRAN-57). Every function that reads a moment now reads a zoned string for a zone with a sub-minute offset as the instant Temporal wrote it for, and an offset written with seconds must match its zone exactly.

Every mode publishes a plan and records what happened, and measures the gap the same way. Only the tolerance differs, and the tolerance is the caller's. The other shared problem is that one field often holds four kinds of time — planned, estimated, requested and actual — and an estimate shown as an actual is the standard tracking-dashboard error.

```typescript
import { bestAvailable, classifyPunctuality, estimateDrift, nextDeparture, punctualityRate, scheduleDeviation } from "@northguild/gmt";

scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-15T10:14:00Z"); // "PT14M"
scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-15T09:55:00Z"); // "-PT5M" — five minutes early
scheduleDeviation("2024-11-03T01:30:00-04:00[America/New_York]", "2024-11-03T01:30:00-05:00[America/New_York]");
// "PT1H" — the same wall time, an hour later across the fall-back night

classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:14:59Z", { late: "PT15M" }); // "onTime"
classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:15:00Z", { late: "PT15M" }); // "late"
classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T09:49:00Z", { late: "PT15M", early: "PT10M" }); // "early"

punctualityRate([
  { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:05:00Z" },
  { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:14:00Z" },
  { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:16:00Z" },
  { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T09:57:00Z" },
], { late: "PT15M" });
// { onTime: 3, total: 4, rate: 0.75 }

bestAvailable([
  { classifier: "ACT", at: "2024-06-15T12:52:00Z", recordedAt: "2024-06-15T12:53:00Z" },
  { classifier: "EST", at: "2024-06-15T13:05:00Z", recordedAt: "2024-06-15T14:00:00Z" },
]);
// { at: "2024-06-15T12:52:00Z", classifier: "ACT" } — an estimate recorded later never replaces an actual

estimateDrift([
  { classifier: "EST", at: "2024-06-20T08:00:00Z", recordedAt: "2024-06-01T00:00:00Z" },
  { classifier: "EST", at: "2024-06-20T12:00:00Z", recordedAt: "2024-06-05T00:00:00Z" },
  { classifier: "EST", at: "2024-06-20T17:00:00Z", recordedAt: "2024-06-10T00:00:00Z" },
], { tolerance: "PT8H" });
// { first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: true }

const timetable = ["2024-06-15T08:00:00Z", "2024-06-15T09:30:00Z", "2024-06-15T11:00:00Z"];
nextDeparture("2024-06-15T09:00:00Z", timetable, { minimumConnection: "PT45M" }); // "2024-06-15T11:00:00Z"
nextDeparture("2024-06-15T06:05:00+02:00", { headway: "PT20M", from: "2024-06-15T06:00:00+02:00", to: "2024-06-15T09:00:00+02:00" });
// "2024-06-15T06:20:00+02:00"
```

- **A deviation is exact elapsed time.** `scheduleDeviation` returns `actual` minus `planned` with hours as the largest unit: positive when late, negative when early, `PT48H` rather than `P2D`. A delay across a fall-back night is `PT1H`, never the `PT0S` or `PT2H` a wall-clock subtraction gives. Both times are an instant or a zoned string, and the zone they are written in does not matter.
- **"On time" needs a stated tolerance.** GMT has no default. `PunctualityTolerance` is `{ late, early? }` as ISO 8601 durations of exact time: a day is 24 hours, and years, months, weeks or a negative value return `null`. A 15-minute tolerance, a 60/120-minute pair and a day-based one are all the same call with different numbers.
- **Both edges belong to the outside.** Exactly `late` is late, and exactly `-early` is early. Without `early`, every early arrival is on time. `classifyPunctuality` returns `null` on invalid input, as `classifyLocal` does.
- **A rate is a count under one tolerance.** `punctualityRate` reads the tolerance once and judges every pair under it. Only `"onTime"` counts, so with an `early` tolerance an early arrival is not on time. `rate` is not rounded. An empty list, or any invalid pair, returns `null` — never a rate over the rest.
- **The class travels with the value.** `TimestampEvent` records a `classifier` (`PLN`, `EST`, `REQ` or `ACT`, DCSA's vocabulary), the moment `at` and when it was `recordedAt`. `bestAvailable` picks an `ACT` whenever one exists, else `PLN`, else `REQ`, else `EST`, and the newest-recorded within that class. The order is GMT's and is fixed: DCSA's Port Call standard defines the classes and an estimated, requested, planned, then actual pattern, not a rule for choosing among them. It returns the class with the value, and echoes `at` exactly as written.
- **Drift needs two estimates.** `estimateDrift` reads only the `EST` records, in recording order, and reports the last minus the first. It returns `null` with fewer than two, since one estimate has no drift. With `tolerance`, `exceedsTolerance` is `true` when the drift in either direction is greater than it; exactly the tolerance is `false`.
- **`nextDeparture` is timetable lookup, not routing.** It returns the first departure at or after `after` plus `minimumConnection` (default `"PT0S"`); one exactly at that threshold is made. A list entry is returned exactly as written, so it can go straight into `scheduleDelivery` as a leg's `departure`. Every moment must carry its offset: a wall time without one returns `""`, because in a repeated fall-back hour it names two departures.
- **A headway window is half-open.** `{ headway, from, to }` has the shape of a GTFS [`frequencies.txt`](https://github.com/google/transit/blob/master/gtfs/spec/en/reference.md#frequenciestxt) row. Departures are `from` plus whole headways in exact time, up to but never at `to`, and are computed from `from` rather than stepped. The result is written the way `from` was written.
- Also exported: the `TimestampClass`, `TimestampEvent`, `PunctualityTolerance`, `Punctuality`, `PlannedActual`, `OnTimeRate`, `ClassifiedTimestamp`, `EstimateDriftOptions`, `DriftReport`, `Headway` and `NextDepartureOptions` types.

### A zoned string names one instant in every reader

`Temporal.ZonedDateTime.prototype.toString` writes a zone's offset rounded to the minute. `Africa/Monrovia` stood at −00:44:30 until 1972, so Temporal writes it `-00:45`. `Temporal.ZonedDateTime.from` reads that string back to the same instant (TC39 `ToTemporalZonedDateTime` matches a minute-precision offset by minutes), but `Temporal.Instant.from` takes `-00:45` literally and lands 30 seconds late. GMT writes zoned strings and reads them back as instants, so a deviation, a span or a cut-off measured from one of its own strings was up to 30 seconds off in such a zone. Every instant reader now follows the zoned reading.

```typescript
import { etaAtZone, isValidZonedDateTime, scheduleDeviation, toNanoseconds } from "@northguild/gmt";

const written = etaAtZone("1960-01-01T01:04:30Z", "Africa/Monrovia");
// "1960-01-01T00:20:00-00:45[Africa/Monrovia]" — Temporal rounds -00:44:30 to the minute

scheduleDeviation("1960-01-01T01:04:30Z", written); // "PT0S" — was "PT30S"
toNanoseconds(written); // -315615330000000000n, which is 01:04:30Z
toNanoseconds("1960-01-01T00:20:00-00:45"); // -315615300000000000n — no zone, so the offset is exact

isValidZonedDateTime("1960-01-01T00:20:00-00:45[Africa/Monrovia]"); // true — the rounded offset
isValidZonedDateTime("1960-01-01T00:20:00-00:44:30[Africa/Monrovia]"); // true — the exact offset
isValidZonedDateTime("1960-01-01T00:20:00-00:45:00[Africa/Monrovia]"); // false — seconds must be exact
```

- **The rule.** When a string has a bracketed zone and an offset written to the minute, and that offset is the zone's real offset at that wall time rounded to the minute, the instant is the one the zone gives. Every other string keeps its written offset: one without a bracket, a `Z` instant, an offset written with seconds, and a bracket whose zone does not exist or does not fit the offset.
- **Only zones with a sub-minute offset are affected.** These are historical offsets: local mean time, and zones such as `Africa/Monrovia` before 1972. A string in a zone whose offset is a whole number of minutes reads exactly as before.
- **An instant reader still does not validate the bracket.** `toNanoseconds("2024-06-15T10:00:00Z[Not/AZone]")` is still the instant the `Z` names. A bracket never supplies the zone a result is rendered in: `timeZone` and `targetZone` do.
- **Every string Temporal writes for an instant in range is now valid.** At the first seconds of the range, the rounded offset alone can read as just outside it: `-271821-04-19T23:58:45-00:01[Europe/London]` is the first instant, at London's local mean time of −00:01:15.
- **An offset written with seconds must be the zone's offset exactly**, as TC39 `ToTemporalZonedDateTime` requires. The Temporal polyfill GMT runs on matched it by minutes, so `-00:45:00[Africa/Monrovia]` was accepted as a zoned string. GMT now corrects that in every function that reads a zoned string.
- **A wall time repeated inside a sub-minute offset change reads as its first pass**, as it does in `Temporal.ZonedDateTime.from`. `Pacific/Niue` moved from −11:19:40 to −11:20:00 at the end of 15 October 1952, so 23:59:40 to 23:59:59 happened twice, and both passes are written `-11:20`. Write the offset with seconds (`-11:20:00`) to name the second pass.
- **A zoned read still refuses a local date of −271821-04-19**, as `Temporal.ZonedDateTime.from` does. A zone west of Greenwich shows that date for the first hours of the instant range. `isValidInstant` and the other instant readers accept such a string; `transitTime`, `toOffsetInstant`, `isValidZonedDateTime` and the `zoned/` functions return their sentinel. Pass that instant in `Z` form.

### Breaking changes

`M` is `1960-01-01T00:20:00-00:45[Africa/Monrovia]`, a string Temporal writes for `1960-01-01T01:04:30Z`. `S` is the same wall time with the offset written `-00:45:00`.

| Call | 1.17 | 1.18 |
| --- | --- | --- |
| `toNanoseconds(M)`, likewise `toFileTime`, `toDotNetTicks`, `toNtpTimestamp`, `toExcelSerial`, `toPgMicroseconds` | `-315615300000000000n` (`01:05:00Z`) | `-315615330000000000n` (`01:04:30Z`) |
| `spanNs("1960-01-01T01:04:30Z", M)`, likewise `spanMs` | `30000000000n` | `0n` |
| `isValidInterval({ start: "1960-01-01T01:04:45Z", end: M })`, likewise every `interval/` function: `mergeIntervals`, `intersectIntervals`, `subtractIntervals`, `splitIntervalAt`, `sumIntervals`, `intervalContains`, `intervalsOverlap` | `true` (`end` read as `01:05:00Z`) | `false` (`end` is `01:04:30Z`, before `start`) |
| `etaAtZone(M, "UTC")`, likewise `dwellTime`, `floorToZone`, `bucketRange` and `getTimeZoneOffset`, which read the same instant | `"1960-01-01T01:05:00+00:00[UTC]"` | `"1960-01-01T01:04:30+00:00[UTC]"` |
| `freeTimeExpiry("1960-01-01T23:15:15-00:45[Africa/Monrovia]", 1, { basis: "calendar", timeZone: "UTC", firstDay: "eventDay" })`, likewise `chargeableDays` and `demurrageClock`, which read their events the same way | `freeTimeStart: "1960-01-02"` | `freeTimeStart: "1960-01-01"` |
| `isValidInstant("-271821-04-19T23:58:45-00:01[Europe/London]")`, likewise `isValidSpan` | `false` | `true` |
| `isValidZonedDateTime(S)` | `true` | `false` |
| `transitTime(S, "PT1H")`, likewise `toOffsetInstant`, `dwellTime` without `targetZone`, and every `zoned/` function | `"1960-01-01T01:20:00-00:45[Africa/Monrovia]"` | `""` (each function's own sentinel) |
| `durationAs("P1D", "hours", { relativeTo: S })`, likewise `normalizeDuration` and `compareDurations` | `24` | `null` |
| `convertZonedToUtc("1952-10-15T23:59:59-11:20:00[Pacific/Niue]")` | `"1952-10-16T11:19:39Z"` (the first pass) | `"1952-10-16T11:19:59Z"` (the second pass, which `-11:20:00` names) |

Unchanged: a string without a bracket, a `Z` instant, and any string in a zone whose offset is a whole number of minutes. `toOffsetInstant(M)`, `transitTime(M, …)` and the `zoned/` functions already read `M` through its zone.

Migration:

- **A stored instant computed from a zoned string in a sub-minute-offset zone** moves by up to 30 seconds, to the instant Temporal wrote the string for. Recompute it. To keep the old reading, drop the bracket: `toNanoseconds("1960-01-01T00:20:00-00:45")` reads the offset as written.
- **A zoned string whose offset has seconds that are not the zone's** is now invalid. Write the zone's exact offset (`-00:44:30[Africa/Monrovia]`) or the minute-rounded one Temporal writes (`-00:45[Africa/Monrovia]`).
