import { plainMonthDayOf } from "../../internal/inputChecks";
import { REFERENCE_ISO_YEAR } from "../../internal/monthDay";
import { Temporal } from "../../internal/temporal";

/**
 * Compare two month-day strings (`--MM-DD`, or `MM-DD`) in calendar order: month first, then day.
 *
 * - Accepts both input forms, so `12-25` and `--12-25` compare equal.
 * - The year is not part of a month-day: `--02-29` sorts between `--02-28` and `--03-01`.
 *   (Temporal has no `PlainMonthDay.compare`; this compares the matching `PlainDate`s in the
 *   leap reference year 1972, as the note on `PlainMonthDay.prototype.valueOf` directs.)
 * - Returns `null` if either input is invalid or not in the ISO calendar.
 *
 * @param a month-day string
 * @param b month-day string
 * @returns -1, 0, or 1, or null on invalid input
 *
 * @example compareMonthDays("--01-01", "--12-31") // -1
 * @example compareMonthDays("12-25", "--12-25") // 0
 * @example compareMonthDays("--02-29", "--02-28") // 1
 * @example compareMonthDays("--02-30", "--03-01") // null
 * @example ["--12-25", "--02-29", "--02-28"].sort((a, b) => compareMonthDays(a, b) ?? 0) // ["--02-28", "--02-29", "--12-25"]
 */
export function compareMonthDays(a: string, b: string): number | null {
  const first = plainMonthDayOf(a);
  const second = plainMonthDayOf(b);
  if (first === null || second === null) {
    return null;
  }

  try {
    return Temporal.PlainDate.compare(
      first.toPlainDate({ year: REFERENCE_ISO_YEAR }),
      second.toPlainDate({ year: REFERENCE_ISO_YEAR }),
    );
  } catch {
    return null;
  }
}
