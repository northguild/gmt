import { parseHolidayRule } from "../../internal/holidayRules";
import type { HolidayRule } from "../../types";

/**
 * Return true when `rule` is a `HolidayRule` that `holidayDates` and `buildBusinessCalendar`
 * accept. It answers "is this a rule", which `holidayDates` cannot: that returns `[]` both for an
 * invalid rule and for a year with no occurrence.
 *
 * - `name` must be a string (an empty one is fine; it is a label and never output).
 * - `fixed`: `month` 1 to 12 and `day` within the month's longest length (29 for February, so
 *   `2 30` and `4 31` are invalid); `observed`, when present, a valid `ObservancePolicy`.
 * - `calendarFixed`: a supported calendar (aliases such as `islamicc` accepted; `chinese`, `dangi`
 *   and unknown ids are not) with a `monthCode` that calendar has (`M01` to `M12`, `M13` in coptic,
 *   ethiopic and ethioaa, `M05L` in hebrew) and a `day` within the month's longest length, read
 *   from the calendar (30 for Hebrew `M01`, 29 for Islamic civil `M02`, 6 for `M13`). A day only
 *   some years' month has (Heshvan 30) is valid: the other years have no date.
 * - `nthWeekday`: `month` 1 to 12, `weekday` 1 to 7, `n` of 1 to 5, -1 to -5 or `"last"`.
 * - `easterRelative`: a safe-integer `offsetDays`; `computus` absent, `"gregorian"` or `"julian"`.
 * - `dates`: an array of ISO PlainDate strings; `[]` is valid.
 * - Properties a kind does not define are ignored. Returns `false` for non-objects, `null` and arrays.
 *
 * @param rule candidate value of any type
 * @returns boolean indicating whether `holidayDates` accepts it
 *
 * @example isValidHolidayRule({ name: "Closing day", kind: "fixed", month: 12, day: 25 }) // true
 * @example isValidHolidayRule({ name: "Easter − 2", kind: "easterRelative", offsetDays: -2 }) // true
 * @example isValidHolidayRule({ name: "No dates yet", kind: "dates", dates: [] }) // true — an empty list is a rule
 * @example isValidHolidayRule({ name: "Bad", kind: "fixed", month: 2, day: 30 }) // false — no year has 30 February
 * @example isValidHolidayRule({ name: "Bad", kind: "calendarFixed", calendar: "hebrew", monthCode: "M01", day: 31 }) // false — Tishri has 30 days
 * @example isValidHolidayRule({ name: "Bad", kind: "calendarFixed", calendar: "chinese", monthCode: "M01", day: 1 }) // false — chinese is not supported
 * @example isValidHolidayRule(null) // false
 */
export function isValidHolidayRule(rule: unknown): rule is HolidayRule {
  try {
    return parseHolidayRule(rule) !== null;
  } catch {
    // Never throws (Core Rule 3): a hostile getter is an invalid rule, not an exception.
    return false;
  }
}
