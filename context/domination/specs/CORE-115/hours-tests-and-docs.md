# Slice 2 — `operatingIntervals` test repair and JSDoc pointers

Index: [index.md](index.md). Depends on slice 1 for `src/test/operatingScheduleRows.ts`.
No behaviour changes: every edit here is a test that now tests what its name says, or a
JSDoc sentence.

## A. Tests that pass only through the sentinel

File: `packages/gmt/src/calendar/hours/operatingIntervals.test.ts`. Since CORE-113 a plain date
takes no annotation ([calendar-strings § each kind accepts one exact pattern](../../../coding-standards/calendar-strings.md#calendar-annotated-strings-are-rfc-9557-e1-e7)),
so `parseOperatingSchedule` refuses each schedule below and the expected `[]` is the sentinel,
not a holiday being closed. A test whose expected value equals the sentinel proves nothing
([testing standards](../../../testing-standards/references/index.md)); each is rewritten so a
closed day and a refused schedule give different answers.

1. **"normalises a holiday with $reads"** (the `it.each` with three rows).
   - Delete the `[u-ca=iso8601]` and `[foo=bar]` rows here; both are now rows of
     `REJECTED_SCHEDULES` (slice 1).
   - Keep the duplicate, and add the expanded-year spelling, as rows of a table named
     **"closes a holiday listed as $reads"**:
     `["2024-07-04", "2024-07-04"]` reads "a duplicate", and `["+002024-07-04"]` reads "an
     expanded year".
   - Schedule `{ timeZone: "America/New_York", weekly: { 4: nineToFive, 5: nineToFive },
     holidays }` over `julyWeek`. Expected, derived from the rule (Thursday 4 July closed,
     Friday 5 July 09:00–17:00 EDT, UTC−4): exactly
     `[{ start: "2024-07-05T13:00:00Z", end: "2024-07-05T21:00:00Z" }]`. The sentinel `[]`
     cannot pass this.
2. **"matches an override written with an annotation to its date"** — the annotation is no
   longer valid input, so the test changes its spelling, not its point. Rename it
   **"matches an override written with an expanded year to its date"**, date
   `"+002024-07-04"`, `windows: []`, same `weekly: { 4: nineToFive, 5: nineToFive }` and
   `julyWeek`. Expected: the Friday interval above, alone.
3. **Invalid-input table, row "two spellings of one override date"** — today its second date
   carries `[u-ca=iso8601]`, so the row is refused for the annotation and never reaches the
   duplicate check. The row moves into `REJECTED_SCHEDULES` with dates `"2024-06-10"` and
   `"+002024-06-10"` (slice 1), where each date alone is valid.

## B. The invalid-input table reads the shared rows

In the same file's `describe("invalid input")`:

- Replace the 23-row schedule `it.each` with one over `REJECTED_SCHEDULES`, title
  `"returns [] for a schedule with $reads"`, range `OPEN_RANGE`.
- Add `"returns [] and never throws for $reads"` over `HOSTILE_SCHEDULES` (call `make()` per
  row). Keep the existing hostile tests that pass a hostile *range* or *options*.
- `valid` and `nineToFive` come from the rows module; delete the file's own copies only where the
  values are identical. `day` stays for the range and options table and the tests after it.
- Keep "is not empty for the valid baseline" and "applies a non-enumerable weekday, as a property
  get reads it": both test reading, not refusal.

Test names stay unique across the file: check with
`pnpm --filter @northguild/gmt exec vitest run src/calendar/hours/operatingIntervals.test.ts --reporter=verbose` and a sort.

## C. JSDoc pointers

`isValidOperatingSchedule` is the one place that lists what a schedule must be; the six
operating functions point to it. Edits (wording exact, in the existing bullet):

| File | Today | After |
| ---- | ----- | ----- |
| `calendar/hours/isOpenAt.ts` | `` Check the schedule with `operatingIntervals` when "closed" and "invalid" must be told apart. `` | `` `isValidOperatingSchedule` tells a closed schedule from an invalid one. `` |
| `calendar/hours/operatingIntervals.ts` | `` - `[]` is both a legitimate result (closed throughout, or an empty `range`) and the sentinel. `` | `` - `[]` is both a legitimate result (closed throughout, or an empty `range`) and the sentinel; `isValidOperatingSchedule` tells a closed schedule from an invalid one. `` |
| `calendar/hours/operatingIntervals.ts` | `` …invalid zone, holiday or override date, or two overrides for one date), `` | `` …invalid zone, holiday or override date, or two overrides for one date; `isValidOperatingSchedule` lists every rule), `` |
| `calendar/hours/nextOpenAt.ts`, `nextCloseAt.ts`, `operatingTimeBetween.ts` | `` an invalid instant or `OperatingSchedule`, `` | `` an invalid instant, an `OperatingSchedule` that `isValidOperatingSchedule` refuses, `` |
| `calendar/hours/addOperatingTime.ts` | `` an invalid instant, duration or `OperatingSchedule`, `` | `` an invalid instant or duration, an `OperatingSchedule` that `isValidOperatingSchedule` refuses, `` |

Reflow each bullet to the file's line width (100); `oxfmt` does not wrap JSDoc.

`packages/gmt/src/types/operating-schedule.ts`, the `OperatingSchedule` doc block: add the line
`` Narrow a candidate with `isValidOperatingSchedule`. `` as its last paragraph, matching
`types/business-calendar.ts`.

## Done when

- `pnpm --filter @northguild/gmt exec vitest run src/calendar/hours src/calendar/validate` passes, and no test in `operatingIntervals.test.ts`
  asserts `[]` for a schedule that `isValidOperatingSchedule` accepts unless its name says the
  schedule is closed or the range is empty.
- `pnpm --filter @northguild/gmt lint` and `pnpm --filter @northguild/gmt typecheck` pass.
