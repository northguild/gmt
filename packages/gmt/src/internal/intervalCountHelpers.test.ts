import { Temporal } from "@js-temporal/polyfill";
import { getStartOfZonedUnit, getUnitSpan } from "./intervalCountHelpers";

describe("getStartOfZonedUnit", () => {
  const source = "2024-03-13T14:45:30.123456789+00:00[UTC]";

  it.each`
    unit             | expected
    ${"year"}        | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"month"}       | ${"2024-03-01T00:00:00+00:00[UTC]"}
    ${"week"}        | ${"2024-03-11T00:00:00+00:00[UTC]"}
    ${"day"}         | ${"2024-03-13T00:00:00+00:00[UTC]"}
    ${"hour"}        | ${"2024-03-13T14:00:00+00:00[UTC]"}
    ${"minute"}      | ${"2024-03-13T14:45:00+00:00[UTC]"}
    ${"second"}      | ${"2024-03-13T14:45:30+00:00[UTC]"}
    ${"millisecond"} | ${"2024-03-13T14:45:30.123+00:00[UTC]"}
    ${"microsecond"} | ${"2024-03-13T14:45:30.123456+00:00[UTC]"}
    ${"nanosecond"}  | ${"2024-03-13T14:45:30.123456789+00:00[UTC]"}
  `("returns $expected for unit $unit", ({ unit, expected }) => {
    expect(
      getStartOfZonedUnit(Temporal.ZonedDateTime.from(source), unit).toString(),
    ).toBe(expected);
  });

  // America/Santiago springs forward at midnight on 2024-09-08, so that local day
  // has no 00:00 — its start is 01:00.
  it.each`
    source                                           | unit       | expected
    ${"2024-09-08T12:00:00-03:00[America/Santiago]"} | ${"day"}   | ${"2024-09-08T01:00:00-03:00[America/Santiago]"}
    ${"2024-09-08T12:00:00-03:00[America/Santiago]"} | ${"month"} | ${"2024-09-01T00:00:00-04:00[America/Santiago]"}
  `(
    "returns $expected for $source with unit $unit when local midnight is skipped",
    ({ source: value, unit, expected }) => {
      expect(
        getStartOfZonedUnit(
          Temporal.ZonedDateTime.from(value),
          unit,
        ).toString(),
      ).toBe(expected);
    },
  );

  // 01:30 EST is the second pass through 1am on the fall-back day — truncation is
  // instant-based, so it must stay on the EST pass rather than jump to the EDT one.
  it.each`
    source                                           | unit      | expected
    ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"hour"} | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"day"}  | ${"2024-11-03T00:00:00-04:00[America/New_York]"}
  `(
    "returns $expected for $source with unit $unit inside the repeated hour",
    ({ source: value, unit, expected }) => {
      expect(
        getStartOfZonedUnit(
          Temporal.ZonedDateTime.from(value),
          unit,
        ).toString(),
      ).toBe(expected);
    },
  );
});

describe("getUnitSpan", () => {
  it("returns the whole-unit field of a calendar-unit duration", () => {
    const duration = Temporal.PlainDate.from("2024-01-01").until(
      Temporal.PlainDate.from("2024-03-01"),
      { largestUnit: "month" },
    );

    expect(getUnitSpan(duration, "month")).toBe(2);
  });

  it("floors a partial trailing amount instead of rounding it up", () => {
    const duration = Temporal.PlainTime.from("12:00:00").until(
      Temporal.PlainTime.from("14:30:00"),
      { largestUnit: "hour" },
    );

    expect(getUnitSpan(duration, "hour")).toBe(2);
  });

  it("returns 0 for a zero duration", () => {
    const duration = Temporal.PlainDate.from("2024-01-01").until(
      Temporal.PlainDate.from("2024-01-01"),
      { largestUnit: "day" },
    );

    expect(getUnitSpan(duration, "day")).toBe(0);
  });
});
