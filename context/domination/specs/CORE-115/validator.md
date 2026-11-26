# Slice 1 — `isValidOperatingSchedule`, shared rows, agreement check

Index: [index.md](index.md). Rules and their sources: the index's Authority table.

## Source

`packages/gmt/src/calendar/validate/isValidOperatingSchedule.ts`, the same shape as
`isValidBusinessCalendar.ts` beside it:

```ts
import { parseOperatingSchedule } from "../../internal/operatingSchedule";
import type { OperatingSchedule } from "../../types";

export function isValidOperatingSchedule(schedule: unknown): schedule is OperatingSchedule {
  try {
    return parseOperatingSchedule(schedule) !== null;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
```

The `try` is needed: `parseOperatingSchedule` has no catch of its own, and a getter that throws
on `timeZone` propagates out of it (probe on this branch). Add
`export * from "./isValidOperatingSchedule";` to `calendar/validate/index.ts` after
`isValidHolidayRule`. No change to `internal/operatingSchedule.ts`.

## JSDoc

Lead: "Return true when `schedule` is an `OperatingSchedule` the operating-hours functions
accept." Then bullets, in this order, each one rule from the Authority table:

- `timeZone` must be a time zone identifier (`"Europe/Paris"`, `"+05:30"`, `"+0530"`, `"-08"`) or
  a stored offset `±HH:MM[:SS]` (`"-00:44:30"`), as `isValidTimeZone` or `isValidUtcOffset`
  accepts.
- `weekly` must be an object whose own enumerable keys are `"1"`–`"7"`, Monday to Sunday. A
  weekday is read with a property get, so an inherited one applies. A weekday that is absent or
  `undefined` is closed; any other value must be an array of windows. `{}` is valid and is closed
  every day. A `Map` has no such keys, so it is valid and reads as closed every day.
- A window is `{ from, to }`, both plain times (`"HH:MM"` or `"HH:MM:SS"` with an optional
  fraction). `to` at or before `from` crosses midnight; `"00:00"` to `"00:00"` is a whole day.
  `"24:00"`, a second of 60 and a time with an offset or `T` are not plain times.
- `holidays` is optional: an array of ISO PlainDate strings, or a `BusinessCalendar`, which must
  pass `isValidBusinessCalendar` though only its `holidays` are read.
- `overrides` is optional: an array of `{ date, windows }`. Two overrides for one date, however
  the date is spelt, are invalid.
- Dates take no annotation (`"2024-05-15[u-ca=iso8601]"` is invalid) and lie between
  `-271821-04-19` and `+275760-09-13`, Temporal's limits.
- Other keys on the schedule, a window or an override are ignored, so a misspelt key such as
  `holiday` is not an error.
- Returns `false` for non-objects, `null` and arrays. A function carrying the fields is accepted.
- Use it to tell a closed schedule from an invalid one: `operatingIntervals` returns `[]` and
  `isOpenAt` returns `false` for both. `nextOpenAt`, `nextCloseAt` and `addOperatingTime` search a
  horizon and return `""` for an invalid schedule and for no answer within it. `operatingTimeBetween`
  has no horizon: it returns `""` for an invalid schedule and `"PT0S"` for a valid closed one.

`@param schedule candidate value of any type`;
`@returns boolean indicating whether every operating-hours function accepts it`.

Examples (each verified on this branch; the comment after `//` gives the reason):

```ts
isValidOperatingSchedule({ timeZone: "Europe/Paris", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // true
isValidOperatingSchedule({ timeZone: "UTC", weekly: { 5: [{ from: "23:00", to: "06:00" }] }, holidays: ["2024-11-20"], overrides: [{ date: "2024-11-19", windows: [] }] }) // true — a window past midnight, a holiday and an override
isValidOperatingSchedule({ timeZone: "-00:44:30", weekly: {} }) // true — valid, closed every day
isValidOperatingSchedule({ timeZone: "UTC", weekly: { 8: [] } }) // false — 8 is not an ISO weekday
isValidOperatingSchedule({ timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "24:00" }] } }) // false — 24:00 is not a plain time
isValidOperatingSchedule({ timeZone: "UTC", weekly: {}, holidays: ["2024-05-15[u-ca=iso8601]"] }) // false — a plain date takes no annotation
isValidOperatingSchedule({ timeZone: "UTC", weekly: {}, overrides: [{ date: "2024-06-10", windows: [] }, { date: "+002024-06-10", windows: [] }] }) // false — two overrides for one date
isValidOperatingSchedule({ timeZone: "Invalid/Zone", weekly: {} }) // false
isValidOperatingSchedule(null) // false
```

## Shared rows — `packages/gmt/src/test/operatingScheduleRows.ts`

Test data only, no `describe` or `it`. Imports `battleTestTimeZones` from `./index` and
`hostileProxy`, `revokedProxy` from `./hostileValues`. Exports:

- `OPEN_RANGE = { start: "2024-06-08T00:00:00Z", end: "2024-06-13T00:00:00Z" }` (Saturday to
  Thursday, so Monday 2024-06-10 09:00–17:00 local is inside it at every offset from −12 to +14).
- `nineToFive`, `valid = { timeZone: "UTC", weekly: { 1: nineToFive } }`.
- `ACCEPTED_SCHEDULES`, `CLOSED_SCHEDULES`, `REJECTED_SCHEDULES`: arrays of
  `{ schedule: unknown, reads: string }`, every `reads` unique across all three.
