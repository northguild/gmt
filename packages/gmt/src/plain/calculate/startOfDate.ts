// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import type { Temporal } from "../../internal/temporal";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { plainDateOf } from "../../internal/inputChecks";
import { startOfPlainDate } from "../../internal/plainDateSteps";
import { isOptionsArgument } from "../../internal/isObject";

const supported: Temporal.DateUnit[] = ["year", "month", "week", "day"];

/**
 * Return the start of the specified date `unit` for a given ISO 8601 date string.
 *
 * - `"day"` returns the date itself: a date is already a whole day, as `endOfDate` treats it.
 * - `unit` accepts the singular or plural name (`"month"` or `"months"`), as Temporal does.
 * - Returns "" for invalid inputs.
 *
 * @param value ISO 8601 date string
 * @param unit date unit, singular or plural, to specify the unit for the start
 * @param optionsArg How the week is defined
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
  optionsArg?: {
    /**
     * The first day of the week, which sets where a `"week"` unit starts. `"monday"` is the ISO
     * 8601 week, Monday to Sunday; `"sunday"` runs Sunday to Saturday. Any other value returns
     * `""`, whatever the unit.
     *
     * @defaultValue `"monday"`
     */
    weekStartsOn?: "monday" | "sunday";
  },
): string {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }

    const resolvedUnit = resolveDateTimeUnit(unit);
    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);

    if (
      weekStartsOn === null ||
      !supported.includes(resolvedUnit as Temporal.DateUnit)
    )
      return "";

    const source = plainDateOf(value);
    if (source === null) return "";

    try {
      return startOfPlainDate(
        source,
        resolvedUnit as Temporal.DateUnit,
        weekStartsOn,
      ).toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
