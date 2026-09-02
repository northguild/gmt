import { Temporal } from "@js-temporal/polyfill";
import { joinDateTimeConnector, normalizeDateTime } from "../../internal";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { isValidUtc } from "../../utc/validate";

/**
 * Options for `formatCalendarUnix`. Mirrors the option shape of
 * `formatCalendar` but targets the unix domain, adding `epochUnit`.
 *
 * @remarks Members:
 *
 * | Member | Type | Default | Description |
 * | --- | --- | --- | --- |
 * | `style` | `"long"\|"short"\|"narrow"` | `"long"` | `RelativeTimeFormat` style for the day label. |
 * | `numeric` | `"always"\|"auto"` | `"auto"` | Numeric formatting of the relative day label. |
 * | `largestUnit` | `"year"\|"month"\|"week"\|"day"` | auto | Largest unit for the relative diff. |
 * | `roundingMethod` | `"expand"\|"trunc"\|"floor"\|"ceil"` | — | Rounding for the computed distance. |
 * | `reference` | `string\|number` | now (UTC) | Anchor epoch/ISO for the "today/tomorrow" comparison. |
 * | `epochUnit` | `"milliseconds"\|"seconds"` | `"milliseconds"` | Interpretation of numeric `value`/`reference`. |
 * | `timeZone` | `string` | `"UTC"` | IANA zone for both day-comparison and clock-time rendering. |
 * | `timeStyle` | `"short"\|"medium"\|"full"` | `"short"` | `Intl` `timeStyle` for the time-of-day portion. |
 *
 * @example
 * import { FormatCalendarUnixOptions } from "@northguild/gmt/unix";
 * const opts: FormatCalendarUnixOptions = { timeZone: "America/New_York" };
 */
export interface FormatCalendarUnixOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: "year" | "month" | "week" | "day";
  roundingMethod?: "expand" | "trunc" | "floor" | "ceil";
  /** Anchor point for the relative day comparison. Accepts ISO strings or numeric epochs. */
  reference?: string | number;
  epochUnit?: "milliseconds" | "seconds";
  /**
   * IANA timezone used for both the calendar-day comparison and the
   * rendered clock time. Resolved via `normalizeTimeZone` — `"local"` for
   * the system zone, an invalid/omitted value falls back to `"UTC"`.
   */
  timeZone?: string;
  /** `Intl.DateTimeFormatOptions` `timeStyle` for the time-of-day half. */
  timeStyle?: "short" | "medium" | "full";
}

const ABS_DAY_THRESHOLD = 6;

function toInstant(
  raw: string | number,
  epochUnit: "milliseconds" | "seconds",
): Temporal.Instant | null {
  let n: number;
  if (typeof raw === "number") {
    n = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    // Mirror formatUnix.parseEpochMs: only accept integer-looking strings,
    // so "" / "not-a-date" / "12.5" don't silently coerce to 0/12.
    if (!/^-?\d+$/.test(trimmed)) return null;
    n = Number(trimmed);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  try {
    const ms = epochUnit === "seconds" ? n * 1000 : n;
    return Temporal.Instant.fromEpochMilliseconds(ms);
  } catch {
    return null;
  }
}

/**
 * Format a unix epoch value as a relative day label plus time-of-day, e.g.
 * "Tomorrow at 2:30 PM" — the unix counterpart of `formatCalendar`. See
 * that function's JSDoc for the day-label/threshold/connector design; this
 * variant compares calendar days and renders the clock time in `timeZone`
 * (default `"UTC"`).
 *
 * @param value unix epoch (string or number, per `epochUnit`) to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { epochUnit, reference, timeZone, timeStyle }
 * @returns the formatted calendar string, or "" on invalid input
 *
 * @example formatCalendarUnix(1710685845000, "en-US", { epochUnit: "milliseconds", timeZone: "America/New_York" }) // day label + time relative to "now", or the absolute fallback beyond the ±6-day threshold
 * @example formatCalendarUnix(value, "en-US", { reference: 1710685000000 }) // e.g. "tomorrow at 2:30 PM"
 * @example formatCalendarUnix("not-a-number") // ""
 */
export function formatCalendarUnix(
  value: string | number,
  locale?: string,
  options: FormatCalendarUnixOptions = {},
): string {
  const epochUnit = options.epochUnit ?? "milliseconds";

  const target = toInstant(value, epochUnit);
  if (target === null) return "";

  let reference: Temporal.Instant;
  if (options.reference === undefined) {
    try {
      reference = Temporal.Now.instant();
    } catch {
      return "";
    }
  } else if (typeof options.reference === "string") {
    const numericRef = toInstant(options.reference, epochUnit);
    if (numericRef !== null) {
      reference = numericRef;
    } else if (isValidUtc(options.reference)) {
      try {
        reference = Temporal.Instant.from(options.reference);
      } catch {
        return "";
      }
    } else {
      return "";
    }
  } else {
    const ref = toInstant(options.reference, epochUnit);
    if (ref === null) return "";
    reference = ref;
  }

  try {
    const timeZone = normalizeTimeZone(options.timeZone);
    const timeStyle = options.timeStyle ?? "short";

    const targetDate = target.toZonedDateTimeISO(timeZone).toPlainDate();
    const referenceDate = reference.toZonedDateTimeISO(timeZone).toPlainDate();
    const diffDays = targetDate.since(referenceDate).days;

    const epochMilliseconds = Number(target.epochMilliseconds);

    if (Math.abs(diffDays) > ABS_DAY_THRESHOLD) {
      return normalizeDateTime(
        new Intl.DateTimeFormat(locale, {
          dateStyle: "long",
          timeStyle,
          timeZone,
        }).format(epochMilliseconds),
      );
    }

    const dayLabel = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
    }).format(diffDays, "day");

    return normalizeDateTime(
      joinDateTimeConnector(
        epochMilliseconds,
        timeZone,
        locale,
        dayLabel,
        timeStyle,
      ),
    );
  } catch {
    return "";
  }
}
