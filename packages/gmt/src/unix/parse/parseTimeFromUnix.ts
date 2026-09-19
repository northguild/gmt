import { unixZonedDateTime } from "../../internal/unixZonedDateTime";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Extract the time portion from a unix epoch value.
 *
 * - Converts to ZonedDateTime then extracts the PlainTime.
 * - Uses UTC if `timeZone` is not specified; `"local"` is the system time zone.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone is invalid)
 * @returns ISO time string (e.g., "14:30:45") or "" on invalid input
 *
 * @example parseTimeFromUnix(1700000000000, { timeZone: "UTC" }) // "22:13:20"
 * @example parseTimeFromUnix(1700000000, { epochUnit: "seconds", timeZone: "UTC" }) // "22:13:20"
 * @example parseTimeFromUnix(-86400, { epochUnit: "seconds", timeZone: "UTC" }) // "00:00:00"
 * @example parseTimeFromUnix("1700000000", { epochUnit: "second" }) // "22:13:20" (digit string, UTC by default)
 * @example parseTimeFromUnix(1.5) // "" (not an integer epoch)
 */
export function parseTimeFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  const zdt = unixZonedDateTime(value, options);

  return zdt === null ? "" : zdt.toPlainTime().toString();
}
