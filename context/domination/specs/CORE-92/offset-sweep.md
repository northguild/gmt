# Slice 2 — offset-sweep: every zone, one instant a day, swap against `Intl`

Index: [index.md](index.md). Clauses: the index Authority rows on zones, IANA, `longOffset`, ILD
text, the swap offset, instant validity, the 29 February clamp, and the noon / 1970 / ten-year
GMT rule. Issue Scope 2; research §4.3.

## File

`scripts/lib/offset-sweep.mjs`: pure functions, ESM, JSDoc-typed like the other `scripts/lib`
modules. No I/O and no imports beyond `node:` built-ins. The caller (slice 3) supplies both
offset functions, so this module never loads a polyfill.

## `parseLongOffset(text)`

`text`: the `timeZoneName` part from `formatToParts` of an `Intl.DateTimeFormat("en", { timeZone,
timeZoneName: "longOffset" })`. Returns the offset in **seconds east of UTC**, or `null` for
any other text.

Grammar: `^GMT(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?$`.

| Input | Output |
| ----- | ------ |
| `"GMT"` | `0` (CLDR `gmtZeroFormat`) |
| `"GMT+00:00"` | `0` |
| `"GMT+05:30"` | `19800` |
| `"GMT-03:00"` | `-10800` |
| `"GMT-00:44:30"` | `-2670` (Africa/Monrovia before 1972; seconds are kept) |
| `"GMT+14:00"` | `50400` |
| `"GMT-00:00"` | `0` (not `-0`: return `0` when the value is zero) |
| `"UTC"`, `"GMT+5"`, `"GMT+05"`, `"+05:30"`, `"GMT+05:30 "`, `""` | `null` |
| `"GMT+05:60"`, `"GMT+05:30:60"` | `null` (minutes and seconds must be 00–59) |

## `sweepSpan(today)`

`today`: a `Temporal.PlainDate` (the runtime's built-in one, passed in by the caller).
Returns `{ from: "1970-01-01", through: <ISO date>, firstDay: 0, lastDay: <epoch day> }`.
`through = today.add({ years: 10 })` with the default `overflow: "constrain"`. An epoch day is
whole days since 1970-01-01.

| `today` | `through` | `lastDay` |
| ------- | --------- | --------- |
| 2026-10-25 | 2036-10-25 | 24404 |
| 2028-02-29 | 2038-02-28 | 24895 |
| 1970-01-01 | 1980-01-01 | 3652 |

(Check: 2026-10-25 is epoch day 20751; 2000-02-29 is 11016; 1969-12-31 would be −1.)

## `sweepOffsets({ zones, firstDay, lastDay, implOffset, intlOffset })`

- `zones: string[]`: in the order given (the caller passes `Intl.supportedValuesOf("timeZone")`).
- `implOffset(zone, ms) → number`: the swap's offset in **seconds**, as
  `Number(offsetNanoseconds) / 1e9` of
  `Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(zone)`. It may throw.
- `intlOffset(zone, ms) → string`: the raw `timeZoneName` text. The sweep parses it.
- The instant for day `d` is `ms = d * 86_400_000 + 43_200_000` (12:00 UTC).

Per zone and day:

1. `text = intlOffset(zone, ms)`; `intl = parseLongOffset(text)`. When `intl === null`, throw
   `Error` with the message `` `Intl longOffset text for ${zone} on ${iso(d)} is "${text}", which
   the sweep cannot read` ``. The caller turns it into a could-not-run sweep. An unreadable
   reference is not a pass.
2. `polyfill = implOffset(zone, ms)`; if it throws, `polyfill = null`. A throw on a valid zone
   and instant is a defect, so the day counts as differing.
3. The day differs when `polyfill !== intl`.

`iso(d)`: the ISO date of epoch day `d`. Compute it from epoch arithmetic
(`new Date(d * 86_400_000).toISOString().slice(0, 10)`, valid because every swept day is after
1970 and inside the `Date` range). Do not use the swap implementation.

Consecutive differing days for a zone with the same `(intl, polyfill)` pair merge into one
**run**: `{ from, through, intl, polyfill }`, with ISO dates and offsets in seconds (`polyfill`
may be `null`). A day that matches, or a day with a different pair, ends the run.

Returns:

```js
{
  from, through,            // ISO dates of firstDay and lastDay
  zones: number,            // zones swept
  days: number,             // lastDay - firstDay + 1
  comparisons: number,      // zones × days
  differingZones: number,   // zones with at least one differing day (never capped)
  differing: [{ zone, days, runs, runsTruncated }],   // in input zone order
  differingTruncated: boolean,
}
```

- Cap `differing` at **50** zones (`differingTruncated` is true beyond that). Cap each zone's
  `runs` at **20** (`runsTruncated`). `days` is the zone's full count of differing days, never
  capped.
- `zones.length === 0` → throw `"Intl.supportedValuesOf(\"timeZone\") returned no zones"`.
- `lastDay < firstDay` → throw (a caller bug).

## Edge cases the tests must cover (`apps/dox/scripts/canary/offset-sweep.test.ts`)

Use fake `implOffset` / `intlOffset` functions. No polyfill and no real zones are needed for
the unit rows.

| Row | Expected |
| --- | -------- |
| every day matches | `differing: []`, `differingZones: 0`, `comparisons = zones × days` |
| one zone differs on days 3–5 with one pair, then on day 9 with another | 1 zone, `days: 4`, 2 runs |
| differing days 3–5 with pair A, then day 6 with pair B | 2 runs (the pair change splits the run) |
| `implOffset` throws on day 2 | that day differs, `polyfill: null` |
| Intl returns `"GMT+5"` | throws, and the message names zone, date and text |
| 51 differing zones | 50 listed, `differingTruncated: true`, `differingZones: 51` |
| 21 runs in one zone | 20 listed, `runsTruncated: true`, `days` counts all |
| instant for day 0 | `43_200_000` ms is the first `ms` passed |
| `zones: []` | throws |
| the `parseLongOffset` and `sweepSpan` tables above | as listed |

**One integration row on real data** (Node 26's own `Intl` and built-in `Temporal`): sweep
`["Africa/Casablanca", "Europe/Chisinau", "Africa/Monrovia", "America/New_York"]` from 1970 to
2036 with `implOffset` on the **runtime's built-in** `Temporal`. Expect `differingZones: 0`.
This proves the harness on two correct sources. It must not need `temporal-polyfill`. Skip it
with a message only when `globalThis.Temporal` is absent; the repo's Node floor is 26, so it
should always run.

The research figures are the acceptance check in the index's "Verification before review": 0 zones
on 1.0.7, and on 1.0.6 (the known positive) Casablanca 178 days, Chisinau 42, Monrovia and
New_York 0, all with tz 2026e. They are not unit rows, because the package is not installed in
the repo.

## Cost

The function body is O(zones × days) with constant work per comparison. The caller builds one
`Intl.DateTimeFormat` per zone (slice 3), never one per day. About 80 s on Node 26.12.1 for 418
zones over 1970–2036 (the index's Loop cost section).
