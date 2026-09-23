// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { isValidDate } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

const supported: Temporal.DateUnit[] = ["year", "month", "week", "day"];

/**
 * Return the start of the specified date `unit` for a given ISO 8601 date string.
 *
 * - `"day"` returns the date itself: a date is already a whole day, as `endOfDate` treats it.
 * - `unit` accepts the singular or plural name (`"month"` or `"months"`), as Temporal does.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns "".
 * - Returns "" for invalid inputs.
 *
 * @param value ISO 8601 date string
 * @param unit date unit, singular or plural, to specify the unit for the start
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday")
 * @returns ISO 8601 string representing the start of the specified unit, or "" on invalid input
 *
 * @example startOfDate("2024-02-29", "month") // "2024-02-01"
 * @example startOfDate("2024-02-29", "day") // "2024-02-29"
 * @example startOfDate("2024-02-29", "months") // "2024-02-01"
 * @example startOfDate("invalid-date", "month") // ""
 */
export function startOfDate(
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
          result = source.with({ month: 1, day: 1 });
          break;
        case "month":
          result = source.with({ day: 1 });
          break;
        case "day":
          result = source;
          break;
        case "week": {
          // Week start: compute how many days to subtract to reach Monday.
          // Temporal: 1 (Mon) to 7 (Sun)
          // If Monday start: Monday(1) subtracts 0, Sunday(7) subtracts 6.
          // If Sunday start: Sunday(7) subtracts 0, Monday(1) subtracts 1.
          const daysToSubtract =
            weekStartsOn === "monday"
              ? source.dayOfWeek - 1
              : source.dayOfWeek % 7;

          result = source.subtract({ days: daysToSubtract });
          break;
        }
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
