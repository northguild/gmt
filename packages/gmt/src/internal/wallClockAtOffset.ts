import type { Temporal } from "@js-temporal/polyfill";

/**
 * The wall clock an instant reads at a fixed UTC offset, including a sub-minute or fractional
 * one. Callers write the offset text themselves.
 *
 * The shift happens on the wall clock, never on the instant: a `PlainDateTime` reaches a day
 * further either side than an `Instant` does (TC39 `ISODateTimeWithinLimits` against
 * `IsValidEpochNanoseconds`), so shifting the instant first would reject the last 14 hours of
 * the representable range, where `+275760-09-13T00:00:00Z` at `+14:00` names a local time that
 * exists. No offset time zone is built either: Temporal's offset time-zone identifiers are
 * minute precision, and an offset such as `-00:44:30` or `+05:30:15.25` is not.
 *
 * Throws what Temporal throws; callers wrap it in their own try/catch.
 *
 * @param instant the exact time
 * @param offsetNanoseconds UTC offset in nanoseconds, east positive
 * @returns the local wall clock at that offset
 *
 * @example wallClockAtOffset(Temporal.Instant.from("1970-01-01T00:00:00Z"), -2_670_000_000_000n).toString() // "1969-12-31T23:15:30"
 * @example wallClockAtOffset(Temporal.Instant.from("+275760-09-13T00:00:00Z"), 50_400_000_000_000n).toString() // "+275760-09-13T14:00:00"
 */
export function wallClockAtOffset(
  instant: Temporal.Instant,
  offsetNanoseconds: bigint,
): Temporal.PlainDateTime {
  return instant
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime()
    .add({ nanoseconds: Number(offsetNanoseconds) });
}
