import type { Temporal } from "./temporal";

const NANOSECONDS_PER_SECOND = 1_000_000_000n;

/**
 * The duration's seconds plus its sub-second fields as an exact decimal string.
 *
 * Summed in bigint nanoseconds, not float seconds: Temporal allows seconds up to 2^53 - 1 with 9
 * fraction digits (IsValidDuration), which a float cannot hold. ECMA-402 Intl.NumberFormat accepts
 * a decimal string and formats it without converting to a Number (ToIntlMathematicalValue).
 * Returns "0", never "-0", for a zero amount, so a negative duration's zero seconds renders as 0.
 */
export function exactSeconds(
  duration: Temporal.Duration,
): Intl.StringNumericLiteral {
  const total =
    BigInt(duration.seconds) * NANOSECONDS_PER_SECOND +
    BigInt(duration.milliseconds) * 1_000_000n +
    BigInt(duration.microseconds) * 1_000n +
    BigInt(duration.nanoseconds);
  const magnitude = total < 0n ? -total : total;
  const whole = magnitude / NANOSECONDS_PER_SECOND;
  const fraction = (magnitude % NANOSECONDS_PER_SECOND)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  const sign = total < 0n ? "-" : "";
  return `${sign}${whole}${fraction === "" ? "" : `.${fraction}`}` as Intl.StringNumericLiteral;
}
