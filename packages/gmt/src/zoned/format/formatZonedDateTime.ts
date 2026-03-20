import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

export function formatZonedDateTime(
  value: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.toLocaleString(locale, options);
  } catch {
    return "";
  }
}
