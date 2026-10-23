import { floorDivide } from "./floorDivide";
import { NANOSECONDS_PER_DAY } from "./foreignEpochs";
import { plainDateTimeOf } from "./inputChecks";
import { Temporal } from "./temporal";

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
 * (an Arrow `Timestamp` with no time zone), or `null` for text `isValidDateTime` rejects (an
 * offset, a leap second, a non-ISO calendar). A bracketed time zone is ignored. Counting whole
 * days, then the time of day, covers every `PlainDateTime`, including the day past each end of
 * the instant range that `toZonedDateTime` refuses.
 */
export function wallClockNanoseconds(value: unknown): bigint | null {
  // Whole days plus a time-of-day remainder under a day, which `total` gives exactly.
  const sinceEpoch = plainDateTimeOf(value as string)?.since("1970-01-01");

  return sinceEpoch
    ? BigInt(sinceEpoch.days) * NANOSECONDS_PER_DAY +
        BigInt(sinceEpoch.with({ days: 0 }).total("nanoseconds"))
    : null;
}

/**
 * The wall-clock date-time string for nanoseconds since the Unix epoch, the inverse of
 * `wallClockNanoseconds`. "" for `null` and for a count outside the `PlainDateTime` range.
 */
export function wallClockString(nanoseconds: bigint | null): string {
  if (nanoseconds === null) {
    return "";
  }

  try {
    // The days and the remainder share a sign, and each is exact as a `Number`; `add` throws
    // past the `PlainDateTime` range.
    return new Temporal.PlainDateTime(1970, 1, 1)
      .add({
        days: Number(nanoseconds / NANOSECONDS_PER_DAY),
        nanoseconds: Number(nanoseconds % NANOSECONDS_PER_DAY),
      })
      .toString();
  } catch {
    return "";
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
 * value: `parseInstantNanoseconds` and `wallClockNanoseconds` return only in-range counts.
 */
export function arrowCount(nanoseconds: bigint | null, unit: unknown): bigint {
  const factor = arrowUnitFactor(unit);
  const result =
    factor !== null && nanoseconds !== null
      ? floorDivide(nanoseconds, factor)
      : 0n;

  return fitsInt64(result) ? result : 0n;
}
