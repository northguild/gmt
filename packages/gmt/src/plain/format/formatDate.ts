import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

export function formatDate(
  value: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidDate(value)) {
    return "";
  }

  try {
    return Temporal.PlainDate.from(value).toLocaleString(locale, options);
  } catch {
    return "";
  }
}
