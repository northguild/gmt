import { Temporal } from "@js-temporal/polyfill";
import { joinDateTimeConnector, normalizeDateTime } from "../../internal";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { unixEpochToInstant } from "../../internal/unixEpochInstant";
import { isValidUtc } from "../../utc/validate";
import { isValidUnixUnit } from "../validate/isValidUnixUnit";

/**
 * Options for `formatCalendarUnix`. Like `formatCalendar`, it takes a `reference` and a `timeStyle`
 * (here also `"full"`); it adds `epochUnit` and `timeZone` for the unix domain.
 *
 * @remarks Members:
 *
 * | Member | Type | Default | Description |
 * | --- | --- | --- | --- |
 * | `reference` | `string\|number` | now (UTC) | Anchor epoch/ISO for the "today/tomorrow" comparison. |
 * | `epochUnit` | `"milliseconds"\|"seconds"` | `"milliseconds"` | Interpretation of numeric `value`/`reference`. |
 * | `timeZone` | `string` | `"UTC"` | IANA zone for both day-comparison and clock-time rendering. |
 * | `timeStyle` | `"short"\|"medium"\|"full"` | `"short"` | `Intl` `timeStyle` for the time-of-day portion. |
 * | `style`, `numeric`, `largestUnit`, `roundingMethod` | — | — | Deprecated and ignored: the function never read them. Kept so existing calls still type-check; removed in the next major. |
 *
 * @example
 * import { FormatCalendarUnixOptions } from "@northguild/gmt/unix";
 * const opts: FormatCalendarUnixOptions = { timeZone: "America/New_York" };
 */
export interface FormatCalendarUnixOptions {
  /**
   * @deprecated Ignored. `formatCalendarUnix` never read it; the day label always uses the long style. Will be removed in the next major.
   */
  style?: "long" | "short" | "narrow";
  /**
   * @deprecated Ignored. `formatCalendarUnix` never read it; the day label always uses `numeric: "auto"`. Will be removed in the next major.
   */
  numeric?: "always" | "auto";
  /**
   * @deprecated Ignored. `formatCalendarUnix` never read it. Will be removed in the next major.
   */
  largestUnit?: "year" | "month" | "week" | "day";
  /**
   * @deprecated Ignored. `formatCalendarUnix` never read it. Will be removed in the next major.
   */
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
 * @example formatCalendarUnix(1710772200000, "en-US", { reference: 1710685000000, timeZone: "UTC" }) // "tomorrow at 2:30 PM"
 * @example formatCalendarUnix("not-a-number") // ""
 */
export function formatCalendarUnix(
  value: string | number,
  locale?: string,
  options: FormatCalendarUnixOptions = {},
): string {
  // A default parameter covers only `undefined`; `null` also means "no options".
  options ??= {};
  const epochUnit = options.epochUnit ?? "milliseconds";
  if (!isValidUnixUnit(epochUnit)) return "";

  const target = unixEpochToInstant(value, epochUnit);
  if (target === null) return "";

  let reference: Temporal.Instant;
  if (options.reference === undefined) {
    try {
      reference = Temporal.Now.instant();
    } catch {
      return "";
    }
  } else if (typeof options.reference === "string") {
    const numericRef = unixEpochToInstant(options.reference, epochUnit);
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
    const ref = unixEpochToInstant(options.reference, epochUnit);
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
