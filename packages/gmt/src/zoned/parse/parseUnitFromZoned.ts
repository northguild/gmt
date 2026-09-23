import type { Temporal } from "@js-temporal/polyfill";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Units supported by `parseUnitFromZoned` when extracting a value from a zoned
 * ISO string. Includes `timeZone` for reading the zone identifier. Each Temporal unit is also
 * accepted in its plural form (`"months"`), as Temporal accepts.
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
 * | `timeZone` | IANA timeZone identifier string. |
 *
 * @example
 * import { ZonedParseUnit } from "@northguild/gmt/zoned";
 * const u: ZonedParseUnit = "month";
 */
export type ZonedParseUnit =
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
  | "dayOfWeek"
  | "timeZone";

function isValidZonedUnit(unit: string): boolean {
  return [
    "year",
    "month",
    "week",
    "day",
    "dayOfWeek",
    "hour",
    "minute",
    "second",
    "millisecond",
    "microsecond",
    "nanosecond",
    "timeZone",
  ].includes(unit);
}

/**
 * Return the requested unit value from an ISO 8601 zoned datetime string.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond", "timeZone".
 * - Uses Temporal.ZonedDateTime.from to parse.
 * - `unit` accepts the singular or plural name of a Temporal unit (`"hour"` or `"hours"`), as Temporal
 *   does; `"dayOfWeek"` has no plural.
 * - `weekStartsOn: "sunday"` numbers weeks by UTS #35 (week 1 holds 1 January, so late-December
 *   days can be week 1); any value other than `"monday"` or `"sunday"` returns "".
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit unit to extract
 * @param optionsArg optional settings (e.g. weekStartsOn for week calculations); a non-object value (such as `null`) is invalid
 * @returns string representation of the requested unit or "" when invalid
 *
 * @example parseUnitFromZoned("2024-02-29T12:34:56.789+00:00[UTC]", "year") // "2024"
 * @example parseUnitFromZoned("2024-02-29T12:34:56.789+00:00[UTC]", "milliseconds") // "789"
 * @example parseUnitFromZoned("2024-12-31T12:00:00+00:00[UTC]", "week", { weekStartsOn: "sunday" }) // "1"
 * @example parseUnitFromZoned("invalid", "year") // ""
 */
export function parseUnitFromZoned(
  value: string,
  unit: ZonedParseUnit,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): string {
  try {
    // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }
    const resolvedUnit = resolveDateTimeUnit(unit);
    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);

    if (
      !isValidZonedDateTime(value) ||
      !isValidZonedUnit(resolvedUnit) ||
      weekStartsOn === null
    ) {
      return "";
    }

    try {
      const zonedDateTime = zonedDateTimeFrom(value);

      switch (resolvedUnit) {
        case "year":
          return zonedDateTime.year.toString();
        case "month":
          return zonedDateTime.month.toString().padStart(2, "0");
        case "week":
          return (
            getWeekNumber(
              zonedDateTime.toPlainDate().toString(),
              weekStartsOn,
            ) ?? 0
          ).toString();
        case "day":
          return zonedDateTime.day.toString().padStart(2, "0");
        case "dayOfWeek":
          return zonedDateTime.dayOfWeek.toString();
        case "hour":
          return zonedDateTime.hour.toString().padStart(2, "0");
        case "minute":
          return zonedDateTime.minute.toString().padStart(2, "0");
        case "second":
          return zonedDateTime.second.toString().padStart(2, "0");
        case "millisecond":
          return zonedDateTime.millisecond.toString().padStart(3, "0");
        case "microsecond":
          return zonedDateTime.microsecond.toString().padStart(3, "0");
        case "nanosecond":
          return zonedDateTime.nanosecond.toString().padStart(3, "0");
        case "timeZone":
          return zonedDateTime.timeZoneId;
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
