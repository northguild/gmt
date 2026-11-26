import { parseOperatingSchedule } from "../../internal/operatingSchedule";
import type { OperatingSchedule } from "../../types";

/**
 * Return true when `schedule` is an `OperatingSchedule` the operating-hours functions accept.
 *
 * - `timeZone` must be a time zone identifier (`"Europe/Paris"`, `"+05:30"`, `"+0530"`, `"-08"`)
 *   or a stored offset `±HH:MM[:SS]` (`"-00:44:30"`), as `isValidTimeZone` or `isValidUtcOffset`
 *   accepts.
 * - `weekly` must be an object whose own enumerable keys are `"1"`–`"7"`, Monday to Sunday. A
 *   weekday is read with a property get, so an inherited one applies. A weekday that is absent or
 *   `undefined` is closed; any other value must be an array of windows. `{}` is valid and is
 *   closed every day. A `Map` has no such keys, so it is valid and reads as closed every day.
 * - A window is `{ from, to }`, both plain times (`"HH:MM"` or `"HH:MM:SS"` with an optional
 *   fraction). `to` at or before `from` crosses midnight; `"00:00"` to `"00:00"` is a whole day.
 *   `"24:00"`, a second of 60 and a time with an offset or `T` are not plain times.
 * - `holidays` is optional: an array of ISO PlainDate strings, or a `BusinessCalendar`, which must
 *   pass `isValidBusinessCalendar` though only its `holidays` are read.
 * - `overrides` is optional: an array of `{ date, windows }`. Two overrides for one date, however
 *   the date is spelt, are invalid.
 * - Dates take no annotation (`"2024-05-15[u-ca=iso8601]"` is invalid) and lie between
 *   `-271821-04-19` and `+275760-09-13`, Temporal's limits.
 * - Other keys on the schedule, a window or an override are ignored, so a misspelt key such as
 *   `holiday` is not an error.
 * - Returns `false` for non-objects, `null` and arrays. A function carrying the fields is accepted.
 * - Use it to tell a closed schedule from an invalid one: `operatingIntervals` returns `[]` and
 *   `isOpenAt` returns `false` for both. `nextOpenAt`, `nextCloseAt` and `addOperatingTime` search
 *   a horizon and return `""` for an invalid schedule and for no answer within it.
 *   `operatingTimeBetween` has no horizon: it returns `""` for an invalid schedule and `"PT0S"` for
 *   a valid closed one.
 *
 * @param schedule candidate value of any type
 * @returns boolean indicating whether every operating-hours function accepts it
 *
 * @example isValidOperatingSchedule({ timeZone: "Europe/Paris", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // true
 * @example isValidOperatingSchedule({ timeZone: "UTC", weekly: { 5: [{ from: "23:00", to: "06:00" }] }, holidays: ["2024-11-20"], overrides: [{ date: "2024-11-19", windows: [] }] }) // true — a window past midnight, a holiday and an override
 * @example isValidOperatingSchedule({ timeZone: "-00:44:30", weekly: {} }) // true — valid, closed every day
 * @example isValidOperatingSchedule({ timeZone: "UTC", weekly: { 8: [] } }) // false — 8 is not an ISO weekday
 * @example isValidOperatingSchedule({ timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "24:00" }] } }) // false — 24:00 is not a plain time
 * @example isValidOperatingSchedule({ timeZone: "UTC", weekly: {}, holidays: ["2024-05-15[u-ca=iso8601]"] }) // false — a plain date takes no annotation
 * @example isValidOperatingSchedule({ timeZone: "UTC", weekly: {}, overrides: [{ date: "2024-06-10", windows: [] }, { date: "+002024-06-10", windows: [] }] }) // false — two overrides for one date
 * @example isValidOperatingSchedule({ timeZone: "Invalid/Zone", weekly: {} }) // false
 * @example isValidOperatingSchedule(null) // false
 */
export function isValidOperatingSchedule(
  schedule: unknown,
): schedule is OperatingSchedule {
  try {
    return parseOperatingSchedule(schedule) !== null;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
