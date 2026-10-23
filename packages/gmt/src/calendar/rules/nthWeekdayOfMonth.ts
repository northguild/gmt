import { isoDateString } from "../../internal/epochDay";
import { isValidDayOfWeek } from "../../internal/isValidDayOfWeek";
import {
  isWeekdayOrdinal,
  nthWeekdayEpochDay,
  ordinalNumber,
} from "../../internal/nthWeekday";
import type { WeekdayOrdinal } from "../../types";

/** Years Temporal's date range reaches (-271821-04-19 to +275760-09-13); beyond them epoch-day arithmetic overflows. */
const MIN_YEAR = -271_821;
const MAX_YEAR = 275_760;

/**
 * The `n`-th `weekday` of a month, counted from the start (`1` to `5`) or from the end (`-1` to
 * `-5`; `"last"` is `-1`), as RFC 5545 §3.3.10 counts a `BYDAY` ordinal in a monthly rule.
 *
 * - The ISO (proleptic Gregorian) calendar only.
 * - A fifth occurrence a month does not have (a fifth Friday of February 2026) gives `""`: the
 *   date is skipped, never clamped to the fourth.
 * - A date outside Temporal's range (-271821-04-19 to +275760-09-13) gives `""`.
 * - Never throws.
 *
 * @param year ISO year, an integer
 * @param month ISO month, 1 to 12
 * @param weekday ISO weekday, Monday 1 to Sunday 7
 * @param n which occurrence: `1`..`5`, `-1`..`-5` or `"last"`
 * @returns ISO PlainDate string of the occurrence, or `""` when it does not exist or an argument is invalid
 *
 * @example nthWeekdayOfMonth(2026, 3, 7, "last") // "2026-03-29" — the last Sunday of March
 * @example nthWeekdayOfMonth(2026, 1, 1, 3) // "2026-01-19" — the third Monday of January
 * @example nthWeekdayOfMonth(2026, 2, 5, 5) // "" — February 2026 has only four Fridays
 * @example nthWeekdayOfMonth(2026, 13, 1, 1) // "" — invalid month
 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: WeekdayOrdinal,
): string {
  if (
    !Number.isInteger(year) ||
    year < MIN_YEAR ||
    year > MAX_YEAR ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !isValidDayOfWeek(weekday) ||
    !isWeekdayOrdinal(n)
  ) {
    return "";
  }

  try {
    const day = nthWeekdayEpochDay(year, month, weekday, ordinalNumber(n));

    return day === null ? "" : isoDateString(day);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