- `HOSTILE_SCHEDULES`: `{ make: () => unknown, reads }`, built fresh per call.

**Accepted** (open somewhere in `OPEN_RANGE`): the valid baseline; `valid` in each of the 20
`battleTestTimeZones` (reads `` `zone ${zone}` ``); zones `-00:44:30`, `utc`, `+0530`, `-08`;
a misspelt `holiday: ["2024-06-10"]`; a window with an extra `note` key; `2: undefined`;
`Object.assign(() => {}, valid)`; a null-prototype copy; `Object.freeze` of a copy;
`Object.create(valid)` (inherited fields); `weekly: Object.create({ 1: nineToFive })`
(inherited weekday); a `weekly` with a non-enumerable symbol key; edges `"09:00:00.5"` and
`"09:00:00,5"` (ISO 8601 allows either decimal sign); `"00:00"` to `"00:00"`; explicit
`holidays: undefined`; holiday `"+275760-09-13"`; overrides on `"-271821-04-19"` and on
`"+275760-09-13"`; a holiday and an override for `"2024-06-10"` with `nineToFive` (the override
wins, still open); `holidays` a valid `BusinessCalendar` (`weekend: [6, 7]`, `holidays:
["2024-06-11"]`) with zone `"UTC"`, and one with zone `"+05:30"`.

**Closed** (valid, no open instant in `OPEN_RANGE`, and no override on 2024-06-12): `weekly: {}`;
`weekly: new Map([[1, nineToFive]])` (no own enumerable key, so no weekday: closed);
`holidays: ["2024-06-10"]`; an override `{ date: "2024-06-10", windows: [] }`.

**Rejected** — the 23 rows in today's `operatingIntervals.test.ts` invalid table, except "two
spellings of one override date", which is rewritten below; then:

- Non-objects: `undefined`, `42`, `42n`, `Symbol("s")`, `true`.
- Zone: `0`, `""`, `"Z"`, `"[UTC]"`, `" UTC "`.
- `weekly`: `null`, `[nineToFive]`, key `"0"`, `"01"`, `"Monday"`, an enumerable symbol key.
- Weekday: `null`, `{ from: "09:00", to: "17:00" }` (not in an array), `new Array(1)` (a hole).
- Window: `to` `"24:00"`; `from` `"T09:00"`, `"9:00"`, `"09:00:00.0000000001"`, `"23:59:60"`,
  `"09:00Z"`; a window written `["09:00", "17:00"]`; no `to`.
- Holidays: `null`; `"2024-05-15[u-ca=iso8601]"`, `"2024-05-15[foo=bar]"`, `"2024-05-15[UTC]"`;
  `"+275760-09-14"`; a `BusinessCalendar` with zone `"-00:44:30"`.
- Overrides: `null`; `[["2024-06-10", []]]`; date `20240610`; date `"-271821-04-18"`; date
  `"2024-06-10[u-ca=iso8601]"`; "two spellings of one override date": `"2024-06-10"` and
  `"+002024-06-10"`, both `windows: []` (each alone is valid, so only the duplicate refuses it).

**Hostile**: `hostileProxy()`, `revokedProxy()`; a schedule whose `timeZone` getter throws; one
whose `weekly["1"]` getter throws; one whose `holidays` getter throws.

## Tests — `isValidOperatingSchedule.test.ts`

Mirror `isValidBusinessCalendar.test.ts`: `it.each` tables, `''` for an empty-string label.

1. `"accepts a schedule with $reads"` over `ACCEPTED_SCHEDULES` → `true`.
2. `"accepts a schedule that is closed throughout, with $reads"` over `CLOSED_SCHEDULES` → `true`.
3. `"refuses a schedule with $reads"` over `REJECTED_SCHEDULES` → `false`.
4. `"returns false, never throws, for $reads"` over `HOSTILE_SCHEDULES` → `false`.
5. Each `@example` above as a row of one table, `"returns $expected for $reads"`.
6. Mocks, each restored after: `mockTemporalPlainTimeFromThrow` → `false` for `valid`;
   `clearHolidayMemo()` then `mockTemporalPlainDateFromThrow` → `false` for
   `{ ...valid, holidays: ["2031-01-01"] }` (a date no other test memoises).
7. **Agreement**, one test, `"agrees with operatingIntervals on every row"`. For each row compute
   `isValidOperatingSchedule(s)` and `operatingIntervals(s, OPEN_RANGE)`; a row disagrees when:
   - accepted: the validator is not `true`, or the intervals are empty;
   - closed: the validator is not `true`, the intervals are not `[]`, or
     `operatingIntervals({ ...s, overrides: [...(s.overrides ?? []), { date: "2024-06-12",
     windows: nineToFive }] }, OPEN_RANGE)` is empty (the override proves the schedule parses);
   - rejected and hostile: the validator is not `false`, or the intervals are not `[]`.

   Collect disagreeing `reads` and assert `{ count: 0, first: [] }` once (first five).
   `operatingIntervals` is imported from `../hours/operatingIntervals` (tests may call two public
   functions; the boundary rule covers source only).

Every test stays under 0.3 s; the agreement test runs about 120 rows over a five-day range.
