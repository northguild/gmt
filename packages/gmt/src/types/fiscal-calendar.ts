/**
 * Week-per-period shape of a 52/53-week fiscal year, one entry per month of a quarter.
 *
 * - `"4-5-4"` — the NRF retail calendar, the US retail standard.
 * - `"4-4-5"` — the longer month falls at the end of the quarter.
 * - `"5-4-4"` — the longer month falls at the start of the quarter.
 *
 * Narrow a candidate — a pattern out of config, an env var or a form — with
 * `isValidFiscalPattern`.
 */
export type FiscalPattern = "4-5-4" | "4-4-5" | "5-4-4";

/** Caller-supplied 52/53-week fiscal calendar. GMT bundles none. */
export interface FiscalCalendar {
  /** Weeks per period within each quarter. */
  pattern: FiscalPattern;
  /**
   * The year-end rule, stated as one ISO date: fiscal years end on this date's **weekday**,
   * on the occurrence nearest this date's **month and day**. For the NRF retail calendar —
   * "the Saturday nearest to January 31" — that is `"2026-01-31"`.
   */
  yearEndsOn: string;
}
