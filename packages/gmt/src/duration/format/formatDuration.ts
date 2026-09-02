import { Temporal } from "@js-temporal/polyfill";
import type { DurationUnit } from "../../types";

const UNIT_TO_INTL: Record<DurationUnit, string> = {
  years: "year",
  months: "month",
  weeks: "week",
  days: "day",
  hours: "hour",
  minutes: "minute",
  seconds: "second",
};

const UNITS_IN_ORDER: DurationUnit[] = [
  "years",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "seconds",
];

export interface FormatDurationOptions {
  style?: "long" | "short" | "narrow";
  zero?: boolean;
}

/**
 * Render an ISO 8601 duration string as a locale-aware, human-readable string.
 *
 * - Uses Temporal.Duration.from to parse, then Intl.NumberFormat({ style: "unit" })
 *   to render each nonzero year/month/week/day/hour/minute/second component with
 *   correct per-locale unit labels and pluralization, joined via Intl.ListFormat.
 * - Sub-second components (milliseconds/microseconds/nanoseconds) are folded into
 *   the seconds component as a fractional value (e.g. "PT1.5S" -> one "1.5 seconds"
 *   component), since Intl.NumberFormat's "second" unit accepts fractional input.
 * - By default, zero-valued components are omitted (e.g. "P1DT0H30M" -> "1 day, 30
 *   minutes"). Pass { zero: true } to include them.
 * - A zero-length duration (e.g. "PT0S") always renders its seconds component
 *   ("0 seconds") even with the default zero-omitting behavior, since omitting
 *   every component would otherwise produce "".
 * - Negative durations render each component with a leading "-" (Temporal stores
 *   every field of a negative duration as a negative number).
 * - Returns "" for invalid input: non-string value or invalid duration string.
 *
 * @param value ISO 8601 duration string
 * @param locale BCP 47 locale tag, passed to Intl.NumberFormat/Intl.ListFormat; system default if omitted
 * @param options optional: { style: "long" | "short" | "narrow" (default "long"), zero: boolean (default false) }
 * @returns human-readable rendering of the duration, or "" on invalid input
 *
 * @example formatDuration("P1DT2H30M", "en-US") // "1 day, 2 hours, and 30 minutes"
 * @example formatDuration("PT90M", "en-US", { style: "short" }) // "90 min"
 * @example formatDuration("PT90M", "en-US", { style: "narrow" }) // "90m"
 * @example formatDuration("P1DT0H30M", "en-US") // "1 day and 30 minutes"
 * @example formatDuration("PT0S", "en-US") // "0 seconds"
 * @example formatDuration("-P1DT2H", "en-US") // "-1 day and -2 hours"
 * @example formatDuration("P1DT2H30M", "de-DE") // "1 Tag, 2 Stunden und 30 Minuten"
 * @example formatDuration("invalid") // ""
 */
export function formatDuration(
  value: string,
  locale?: string,
  options: FormatDurationOptions = {},
): string {
  if (typeof value !== "string") {
    return "";
  }

  try {
    const duration = Temporal.Duration.from(value);
    const style = options.style ?? "long";
    const includeZero = options.zero ?? false;

    const seconds =
      duration.seconds +
      duration.milliseconds / 1e3 +
      duration.microseconds / 1e6 +
      duration.nanoseconds / 1e9;
    const amounts: Record<DurationUnit, number> = {
      years: duration.years,
      months: duration.months,
      weeks: duration.weeks,
      days: duration.days,
      hours: duration.hours,
      minutes: duration.minutes,
      seconds,
    };

    const parts = UNITS_IN_ORDER.filter(
      (unit) => includeZero || amounts[unit] !== 0,
    ).map((unit) =>
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit: UNIT_TO_INTL[unit],
        unitDisplay: style,
      }).format(amounts[unit]),
    );

    if (parts.length === 0) {
      parts.push(
        new Intl.NumberFormat(locale, {
          style: "unit",
          unit: "second",
          unitDisplay: style,
        }).format(0),
      );
    }

    return new Intl.ListFormat(locale, {
      style: style === "long" ? "long" : "short",
      type: "conjunction",
    }).format(parts);
  } catch {
    return "";
  }
}
