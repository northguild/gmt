import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";

import { intervalLengthDateTime } from "../plain";
import { intervalLengthUtc } from "../utc";
import { intervalLengthZoned } from "../zoned";

/**
 * `intervalLength*` in calendar units, against an oracle built only from `add` and instant
 * subtraction.
 *
 * The per-function suites compare these values with `until` and `Duration.total` — the same
 * primitives the implementations call — so a bug inside those primitives would agree with itself.
 * The oracle here is the spec definition written out longhand instead (Temporal's
 * TotalRelativeDuration): the whole part is how many whole units fit, and the fraction is how far
 * into the next one the end lands, measured against that particular unit's own length. A calendar
 * unit's length varies — February, a 53-week year, a 23-hour DST day — so the denominator is
 * recomputed for every case rather than assumed.
 */

const CALENDAR_UNITS = ["year", "month", "week", "day"] as const;

const SPANS = [
  ["2024-01-01T00:00:00", "2024-03-01T00:00:00"],
  ["2024-01-31T00:00:00", "2024-02-29T12:00:00"],
  ["2023-02-28T00:00:00", "2024-02-29T06:00:00"],
  ["2024-02-29T00:00:00", "2025-02-28T00:00:00"],
  ["2024-01-01T23:59:00", "2024-01-02T00:01:00"],
  ["2024-11-01T00:00:00", "2024-11-30T13:45:30"],
  ["2024-03-09T12:00:00", "2024-03-11T12:00:00"],
  ["2024-11-02T12:00:00", "2024-11-04T12:00:00"],
  ["1970-01-01T00:00:00", "2024-07-04T09:15:00"],
] as const;

const NEW_YORK = "America/New_York";

const nanosecondsBetween = (
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
): bigint =>
  to.toInstant().epochNanoseconds - from.toInstant().epochNanoseconds;

/**
 * Whole units that fit in [from, to], plus the fraction of the next one the remainder covers.
 * Uses only `add`, so it shares no code path with `until` or `Duration.total`.
 */
function lengthOracle(
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
  unit: (typeof CALENDAR_UNITS)[number],
): number {
  let whole = 0;
  while (nanosecondsBetween(from.add({ [`${unit}s`]: whole + 1 }), to) >= 0n) {
    whole += 1;
  }

  const reached = from.add({ [`${unit}s`]: whole });
  const next = from.add({ [`${unit}s`]: whole + 1 });
  const remainder = nanosecondsBetween(reached, to);
  if (remainder === 0n) {
    return whole;
  }

  const unitLength = nanosecondsBetween(reached, next);
  return whole + Number(remainder) / Number(unitLength);
}

describe("intervalLength in calendar units matches a longhand oracle", () => {
  for (const [start, end] of SPANS) {
    for (const unit of CALENDAR_UNITS) {
      it(`${unit} from ${start}Z to ${end}Z (Utc)`, () => {
        const from = Temporal.Instant.from(`${start}Z`).toZonedDateTimeISO(
          "UTC",
        );
        const to = Temporal.Instant.from(`${end}Z`).toZonedDateTimeISO("UTC");

        expect(intervalLengthUtc(`${start}Z`, `${end}Z`, unit)).toBeCloseTo(
          lengthOracle(from, to, unit),
          10,
        );
      });

      it(`${unit} from ${start} to ${end} (DateTime)`, () => {
        const from = Temporal.PlainDateTime.from(start).toZonedDateTime("UTC");
        const to = Temporal.PlainDateTime.from(end).toZonedDateTime("UTC");

        expect(intervalLengthDateTime(start, end, unit)).toBeCloseTo(
          lengthOracle(from, to, unit),
          10,
        );
      });

      it(`${unit} from ${start} to ${end} (Zoned, ${NEW_YORK})`, () => {
        const from =
          Temporal.PlainDateTime.from(start).toZonedDateTime(NEW_YORK);
        const to = Temporal.PlainDateTime.from(end).toZonedDateTime(NEW_YORK);

        expect(
          intervalLengthZoned(from.toString(), to.toString(), unit),
        ).toBeCloseTo(lengthOracle(from, to, unit), 10);
      });
    }
  }
});
