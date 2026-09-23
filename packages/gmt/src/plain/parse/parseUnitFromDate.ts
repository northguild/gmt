import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../calculate/getWeekNumber";
import { isValidDate } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a specific date unit extracted from a PlainDate string.
 *
 * - Extracts "year", "month", "day", "week", or "dayOfWeek" from a PlainDate.
 * - Returns zero-padded string for month and day.
 * - `unit` accepts the singular or plural name of a Temporal unit (`"hour"` or `"hours"`), as Temporal
 *   does; `"dayOfWeek"` has no plural.
 * - `weekStartsOn: "sunday"` numbers weeks by UTS #35 (week 1 holds 1 January, so late-December
 *   days can be week 1); any value other than `"monday"` or `"sunday"` returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainDate string
 * @param unit unit to extract from the date
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations; a non-object value (such as `null`) is invalid
 * @returns string representation of the requested unit or "" on invalid input
 *
 * @example parseUnitFromDate("2024-03-15", "year") // "2024"
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
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
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
          return date.year.toString();
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
