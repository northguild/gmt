// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { formatRelativeDuration } from "../../internal/formatRelativeDuration";
import type {
  RelativeDateTimeUnit,
  RelativeTimeFormatOptions,
} from "../../types";
import { isValidDateTime } from "../validate";

export interface FormatRelativeDateTimeOptions extends RelativeTimeFormatOptions {
  largestUnit?: RelativeDateTimeUnit;
}

/**
 * Format the relative time between a plain date-time and a reference date-time.
 *
 * - Auto-picks the display unit based on the distance, unless `largestUnit` forces one: second
 *   under a minute, minute under an hour, hour under a day, then `formatRelativeDate`'s thresholds —
 *   day under 7 days, week under 28, month under 365, year beyond — so a 3-year distance reads
 *   "3 years ago".
 * - **Compatibility:** before 1.16.0 week, month and year were never auto-picked ("1,096 days ago").
 *   Pass `largestUnit: "day"` to keep a day count.
 * - `roundingMethod` controls how the distance rounds to the display unit.
 * - `options` must be an object or omitted: `null` or any other primitive returns `""`, as
 *   Temporal's GetOptionsObject rejects it.
 *
 * @param value ISO date-time string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: { style, numeric, largestUnit, roundingMethod, reference }
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeDateTime("2026-03-17T09:00:00", "en-GB", { style: "long" }) // "in 3 hours"
 * @example formatRelativeDateTime("2026-01-15T00:00:00", "en-US", { reference: "2026-01-15T10:30:00", roundingMethod: "floor" }) // "11 hours ago" (−10.5 hours floors to −11; the default rounds to 10)
 * @example formatRelativeDateTime("2021-03-15T12:00:00", "en-US", { reference: "2024-03-15T12:00:00" }) // "3 years ago"
 * @example formatRelativeDateTime("not-a-date") // ""
 * @example formatRelativeDateTime("2024-03-15T09:00:00", ["fr-FR", "en-US"], { reference: "2024-03-15T12:00:00" }) // "il y a 3 heures"
 * @example formatRelativeDateTime("2024-03-12T10:00:00", "en-US", null as never) // "" (null options)
 */
export function formatRelativeDateTime(
  value: string,
  locale?: string | string[],
  options: FormatRelativeDateTimeOptions = {},
): string {
  // Temporal GetOptionsObject: options must be an object or omitted; null and other primitives are
  // invalid input.
  if (options === null || typeof options !== "object") return "";
  if (!isValidDateTime(value)) return "";
  if (options.reference !== undefined && !isValidDateTime(options.reference))
    return "";

  try {
    const target = Temporal.PlainDateTime.from(value);
    const reference = options.reference
      ? Temporal.PlainDateTime.from(options.reference)
      : Temporal.Now.plainDateTimeISO();

    const diff = target.since(reference);
    // month/year are calendrical — relativeTo needs a PlainDate
    return formatRelativeDuration(diff, locale, options, (unit) =>
      diff.total({ unit, relativeTo: reference.toPlainDate() }),
    );
  } catch {
    return "";
  }
}
