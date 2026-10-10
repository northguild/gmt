// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../calculate/getWeekNumber";
import { isValidDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";
import { isoYearString } from "../../internal/isoYearString";

/**
 * Return a specific unit extracted from a PlainDateTime string.
 *
 * - Extracts "year", "month", "day", "week", "dayOfWeek", "hour", "minute", "second",
 *   "millisecond", "microsecond" or "nanosecond" from a PlainDateTime (the last three are
 *   Temporal's 0-999 fields, zero-padded to 3 digits).
 * - Returns zero-padded string for most units.
 * - `unit` accepts the singular or plural name of a Temporal unit (`"hour"` or `"hours"`), as Temporal
 *   does; `"dayOfWeek"` has no plural.
 * - `optionsArg` must be an object or omitted: `null` or any other primitive returns "", as
 *   Temporal's GetOptionsObject rejects it.
 * - Returns "" for invalid input.
 * - The `"year"` unit is written as Temporal writes a year: four digits (`"2024"`, `"0005"`), or a
 *   sign and six digits outside 0000–9999 (`"+010000"`, `"-000005"`).
 *
 * @param value ISO PlainDateTime string
 * @param unit unit to extract from the datetime
 * @param optionsArg How weeks are numbered
 * @returns string representation of the requested unit or "" on invalid input
 *
 * @example parseUnitFromDateTime("2024-03-15T14:30:45.123", "year") // "2024"
 * @example parseUnitFromDateTime("0005-06-01T12:30:00", "year") // "0005"
 * @example parseUnitFromDateTime("2024-03-15T14:30:45.123", "week") // "11"
 * @example parseUnitFromDateTime("2024-03-15T14:30:45.123", "hour") // "14"
 * @example parseUnitFromDateTime("2024-03-15T14:30:45.123", "millisecond") // "123"
 * @example parseUnitFromDateTime("2024-03-15T14:30:45.123", "hours") // "14"
 * @example parseUnitFromDateTime("invalid", "year") // ""
 * @example parseUnitFromDateTime("2024-01-01T00:00:00", "week", { weekStartsOn: "sunday" }) // "1"
 */
export function parseUnitFromDateTime(
  value: string,
  unit:
    | Temporal.SmallestUnit<
        | "year"
        | "month"
        | "day"
        | "week"
        | "hour"
        | "minute"
        | "second"
        | "millisecond"
        | "microsecond"
        | "nanosecond"
      >
    | "dayOfWeek",
  optionsArg?: {
    /**
     * The first day of the week, which sets how the `"week"` unit is numbered. `"monday"` gives the
     * ISO 8601 week number, where week 1 holds the year's first Thursday; `"sunday"` gives the UTS
     * #35 week number with a Sunday first day and one minimal day, where week 1 holds 1 January.
     * Any other value returns `""`, whatever the unit.
     *
     * @defaultValue `"monday"`
     */
    weekStartsOn?: "monday" | "sunday";
  },
): string {
  try {
    // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }
    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);

    if (!isValidDateTime(value) || weekStartsOn === null) {
      return "";
    }

    try {
      const dateTime = Temporal.PlainDateTime.from(value);

      switch (resolveDateTimeUnit(unit)) {
        case "year":
          return isoYearString(dateTime.year);
        case "month":
          return dateTime.month.toString().padStart(2, "0");
        case "day":
          return dateTime.day.toString().padStart(2, "0");
        case "week":
          return (
            getWeekNumber(dateTime.toPlainDate().toString(), weekStartsOn) ?? 0
          ).toString();
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
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
