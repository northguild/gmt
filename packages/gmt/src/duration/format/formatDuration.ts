import { Temporal } from "@js-temporal/polyfill";
import type { DurationUnit } from "../../types";
import { isOptionsArgument } from "../../internal/isObject";

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

const NANOSECONDS_PER_SECOND = 1_000_000_000n;

function isZeroAmount(amount: number | Intl.StringNumericLiteral): boolean {
  return amount === 0 || amount === "0";
}

/**
 * The duration's seconds plus its sub-second fields as an exact decimal string.
 *
 * Summed in bigint nanoseconds, not float seconds: Temporal allows seconds up to 2^53 - 1 with 9
 * fraction digits (IsValidDuration), which a float cannot hold. ECMA-402 Intl.NumberFormat accepts
 * a decimal string and formats it without converting to a Number (ToIntlMathematicalValue).
 * Returns "0", never "-0", for a zero amount, so a negative duration's zero seconds renders as 0.
 */
function exactSeconds(duration: Temporal.Duration): Intl.StringNumericLiteral {
  const total =
    BigInt(duration.seconds) * NANOSECONDS_PER_SECOND +
    BigInt(duration.milliseconds) * 1_000_000n +
    BigInt(duration.microseconds) * 1_000n +
    BigInt(duration.nanoseconds);
  const magnitude = total < 0n ? -total : total;
  const whole = magnitude / NANOSECONDS_PER_SECOND;
  const fraction = (magnitude % NANOSECONDS_PER_SECOND)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  const sign = total < 0n ? "-" : "";
  return `${sign}${whole}${fraction === "" ? "" : `.${fraction}`}` as Intl.StringNumericLiteral;
}

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
 *   the seconds component as an exact fractional value (e.g. "PT1.5S" -> one "1.5 seconds"
 *   component). Every digit the duration holds is rendered, up to 9 fraction digits and
 *   seconds up to 2^53 - 1: nothing is rounded, so a non-zero duration never prints
 *   "0 seconds" and "PT9007199254740991.999999999S" renders exactly.
 * - To render fewer fraction digits, round the string first with parseDuration, e.g.
 *   { smallestUnit: "millisecond", roundingMode: "halfExpand" } for the 3-digit output this
 *   function produced before (parseDuration's default roundingMode "trunc" drops the digits).
 * - By default, zero-valued components are omitted (e.g. "P1DT0H30M" -> "1 day and 30
 *   minutes"). Pass { zero: true } to include them.
 * - A zero-length duration (e.g. "PT0S") always renders its seconds component
 *   ("0 seconds") even with the default zero-omitting behavior, since omitting
 *   every component would otherwise produce "".
 * - Negative durations render each component with a leading "-" (Temporal stores
 *   every field of a negative duration as a negative number).
 * - Returns "" for invalid input: non-string value or invalid duration string.
 *
 * @param value ISO 8601 duration string
 * @param locale BCP 47 locale tag, passed to Intl.NumberFormat/Intl.ListFormat; system default if omitted, or a preference list of tags (ECMA-402)
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
 * @example formatDuration("PT0.000000001S", "en-US") // "0.000000001 seconds"
 * @example formatDuration("PT1.123456789S", "en-US") // "1.123456789 seconds"
 * @example formatDuration(parseDuration("PT1.123456789S", { smallestUnit: "millisecond" }), "en-US") // "1.123 seconds"
 * @example formatDuration("invalid") // ""
 * @example formatDuration("P1DT2H30M", ["es-ES", "en-US"]) // "1 día, 2 horas y 30 minutos"
 */
export function formatDuration(
  value: string,
  locale?: string | string[],
  options: FormatDurationOptions = {},
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  if (typeof value !== "string") {
    return "";
  }

  try {
    const duration = Temporal.Duration.from(value);
    const style = options.style === undefined ? "long" : options.style;
    const includeZero = options.zero ?? false;

    const amounts: Record<DurationUnit, number | Intl.StringNumericLiteral> = {
      years: duration.years,
      months: duration.months,
      weeks: duration.weeks,
      days: duration.days,
      hours: duration.hours,
      minutes: duration.minutes,
      seconds: exactSeconds(duration),
    };

    const parts = UNITS_IN_ORDER.filter(
      (unit) => includeZero || !isZeroAmount(amounts[unit]),
    ).map((unit) =>
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit: UNIT_TO_INTL[unit],
        unitDisplay: style,
        maximumFractionDigits: 9,
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
