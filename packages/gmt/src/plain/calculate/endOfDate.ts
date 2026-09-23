// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { isValidDate } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

const supported: Temporal.DateUnit[] = ["year", "month", "week", "day"];

/**
 * Return the end of the specified date `unit` for a given ISO 8601 date string.
 *
 * - A Sunday-first week runs Sunday to Saturday, so a Sunday ends its week six days later.
 * - The end is computed forward from `value`, so it is returned even when the unit began before
 *   the first representable date (`-271821-04-19`).
 * - `unit` accepts the singular or plural name (`"month"` or `"months"`), as Temporal does.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns "".
 * - Returns "" for invalid inputs.
 *
 * @param value ISO 8601 date string
 * @param unit date unit, singular or plural, to specify the unit for the end
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday")
 * @returns ISO 8601 string representing the end of the specified unit, or "" on invalid input
 *
 * @example endOfDate("2024-02-29", "month") // "2024-02-29"
 * @example endOfDate("2024-03-03", "week", { weekStartsOn: "sunday" }) // "2024-03-09"
 * @example endOfDate("-271821-04-19", "month") // "-271821-04-30" (the month began before the range; its end did not)
 * @example endOfDate("2024-02-29", "years") // "2024-12-31"
 * @example endOfDate("invalid-date", "month") // ""
 */
export function endOfDate(
  value: string,
  unit: Temporal.SmallestUnit<Temporal.DateUnit>,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): string {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }

    const resolvedUnit = resolveDateTimeUnit(unit);
    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);

    if (
      weekStartsOn === null ||
      !isValidDate(value) ||
      !supported.includes(resolvedUnit as Temporal.DateUnit)
    )
      return "";

    try {
      const source = Temporal.PlainDate.from(value);
      let result: Temporal.PlainDate;

      switch (resolvedUnit) {
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
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
