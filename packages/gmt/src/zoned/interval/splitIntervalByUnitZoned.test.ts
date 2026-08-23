import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { splitIntervalByUnitZoned } from "./splitIntervalByUnitZoned";

describe("splitIntervalByUnitZoned", () => {
  const expectedExactDivision = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T06:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T06:00:00+00:00[UTC]",
      end: "2024-01-01T12:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T12:00:00+00:00[UTC]",
      end: "2024-01-01T18:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T18:00:00+00:00[UTC]",
      end: "2024-01-02T00:00:00+00:00[UTC]",
    },
  ];

  const expectedRemainder = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T01:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T01:00:00+00:00[UTC]",
      end: "2024-01-01T01:30:00+00:00[UTC]",
    },
  ];

  const expectedDayUnit = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-03T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-03T00:00:00+00:00[UTC]",
      end: "2024-01-05T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-05T00:00:00+00:00[UTC]",
      end: "2024-01-07T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-07T00:00:00+00:00[UTC]",
      end: "2024-01-09T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-09T00:00:00+00:00[UTC]",
      end: "2024-01-10T00:00:00+00:00[UTC]",
    },
  ];

  const expectedZeroLength = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T00:00:00+00:00[UTC]",
    },
  ];

  const expectedSingleStep = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T02:00:00+00:00[UTC]",
    },
  ];

  it.each`
    start                               | end                                 | unit      | amount | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"hour"} | ${6}   | ${expectedExactDivision}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"} | ${1}   | ${expectedRemainder}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-10T00:00:00+00:00[UTC]"} | ${"day"}  | ${2}   | ${expectedDayUnit}
  `(
    "returns $expected for $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                               | end                                 | unit      | amount | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"hour"} | ${1}   | ${expectedZeroLength}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T02:00:00+00:00[UTC]"} | ${"hour"} | ${2}   | ${expectedSingleStep}
  `(
    "returns $expected for edge-case $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                               | end                                 | unit         | amount
    ${"invalid"}                        | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${""}                               | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${""}                               | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"invalid"} | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${""}        | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${0}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${-1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1.5}
  `(
    "returns [] for invalid $start, $end, $unit, or $amount",
    ({ start, end, unit, amount }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual([]);
    },
  );

  it.each`
    start                               | end                                 | unit         | amount
    ${null} | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${null} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
  `(
    "returns [] for non-string or non-number input: $start, $end, $unit, $amount",
    ({ start, end, unit, amount }) => {
      expect(
        splitIntervalByUnitZoned(
          start as never,
          end as never,
          unit as never,
          amount as never,
        ),
      ).toEqual([]);
    },
  );

  it("returns [] when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      splitIntervalByUnitZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-02T00:00:00+00:00[UTC]",
        "hour",
        6,
      ),
    ).toEqual([]);
  });

  it("proves zone-invariance across battleTestTimeZones for exact division", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-02T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      const result = splitIntervalByUnitZoned(start, end, "hour", 6);

      expect(result).toHaveLength(4);
      expect(result[0].start).toBe(start);
      expect(result[3].end).toBe(end);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for remainder case", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-01T01:30:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      const result = splitIntervalByUnitZoned(start, end, "hour", 1);

      expect(result).toHaveLength(2);
      expect(result[0].start).toBe(start);
      expect(result[1].end).toBe(end);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for day unit", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-10T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      const result = splitIntervalByUnitZoned(start, end, "day", 2);

      expect(result).toHaveLength(5);
      expect(result[0].start).toBe(start);
      expect(result[4].end).toBe(end);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for zero-length interval", () => {
    const instant = Temporal.Instant.from("2024-01-01T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const zdt = instant.toZonedDateTimeISO(timeZone);
      const start = zdt.toString();
      const end = zdt.toString();

      const result = splitIntervalByUnitZoned(start, end, "hour", 1);

      expect(result).toHaveLength(1);
      expect(result[0].start).toBe(start);
      expect(result[0].end).toBe(end);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for single step", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-01T02:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      const result = splitIntervalByUnitZoned(start, end, "hour", 2);

      expect(result).toHaveLength(1);
      expect(result[0].start).toBe(start);
      expect(result[0].end).toBe(end);
    }
  });
});
