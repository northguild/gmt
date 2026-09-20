import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime, resolveRelativeRounding } from "../../internal";
import type { RelativeTimeFormatOptions, RelativeTimeUnit } from "../../types";
import { isValidTime } from "../validate";

export interface FormatRelativeTimeOptions extends RelativeTimeFormatOptions {
  largestUnit?: RelativeTimeUnit;
}

const AUTO_UNITS: Array<{ unit: RelativeTimeUnit; maxSeconds: number }> = [
  { unit: "second", maxSeconds: 60 },
  { unit: "minute", maxSeconds: 3_600 },
  { unit: "hour", maxSeconds: Infinity },
];

/**
 * Format the relative time between a plain time and a reference time.
 *
 * - Auto-picks the display unit (second/minute/hour) based on the distance, unless
 *   `largestUnit` forces one.
 * - `roundingMethod` controls how the distance rounds to the display unit.
 * - `options` must be an object or omitted: `null` or any other primitive returns `""`, as
 *   Temporal's GetOptionsObject rejects it.
 *
 * @param value ISO time string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: { style, numeric, largestUnit, roundingMethod, reference }
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeTime("14:30:00", "en-US", { style: "short", reference: "16:30:00" }) // "2 hr. ago"
 * @example formatRelativeTime("09:00:00", "en-US", { reference: "10:30:00", roundingMethod: "floor" }) // "2 hours ago" (−1.5 hours floors to −2)
 * @example formatRelativeTime("not-a-time") // ""
 * @example formatRelativeTime("10:00:00", ["fr-FR", "en-US"], { reference: "12:00:00" }) // "il y a 2 heures"
 * @example formatRelativeTime("10:00:00", "en-US", null as never) // "" (null options)
 */
export function formatRelativeTime(
  value: string,
  locale?: string | string[],
  options: FormatRelativeTimeOptions = {},
): string {
  // Temporal GetOptionsObject: options must be an object or omitted; null and other primitives are
  // invalid input.
  if (options === null || typeof options !== "object") return "";
  if (!isValidTime(value)) return "";
  if (options.reference !== undefined && !isValidTime(options.reference))
    return "";

  try {
    const target = Temporal.PlainTime.from(value);
    const reference = options.reference
      ? Temporal.PlainTime.from(options.reference)
      : Temporal.Now.plainTimeISO();

    const diff = target.since(reference);
    const absSeconds = Math.abs(diff.total("second"));

    const unit =
      options.largestUnit === undefined
        ? (AUTO_UNITS.find((t) => absSeconds < t.maxSeconds)?.unit ?? "hour")
        : options.largestUnit;

    const amount = resolveRelativeRounding(
      diff.total(unit),
      options.roundingMethod,
    );

    return normalizeDateTime(
      new Intl.RelativeTimeFormat(locale, {
        numeric: options.numeric === undefined ? "auto" : options.numeric,
        style: options.style === undefined ? "long" : options.style,
      }).format(amount, unit),
    );
  } catch {
    return "";
  }
}
