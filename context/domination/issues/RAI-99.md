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
    both call `readGtfsTime` in `internal/`, so the two cannot disagree. False for a value that is
    not a string.
- `internal/gtfsTime.ts` — the one `H:MM:SS` / `HH:MM:SS` / `HHH:MM:SS` regex. Not in `regex/`: GTFS states the
  format in prose, not as a pattern. It joins `context/coding-standards.md` as a scoped exception,
  as INT-15's EDI grammars did.
- `packages/gmt/src/types/gtfs.ts` — `GtfsTime`: `{ seconds: number; dayOverflow: number }`.
  `seconds` is the time of day in seconds, 0 to 86399; `dayOverflow` is the number of whole days past
  the service day, 0 or more.
- This story opens the `rail/` realm: the `@northguild/gmt/rail`, `@northguild/gmt/rail/parse`,
  `@northguild/gmt/rail/format` and `@northguild/gmt/rail/validate` subpaths (`package.json`
  `exports` and `typesVersions`, the dox `gmt-modules.ts` barrel), and the Rail industry in
  `apps/dox/src/data/industries.json`, with namespace `rail`, drawing on `transport`; its glyph in
  `INDUSTRY_ICON_PATHS` (`apps/dox/src/lib/industry-tags.ts`), and its hub text in
  `apps/dox/src/lib/industry-overview.ts`: three to five problems, each answered by a function the
  industry may name, in that file's wording rules. `context/dox/built.md` names all three as what a
  new industry takes, and `industry-tags.test.ts` and `industry-overview.test.ts` fail without them.

### What returns the sentinel

- `parseGtfsTime`: a value that is not `H:MM:SS`, `HH:MM:SS` or `HHH:MM:SS`; minutes or seconds outside 00–59; a
  sign, a fraction or a space.
- `formatGtfsTime`: a value that is not a `GtfsTime` object; `seconds` that is not an integer from 0
  to 86399; `dayOverflow` that is not a non-negative integer; a total of 1000 hours or more, which
  three hour digits cannot hold.

### Docs site — `apps/dox/src/content/docs/`

- Guide `guides/industries/rail-gtfs-service-days.mdx`: times past midnight, the service day, and
  why the overflow is kept.
- Scenario `a-gtfs-time-folded-into-one-day.mdx`.
- Mistakes: `mistakes/rail.mdx`.
- Indexes: `guides/industries/index.mdx`, `guides/index.mdx`, `mistakes/index.mdx`.

## Tool

**GTFS Time Reader.** Paste a `stop_times` value and see the time of day and the whole days past the
service day, never a date; a line says that a clock time on a date needs the agency's zone and
`gtfsToInstant` (RAI-100). Type a value under `24:00:00` and see the overflow drop to 0. Calls
`parseGtfsTime`, `formatGtfsTime`. Teaches: `25:35:00` is 01:35 on the day after the service day,
and still part of that service day.

## Design notes

- **The overflow is kept apart from the time.** Returning `dayOverflow` separately lets a round trip
  give back `25:35:00`, the form that carries the service day. Folding it into `01:35:00` loses what
  the field means.
- **`H:MM:SS`, `HH:MM:SS` and `HHH:MM:SS` are read, and at least `HH` is written.** GTFS accepts a one-digit hour; writing always
  uses two, so a value written by GMT matches the form the reference names first.
- **No upper bound below the format's.** GTFS sets no limit on how far past midnight a service day
  runs, so any value three hour digits can hold is read, up to `999:59:59`.
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
| `isValidGtfsTime` is true exactly when the parser returns a value | **GMT rule.** The validator and the parser call one internal core, so the two cannot disagree |
| Hours up to 999 | **GMT rule**: GTFS states no upper bound; MobilityData's gtfs-validator reads `H:MM:SS`, `HH:MM:SS` or `HHH:MM:SS` (`(\\d{1,3}):(\\d\\d):(\\d\\d)` in `GtfsTime.java`), and VIA Rail Canada's live feed writes `110:29:00` |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- Nothing from another story. The parse is integer arithmetic on three fields; no function in this
  story reads a zone or calls Temporal.

## Verification

