import {
  resolveUnixEpochUnitOptions,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import { isValidTimeZone } from "../../zoned/validate";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Convert a unix epoch value to a zoned ISO 8601 datetime string.
 *
 * - Converts to ZonedDateTime using the specified timezone (required; an unknown zone returns "").
 * - `value` is a safe integer or a string of optionally negative ASCII digits; anything else, or an
 *   instant outside the Temporal range, returns "".
 * - `options.epochUnit` is `"seconds"` or `"milliseconds"` (singular accepted), default
 *   `"milliseconds"`. An explicit `undefined` is the same as omitted; a non-object `options` (such
 *   as a bare `"seconds"` string) returns "".
 *
 * @param value epoch value: a safe integer or a digit string
 * @param timeZone IANA timeZone identifier
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds")
 * @returns zoned ISO 8601 string or "" on invalid
 *
 * @example convertUnixToZoned(1709164800000, "America/New_York") // "2024-02-28T19:00:00-05:00[America/New_York]"
 * @example convertUnixToZoned(1709164800, "UTC", { epochUnit: "seconds" }) // "2024-02-29T00:00:00+00:00[UTC]"
 * @example convertUnixToZoned("-1", "UTC") // "1969-12-31T23:59:59.999+00:00[UTC]"
 * @example convertUnixToZoned(1709164800, "UTC", "seconds" as never) // "" (options must be an object)
 * @example convertUnixToZoned(NaN, "UTC") // ""
 */
export function convertUnixToZoned(
  value: number | string,
  timeZone: string,
  options?: { epochUnit?: UnixUnit },
): string {
  const epochUnit = resolveUnixEpochUnitOptions(options);

  if (epochUnit === null || !isValidTimeZone(timeZone)) {
    return "";
  }

  const instant = unixEpochToInstant(value, epochUnit);

  if (instant === null) {
    return "";
  }

  try {
    return instant.toZonedDateTimeISO(timeZone).toString();
  } catch {
    return "";
  }
}
