import { unixZonedDateTime } from "../../internal/unixZonedDateTime";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Extract the date portion from a unix epoch value.
 *
 * - Converts to ZonedDateTime then extracts the PlainDate.
 * - Uses UTC if `timeZone` is not specified; `"local"` is the system time zone.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone is invalid)
 * @returns ISO date string (e.g., "2024-03-17") or "" on invalid input
 *
 * @example parseDateFromUnix(1700000000000, { timeZone: "UTC" }) // "2023-11-14"
 * @example parseDateFromUnix(1700000000, { epochUnit: "seconds", timeZone: "UTC" }) // "2023-11-14"
 * @example parseDateFromUnix(-86400, { epochUnit: "seconds", timeZone: "UTC" }) // "1969-12-31"
 * @example parseDateFromUnix("1700000000000", { timeZone: "Asia/Tokyo" }) // "2023-11-15" (digit string)
 * @example parseDateFromUnix(1.5) // "" (not an integer epoch)
 */
export function parseDateFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  const zdt = unixZonedDateTime(value, options);

  return zdt === null ? "" : zdt.toPlainDate().toString();
}
