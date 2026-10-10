import { Temporal } from "@js-temporal/polyfill";
import { isObject } from "./isObject";

/** `TwoDigitYearOptions.yearWindow` as a number: the first year of the window, 0–9900. */
const MIN_YEAR_WINDOW_START = 0;
/** The highest start whose every year, start + 99, is still a four-digit ISO year. */
const MAX_YEAR_WINDOW_START = 9900;
/** A rolling window starts this many years before the current UTC calendar year. */
const ROLLING_YEARS_BEFORE_NOW = 50;

/**
 * Resolve `TwoDigitYearOptions.yearWindow` to the first year of a hundred-year window, or null
 * when the option is absent or not one of its two forms.
 *
 * - An integer from 0 to 9900 is a fixed window starting in that year.
 * - `"rolling"` (exact match) is the hundred years around today: 50 years before the current UTC
 *   calendar year to 49 after it. The year is read once, from
 *   `Temporal.Now.instant().toZonedDateTimeISO("UTC").year`, so the window moves at the UTC new
 *   year, not mid-year: year granularity is a **GMT rule**. RFC 9110 §5.6.7 applies the same
 *   50-year idea to an `rfc850-date` two-digit year, at day granularity; `internal/httpDateFields.ts`
 *   implements that rule for HTTP dates and is not affected by this one.
 * - Anything else (a non-integer, a negative, 9901, `NaN`, `Infinity`, a numeric string, any
 *   other string, `null`) is null. Whether a null window matters is the caller's: a value with no
 *   two-digit year needs none.
 *
 * `options` is read as an Object the way Temporal's GetOptionsObject reads one (a function is an
 * Object); a non-Object yields null here, and the public function has already returned its
 * sentinel for one by `isOptionsArgument`.
 *
 * @param options the caller's options bag
 * @returns the window's first year, or null
 *
 * @example readYearWindowStart({ yearWindow: 1950 }) // 1950
 * @example readYearWindowStart({ yearWindow: "rolling" }) // 1976 (in 2026)
 * @example readYearWindowStart({}) // null
 * @example readYearWindowStart({ yearWindow: 9901 }) // null
 */
export function readYearWindowStart(options: unknown): number | null {
  if (!isObject(options)) {
    return null;
  }
  const { yearWindow } = options as { yearWindow?: unknown };
  if (yearWindow === "rolling") {
    return (
      Temporal.Now.instant().toZonedDateTimeISO("UTC").year -
      ROLLING_YEARS_BEFORE_NOW
    );
  }
  if (
    typeof yearWindow === "number" &&
    Number.isInteger(yearWindow) &&
    yearWindow >= MIN_YEAR_WINDOW_START &&
    yearWindow <= MAX_YEAR_WINDOW_START
  ) {
    return yearWindow;
  }
  return null;
}
