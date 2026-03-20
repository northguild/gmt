import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

export function formatDateTime(
  value: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidDateTime(value)) {
    return "";
  }

  try {
    return Temporal.PlainDateTime.from(value).toLocaleString(locale, options);
  } catch {
    return "";
  }
}
