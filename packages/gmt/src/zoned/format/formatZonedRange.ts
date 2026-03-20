import { Temporal, Intl as TemporalIntl } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

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
    return new TemporalIntl.DateTimeFormat(locale, formatOptions).formatRange(
      zdt1.toInstant(),
      zdt2.toInstant(),
    );
  } catch {
    return "";
  }
}
