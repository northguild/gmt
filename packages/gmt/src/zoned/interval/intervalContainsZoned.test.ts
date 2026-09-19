import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import {
  battleTestTimeZones,
  sameInstantBattleCases,
} from "../../test/timeZoneMatrix";
import { intervalContainsZoned } from "./intervalContainsZoned";

describe("intervalContainsZoned", () => {
  it.each`
    intervalStart                       | intervalEnd                         | pointOrStart                        | pointEnd     | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${undefined} | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${undefined} | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${undefined} | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${undefined} | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2023-12-01T00:00:00+00:00[UTC]"} | ${undefined} | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${undefined} | ${false}
  `(
    "returns $expected for point $pointOrStart in zoned interval $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsZoned(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart                       | intervalEnd                         | innerStart                          | innerEnd                            | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"2024-09-01T00:00:00+00:00[UTC]"} | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${false}
    ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2023-12-01T00:00:00+00:00[UTC]"} | ${"2024-06-15T00:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-06-15T00:00:00+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-06-15T00:00:00+00:00[UTC]"} | ${"2024-06-10T00:00:00+00:00[UTC]"} | ${false}
  `(
    "returns $expected for inner interval $innerStart to $innerEnd inside $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsZoned(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  // Half-open [start, end) (coding-standards § 8; A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z,
  // D = 17:00Z). A point is inside when `start <= point < end`, as in `intervalContains`. An inner
  // interval is inside when the two overlap and `outerStart <= innerStart && innerEnd <= outerEnd`,
  // so an empty inner interval counts only strictly inside — as `clampInterval` clamps it to itself
  // there and to `null` at an edge.
  it.each`
    intervalStart                       | intervalEnd                         | pointOrStart                                     | pointEnd                                      | expected | reason
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${undefined}                                  | ${false} | ${"point at the exclusive end"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T07:00:00-05:00[America/New_York]"} | ${undefined}                                  | ${false} | ${"point at the exclusive end, another zone"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T11:59:59.999999999+00:00[UTC]"}    | ${undefined}                                  | ${true}  | ${"point one nanosecond before the end"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${undefined}                                  | ${true}  | ${"point at the inclusive start"}
    ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${undefined}                                  | ${false} | ${"an empty interval contains no point"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"}           | ${true}  | ${"inner [B, D) shares the end of [A, D)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${true}  | ${"empty inner [B, B) strictly inside"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"}           | ${false} | ${"empty inner [D, D) at the end edge"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T09:00:00+00:00[UTC]"}           | ${false} | ${"empty inner [A, A) at the start edge"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T13:00:00+00:00[UTC]"}              | ${"2024-01-01T13:00:00+00:00[UTC]"}           | ${false} | ${"empty inner [C, C) beyond the end"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00.000000001+00:00[UTC]"} | ${false} | ${"inner runs one nanosecond past the end"}
  `(
    "returns $expected for $pointOrStart (inner end $pointEnd) in [$intervalStart, $intervalEnd) ($reason)",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsZoned(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart                       | intervalEnd                         | pointOrStart                        | pointEnd                            | expected
    ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${undefined}                        | ${false}
    ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-07-15T12:00:00+00:00[UTC]"} | ${false}
    ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-10T12:00:00+00:00[UTC]"} | ${false}
  `(
    "returns $expected for reversed outer interval",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsZoned(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart                       | intervalEnd                         | innerStart                          | innerEnd                            | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-10T12:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-07-01T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${false}
  `(
    "returns $expected for reversed inner interval",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsZoned(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart                       | intervalEnd                         | pointOrStart
    ${"invalid"}                        | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${""}                               | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"not-a-zoned"}                    | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${""}                               | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"not-a-zoned"}                    | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"invalid"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${""}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"not-a-zoned"}
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"}
  `(
    "returns false for malformed zoned: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsZoned(
          intervalStart,
          intervalEnd,
          pointOrStart,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart   | intervalEnd     | pointOrStart    | pointEnd
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${false}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${false}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${false}
  `(
    "returns false for non-string input: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsZoned(
          intervalStart as never,
          intervalEnd as never,
          pointOrStart as never,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart                       | intervalEnd                         | innerStart                          | innerEnd
    ${null}                             | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-07-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${null}                             | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-07-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${null}                             | ${"2024-07-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${null}
  `(
    "returns false for non-string 4-arg input",
    ({ intervalStart, intervalEnd, innerStart, innerEnd }) => {
      expect(
        intervalContainsZoned(
          intervalStart as never,
          intervalEnd as never,
          innerStart as never,
          innerEnd as never,
        ),
      ).toBe(false);
    },
  );

  it("returns false when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalContainsZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-12-31T23:59:59+00:00[UTC]",
        "2024-06-15T12:00:00+00:00[UTC]",
      ),
    ).toBe(false);
  });

  it("proves zone-invariance across sameInstantBattleCases", () => {
    const outerStart = "2024-01-01T00:00:00+00:00[UTC]";
    const outerEnd = "2024-12-31T23:59:59+00:00[UTC]";

    for (const { value: point } of sameInstantBattleCases) {
      expect(intervalContainsZoned(outerStart, outerEnd, point)).toBe(true);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for point containment", () => {
    const intervalStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const intervalEndInstant = Temporal.Instant.from("2024-12-31T23:59:59Z");
    const pointInstant = Temporal.Instant.from("2024-06-15T12:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const intervalStart = intervalStartInstant
        .toZonedDateTimeISO(timeZone)
        .toString();
      const intervalEnd = intervalEndInstant
        .toZonedDateTimeISO(timeZone)
        .toString();
      const point = pointInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalContainsZoned(intervalStart, intervalEnd, point)).toBe(
        true,
      );
    }
  });

  it("proves zone-invariance across battleTestTimeZones for point outside interval", () => {
    const intervalStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const intervalEndInstant = Temporal.Instant.from("2024-12-31T23:59:59Z");
    const pointInstant = Temporal.Instant.from("2023-12-01T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const intervalStart = intervalStartInstant
        .toZonedDateTimeISO(timeZone)
        .toString();
      const intervalEnd = intervalEndInstant
        .toZonedDateTimeISO(timeZone)
        .toString();
      const point = pointInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalContainsZoned(intervalStart, intervalEnd, point)).toBe(
        false,
      );
    }
  });

  it("proves zone-invariance across battleTestTimeZones for inner interval containment", () => {
    const outerStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const outerEndInstant = Temporal.Instant.from("2024-12-31T23:59:59Z");
    const innerStartInstant = Temporal.Instant.from("2024-03-01T00:00:00Z");
    const innerEndInstant = Temporal.Instant.from("2024-09-01T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const outerStart = outerStartInstant
        .toZonedDateTimeISO(timeZone)
        .toString();
      const outerEnd = outerEndInstant.toZonedDateTimeISO(timeZone).toString();
      const innerStart = innerStartInstant
        .toZonedDateTimeISO(timeZone)
        .toString();
      const innerEnd = innerEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(
        intervalContainsZoned(outerStart, outerEnd, innerStart, innerEnd),
      ).toBe(true);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for inner interval outside", () => {
    const outerStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const outerEndInstant = Temporal.Instant.from("2024-12-31T23:59:59Z");
    const innerStartInstant = Temporal.Instant.from("2023-12-01T00:00:00Z");
    const innerEndInstant = Temporal.Instant.from("2024-06-15T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const outerStart = outerStartInstant
        .toZonedDateTimeISO(timeZone)
        .toString();
      const outerEnd = outerEndInstant.toZonedDateTimeISO(timeZone).toString();
      const innerStart = innerStartInstant
        .toZonedDateTimeISO(timeZone)
        .toString();
      const innerEnd = innerEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(
        intervalContainsZoned(outerStart, outerEnd, innerStart, innerEnd),
      ).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for identical intervals (contains = true)", () => {
    const startInstant = Temporal.Instant.from("2024-06-15T12:00:00Z");
    const endInstant = Temporal.Instant.from("2024-06-15T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const outerStart = startInstant.toZonedDateTimeISO(timeZone).toString();
      const outerEnd = endInstant.toZonedDateTimeISO(timeZone).toString();
      const innerStart = startInstant.toZonedDateTimeISO(timeZone).toString();
      const innerEnd = endInstant.toZonedDateTimeISO(timeZone).toString();

      expect(
        intervalContainsZoned(outerStart, outerEnd, innerStart, innerEnd),
      ).toBe(true);
    }
  });

  it("returns true for points across a DST spring-forward gap by instant", () => {
    // America/Chicago spring-forward: 2024-03-10 02:00 -> 03:00
    // Interval spans the transition; containment is computed by instant, not wall-clock.
    const outerStart = "2024-03-09T23:00:00-06:00[America/Chicago]";
    const outerEnd = "2024-03-10T04:00:00-05:00[America/Chicago]";

    // Point before the gap (valid local time)
    expect(
      intervalContainsZoned(
        outerStart,
        outerEnd,
        "2024-03-10T01:00:00-06:00[America/Chicago]",
      ),
    ).toBe(true);

    // Point after the gap (valid local time)
    expect(
      intervalContainsZoned(
        outerStart,
        outerEnd,
        "2024-03-10T03:30:00-05:00[America/Chicago]",
      ),
    ).toBe(true);

    // Point at the exclusive end
    expect(
      intervalContainsZoned(
        outerStart,
        outerEnd,
        "2024-03-10T04:00:00-05:00[America/Chicago]",
      ),
    ).toBe(false);

    // Point before the interval
    expect(
      intervalContainsZoned(
        outerStart,
        outerEnd,
        "2024-03-09T20:00:00-06:00[America/Chicago]",
      ),
    ).toBe(false);
  });

  // An RFC 9557 calendar-annotated argument is valid, and ordering has no calendar check
  // (Temporal.ZonedDateTime.compare; native Chromium 153 compares the hebrew and bare 2024-01-01
  // UTC values as 0), so mixed calendars give the bare-ISO answer. Both rows are the same interval.
  it.each`
    aStart                                           | aEnd                                | bStart                                           | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns true for mixed calendars (equal intervals contain each other): $aStart, $aEnd, $bStart, $bEnd",
    ({
      aStart,
      aEnd,
      bStart,
      bEnd,
    }: {
      aStart: string;
      aEnd: string;
      bStart: string;
      bEnd: string;
    }) => {
      expect(intervalContainsZoned(aStart, aEnd, bStart, bEnd)).toBe(true);
    },
  );
});
