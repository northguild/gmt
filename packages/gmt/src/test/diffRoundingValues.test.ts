import { describe, expect, it } from "vitest";

import { diffUtc } from "../utc";

/**
 * The *values* `diff*` returns when its rounding options are used, not just that the options are
 * accepted or rejected.
 *
 * The per-function suites pin a handful of rounded results; this one computes the answer longhand
 * for every Temporal rounding mode. A UTC span in time units is an exact number of nanoseconds, so
 * the expected value is integer arithmetic on that count — no Temporal call, and no GMT call, takes
 * part in producing it.
 *
 * Temporal's rounding modes are defined in "Rounding Modes" (RoundNumberToIncrement): the four
 * directed modes, the four half modes, and `halfEven`. `expand` and `halfExpand` move away from
 * zero, `ceil`/`floor` towards +∞/−∞, and `trunc` towards zero, so every mode is exercised in both
 * directions by measuring each span forwards and backwards.
 */

const MODES = [
  "ceil",
  "floor",
  "expand",
  "trunc",
  "halfCeil",
  "halfFloor",
  "halfExpand",
  "halfTrunc",
  "halfEven",
] as const;

/**
 * Each unit's length in nanoseconds, with increments that Temporal accepts for it: TC39
 * ValidateTemporalRoundingIncrement requires the increment to divide the next larger unit's length
 * and to be smaller than it, so hours take divisors of 24 and milliseconds divisors of 1000.
 */
const UNITS = {
  hours: { size: 3_600_000_000_000n, increments: [1, 2, 4, 12] },
  minutes: { size: 60_000_000_000n, increments: [1, 2, 5, 15, 30] },
  seconds: { size: 1_000_000_000n, increments: [1, 2, 5, 15, 30] },
  milliseconds: { size: 1_000_000n, increments: [1, 2, 5, 100, 500] },
} as const;

/** Spans whose remainders land below, on and above the half-way point of each unit. */
const SPANS = [
  ["2024-06-15T00:00:00Z", "2024-06-15T02:20:00Z"],
  ["2024-06-15T00:00:00Z", "2024-06-15T02:30:00Z"],
  ["2024-06-15T00:00:00Z", "2024-06-15T02:40:00Z"],
  ["2024-06-15T00:00:00Z", "2024-06-15T03:30:00Z"],
  ["2024-06-15T00:00:00Z", "2024-06-15T00:00:30.5Z"],
  ["2024-06-15T00:00:00Z", "2024-06-15T00:07:29.999999999Z"],
  ["2024-06-15T00:00:00Z", "2024-06-15T00:00:00.0005Z"],
  ["2024-06-15T00:00:00Z", "2024-06-15T11:59:59.999999999Z"],
] as const;

/**
 * TC39 RoundNumberToIncrement, written out for an exact rational `numerator / denominator`.
 * Returns the rounded quotient as a bigint.
 */
function roundQuotient(
  numerator: bigint,
  denominator: bigint,
  mode: (typeof MODES)[number],
): bigint {
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  const quotient = magnitude / denominator;
  const remainder = magnitude - quotient * denominator;

  if (remainder === 0n) {
    return negative ? -quotient : quotient;
  }

  // `up` is one step further from zero; the modes then pick between it and `quotient`.
  const twice = remainder * 2n;
  const roundedMagnitude = ((): bigint => {
    switch (mode) {
      case "expand":
        return quotient + 1n;
      case "trunc":
        return quotient;
      case "ceil":
        return negative ? quotient : quotient + 1n;
      case "floor":
        return negative ? quotient + 1n : quotient;
      case "halfExpand":
        return twice >= denominator ? quotient + 1n : quotient;
      case "halfTrunc":
        return twice > denominator ? quotient + 1n : quotient;
      case "halfCeil":
        return twice > denominator || (twice === denominator && !negative)
          ? quotient + 1n
          : quotient;
      case "halfFloor":
        return twice > denominator || (twice === denominator && negative)
          ? quotient + 1n
          : quotient;
      case "halfEven":
        if (twice > denominator) return quotient + 1n;
        if (twice < denominator) return quotient;
        return quotient % 2n === 0n ? quotient : quotient + 1n;
    }
  })();

  return negative ? -roundedMagnitude : roundedMagnitude;
}

const epochNanoseconds = (utc: string): bigint => {
  const [datePart, timePart] = utc.replace("Z", "").split("T");
  const [seconds, fraction = ""] = timePart.split(".");
  const wholeMs = Date.parse(`${datePart}T${seconds}Z`);
  return BigInt(wholeMs) * 1_000_000n + BigInt(fraction.padEnd(9, "0"));
};

describe("diffUtc rounds to the value Temporal's rounding modes define", () => {
  for (const [unit, { size, increments }] of Object.entries(UNITS)) {
    for (const [start, end] of SPANS) {
      for (const increment of increments) {
        for (const mode of MODES) {
          const forward = epochNanoseconds(end) - epochNanoseconds(start);
          const step = size * BigInt(increment);

          it(`${unit} x${increment} ${mode}: ${start} to ${end}`, () => {
            expect(
              diffUtc(start, end, unit as never, {
                smallestUnit: unit as never,
                roundingIncrement: increment,
                roundingMode: mode,
              }),
            ).toBe(
              Number(roundQuotient(forward, step, mode) * BigInt(increment)),
            );

            // The same span backwards, so each mode is checked on a negative value too.
            expect(
              diffUtc(end, start, unit as never, {
                smallestUnit: unit as never,
                roundingIncrement: increment,
                roundingMode: mode,
              }),
            ).toBe(
              Number(roundQuotient(-forward, step, mode) * BigInt(increment)),
            );
          });
        }
      }
    }
  }
});
