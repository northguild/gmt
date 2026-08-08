import { Temporal } from "@js-temporal/polyfill";

/**
 * Parse and re-normalize an ISO 8601 duration string.
 *
 * - Uses Temporal.Duration.from to parse, then .toString() to re-emit.
 * - `smallestUnit`, `fractionalSecondDigits`, and `roundingMode` control the precision/rounding
 *   of the re-emitted string, per Temporal's ToStringPrecisionOptions.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 duration string
 * @param options optional: smallestUnit ("second" | "millisecond" | "microsecond" | "nanosecond" — "minute"/"hour" are rejected by Temporal, resulting in ""), fractionalSecondDigits ("auto" | 0-9, ignored when smallestUnit is also set), roundingMode
 * @returns re-normalized ISO 8601 duration string, or "" on invalid input
 *
 * @example parseDuration("P1DT2H30M") // "P1DT2H30M"
 * @example parseDuration("PT1.5S") // "PT1.5S"
 * @example parseDuration("PT1.5S", { smallestUnit: "second" }) // "PT1S"
 * @example parseDuration("PT1.5S", { fractionalSecondDigits: 3 }) // "PT1.500S"
 * @example parseDuration("invalid") // ""
 */
export function parseDuration(
  value: string,
  options?: {
    smallestUnit?: Temporal.ToStringPrecisionOptions["smallestUnit"];
    fractionalSecondDigits?: Temporal.ToStringPrecisionOptions["fractionalSecondDigits"];
    roundingMode?: Temporal.ToStringPrecisionOptions["roundingMode"];
  },
): string {
  if (typeof value !== "string") {
    return "";
  }

  try {
    const duration = Temporal.Duration.from(value);
    return duration.toString({
      smallestUnit: options?.smallestUnit,
      fractionalSecondDigits: options?.fractionalSecondDigits,
      roundingMode: options?.roundingMode,
    });
  } catch {
    return "";
  }
}
