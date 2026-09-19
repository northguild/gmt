// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveReadingTimeZone } from "../../internal/resolveReadingTimeZone";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Units supported by `parseUnitFromUtc` when extracting a value from a UTC ISO
 * string. Each Temporal unit is also accepted in its plural form (`"months"`), as
 * Temporal accepts.
 *
 * @remarks Members:
 *
 * | Member | Description |
 * | --- | --- |
 * | `year` | Full year, no padding (e.g. `2024`). |
 * | `month` | Zero-padded 2 (e.g. `03`). |
 * | `week` | Week-of-year, 1–53 (`weekStartsOn`-controlled). |
 * | `day` | Zero-padded 2. |
 * | `dayOfWeek` | 1 (Mon)–7 (Sun). |
 * | `hour` | Zero-padded 2. |
 * | `minute` | Zero-padded 2. |
 * | `second` | Zero-padded 2. |
 * | `millisecond` | Zero-padded 3. |
 * | `microsecond` | Zero-padded 3 (Temporal's 0–999 field). |
 * | `nanosecond` | Zero-padded 3 (Temporal's 0–999 field). |
 *
 * @example
 * import { UtcUnit } from "@northguild/gmt/utc";
 * const u: UtcUnit = "month";
 */
export type UtcUnit =
  | Temporal.SmallestUnit<
      | "year"
      | "month"
      | "week"
      | "day"
      | "hour"
      | "minute"
      | "second"
      | "millisecond"
      | "microsecond"
      | "nanosecond"
    >
  | "dayOfWeek";

/**
 * Extract a unit from a UTC datetime string.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - `unit` accepts the singular or plural name of a Temporal unit (`"hour"` or `"hours"`), as Temporal
 *   does; `"dayOfWeek"` has no plural.
 * - Reads the value on the wall clock of `options.timeZone` (an IANA zone, default UTC), as
 *   `parseTimeFromUtc` does; an invalid zone returns "".
 * - `weekStartsOn: "sunday"` numbers weeks by UTS #35 (week 1 holds 1 January, so late-December
 *   days can be week 1); any value other than `"monday"` or `"sunday"` returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param unit unit to extract from the datetime
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations, timeZone (IANA, default "UTC"); a non-object value (such as `null`) is invalid
 * @returns string representation of the requested unit or "" on invalid input
 *
 * @example parseUnitFromUtc("2024-03-17T14:30:45Z", "month") // "03"
 * @example parseUnitFromUtc("2024-03-17T14:30:45Z", "hours") // "14"
 * @example parseUnitFromUtc("2024-03-17T02:30:45Z", "day", { timeZone: "America/New_York" }) // "16"
 * @example parseUnitFromUtc("2024-01-01T00:00:00Z", "week") // "1"
 * @example parseUnitFromUtc("2024-12-31T12:00:00Z", "week", { weekStartsOn: "sunday" }) // "1"
 * @example parseUnitFromUtc("invalid", "month") // ""
 */
export function parseUnitFromUtc(
  value: string,
  unit: UtcUnit,
  optionsArg?: { weekStartsOn?: "monday" | "sunday"; timeZone?: string },
): string {
  // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
  if (!isOptionsArgument(optionsArg)) {
    return "";
  }
  const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);
  const timeZone = resolveReadingTimeZone(optionsArg?.timeZone);

  if (!isValidUtc(value) || weekStartsOn === null || timeZone === null) {
    return "";
  }

  try {
    const dateTime = Temporal.Instant.from(value).toZonedDateTimeISO(timeZone);

    switch (resolveDateTimeUnit(unit)) {
      case "year":
        return dateTime.year.toString();
      case "month":
        return dateTime.month.toString().padStart(2, "0");
      case "week":
        return (
          getWeekNumber(dateTime.toPlainDate().toString(), weekStartsOn) ?? 0
        ).toString();
      case "day":
        return dateTime.day.toString().padStart(2, "0");
      case "dayOfWeek":
        return dateTime.dayOfWeek.toString();
      case "hour":
        return dateTime.hour.toString().padStart(2, "0");
      case "minute":
        return dateTime.minute.toString().padStart(2, "0");
      case "second":
        return dateTime.second.toString().padStart(2, "0");
      case "millisecond":
        return dateTime.millisecond.toString().padStart(3, "0");
      case "microsecond":
        return dateTime.microsecond.toString().padStart(3, "0");
      case "nanosecond":
        return dateTime.nanosecond.toString().padStart(3, "0");
      default:
        return "";
    }
  } catch {
    return "";
  }
}
