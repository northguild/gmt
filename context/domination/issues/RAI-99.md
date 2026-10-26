# RAI-99 — Rail: GTFS time strings

**Scope:** Read and write the GTFS `Time` value, which runs past `24:00:00`, without folding it back into one day.

## Gap

GTFS is the dominant public-transport data format, and its `Time` value is the
highest-frequency temporal bug in transit software ([painpoints § Rail — GTFS is the gap](../painpoints.md#gtfs-is-the-gap)).
`stop_times.arrival_time` and `departure_time` may exceed `24:00:00`: "For times occurring after
midnight on the service day, enter the time as a value greater than 24:00:00 in HH:MM:SS", so
`25:35:00` is "1:35AM on the next day". The time belongs to a service day, not a calendar date,
because agencies group trips that run past midnight with the day they began.

A time parser rejects `25:35:00`. One that accepts it and normalises it to `01:35:00` loses the
service day, and every trip after midnight moves to the wrong date.

([GTFS Schedule Reference, Field Types: Time](https://gtfs.org/documentation/schedule/reference/))

## Scope

- `packages/gmt/src/rail/parse/parseGtfsTime.ts`:
  - `parseGtfsTime(value: string): GtfsTime | null` — `'25:35:00'` returns
    `{ seconds: 5700, dayOverflow: 1 }`: 01:35:00 after one whole day. A value below `24:00:00`
    returns `dayOverflow: 0`.
- `packages/gmt/src/rail/format/formatGtfsTime.ts`:
  - `formatGtfsTime(value: GtfsTime): string` — The inverse. `{ seconds: 5700, dayOverflow: 1 }`
    returns `25:35:00`, never `01:35:00`.
- `packages/gmt/src/rail/validate/isValidGtfsTime.ts`:
  - `isValidGtfsTime(value: string): boolean` — True exactly when `parseGtfsTime` returns a value;
    it calls the parser, so the two cannot disagree. False for a value that is not a string.
- `internal/gtfsTime.ts` — the one `H:MM:SS` / `HH:MM:SS` regex. Not in `regex/`: GTFS states the
  format in prose, not as a pattern. It joins `context/coding-standards.md` as a scoped exception,
  as INT-15's EDI grammars did.
- `packages/gmt/src/types/gtfs.ts` — `GtfsTime`: `{ seconds: number; dayOverflow: number }`.
  `seconds` is the time of day in seconds, 0 to 86399; `dayOverflow` is the number of whole days past
  the service day, 0 or more.
- This story opens the `rail/` realm: the `@northguild/gmt/rail`, `@northguild/gmt/rail/parse`,
  `@northguild/gmt/rail/format` and `@northguild/gmt/rail/validate` subpaths (`package.json`
  `exports` and `typesVersions`, the dox `gmt-modules.ts` barrel), and the Rail industry in
  `apps/dox/src/data/industries.json`, with namespace `rail`, drawing on `transport`.

### What returns the sentinel

- `parseGtfsTime`: a value that is not `H:MM:SS` or `HH:MM:SS`; minutes or seconds outside 00–59; a
  sign, a fraction or a space.
- `formatGtfsTime`: a value that is not a `GtfsTime` object; `seconds` that is not an integer from 0
  to 86399; `dayOverflow` that is not a non-negative integer; a total of 100 hours or more, which
  `HH` cannot hold.

### Docs site — `apps/dox/src/content/docs/`

- Guide `guides/industries/rail-gtfs-service-days.mdx`: times past midnight, the service day, and
  why the overflow is kept.
- Scenario `a-gtfs-time-folded-into-one-day.mdx`.
- Mistakes: `mistakes/rail.mdx`.
- Indexes: `guides/industries/index.mdx`, `guides/index.mdx`, `mistakes/index.mdx`.

## Tool

**GTFS Time Reader.** Paste a `stop_times` value and see the time of day, the days past the service
day and the clock reading on the following date; type a value under `24:00:00` and see the overflow
drop to 0. Calls `parseGtfsTime`, `formatGtfsTime`. Teaches: `25:35:00` is 01:35 on the next day,
and still part of today's service.

## Design notes

- **The overflow is kept apart from the time.** Returning `dayOverflow` separately lets a round trip
  give back `25:35:00`, the form that carries the service day. Folding it into `01:35:00` loses what
  the field means.
- **`H:MM:SS` is read, and `HH:MM:SS` is written.** GTFS accepts a one-digit hour; writing always
  uses two, so a value written by GMT matches the form the reference names first.
- **No upper bound below the format's.** GTFS sets no limit on how far past midnight a service day
  runs, so any value `HH` can hold is read, up to `99:59:59`.
- **One public check, no public pattern.** A GTFS time has no calendar to check, so the regex and
  the minute and second ranges are the whole rule. The pattern still stays in `internal/`, because
  GTFS publishes none; `isValidGtfsTime` is the public check.
- **Not an instant yet.** A GTFS time is measured from "noon minus 12h" of the service day in the
  agency's zone; turning it into an instant is RAI-100's.
- `calendar.txt` and `calendar_dates.txt` service selection is data modelling and stays with the
  consumer.

## Authority — what each rule rests on

GTFS is an open specification, maintained by MobilityData with its community and published by
agencies in many countries; the reference was read at gtfs.org.

| Rule | Source |
| --- | --- |
| `HH:MM:SS`, with `H:MM:SS` accepted | GTFS Reference, Field Types, Time: "Time in the HH:MM:SS format (H:MM:SS is also accepted)" |
| Values past `24:00:00` belong to the service day | GTFS Reference, Field Types, Time: "For times occurring after midnight on the service day, enter the time as a value greater than 24:00:00 in HH:MM:SS"; examples `14:30:00` and `25:35:00` "for 1:35AM on the next day" |
| The overflow is returned apart and written back | **GMT rule.** The service day is the field's meaning; normalising drops it |
| The grammar is internal; the public check is `isValidGtfsTime` | **GMT rule**, INT-15's: GTFS states the format in prose and publishes no pattern |
| `isValidGtfsTime` is true exactly when the parser returns a value | **GMT rule.** The validator calls the parser, so the two cannot disagree |
| Hours up to 99 | **GMT rule**, from the two-digit `HH` the format names; GTFS states no upper bound |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- Nothing from another story. The parse is integer arithmetic on three fields; no function in this
  story reads a zone or calls Temporal.

## Verification

- `parseGtfsTime('25:35:00')` returns `{ seconds: 5700, dayOverflow: 1 }`
- `parseGtfsTime('14:30:00')` returns `{ seconds: 52200, dayOverflow: 0 }`; `'8:05:00'` returns `{ seconds: 29100, dayOverflow: 0 }`
- `parseGtfsTime('24:00:00')` returns `{ seconds: 0, dayOverflow: 1 }`; `'48:00:00'` returns `dayOverflow: 2`
- `parseGtfsTime('-01:00:00')`, `'25:60:00'`, `'25:35'`, `'25:35:00.5'`, `'125:00:00'` and `' 25:35:00'` return the sentinel
- `formatGtfsTime({ seconds: 5700, dayOverflow: 1 })` returns `25:35:00`; `formatGtfsTime({ seconds: 29100, dayOverflow: 0 })` returns `08:05:00`
- Round-trip: `formatGtfsTime(parseGtfsTime('25:35:00'))` returns `25:35:00`, not `01:35:00`
- `isValidGtfsTime('25:35:00')` and `'8:05:00'` are `true`; `'25:60:00'`, `'25:35'` and `'125:00:00'` are `false`
- `isValidGtfsTime` agrees with `parseGtfsTime` on every parse row above; `isValidGtfsTime(5700)` and `isValidGtfsTime(null)` are `false`
- `formatGtfsTime({ seconds: 86400, dayOverflow: 0 })`, `{ seconds: 1.5, dayOverflow: 0 }`, `{ seconds: 0, dayOverflow: -1 }` and `{ seconds: 0, dayOverflow: 5 }` (120 hours) return the sentinel
- `pnpm run validate` stays green
