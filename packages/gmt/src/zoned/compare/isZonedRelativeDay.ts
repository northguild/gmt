import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return true when `value`'s local calendar day falls `offsetDays` days from
 * today in `value`'s own IANA timeZone.
 *
 * - Subsumes `isZonedToday`/`isZonedYesterday`/`isZonedTomorrow`:
 *   `offsetDays: 0` is "today", `-1` is "yesterday", `1` is "tomorrow", and
 *   any other integer offset works the same way.
 * - "Today" is resolved in `value`'s own timeZone — no separate timeZone
 *   argument needed, since `value` already carries its IANA timeZone. This
 *   is the deterministic counterpart to `isRelativeDay`, which depends on
 *   the system clock and system timeZone: the same instant is "today" in
 *   `Pacific/Apia` and "yesterday" in `Pacific/Niue`, a 24-hour spread.
 * - `offsetDays` must be an integer; non-integer or non-finite values return false.
 * - Returns false if `value` is invalid.
 *
 * @param value ISO ZonedDateTime string
 * @param offsetDays integer number of days from today in `value`'s own timeZone
 * @returns true if `value`'s local day is exactly `offsetDays` days from today in its own timeZone, false on invalid input
 *
 * @example isZonedRelativeDay("2024-03-15T10:00:00-04:00[America/New_York]", 0) // true, if today is 2024-03-15 in America/New_York
 * @example isZonedRelativeDay("2024-03-14T10:00:00-04:00[America/New_York]", -1) // true, if today is 2024-03-15 in America/New_York
 * @example isZonedRelativeDay("2024-03-15T10:00:00+13:00[Pacific/Apia]", 0) // true, when the same instant is "yesterday" in Pacific/Niue
 * @example isZonedRelativeDay("invalid", 0) // false
 */
export function isZonedRelativeDay(value: string, offsetDays: number): boolean {
  if (!isValidZonedDateTime(value) || !Number.isInteger(offsetDays)) {
    return false;
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    const today = Temporal.Now.zonedDateTimeISO(
      zonedDateTime.timeZoneId,
    ).toPlainDate();
    const target = today.add({ days: offsetDays });

    return (
      Temporal.PlainDate.compare(zonedDateTime.toPlainDate(), target) === 0
    );
  } catch {
    return false;
  }
}
