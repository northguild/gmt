import type { Temporal } from "@js-temporal/polyfill";

// Precision options for Temporal.Duration.prototype.toString(), kept separate from
// RoundingOptions because both option sets have colliding smallestUnit/roundingMode keys
// with different Temporal types (DifferenceOptions vs ToStringPrecisionOptions).
export type DurationStringOptions = {
  toStringSmallestUnit?: Temporal.ToStringPrecisionOptions["smallestUnit"];
  fractionalSecondDigits?: Temporal.ToStringPrecisionOptions["fractionalSecondDigits"];
  toStringRoundingMode?: Temporal.ToStringPrecisionOptions["roundingMode"];
};
