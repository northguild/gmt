import type { Temporal } from "@js-temporal/polyfill";

/** The nine rounding modes of Temporal's GetRoundingModeOption (Temporal §14.5.2.2). */
const ROUNDING_MODES: readonly unknown[] = [
  "ceil",
  "floor",
  "expand",
  "trunc",
  "halfCeil",
  "halfFloor",
  "halfExpand",
  "halfTrunc",
  "halfEven",
];

/**
 * Read `roundingIncrement` and `roundingMode` the way Temporal does, for a rounding GMT computes
 * itself (a date unit that Temporal's own `round()` does not accept).
 *
 * - `roundingIncrement` follows GetRoundingIncrementOption: `undefined` is 1; any other value is
 *   truncated towards zero (ToIntegerWithTruncation), and a non-finite value or one below 1 after
 *   truncation is rejected.
 * - `roundingMode` follows GetRoundingModeOption: `undefined` is `"halfExpand"`; a value outside the
 *   nine modes is rejected.
 *
 * @param roundingIncrement caller-supplied increment
 * @param roundingMode caller-supplied rounding mode
 * @returns the resolved increment and mode, or null when Temporal would throw a RangeError
 *
 * @example resolveManualRoundingOptions(1.5, undefined) // { increment: 1, mode: "halfExpand" }
 * @example resolveManualRoundingOptions(0.9, "floor") // null
 * @example resolveManualRoundingOptions(2, "bogus" as never) // null
 */
export function resolveManualRoundingOptions(
  roundingIncrement: number | undefined,
  roundingMode: Temporal.RoundingMode | undefined,
): { increment: number; mode: Temporal.RoundingMode } | null {
  const increment =
    roundingIncrement === undefined ? 1 : Math.trunc(roundingIncrement);
  if (!Number.isFinite(increment) || increment < 1) return null;

  if (roundingMode !== undefined && !ROUNDING_MODES.includes(roundingMode)) {
    return null;
  }

  return { increment, mode: roundingMode ?? "halfExpand" };
}
