import { cachedFormatter } from "../../internal/formatterCache";
import { exactSeconds } from "../../internal/exactSeconds";
import { Temporal } from "../../internal/temporal";
import { isOptionsArgument } from "../../internal/isObject";
import { optionOrDefault } from "../../internal/optionOrDefault";

/**
 * Plural unit keys rendered by `formatDuration`. Maps to singular `Intl.NumberFormat` unit
 * labels through `UNIT_TO_INTL` (e.g. `"years"` → `"year"`).
 */
type DurationUnit =
  | "years"
  | "months"
  | "weeks"
  | "days"
  | "hours"
  | "minutes"
  | "seconds";

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

function isZeroAmount(amount: number | Intl.StringNumericLiteral): boolean {
  return amount === 0 || amount === "0";
}

/** How `formatDuration` writes unit names, and whether it writes zero components. */
export interface FormatDurationOptions {
  /**
   * The length of each unit name, as the `unitDisplay` of `Intl.NumberFormat`: `"long"` ("90
   * minutes"), `"short"` ("90 min") or `"narrow"` ("90m"). The components are joined as a long list
   * ("1 day, 2 hours, and 30 minutes") for `"long"` and as a short list otherwise.
   *
   * @defaultValue `"long"`
   */
  style?: "long" | "short" | "narrow";
  /**
   * Whether components that are zero are written. `false` leaves them out, so `"P1DT0H30M"`
   * reads "1 day and 30 minutes"; `true` writes every unit from years to seconds.
   *
   * @defaultValue `false`
   */
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
 * - A zero-length duration (e.g. "PT0S") always renders its seconds component
 *   ("0 seconds") even when zero components are left out, since omitting
 *   every component would otherwise produce "".
 * - Negative durations render each component with a leading "-" (Temporal stores
 *   every field of a negative duration as a negative number).
 * - Returns "" for invalid input: non-string value or invalid duration string.
 *
 * @param value ISO 8601 duration string
 * @param locale BCP 47 locale tag, passed to Intl.NumberFormat/Intl.ListFormat; system default if omitted, or a preference list of tags (ECMA-402)
 * @param options How unit names are written, and whether zero components are shown
 * @returns human-readable rendering of the duration, or "" on invalid input
 *
 * @example formatDuration("P1DT2H30M", "en-GB") // "1 day, 2 hours and 30 minutes"
 * @example formatDuration("PT90M", "ja-JP", { style: "short" }) // "90 分"
 * @example formatDuration("PT90M", "hi-IN", { style: "narrow" }) // "90 मि"
 * @example formatDuration("P1DT0H30M", "pt-BR") // "1 dia e 30 minutos"
 * @example formatDuration("PT0S", "en-GB") // "0 seconds"
 * @example formatDuration("-P1DT2H", "pt-BR") // "-1 dia e -2 horas"
 * @example formatDuration("P1DT2H30M", "de-DE") // "1 Tag, 2 Stunden und 30 Minuten"
 * @example formatDuration("PT0.000000001S", "hi-IN") // "0.000000001 सेकंड"
 * @example formatDuration("PT1.123456789S", "ja-JP") // "1.123456789 秒"
 * @example formatDuration(parseDuration("PT1.123456789S", { smallestUnit: "millisecond" }), "en-GB") // "1.123 seconds"
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
    const style = optionOrDefault(options.style, "long");
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
      cachedFormatter("NumberFormat", locale, {
        style: "unit",
        unit: UNIT_TO_INTL[unit],
        unitDisplay: style,
        maximumFractionDigits: 9,
      }).format(amounts[unit]),
    );

    if (parts.length === 0) {
      parts.push(
        cachedFormatter("NumberFormat", locale, {
          style: "unit",
          unit: "second",
          unitDisplay: style,
        }).format(0),
      );
    }

    return cachedFormatter("ListFormat", locale, {
      style: style === "long" ? "long" : "short",
      type: "conjunction",
    }).format(parts);
  } catch {
    return "";
  }
}
