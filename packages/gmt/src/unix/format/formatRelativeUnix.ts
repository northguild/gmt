// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { formatRelativeDuration } from "../../internal/formatRelativeDuration";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import { resolveUnixFormatReference } from "../../internal/unixFormatReference";
import { durationTotal } from "../../internal/zonedWallClockDifference";
import type { RelativeRoundingMethod, RelativeUnit } from "../../types";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Options for `formatRelativeUnix`: the wording of the phrase, the unit and rounding of the
 * distance, and the reference instant, epoch unit and time zone the distance is measured with.
 */
export interface FormatRelativeUnixOptions {
  /**
   * The length of the unit name, as the `style` of `Intl.RelativeTimeFormat`: `"long"` ("in 3
   * months"), `"short"` ("in 3 mo.") or `"narrow"` (the locale's most compact form).
   *
   * @defaultValue `"long"`
   */
  style?: "long" | "short" | "narrow";
  /**
   * Whether a distance may be written as a word instead of a number, as the `numeric` option of
   * `Intl.RelativeTimeFormat`. `"auto"` uses the locale's word where it has one ("yesterday", "next
   * year"); `"always"` writes the number every time ("1 day ago").
   *
   * @defaultValue `"auto"`
   */
  numeric?: "always" | "auto";
  /**
   * The unit the distance is written in, whatever its size, from `"second"` to `"year"`, singular
   * or plural. Omitted, the unit is picked from the distance: second under a minute, minute under
   * an hour, hour under a day, day under 7 days, week under 28, month under 365 and year beyond.
   *
   * @defaultValue None. The unit is picked from the distance.
   */
  largestUnit?: RelativeUnit | `${RelativeUnit}s`;
  /**
   * The way a fractional distance becomes the whole number displayed: `"round"` goes to the nearest
   * whole number, `"floor"` down and `"ceil"` up. It applies to the signed value, where a past
   * distance is negative, so `"floor"` turns −1.5 hours into "2 hours ago".
   *
   * @defaultValue `"round"`
   */
  roundingMethod?: RelativeRoundingMethod;
  /**
   * The unit `value` and a numeric `reference` are counted in: `"seconds"` or `"milliseconds"`,
   * singular or plural. Any other value returns `""`.
   *
   * @defaultValue `"milliseconds"`
   */
  epochUnit?: UnixUnit;
  /**
   * The instant the distance is measured from, as a UTC ISO string, or an epoch in `epochUnit`
   * given as a safe integer or a digit string. Any other value returns `""`.
   *
   * @defaultValue The current instant.
   */
  reference?: string | number;
  /**
   * The time zone that anchors a calendar unit (week, month or year): an IANA name, a UTC offset,
   * or `"local"` for the system time zone. An unknown zone returns `""` whatever the unit, as
   * ECMA-402 throws RangeError for it.
   *
   * @defaultValue `"UTC"`
   */
  timeZone?: string;
}

/**
 * Format the relative time between a unix epoch value and a reference instant.
 *
 * - Auto-picks the display unit based on the distance, unless `largestUnit` forces one: second
 *   under a minute, minute under an hour, hour under a day, then `formatRelativeDate`'s thresholds —
 *   day under 7 days, week under 28, month under 365, year beyond — so a 3-year distance reads
 *   "3 years ago".
 * - **Compatibility:** before 1.16.0 week, month and year were never auto-picked ("1,096 days ago").
 *   Pass `largestUnit: "day"` to keep a day count.
 * - `value` and a numeric `reference` are safe integers or strings of optionally negative ASCII
 *   digits; `largestUnit` and `epochUnit` accept singular or plural names.
 * - `options` must be an object or omitted: `null` returns `""`, as Temporal's GetOptionsObject
 *   rejects it.
 *
 * @param value unix epoch (string or number, per `epochUnit`) to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: the wording, the unit and rounding of the distance, and what it is measured from
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeUnix(1710685845000, "en-US", { epochUnit: "milliseconds", reference: 1805358645000 }) // "3 years ago"
 * @example formatRelativeUnix(1710685845000, "en-US", { epochUnit: "milliseconds", reference: 1805358645000, largestUnit: "day" }) // "1,096 days ago"
 * @example formatRelativeUnix(0, "en-US", { reference: 37800000, roundingMethod: "floor" }) // "11 hours ago" (−10.5 hours floors to −11; the default rounds to 10)
 * @example formatRelativeUnix("0", "en-US", { reference: "1800", epochUnit: "second", largestUnit: "minutes" }) // "30 minutes ago"
 * @example formatRelativeUnix(0, "en-US", { reference: 1800000, timeZone: "Invalid/Zone" }) // ""
 * @example formatRelativeUnix(0, "en-US", null as never) // ""
 * @example formatRelativeUnix("not-a-number") // ""
 * @example formatRelativeUnix(1709163000000, ["fr-FR", "en-US"], { reference: 1709164800000 }) // "il y a 30 minutes"
 */
export function formatRelativeUnix(
  value: string | number,
  locale?: string | string[],
  options: FormatRelativeUnixOptions = {},
): string {
  try {
    // Temporal GetOptionsObject: undefined is defaults (the parameter default); anything else that is
    // not an object, including null, is a TypeError.
    if (options === null || typeof options !== "object") return "";
    const epochUnit = resolveUnixEpochUnit(options.epochUnit);
    if (epochUnit === null) return "";
    const tz = normalizeTimeZone(options.timeZone);
    if (!tz) return "";

    const target = unixEpochToInstant(value, epochUnit);
    if (target === null) return "";

    const reference = resolveUnixFormatReference(options.reference, epochUnit);
    if (reference === null) return "";

    try {
      const diff = target.since(reference);
      // month/year are calendrical and need a relativeTo anchor.
      return formatRelativeDuration(diff, locale, options, (unit) =>
        durationTotal(diff, unit, reference.toZonedDateTimeISO(tz)),
      );
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
