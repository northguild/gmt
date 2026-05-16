import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal/normalizeDateTime";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { isValidUnixUnit } from "../validate";

export interface FormatUnixOptions extends Intl.DateTimeFormatOptions {
  epochUnit?: "milliseconds" | "seconds";
  timeZone?: string;
  // When true, format via ZonedDateTime so the localized timezone name is
  // included for full/long styles. Defaults to false (matches the original
  // behavior of formatting a wall-clock PlainDateTime).
  includeTimeZoneName?: boolean;
}

function parseEpochMs(
  value: string | number,
  epochUnit: "milliseconds" | "seconds",
): number | null {
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    n = Number(trimmed);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  return epochUnit === "seconds" ? n * 1000 : n;
}

export function formatUnix(
  value: string | number,
  locale?: string,
  options?: FormatUnixOptions,
): string {
  const {
    epochUnit = "milliseconds",
    timeZone,
    includeTimeZoneName = false,
    ...intlOptions
  } = options ?? {};

  if (!isValidUnixUnit(epochUnit)) return "";

  const ms = parseEpochMs(value, epochUnit);
  if (ms === null) return "";

  const tz = normalizeTimeZone(timeZone);

  try {
    const zdt =
      Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(tz);
    const out = includeTimeZoneName
      ? zdt.toLocaleString(locale, intlOptions)
      : zdt.toPlainDateTime().toLocaleString(locale, intlOptions);
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
