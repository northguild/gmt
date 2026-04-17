import { Temporal, Intl as TemporalIntl } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidZonedDateTime } from "../validate";

/**
 * Format a zoned datetime range using the Temporal Intl.DateTimeFormat formatRange API.
 *
 * - Both datetimes must have the same timezone.
 * - Uses Temporal.ZonedDateTime.toInstant for formatting.
 * - Returns "" for invalid input or mismatched timezones.
 *
 * @param from zoned ISO 8601 datetime string (range start)
 * @param to zoned ISO 8601 datetime string (range end)
 * @param locale optional locale tag
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized range string or "" when invalid
 *
 * @example formatZonedRange("2024-02-29T12:00:00.000+00:00[UTC]", "2024-02-29T14:00:00.000+00:00[UTC]", "en-US", { dateStyle: "long", timeStyle: "short" }) // "February 29, 2024 at 12:00 PM – 2:00 PM Coordinated Universal Time"
 * @example formatZonedRange("2024-02-29T12:00:00.000+00:00[UTC]", "2024-02-29T14:00:00.000+00:00[UTC]", "en-GB", { dateStyle: "short", timeStyle: "short" }) // "29/02/2024, 12:00 – 14:00"
 * @example formatZonedRange("invalid", "2024-02-29T14:00:00.000+00:00[UTC]", "en-US") // "" (invalid input)
 */
export function formatZonedRange(
  from: string,
  to: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidZonedDateTime(from) || !isValidZonedDateTime(to)) {
    return "";
  }

  let zdt1: Temporal.ZonedDateTime;
  let zdt2: Temporal.ZonedDateTime;
  try {
    zdt1 = Temporal.ZonedDateTime.from(from);
    zdt2 = Temporal.ZonedDateTime.from(to);
  } catch {
    return "";
  }

  if (zdt1.timeZoneId !== zdt2.timeZoneId) {
    return "";
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    ...options,
    timeZone: zdt1.timeZoneId,
  };

  try {
    const out = new TemporalIntl.DateTimeFormat(
      locale,
      formatOptions,
    ).formatRange(zdt1.toInstant(), zdt2.toInstant());
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
