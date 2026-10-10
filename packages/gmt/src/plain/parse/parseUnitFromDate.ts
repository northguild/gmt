import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../calculate/getWeekNumber";
import { isValidDate } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";
import { isoYearString } from "../../internal/isoYearString";

/**
 * Return a specific date unit extracted from a PlainDate string.
 *
 * - Extracts "year", "month", "day", "week", or "dayOfWeek" from a PlainDate.
 * - Returns zero-padded string for month and day.
 * - `unit` accepts the singular or plural name of a Temporal unit (`"hour"` or `"hours"`), as Temporal
 *   does; `"dayOfWeek"` has no plural.
 * - `optionsArg` must be an object or omitted: `null` or any other primitive returns "", as
 *   Temporal's GetOptionsObject rejects it.
 * - Returns "" for invalid input.
 * - The `"year"` unit is written as Temporal writes a year: four digits (`"2024"`, `"0005"`), or a
 *   sign and six digits outside 0000–9999 (`"+010000"`, `"-000005"`).
 *
 * @param value ISO PlainDate string
 * @param unit unit to extract from the date
 * @param optionsArg How weeks are numbered
 * @returns string representation of the requested unit or "" on invalid input
 *
 * @example parseUnitFromDate("2024-03-15", "year") // "2024"
 * @example parseUnitFromDate("0005-06-01", "year") // "0005"
 * @example parseUnitFromDate("2024-03-15", "month") // "03"
 * @example parseUnitFromDate("2024-03-15", "day") // "15"
 * @example parseUnitFromDate("2024-03-15", "week") // "11"
 * @example parseUnitFromDate("2024-03-15", "dayOfWeek") // "5"
 * @example parseUnitFromDate("2024-03-15", "months") // "03"
 * @example parseUnitFromDate("2024-12-31", "week", { weekStartsOn: "sunday" }) // "1"
 * @example parseUnitFromDate("invalid", "year") // ""
 * @example parseUnitFromDate("2024-01-01", "week", { weekStartsOn: "sunday" }) // "1"
 */
export function parseUnitFromDate(
  value: string,
  unit: Temporal.SmallestUnit<"year" | "month" | "day" | "week"> | "dayOfWeek",
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

    if (!isValidDate(value) || weekStartsOn === null) {
      return "";
    }

    try {
      const date = Temporal.PlainDate.from(value);

      switch (resolveDateTimeUnit(unit)) {
        case "year":
          return isoYearString(date.year);
        case "month":
          return date.month.toString().padStart(2, "0");
        case "day":
          return date.day.toString().padStart(2, "0");
        case "week":
          return (getWeekNumber(value, weekStartsOn) ?? 0).toString();
        case "dayOfWeek":
          return date.dayOfWeek.toString();
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
