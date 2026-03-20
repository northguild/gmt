import { Temporal } from "@js-temporal/polyfill";

import { isValidTime } from "../validate";

export function formatTime(
  value: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidTime(value)) {
    return "";
  }

  try {
    return Temporal.PlainTime.from(value).toLocaleString(locale, options);
  } catch {
    return "";
  }
}