- `parseGtfsTime('25:35:00')` returns `{ seconds: 5700, dayOverflow: 1 }`
- `parseGtfsTime('14:30:00')` returns `{ seconds: 52200, dayOverflow: 0 }`; `'8:05:00'` returns `{ seconds: 29100, dayOverflow: 0 }`
- `parseGtfsTime('24:00:00')` returns `{ seconds: 0, dayOverflow: 1 }`; `'48:00:00'` returns `dayOverflow: 2`
- `parseGtfsTime('-01:00:00')`, `'25:60:00'`, `'25:35'`, `'25:35:00.5'`, `'1000:00:00'` and `' 25:35:00'` return the sentinel
- `parseGtfsTime('125:00:00')` returns `{ seconds: 18000, dayOverflow: 5 }`; `'110:29:00'` returns `{ seconds: 52140, dayOverflow: 4 }`
- `formatGtfsTime({ seconds: 5700, dayOverflow: 1 })` returns `25:35:00`; `formatGtfsTime({ seconds: 29100, dayOverflow: 0 })` returns `08:05:00`
- Round-trip: `formatGtfsTime(parseGtfsTime('25:35:00'))` returns `25:35:00`, not `01:35:00`
- `isValidGtfsTime('25:35:00')` and `'8:05:00'` are `true`; `'125:00:00'` and `'110:29:00'` are `true`; `'25:60:00'`, `'25:35'` and `'1000:00:00'` are `false`
- `isValidGtfsTime` agrees with `parseGtfsTime` on every parse row above; `isValidGtfsTime(5700)` and `isValidGtfsTime(null)` are `false`
- `formatGtfsTime({ seconds: 86400, dayOverflow: 0 })`, `{ seconds: 1.5, dayOverflow: 0 }`, `{ seconds: 0, dayOverflow: -1 }` and `{ seconds: 0, dayOverflow: 42 }` (1008 hours) return the sentinel
- `formatGtfsTime({ seconds: 0, dayOverflow: 5 })` returns `120:00:00`; `{ seconds: 18000, dayOverflow: 5 }` returns `125:00:00`
- `pnpm run validate` stays green

## Decisions

Folded from the library and Dox specs when the story closed.

- **Hours run from 0 to 999, in one to three digits** (owner decision). GTFS sets no upper bound;
  MobilityData's gtfs-validator reads `H:MM:SS`, `HH:MM:SS` and `HHH:MM:SS`, and real feeds use
  three digits: VIA Rail Canada's live feed writes `110:29:00` (trip 112, Vancouver to Toronto). A three-digit spelling of a small hour
  (`005:00:00`) is read as the validator reads it. `formatGtfsTime` writes at least two digits.
- **`seconds` is not "seconds since local midnight".** GTFS measures a time from noon minus 12 h of
  the service day, so `dayOverflow x 86400 + seconds` is the elapsed seconds from that anchor. It
  matches the wall clock only when no clock change falls between the anchor and the time. The type's JSDoc says so, and this is
  the quantity RAI-100 adds to its anchor. RAI-100 consumes `parseGtfsTime` and `GtfsTime` as built.
- **No Temporal call.** A GTFS time names no date and its hour runs past 23 (`PlainTime` refuses
  `25:35:00`, and clamps it to `23:35:00` under `"constrain"`), so the regex and two integer
  comparisons are the whole check. This is a scoped exception in `context/coding-standards.md`.
- **Nothing is trimmed and no BOM is stripped.** A space, tab, newline or U+FEFF returns the sentinel;
  the caller's CSV reader removes them (GTFS § File Requirements).
- **The formatter reads its argument as a property bag** (any Object, a function included; each member
  read once; inherited members read; extra members ignored), as `formatEpcisEvent` does. Its try-catch
  is the only one in the story, because it runs caller code. `-0` writes as `00`.
- **`parseGtfsTime("")` returns `null`**, which is an interpolated stop's empty `arrival_time`. GTFS
  `Local time` (`timeframes.txt`, capped at `24:00:00`) is out of scope.
- **The Rail industry, glyph and hub text belong to the Dox build**, not the library slices: the
  industry tests fail on a link to a page that does not exist, so they land with the guide, the
  scenario and the mistakes page. Rail is its own industry and `drawsOn` `transport`. Its pages are
  tagged `rail` only, and the hub links Transport's Timetable Reader.
- **The reader shows no date.** It shows the time of day and the whole days past the service day,
  never a date or a weekday, and never "since midnight". One line is always shown: a clock time on a
  date needs the agency's zone, and `gtfsToInstant` (RAI-100) does that. The site holds no GTFS
  grammar; every value and refusal comes from the library or a probe of it.
- **`gtfsToInstant` is named, never linked,** on a public page until RAI-100's Dox spec adds the link.
  What is built on the site is recorded in `context/dox/built.md` (GTFS Time Reader).
