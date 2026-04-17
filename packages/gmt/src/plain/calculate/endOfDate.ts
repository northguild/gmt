import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

const supported: Temporal.DateUnit[] = ["year", "month", "week", "day"];

/**
 * Return the end of the specified date `unit` for a given ISO 8601 date string.
 *
 * - Returns "" for invalid inputs.
 *
 * @param value ISO 8601 date string
 * @param unit Temporal.DateUnit to specify the unit for the end
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday")
 * @returns ISO 8601 string representing the end of the specified unit, or "" on invalid input
 *
 * @example endOfDate("2024-02-29", "month") // "2024-02-29"
 * @example endOfDate("invalid-date", "month") // ""
 */
export function endOfDate(
  value: string,
  unit: Temporal.DateUnit,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): string {
  if (!isValidDate(value) || !supported.includes(unit)) return "";

  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";

  try {
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
  } catch {
    return "";
  }
}
