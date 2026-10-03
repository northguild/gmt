// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
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
 * - A `"week"` in late December can be week 1 of the next year, under either week numbering.
 * - `optionsArg` must be an object or omitted: a non-object value (such as `null`) returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param unit unit to extract from the datetime
 * @param optionsArg How weeks are numbered, and the time zone the value is read in
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
    /**
     * The time zone the wall-clock fields are read in: an IANA name, a UTC offset, or `"local"` for
     * the system time zone. An unknown zone returns `""`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
  },
): string {
  try {
    // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }
    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);
    const timeZone = normalizeTimeZone(optionsArg?.timeZone);

    if (!isValidUtc(value) || weekStartsOn === null || timeZone === "") {
      return "";
    }

    try {
      const dateTime =
        Temporal.Instant.from(value).toZonedDateTimeISO(timeZone);

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
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
