import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

const supported: Temporal.DateUnit[] = ["year", "month", "week", "day"];

/**
 * Return the end of the specified date `unit` for a given ISO 8601 date string.
 *
 * - A Sunday-first week runs Sunday to Saturday, so a Sunday ends its week six days later.
 * - The end is computed forward from `value`, so it is returned even when the unit began before
 *   the first representable date (`-271821-04-19`).
 * - Returns "" for invalid inputs.
 *
 * @param value ISO 8601 date string
 * @param unit Temporal.DateUnit to specify the unit for the end
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday")
 * @returns ISO 8601 string representing the end of the specified unit, or "" on invalid input
 *
 * @example endOfDate("2024-02-29", "month") // "2024-02-29"
 * @example endOfDate("2024-03-03", "week", { weekStartsOn: "sunday" }) // "2024-03-09"
 * @example endOfDate("-271821-04-19", "month") // "-271821-04-30" (the month began before the range; its end did not)
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
      case "month":
        // Computed from `value` itself: the month's first day may lie before the range.
        result = source.with({ day: source.daysInMonth });
        break;
      case "week": {
        // Sunday is day 7, so `dayOfWeek % 7` counts Sunday as day 0 of a Sunday-first week.
        const daysToEndOfWeek =
          weekStartsOn === "monday"
            ? 7 - source.dayOfWeek
            : 6 - (source.dayOfWeek % 7);

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
