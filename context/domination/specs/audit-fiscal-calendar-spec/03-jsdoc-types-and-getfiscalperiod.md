# Fiscal calendar spec — JSDoc drafts, types and getFiscalPeriod

Part of [the index](../audit-fiscal-calendar-spec.md).

## 4. JSDoc drafts

Use these blocks as the text. Plain-English rules apply. Every `@example` result below came
from running the reference code.

### 4.1 `types/fiscal-calendar.ts`

```ts
/**
 * The period a 53rd week is added to, in a fiscal year that has one.
 *
 * - `"firstPeriod"` — the first period gets the extra week, so quarter 1 has 14 weeks. One
 *   published example is the ONS retail trading periods (UK): "a five week January is
 *   introduced every five to six years".
 * - `"lastPeriod"` — the last period gets it, so quarter 4 has 14 weeks. One published example
 *   is the NRF 4-5-4 calendar (US), which adds the week "to the end of the calendar".
 *
 * Narrow a candidate with `isValidFiscalExtraWeek`.
 */
export type FiscalExtraWeek = "firstPeriod" | "lastPeriod";

/**
 * The calendar year that names a fiscal year.
 *
 * - `"startYear"` — the year its first day falls in. NRF (US): fiscal 2023 runs 2023-01-29 to
 *   2024-02-03.
 * - `"endYear"` — the year its last day falls in. IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c))
 *   identifies a reporting period by the date it ends: a fiscal year from 2023-06-26 to
 *   2024-06-30 is 2024.
 * - `"majorityYear"` — the calendar year holding the most of its days. ONS (UK): 2025 runs
 *   2024-12-29 to 2026-01-03. When two years hold exactly half each, the label is the end year,
 *   the year holding the date the period ends on.
 *
 * Narrow a candidate with `isValidFiscalYearLabel`.
 */
export type FiscalYearLabel = "startYear" | "endYear" | "majorityYear";

/** Caller-supplied 52/53-week fiscal calendar. GMT bundles none, and has no defaults. */
export interface FiscalCalendar {
  /** The weeks per period within each quarter. */
  pattern: FiscalPattern;
  /**
   * The year-end rule, stated as one ISO date: fiscal years end on this date's **weekday**,
   * on the occurrence nearest this date's **month and day**. NRF (US) adds a 53rd week when
   * "there are four or more days left in January", which is the Saturday nearest
   * January 31: `"2026-01-31"`.
   */
  yearEndsOn: string;
  /** The period a 53rd week is added to. */
  extraWeek: FiscalExtraWeek;
  /** The calendar year that names a fiscal year. */
  yearLabel: FiscalYearLabel;
}
```

### 4.2 `getFiscalPeriod` — bullets that change, and examples

Replace the two `GMT rule:` bullets and the "not a unique key" bullet with these:

```text
 * - IFRS 18 ¶29 (formerly IAS 1 ¶37) does not preclude a 52-week reporting period, and a
 *   53-week year follows from it. No international standard
 *   says where the 53rd week goes or which calendar year names the fiscal year, and published
 *   calendars disagree on both. So `calendar.extraWeek` and `calendar.yearLabel` are required,
 *   and there is no default.
 * - `calendar.extraWeek` is the period a 53rd week is added to: `"firstPeriod"` (ONS, UK: "a
 *   five week January") or `"lastPeriod"` (NRF, US: "to the end of the calendar").
 * - `calendar.yearLabel` names the fiscal year: `"startYear"` (NRF, US), `"endYear"`, the
 *   year holding the end date, or `"majorityYear"`, the calendar year holding the most days
 *   (ONS, UK). IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c)) identifies a reporting period by the
 *   date it ends. GMT rule: a 182/182 split goes to the end year, for that reason.
 * - **`year` is not a unique key for every year end.** A 364- or 371-day year drifts against
 *   the calendar, so every label rule has year ends where two fiscal years share a label and a
 *   calendar year names none. `"startYear"` and `"endYear"` do this for year ends near
 *   1 January. Under `yearEndsOn: "2022-12-31"` with `"startYear"`, two fiscal years both start
 *   in 2023, and 2020, 2025 and 2031 name none. `"majorityYear"` does it for year ends near
 *   1 July. Under `yearEndsOn: "2026-07-01"`, 2025-07-03 to 2026-07-01 and 2026-07-02 to
 *   2027-06-30 are both 2026. If your rule falls in such a window, key on the fiscal year's
 *   start date, not on `year`.
 * - Returns null on invalid input, including a calendar with a missing or unrecognised field.
 *   That shares the sentinel with a date that cannot be placed, so check the calendar with
 *   `isValidFiscalCalendar` first to tell the two apart.
```

Keep the `yearEndsOn`-by-example bullet, but replace its quote. NRF's page no longer says
"Saturday nearest January 31". Quote "four or more days left in January" instead (§0).

Examples (replace all of them):

```text
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2024, period: 5, week: 19 }
 * @example getFiscalPeriod("2024-02-04", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2024, period: 1, week: 1 } (NRF fiscal 2024 opens)
 * @example getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2023, period: 12, week: 53 } (the 53rd week of NRF fiscal 2023)
 * @example getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "endYear" }) // { year: 2024, period: 12, week: 53 } (the same week, named by the year it ends in)
 * @example getFiscalPeriod("2024-03-31", { pattern: "4-4-5", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2024, period: 3, week: 9 }
 * @example getFiscalPeriod("2025-02-01", { pattern: "4-4-5", yearEndsOn: "2022-12-31", extraWeek: "firstPeriod", yearLabel: "majorityYear" }) // { year: 2025, period: 1, week: 5 } (ONS 2025: a five-week January)
 * @example getFiscalPeriod("2024-12-29", { pattern: "4-4-5", yearEndsOn: "2022-12-31", extraWeek: "firstPeriod", yearLabel: "majorityYear" }) // { year: 2025, period: 1, week: 1 } (ONS 2025 opens in December 2024)
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-5", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // null (not one of the three patterns)
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod" }) // null (no yearLabel)
 * @example getFiscalPeriod("2024-06-15T12:00:00Z", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // null (a moment, not a calendar date)
```

`@param calendar`: `{ pattern, yearEndsOn, extraWeek, yearLabel }`, all required.

Return-field JSDoc:

- `year`: "The calendar year that names the fiscal year, chosen by `calendar.yearLabel`."
- `period`: "… and a 53rd week belongs to period 1 or period 12, as `calendar.extraWeek` says."

