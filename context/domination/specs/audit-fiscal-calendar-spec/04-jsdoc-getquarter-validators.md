# Fiscal calendar spec — JSDoc drafts, getQuarter, validators, internals

Part of [the index](../audit-fiscal-calendar-spec.md).

### 4.3 `getQuarter`

Replace the `GMT rule:` bullet with this:

```text
 * - With `options`, these are fiscal quarters. The fiscal year starts on day 1 of
 *   `fiscalYearStartMonth`, and `yearLabel` names it: `"startYear"`, `"endYear"`, or
 *   `"majorityYear"` (the calendar year holding the most of its days). Both are required, and
 *   there is no default. Start months 1 to 7 put most days in the start year, and 8 to 12 put
 *   most in the end year.
 * - Returns null on invalid input, including `options` without both fields, a
 *   `fiscalYearStartMonth` that is not an integer from 1 to 12, or an unrecognised `yearLabel`.
```

Examples (replace all of them):

```text
 * @example getQuarter("2024-06-15") // { year: 2024, quarter: 2 }
 * @example getQuarter("2024-10-01") // { year: 2024, quarter: 4 }
 * @example getQuarter("2024-04-01", { fiscalYearStartMonth: 4, yearLabel: "startYear" }) // { year: 2024, quarter: 1 }
 * @example getQuarter("2024-03-31", { fiscalYearStartMonth: 4, yearLabel: "startYear" }) // { year: 2023, quarter: 4 } (the previous fiscal year)
 * @example getQuarter("2024-03-31", { fiscalYearStartMonth: 4, yearLabel: "endYear" }) // { year: 2024, quarter: 4 }
 * @example getQuarter("2023-10-15", { fiscalYearStartMonth: 7, yearLabel: "endYear" }) // { year: 2024, quarter: 2 }
 * @example getQuarter("2023-10-15", { fiscalYearStartMonth: 7, yearLabel: "majorityYear" }) // { year: 2023, quarter: 2 } (July to December is 184 of its days)
 * @example getQuarter("2024-10-01", { fiscalYearStartMonth: 10, yearLabel: "majorityYear" }) // { year: 2025, quarter: 1 }
 * @example getQuarter("2024-06-15", { fiscalYearStartMonth: 4 }) // null (no yearLabel)
 * @example getQuarter("2024-06-15", { fiscalYearStartMonth: 13, yearLabel: "startYear" }) // null
 * @example getQuarter("2024-06-15T12:00:00Z") // null (a moment, not a calendar date)
 * @example getQuarter("invalid") // null
```

Option JSDoc: `fiscalYearStartMonth` loses `@defaultValue`. `yearLabel`: "The calendar year
that names a fiscal year. See `FiscalYearLabel`." The `year` return field: "The year that names
the quarter's year: the calendar year with no `options`, otherwise the one `yearLabel` picks."

### 4.4 Validators

`isValidFiscalExtraWeek`:

```text
 * @example isValidFiscalExtraWeek("firstPeriod") // true
 * @example isValidFiscalExtraWeek("lastPeriod") // true
 * @example isValidFiscalExtraWeek("lastQuarter") // false
 * @example isValidFiscalExtraWeek(12) // false
```

`isValidFiscalYearLabel`:

```text
 * @example isValidFiscalYearLabel("startYear") // true
 * @example isValidFiscalYearLabel("endYear") // true
 * @example isValidFiscalYearLabel("majorityYear") // true
 * @example isValidFiscalYearLabel("fiscalYear") // false
 * @example isValidFiscalYearLabel(null) // false
```

`isValidFiscalCalendar`:

```text
 * @example isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // true
 * @example isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-01-31" }) // false (the 1.19 shape: no extraWeek or yearLabel)
 * @example isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-02-30", extraWeek: "lastPeriod", yearLabel: "startYear" }) // false
 * @example isValidFiscalCalendar("4-5-4") // false
```

`isValidFiscalPattern`: change the `"4-5-5"` example's note to "(a 53-week year's last quarter
under `"lastPeriod"`, not a pattern)". Also change the bullet that names `getFiscalPeriod`'s
sentinel so it points at `isValidFiscalCalendar`.

### 4.5 `internal/fiscalCalendar.ts`

- `fiscalPeriodOfWeek`: drop "GMT rule: … appended to the final period". Say that the 53rd week
  goes to period 1 or 12, as `extraWeek` says.
- `fiscalYearLabel`: document the three rules, the day count, and the tie to the later year,
  in the words of §3.2.

---

