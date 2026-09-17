import type { Temporal } from "@js-temporal/polyfill";
import { normalizeTimeZone } from "./normalizeTimeZone";
import { resolveUnixEpochUnit, unixEpochToInstant } from "./unixEpochValue";

/**
 * Read a Unix epoch argument as a `Temporal.ZonedDateTime` under the shared `unix/` options, or
 * null when anything is invalid.
 *
 * - `value` follows the one epoch grammar (`parseUnixEpochValue`).
 * - `epochUnit` accepts singular or plural names and defaults to `"milliseconds"`.
 * - `timeZone` defaults to `"UTC"`; `"local"` is the system zone; an unknown zone is invalid
 *   (see `normalizeTimeZone`).
 *
 * @param value Unix epoch number or digit string
 * @param options optional `{ epochUnit, timeZone }`
 * @returns the zoned date-time, or null
 *
 * @example unixZonedDateTime(0)?.toString() // "1970-01-01T00:00:00+00:00[UTC]"
 * @example unixZonedDateTime("86400", { epochUnit: "second", timeZone: "Asia/Tokyo" })?.hour // 9
 * @example unixZonedDateTime(0, { timeZone: "Asia/Tokio" }) // null
 */
export function unixZonedDateTime(
  value: unknown,
  options?: { epochUnit?: unknown; timeZone?: unknown },
): Temporal.ZonedDateTime | null {
  const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
  const timeZone = normalizeTimeZone(options?.timeZone);

  if (epochUnit === null || !timeZone) {
    return null;
  }

  try {
    return (
      unixEpochToInstant(value, epochUnit)?.toZonedDateTimeISO(timeZone) ?? null
    );
  } catch {
    return null;
  }
}
