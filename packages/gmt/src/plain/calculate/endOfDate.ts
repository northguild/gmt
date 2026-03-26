import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

const supported: Temporal.DateUnit[] = ["year", "month", "week", "day"];

/**
 * Return the end of the specified date `unit` (year|month|week|day) for a given ISO 8601 date string.
 * - Uses Temporal.PlainDate
 * - Returns an empty string "" for invalid inputs or units.
 *
 * @param value ISO 8601 date string
 * @param unit Temporal.DateUnit to specify the unit for the end (e.g. "month")
 * @param options { weekStartsOn: "monday" | "sunday" } - Optional parameter to specify the start of the week when unit is "week". Default is "monday".
 * @example endOfDate("2024-02-29", "month") => "2024-02-29"
 * @returns ISO 8601 string representing the end of the specified unit, or empty string on invalid input
 */
export function endOfDate(
  value: string,
  unit: Temporal.DateUnit,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): string {
  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";

  if (!isValidDate(value) || !supported.includes(unit)) return "";

  const source = Temporal.PlainDate.from(value);
  let result: Temporal.PlainDate;

  switch (unit) {
    case "year":
      result = source.with({ month: 12, day: 31 });
      break;
    case "month": {
      const firstOfNext = source.with({ day: 1 }).add({ months: 1 });
      result = firstOfNext.subtract({ days: 1 });
      break;
    }
    case "week": {
      const daysToEndOfWeek =
        weekStartsOn === "monday"
          ? 7 - source.dayOfWeek
          : (6 - source.dayOfWeek) % 7;

      result = source.add({ days: daysToEndOfWeek });
      break;
    }
    case "day":
      result = source;
      break;
    default:
      return "";
  }

  return result.toString();
}
