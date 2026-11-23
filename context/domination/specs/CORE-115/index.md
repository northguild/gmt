---
story: CORE-115
issue: 567
status: approved
dox: context/dox/specs/core-115/index.md
---

# CORE-115 — `isValidOperatingSchedule`, a validator for `OperatingSchedule`

## Scope

Story: [`issues/CORE-115.md`](../../issues/CORE-115.md) (#567). `Blocked by` is empty; CORE-55
(`operatingIntervals`, `OperatingSchedule`) and CORE-7 (`isValidBusinessCalendar`) have shipped.

- **One new public function**, `isValidOperatingSchedule`, in `calendar/validate/` beside
  `isValidBusinessCalendar`, with the same guard shape: `try { return parse(x) !== null } catch
  { return false }`.
- **The shared check already exists.** `parseOperatingSchedule` in
  `packages/gmt/src/internal/operatingSchedule.ts` is the only schedule check, and all six
  operating functions call it (`operatingIntervals`, `isOpenAt`, `nextOpenAt`, `nextCloseAt`,
  `addOperatingTime`, `operatingTimeBetween`). The validator calls it too, so it speaks for all
  six and cannot drift. No new internal code, no change to what any function accepts.
- **One shared row table** (`src/test/operatingScheduleRows.ts`) feeds both the validator's tests
  and `operatingIntervals`' invalid-input tests, plus an agreement check over every row.

### Defects this story fixes (found while planning; zero known bugs)

1. **Three `operatingIntervals` tests pass only through the sentinel.** Since CORE-113 a holiday
   or override date takes no annotation (`plainDate` regex,
   [calendar-strings § each kind accepts one exact pattern](../../../coding-standards/calendar-strings.md#calendar-annotated-strings-are-rfc-9557-e1-e7)).
   So "normalises a holiday with an iso8601 annotation", "…an elective annotation" and "matches
   an override written with an annotation to its date" now reject the schedule, and assert `[]`,
   which is the sentinel. The "two spellings of one override date" row is rejected for its
   annotation, not for the duplicate. Probe on this branch: `parseOperatingSchedule` returns
   `null` for all four. Fix in [hours-tests-and-docs](hours-tests-and-docs.md).
2. **`isOpenAt`'s JSDoc gives advice that cannot work.** "Check the schedule with
   `operatingIntervals` when closed and invalid must be told apart", but `operatingIntervals`
   returns `[]` for both. It points at the new validator instead.

Out of scope: `recurringWindows` (takes a bare `weekly`, not a schedule); no change to
`parseOperatingSchedule`'s rules (see [Decisions](#decisions)).

## Signature

```ts
// packages/gmt/src/calendar/validate/isValidOperatingSchedule.ts
export function isValidOperatingSchedule(
  schedule: unknown,
): schedule is OperatingSchedule;
```

Sentinel: `false` ([API contract](../../../coding-standards/api-contract.md#api-contract), boolean
row). Cost: one pass over the caller's windows, holidays and overrides, plus the holiday sort
`parseHolidays` already does: O(W + H log H + O). No span-dependent loop, so no bench row
([§ Loop cost](../../../coding-standards/design-rules.md#loop-cost), first bullet).

## Files

| File | Slice |
| ---- | ----- |
| `packages/gmt/src/calendar/validate/isValidOperatingSchedule.ts` (new) | validator |
| `packages/gmt/src/calendar/validate/isValidOperatingSchedule.test.ts` (new) | validator |
| `packages/gmt/src/calendar/validate/index.ts` (one export line) | validator |
| `packages/gmt/src/test/operatingScheduleRows.ts` (new, test data only) | validator |
| `packages/gmt/src/calendar/hours/operatingIntervals.test.ts` | hours-tests-and-docs |
| `packages/gmt/src/calendar/hours/{operatingIntervals,isOpenAt,nextOpenAt,nextCloseAt,addOperatingTime,operatingTimeBetween}.ts` (JSDoc only) | hours-tests-and-docs |
| `packages/gmt/src/types/operating-schedule.ts` (JSDoc only) | hours-tests-and-docs |
| `packages/gmt/src/test/zoneArgumentCalls.ts`, `zoneArgument.test.ts`, `zoneArgumentBaseline.json` | zone-harness |

## Authority — what each rule rests on

| Rule | Source |
| ---- | ------ |
| Invalid input returns `false`, never throws, hostile values included | [api-contract § API Contract](../../../coding-standards/api-contract.md#api-contract) (boolean → `false`); AGENTS.md Core Rule 3 |
| `true` exactly when `parseOperatingSchedule` returns a schedule; the validator and all six operating functions share that one check | **GMT rule**, issue Scope ("one source of truth"); [§ Loop cost](../../../coding-standards/design-rules.md#loop-cost) "Resolve once": a public function never calls another, both call the core |
| `weekly` keys `"1"`–`"7"`, Monday 1 … Sunday 7 | TC39 Temporal abstract operation `ISODayOfWeek` (`tc39.es/proposal-temporal/#sec-temporal-isodayofweek`), as `PlainDate.prototype.dayOfWeek` reads it |
| A weekday is read with an ordinary property get, so an inherited or non-enumerable weekday applies | ECMA-262 §7.3.2 `Get`, the read Temporal uses for each field of a property bag (`#sec-temporal-preparecalendarfields`) |
| Any other own enumerable key on `weekly`, string or symbol, makes it invalid | **GMT rule**: a `weekly` key is data (a weekday), not a field name, so an unknown one is a malformed weekday, not a field to skip (`parseWeeklyPattern` doc) |
| Other keys on the schedule, a window or an override are ignored | TC39 Temporal reads only its named fields from a property bag (`ToTemporalTimeRecord`, `#sec-temporal-totemporaltimerecord`); same as `isValidDutyLog` ("Extra keys on an entry are ignored"). See decision 1 |
| `from` / `to` are a plain time: GMT's `plainTime` shape over the whole string, then `Temporal.PlainTime.from` | [calendar-strings § each kind accepts one exact pattern](../../../coding-standards/calendar-strings.md#calendar-annotated-strings-are-rfc-9557-e1-e7) (CORE-113): plain kinds take the body and no annotation |
| Second `60` is refused in a window edge | **GMT rule**, `regex/time.ts`: Temporal's `TimeSecond` admits 60 and reads it as 59 |
| Holiday and override dates are plain ISO dates, no annotation, ISO calendar | Same calendar-strings bullet; `plainDateOf` keeps only `iso8601` |
| Dates from `-271821-04-19` to `+275760-09-13` | TC39 Temporal `ISODateWithinLimits` (`#sec-temporal-isodatewithinlimits`). Probe: both limits accepted, one day past each refused |
| `timeZone` is a time zone identifier or a stored offset `±HH:MM[:SS]` | TC39 Temporal `TimeZoneIdentifier` grammar (minutes only); stored offsets with seconds are a **GMT rule** read by `internal/zoneFrame.ts` (`zoneArgument.test.ts` header) |
| `holidays` is a date list or a `BusinessCalendar`, which must itself pass `isValidBusinessCalendar` though only its `holidays` are read | **GMT rule**, `OperatingSchedule.holidays` doc: one validator decides each type. See decision 2 |
| Two overrides for one date, in any spelling, make the schedule invalid | **GMT rule**, `OperatingSchedule.overrides` doc: two different statements about one date |
| A function carrying the fields is an object | ECMA-262 §6.1.7 (a function is an Object); `internal/isObject.ts`, `test/functionObjects.test.ts` |

## Slices

| Slice | File | Depends on |
| ----- | ---- | ---------- |
| 1. Validator, shared rows, agreement check | [validator.md](validator.md) | — |
| 2. `operatingIntervals` test repair and JSDoc pointers | [hours-tests-and-docs.md](hours-tests-and-docs.md) | 1 (the rows module) |
| 3. Zone-argument harness row | [zone-harness.md](zone-harness.md) | 1 (the export) |

## Finalizer

- Changeset: `minor` (new public function), plus a line for the corrected `isOpenAt` advice.
- `pnpm size --files calendar` and root: the root grows by the wrapper only; raise
  `entries.root.minified` by a reviewed edit if the gate fails, nothing else.
- `/tanstack-intent`: add the function to `gmt-timezone` (operating hours list) and
  `skills/_artifacts/domain_map.yaml`.
- Dox: the guide rule and both tools are the Dox spec,
  [`context/dox/specs/core-115/index.md`](../../../dox/specs/core-115/index.md).
- `/update-readme` for the generated function count; refresh the generated reference corpus.
- Fold decisions into `issues/CORE-115.md`, then delete this folder and its line in
  [`../index.md`](../index.md).

## Decisions

1. **Unknown keys are ignored.** Other keys on the schedule, a window or an override are not
   read, so a misspelt `holiday` or `override` key does not refuse the schedule, and a `Map` as
   `weekly` has no own weekday key and reads as closed every day. Authority: TC39 Temporal reads
   only its named fields from a property bag (`ToTemporalTimeRecord`,
   `#sec-temporal-totemporaltimerecord`); `isValidDutyLog` ignores extra keys the same way. The
   JSDoc states it, and slice 1 pins both rows as `true`.
2. **A `BusinessCalendar` in `holidays` is checked in full.** It must pass
   `isValidBusinessCalendar` though only its `holidays` are read, so a seven-day weekend, a missing
   zone or a seconds offset (`"-00:44:30"`) there refuses the schedule. Authority: GMT rule, one
   validator decides each type (`OperatingSchedule.holidays` doc); existing `operatingIntervals`
   tests already pin two of these as refusals.

This story adds no runtime workaround
([runtime-workarounds.md](../../../coding-standards/runtime-workarounds.md)).
