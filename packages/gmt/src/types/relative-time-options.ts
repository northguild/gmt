import type { RelativeRoundingMethod } from "./relative-rounding-method";

/**
 * Core fields shared by all relative-time formatting interfaces.
 * Each domain variant (plain, unix, utc, zoned) extends this and may
 * restrict `largestUnit` or add domain-specific fields.
 */
export interface RelativeTimeFormatOptions {
  /** Name style: "long" (default), "short", or "narrow". */
  style?: "long" | "short" | "narrow";
  /** Whether to use relative time words ("in 2 days") or numeric ("2 days"). */
  numeric?: "always" | "auto";
  /** The largest unit to display. Each domain restricts the allowed values. */
  largestUnit?: string;
  /** How the computed distance rounds to the display unit. */
  roundingMethod?: RelativeRoundingMethod;
  /** Anchor point for the relative diff. */
  reference?: string;
}
