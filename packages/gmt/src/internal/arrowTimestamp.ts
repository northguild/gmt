import { floorDivide } from "./floorDivide";
import { plainDateTimeOf } from "./inputChecks";

// Arrow Schema.fbs `enum TimeUnit`, finest first: each step is 1000 times the one before.
const units = ["nanosecond", "microsecond", "millisecond", "second"];

/** Nanoseconds in one Arrow `TimeUnit`, singular or plural; `null` for anything else. */
function arrowUnitFactor(unit: unknown): bigint | null {
  const index =
    typeof unit === "string" ? units.indexOf(unit.replace(/s$/, "")) : -1;

  return index < 0 ? null : 1000n ** BigInt(index);
}

/**
 * The nanoseconds since the Unix epoch of a plain ISO wall-clock date-time read as if it were UTC
 * (an Arrow `Timestamp` with no time zone). `null` for text `isValidDateTime` rejects (an
 * offset, a leap second, a non-ISO calendar) and for a wall time outside the instant range.
 * A bracketed time zone is ignored.
 */
export function wallClockNanoseconds(value: unknown): bigint | null {
  const dateTime = plainDateTimeOf(value as string);

  try {
    return dateTime && dateTime.toZonedDateTime("UTC").epochNanoseconds;
  } catch {
    return null;
  }
}

/** Whether `nanoseconds` is a count an Arrow `int64` of nanoseconds can hold. */
export function fitsInt64(nanoseconds: unknown): boolean {
  return (
    typeof nanoseconds === "bigint" &&
    BigInt.asIntN(64, nanoseconds) === nanoseconds
  );
}

/**
 * The epoch nanoseconds an Arrow `int64` `value` in `unit` names, or `null` when `value` is not
 * an `int64` bigint or `unit` is not an Arrow `TimeUnit`. The range of instants is not checked.
 */
export function arrowNanoseconds(value: unknown, unit: unknown): bigint | null {
  const factor = arrowUnitFactor(unit);

  return factor !== null && fitsInt64(value)
    ? (value as bigint) * factor
    : null;
}

/**
 * The Arrow `int64` count for epoch nanoseconds in one unit (floored toward negative infinity),
 * or `0n` when the input, the unit or the result is invalid. The caller has range-checked the
 * instant: `parseInstantNanoseconds` and `wallClockNanoseconds` return only in-range counts.
 */
export function arrowCount(nanoseconds: bigint | null, unit: unknown): bigint {
  const factor = arrowUnitFactor(unit);
  const result =
    factor !== null && nanoseconds !== null
      ? floorDivide(nanoseconds, factor)
      : 0n;

  return fitsInt64(result) ? result : 0n;
}
