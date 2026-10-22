---
name: gmt-transport
description: >
  Transport timing for legs, cut-offs and punctuality — transitTime, etaAtZone,
  dwellTime, crossingTime, scheduleDelivery (exact legs, local calendar days
  dwelt, missed connections), cutoffAt, cutoffSchedule, isPastCutoff,
  timeToCutoff, scheduleDeviation, classifyPunctuality, punctualityRate,
  bestAvailable, estimateDrift over PLN/EST/REQ/ACT timestamp classes, and
  nextDeparture, all in @northguild/gmt/transport. Every tolerance, connect time
  and cut-off offset is the caller's. Reads the docs site (llms.txt) and the
  installed package's JSDoc; a routing pointer, not an API dump.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/transport-legs-and-dwell.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/transport-multi-leg-scheduling.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/transport-punctuality-and-timestamps.mdx'
  - 'northguild/gmt:packages/gmt/src/transport/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/transport/compare/index.ts'
  - 'northguild/gmt:packages/gmt/src/transport/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/transport-timestamps.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.20.0'
---

# GMT Transport

Use this skill when the task is timing a vehicle, vessel or consignment across
legs and zones: transit, arrival in the local zone, dwell, cut-offs, planned
versus actual, or the next departure. The time zone rules it builds on are in
the `gmt-timezone` skill.

## When to load

- The user is adding a leg's transit time to a departure, showing an arrival in
  the zone where it lands, or counting how long cargo, a vessel or a patient sat
  somewhere in local calendar days.

## Core rules

1. **Transport legs are exact time; dwell is counted in local days.**
    `transitTime(departure, duration)` adds hours, minutes and seconds as
    elapsed time (`P1D` is 24 exact hours) in the departure's own zone, so a leg
    across a DST transition lands at the wall time the vehicle really arrives;
    years, months and weeks return `""`, and a bracketed zone that contradicts
    its offset is rejected rather than reinterpreted. `etaAtZone(instant, zone)`
    renders a moment in the zone the caller names — no disambiguation arises,
    the offset in the result tells the two passes of a fall-back hour apart, and
    GMT never resolves a port, airport or station code to a zone.
    `dwellTime(entry, exit, targetZone?)` returns `{ duration, enter, exit,
    calendarDays }`; `calendarDays` is the number of distinct local dates the
    half-open `[entry, exit)` touches, walked across the zone's real transitions
    (a skipped date is not counted, a re-entered one only once), and is the
    library's one "local days crossed" count.
    Bare instants with no `targetZone` return `null`: an offset is not a place.
    `crossingTime(entry, exit, targetZone)` returns `{ duration, enter, exit }`
    with no day count (a crossing that needs one is a dwell); `targetZone` is
    required and always the rendering zone — a bracket on the input never
    supplies it.
    `scheduleDelivery(legs, { startTimeZone? })` chains legs into `{ eta,
    legTimes }`: each leg leaves at its explicit `departure` or at the previous
    arrival plus that leg's `dwellAfter`, the minimum connect time. A scheduled
    departure earlier than that is a missed connection and returns `null`
    (equal passes). A departure is exact (instant or zoned string) or a
    zoneless wall time: on the first leg it is read in `startTimeZone`, on a
    later leg in the previous leg's `timeZone` (where that leg leaves from),
    both with `"compatible"` resolution (ambiguous → earlier, skipped →
    later). On a later leg, a repeated hour instead takes the earliest pass
    at or after the previous arrival plus its dwell. A
    negative leg `duration` is `null`; the last leg's `dwellAfter` is echoed,
    never added. `mode`, `origin` and `destination` are opaque tags echoed on
    each `LegTime`. An empty array returns `{ eta: "", legTimes: [] }`.
