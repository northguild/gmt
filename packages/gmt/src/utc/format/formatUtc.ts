import { normalizeDateTime } from "../../internal/normalizeDateTime";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { toInstantFromUtc } from "../../internal/toInstantFromUtc";
import { isValidUtc } from "../validate";

export interface FormatUtcOptions extends Intl.DateTimeFormatOptions {
  timeZone?: string;
  includeTimeZoneName?: boolean;
}

export function formatUtc(
  value: string,
  locale?: string,
  options?: FormatUtcOptions,
): string {
  if (!isValidUtc(value)) return "";

  const {
    timeZone,
    includeTimeZoneName = false,
    ...intlOptions
  } = options ?? {};

  const instant = toInstantFromUtc(value);
  if (instant === null) return "";

  try {
    const tz = normalizeTimeZone(timeZone);
    const zdt = instant.toZonedDateTimeISO(tz);

    const out = includeTimeZoneName
      ? zdt.toLocaleString(locale, intlOptions)
      : zdt.toPlainDateTime().toLocaleString(locale, intlOptions);

    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
