/**
 * Week-per-period shape of a 52/53-week fiscal year, one entry per month of a quarter.
 *
 * - `"4-5-4"` — the longer month falls in the middle of the quarter. One published
 *   example is the NRF retail calendar (US).
 * - `"4-4-5"` — the longer month falls at the end of the quarter.
 * - `"5-4-4"` — the longer month falls at the start of the quarter.
 *
 * Narrow a candidate — a pattern out of config, an env var or a form — with
 * `isValidFiscalPattern`.
 */
export type FiscalPattern = "4-5-4" | "4-4-5" | "5-4-4";

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
 * - `"endYear"` — the year its last day falls in. IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c)) lets
 *   a reporting period be identified by the date it ends. Under `yearEndsOn: "2021-06-27"`,
 *   the year 2023-06-26 to 2024-06-30 is 2024.
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
   * January 31: `"2026-01-31"`. One rule covers one run of years: ONS (UK) trading periods
   * end on the Saturday nearest December 31 (`"2022-12-31"`) from 2004, but when December 31
   * fell on a Tuesday before then, on the Saturday after it (1997-01-04). Years before 2004
   * need a second `FiscalCalendar`.
   */
  yearEndsOn: string;
  /** The period a 53rd week is added to. */
  extraWeek: FiscalExtraWeek;
  /** The calendar year that names a fiscal year. */
  yearLabel: FiscalYearLabel;
}