2. **Cut-offs count back from the caller's event.**
    `cutoffAt(anchor, offset, { timeZone, atLocalTime?, calendar?, roll? })`
    takes an offset off the anchor (loading, departure or arrival are
    different instants; it never guesses which). With `atLocalTime` the
    offset's exact part comes off the anchor's instant first, its calendar
    part off the local date, and the cut-off is that time of day: `P2D` at
    `"17:00"` is 17:00 two days before, not 48 hours. Without it the offset
    is `ZonedDateTime#subtract` (`P2D` keeps the wall clock, `PT96H` is 96
    exact hours). `calendar` and `roll` go together or not at all — there is
    no default roll, as in `rollDate`; either alone is `""`. A repeated hour
    takes the first pass (RFC 5545 §3.3.5); a skipped hour is `""`. It does
    not check that the cut-off is before the anchor.
    `cutoffSchedule(anchor, [{ name, offset, atLocalTime? }], options)`
    sorts the stack by instant and returns `[]` if any entry fails.
    `isPastCutoff(now, cutoff)` is `true` from the cut-off instant on;
    `timeToCutoff(now, cutoff)` is exact hours, `PT0S` at it, negative after.
3. **Planned versus actual is exact time under the caller's tolerance.**
    `scheduleDeviation(planned, actual)` is `actual − planned` in exact hours
    (`"PT14M"` late, `"-PT5M"` early; a fall-back delay is `PT1H`, never
    `PT0S`). `classifyPunctuality(planned, actual, { late, early? })` returns
    `"early" | "onTime" | "late"`, or `null` on invalid input: both edges are
    outside (exactly `late` is late), and without `early` every early arrival
    is on time. There is no default tolerance; tolerances are exact durations
    (a day is 24 hours; years, months, weeks or negative return `null`).
    `punctualityRate(pairs, tolerance)` returns `{ onTime, total, rate }`,
    judging every pair under a tolerance read once; an empty list or any
    invalid pair is `null`. A `TimestampEvent` is `{ classifier: "PLN" |
    "EST" | "REQ" | "ACT", at, recordedAt }` (DCSA vocabulary).
    `bestAvailable(events)` returns `{ at, classifier }`: `ACT` whenever one
    exists, else `PLN`, else `REQ`, else `EST`, newest `recordedAt` within the
    class — never an `EST` shown as an actual. `estimateDrift(events, {
    tolerance? })` reports first-to-last `EST` drift, `revisions` and
    `exceedsTolerance` (strictly greater, either direction; `null` without a
    tolerance), and is `null` with fewer than two `EST`s.
    `nextDeparture(after, timetable, { minimumConnection? })` returns the
    first departure at or after `after + minimumConnection`: a list entry
    echoed as written (ready for `scheduleDelivery`'s `departure`), or for
    `{ headway, from, to }` (a GTFS `frequencies.txt` row) `from + k × headway`
    in the half-open `[from, to)`, written the way `from` was. Every moment
    must carry its offset; a wall time without one is `""`.
4. **Read the docs site.** This skill is a routing pointer. The map of the
   docs is `https://northguild.dev/gmt/llms.txt`, and each page
   has a `.md` twin that holds its text. The JSDoc ships in the installed
   package: `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## Key functions

- **Transport legs and dwell**: `transitTime`, `etaAtZone`, `dwellTime`,
  `crossingTime`, `scheduleDelivery`
- **Cut-offs and deadlines**: `cutoffAt`, `cutoffSchedule`, `isPastCutoff`,
  `timeToCutoff`
- **Punctuality and timestamp classes**: `scheduleDeviation`,
  `classifyPunctuality`, `punctualityRate`, `bestAvailable`, `estimateDrift`,
  `nextDeparture`

## References

- [transport reference](https://northguild.dev/gmt/reference/transport/)
- [Docs map for agents (llms.txt)](https://northguild.dev/gmt/llms.txt)
- [GMT Timezone skill](../gmt-timezone/SKILL.md)
- [GMT Intermodal skill](../gmt-intermodal/SKILL.md)
