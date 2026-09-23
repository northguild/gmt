import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";

import { diffDateTime } from "../plain";
import { diffUtc } from "../utc";
import { diffZoned } from "../zoned";

/**
 * The `diff*` carry rule, checked by reconstruction instead of by a pinned table.
 *
 * A difference record is correct when two things hold for the listed units:
 *
 * 1. **Exactness** — adding the whole record to `start`, unit by unit from largest to smallest,
 *    lands on or before `end`.
 * 2. **Maximality** — adding one more of the *smallest listed* unit would pass `end`.
 *
 * Together those pin the amount of every unit, including the ones the caller skipped: a unit's
 * amount has to absorb everything the units above it left behind. That is the property the
 * per-function tables cover only for adjacent units, so the unit lists here are deliberately
 * gappy ("years" straight to "seconds", "weeks" straight to "minutes").
 *
 * The reconstruction uses Temporal directly rather than any GMT helper, so a bug shared between
 * `differenceRecord` and its `add`/`until` operations cannot hide from it.
 */

const UNIT_LISTS = [
  ["years", "seconds"],
  ["years", "nanoseconds"],
  ["years", "weeks"],
  ["years", "days", "microseconds"],
  ["years", "months", "nanoseconds"],
  ["months", "hours"],
  ["months", "weeks", "milliseconds"],
  ["weeks", "minutes"],
  ["weeks", "seconds"],
  ["days", "nanoseconds"],
  ["hours", "microseconds"],
  ["years", "months", "days"],
  ["years", "months", "weeks", "days", "hours", "minutes", "seconds"],
] as const;

/** Spans chosen to cross leap days, month ends of differing length, and year boundaries. */
const SPANS = [
  ["2024-01-01T00:00:00", "2025-03-01T00:00:00"],
  ["2024-01-31T00:00:00", "2024-03-31T23:59:59.999999999"],
  ["2023-02-28T12:00:00", "2024-02-29T12:00:00"],
  ["2024-02-29T23:59:59.999999999", "2028-02-29T00:00:00.000000001"],
  ["2020-12-31T23:59:59", "2021-01-01T00:00:00.000000001"],
  ["1999-06-15T08:30:00.123456789", "2024-06-14T08:29:59.987654321"],
  ["2024-03-09T00:00:00", "2024-03-12T00:00:00"],
  ["2024-11-01T00:00:00", "2024-11-05T00:00:00"],
] as const;

const NEW_YORK = "America/New_York";

/** Nanoseconds in each fixed-length unit; the calendar units above "days" have no fixed size. */
const NANOSECONDS_IN: Readonly<Record<string, bigint>> = {
  hours: 3_600_000_000_000n,
  minutes: 60_000_000_000n,
  seconds: 1_000_000_000n,
  milliseconds: 1_000_000n,
  microseconds: 1_000n,
  nanoseconds: 1n,
};

/** One of the listed unit, as a Temporal duration-like. */
const oneOf = (unit: string): Record<string, number> => ({ [unit]: 1 });

/** The record's units above its smallest, which the smallest unit then measures out from. */
const aboveSmallest = (
  record: Record<string, number>,
  units: readonly string[],
): Record<string, number> =>
  Object.fromEntries(units.slice(0, -1).map((unit) => [unit, record[unit]]));

const asRecord = (result: unknown): Record<string, number> => {
  expect(typeof result).toBe("object");
  expect(result).not.toBeNull();
  return result as Record<string, number>;
};

/**
 * Check one difference record against `end`.
 *
 * In the exact range the record reconstructs the span: adding it lands on or before `end`, and one
 * more of the smallest unit passes it.
 *
 * Past that range it cannot, and GMT documents why: a `number`-valued count of a sub-second unit
 * stops being an exact integer above 2^53 - 1 (about 104 days in nanoseconds), so the answer is
 * the nearest double to the true count. That case is pinned here rather than skipped — the record
 * must equal exactly that nearest double, so a real arithmetic bug still fails the test while the
 * documented representation limit does not.
 */
function expectRecordMeasures(
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
  record: Record<string, number>,
  units: readonly string[],
): void {
  const smallest = units[units.length - 1];
  const size = NANOSECONDS_IN[smallest];
  const origin = from.add(aboveSmallest(record, units));
  const remainder =
    to.toInstant().epochNanoseconds - origin.toInstant().epochNanoseconds;
  const exactCount = size === undefined ? 0n : remainder / size;

  if (size !== undefined && exactCount > BigInt(Number.MAX_SAFE_INTEGER)) {
    expect(record[smallest]).toBe(Number(exactCount));
    return;
  }

  const landed = from.add(record);
  const overshoot = landed.add(oneOf(smallest));

  expect(Temporal.ZonedDateTime.compare(landed, to)).toBeLessThanOrEqual(0);
  expect(Temporal.ZonedDateTime.compare(overshoot, to)).toBeGreaterThan(0);
}

describe("difference records reconstruct their span", () => {
  describe("diffDateTime", () => {
    for (const [start, end] of SPANS) {
      for (const units of UNIT_LISTS) {
        it(`${units.join("+")} from ${start} to ${end}`, () => {
          const record = asRecord(diffDateTime(start, end, [...units]));
          expect(Object.keys(record).sort()).toEqual([...units].sort());

          // A plain datetime has no zone, so UTC walks its wall clock unchanged.
          expectRecordMeasures(
            Temporal.PlainDateTime.from(start).toZonedDateTime("UTC"),
            Temporal.PlainDateTime.from(end).toZonedDateTime("UTC"),
            record,
            units,
          );
        });
      }
    }
  });

  describe("diffUtc", () => {
    for (const [start, end] of SPANS) {
      for (const units of UNIT_LISTS) {
        it(`${units.join("+")} from ${start}Z to ${end}Z`, () => {
          const record = asRecord(diffUtc(`${start}Z`, `${end}Z`, [...units]));

          expectRecordMeasures(
            Temporal.Instant.from(`${start}Z`).toZonedDateTimeISO("UTC"),
            Temporal.Instant.from(`${end}Z`).toZonedDateTimeISO("UTC"),
            record,
            units,
          );
        });
      }
    }
  });

  describe("diffZoned across DST", () => {
    for (const [start, end] of SPANS) {
      for (const units of UNIT_LISTS) {
        it(`${units.join("+")} from ${start} to ${end} in ${NEW_YORK}`, () => {
          const from =
            Temporal.PlainDateTime.from(start).toZonedDateTime(NEW_YORK);
          const to = Temporal.PlainDateTime.from(end).toZonedDateTime(NEW_YORK);
          const record = asRecord(
            diffZoned(from.toString(), to.toString(), [...units]),
          );

          expectRecordMeasures(from, to, record, units);
        });
      }
    }
  });
});
