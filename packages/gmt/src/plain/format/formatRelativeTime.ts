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
 *
 * @param value ISO time string to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { style, numeric, largestUnit, roundingMethod, reference }
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeTime("14:30:00", "en-US", { style: "short" }) // "2 hr. ago"
 * @example formatRelativeTime("09:00:00", "en-US", { reference: "10:30:00", roundingMethod: "floor" }) // "2 hours ago" (−1.5 hours floors to −2)
 * @example formatRelativeTime("not-a-time") // ""
 */
export function formatRelativeTime(
  value: string,
  locale?: string,
  options: FormatRelativeTimeOptions = {},
): string {
  // A default parameter covers only `undefined`; `null` also means "no options".
  options ??= {};
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
      options.largestUnit ??
      AUTO_UNITS.find((t) => absSeconds < t.maxSeconds)?.unit ??
      "hour";

    const amount = resolveRelativeRounding(
      diff.total(unit),
      options.roundingMethod,
    );

    return normalizeDateTime(
      new Intl.RelativeTimeFormat(locale, {
        numeric: options.numeric ?? "auto",
        style: options.style ?? "long",
      }).format(amount, unit),
    );
  } catch {
    return "";
  }
}
