import type { RelativeRoundingMethod } from "./relative-rounding-method";

/**
 * Core fields shared by all relative-time formatting interfaces.
 * Each domain variant (plain, unix, utc, zoned) extends this and may
 * restrict `largestUnit` or add domain-specific fields.
 */
export interface RelativeTimeFormatOptions {
  /**
   * The length of the unit name, as the `style` of `Intl.RelativeTimeFormat`: `"long"` ("in 3
   * months"), `"short"` ("in 3 mo.") or `"narrow"` (the locale's most compact form).
   *
   * @defaultValue `"long"`
   */
  style?: "long" | "short" | "narrow";
  /**
   * Whether a distance may be written as a word instead of a number, as the `numeric` option of
   * `Intl.RelativeTimeFormat`. `"auto"` uses the locale's word where it has one ("yesterday",
   * "next year"); `"always"` writes the number every time ("1 day ago").
   *
   * @defaultValue `"auto"`
   */
  numeric?: "always" | "auto";
  /**
   * The one unit the distance is written in, whatever its size, so `"hour"` renders a day and a
   * half as "in 36 hours". Each domain restricts the allowed values to the units its values have,
   * singular or plural; any other value returns `""`.
   *
   * @defaultValue None. The unit is picked from the distance.
   */
  largestUnit?: string;
  /**
   * The way a fractional distance becomes the whole number displayed: `"round"` goes to the nearest
   * whole number, `"floor"` down and `"ceil"` up. It applies to the signed value, where a past
   * distance is negative, so `"floor"` turns −1.5 hours into "2 hours ago".
   *
   * @defaultValue `"round"`
   */
  roundingMethod?: RelativeRoundingMethod;
  /**
   * The moment the distance is measured from, as an ISO string in the same form as the value
   * being formatted.
   *
   * @defaultValue The current date and time.
   */
  reference?: string;
}
