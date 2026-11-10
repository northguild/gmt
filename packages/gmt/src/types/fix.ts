/**
 * How many fraction digits a FIX `UTCTimestamp` states. FIX Latest, `UTCTimestamp`: "3 digits to
 * convey milliseconds, 6 digits to convey microseconds, 9 digits to convey nanoseconds, 12 digits
 * to convey picoseconds"; whole seconds carry no period.
 *
 * | Member          | Fraction digits | FIX wording                       |
 * | --------------- | --------------- | --------------------------------- |
 * | `"second"`      | 0               | "whole seconds", no period        |
 * | `"millisecond"` | 3               | "3 digits to convey milliseconds" |
 * | `"microsecond"` | 6               | "6 digits to convey microseconds" |
 * | `"nanosecond"`  | 9               | "9 digits to convey nanoseconds"  |
 * | `"picosecond"`  | 12              | "12 digits to convey picoseconds" |
 *
 * The type is singular. `formatFixUtcTimestamp` also accepts the plural at run time; the parser
 * always reports the singular.
 *
 * Taken by `formatFixUtcTimestamp`; reported by `parseFixUtcTimestamp` in `FixUtcTimestamp`.
 */
export type FixPrecision =
  | "second"
  | "millisecond"
  | "microsecond"
  | "nanosecond"
  | "picosecond";

/**
 * A FIX `UTCTimestamp` (`YYYYMMDD-HH:MM:SS[.fraction]`) read as an instant plus what the digits
 * stated. Returned by `parseFixUtcTimestamp`.
 */
export interface FixUtcTimestamp {
  /**
   * The moment as an ISO 8601 instant string ending in `Z`, with the fraction digits that were
   * sent, up to the ninth. It keeps the digits sent, so `.100` stays `.100Z`; it is therefore not
   * always the string `Temporal.Instant#toString()` writes. In a leap second it is
   * `…T23:59:60…Z`, which only the `timescale/`, `gnss/` and `finance/` functions read back.
   */
  readonly instant: string;
  /** The precision the digit count stated: 0, 3, 6, 9 or 12 fraction digits. */
  readonly precision: FixPrecision;
  /** Whether the second was `60`, an inserted leap second. */
  readonly leapSecond: boolean;
  /**
   * Digits 10 to 12 of a 12-digit fraction, 0 to 999. `0` for every other precision. Temporal
   * holds nanoseconds, so these are returned apart from `instant`.
   */
  readonly picoseconds: number;
}
