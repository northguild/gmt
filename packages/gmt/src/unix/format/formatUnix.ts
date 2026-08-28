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

/**
 * Format a unix epoch value (string or number) as a localized date/time string.
 *
 * - Returns `""` if the input is not a valid unix epoch value for the given `epochUnit`.
 * - `epochUnit` controls whether the input is interpreted as `"milliseconds"` or `"seconds"`; defaults to `"milliseconds"`.
 * - `timeZone` controls the IANA zone used for rendering; defaults to `"UTC"`.
 * - `includeTimeZoneName` appends the localized timezone name when true.
 *
 * @param value unix epoch value to format (string or number, per `epochUnit`)
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { epochUnit, timeZone, includeTimeZoneName }
 * @returns the formatted date/time string, or "" on invalid input
 *
 * @example formatUnix("1710685845000", "en-US", { epochUnit: "milliseconds" }) // "3/17/2024, 2:30:45 PM"
 * @example formatUnix(1710685845000, "en-US", { epochUnit: "milliseconds" }) // "3/17/2024, 2:30:45 PM"
 * @example formatUnix("1710685845", "en-US", { epochUnit: "seconds" }) // "3/17/2024, 2:30:45 PM"
 * @example formatUnix("1710685845000", "en-US", { epochUnit: "milliseconds", includeTimeZoneName: true }) // "3/17/2024, 2:30:45 PM UTC"
 * @example formatUnix("not-a-number") // ""
 */
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
