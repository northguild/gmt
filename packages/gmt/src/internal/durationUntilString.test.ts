import { Temporal } from "@js-temporal/polyfill";
import { durationUntilString } from "./durationUntilString";

describe("durationUntilString", () => {
  describe("PlainDate", () => {
    it.each`
      start           | end             | largestUnit | expected
      ${"2024-03-10"} | ${"2024-03-10"} | ${"day"}    | ${"PT0S"}
      ${"2024-03-10"} | ${"2024-03-15"} | ${"day"}    | ${"P5D"}
      ${"2024-03-10"} | ${"2024-03-15"} | ${"week"}   | ${"P5D"}
      ${"2024-03-10"} | ${"2024-03-15"} | ${"month"}  | ${"P5D"}
      ${"2024-03-10"} | ${"2024-03-15"} | ${"year"}   | ${"P5D"}
    `(
      "returns $expected for $start to $end with largestUnit $largestUnit",
      ({ start, end, largestUnit, expected }) => {
        const result = durationUntilString(
          Temporal.PlainDate.from(start),
          Temporal.PlainDate.from(end),
          largestUnit,
        );
        expect(result).toBe(expected);
      },
    );

    it.each`
      start           | end             | smallestUnit | expected
      ${"2024-03-10"} | ${"2024-03-15"} | ${"day"}     | ${"P5D"}
      ${"2024-03-10"} | ${"2024-03-18"} | ${"week"}    | ${"P1W"}
    `(
      "returns $expected for $start to $end with smallestUnit $smallestUnit",
      ({ start, end, smallestUnit, expected }) => {
        const result = durationUntilString(
          Temporal.PlainDate.from(start),
          Temporal.PlainDate.from(end),
          "week",
          { smallestUnit },
        );
        expect(result).toBe(expected);
      },
    );

    it.each`
      start           | end             | toStringSmallestUnit | expected
      ${"2024-03-10"} | ${"2024-03-15"} | ${"second"}          | ${"P5DT0S"}
      ${"2024-03-10"} | ${"2024-03-15"} | ${"millisecond"}     | ${"P5DT0.000S"}
      ${"2024-03-10"} | ${"2024-03-15"} | ${"microsecond"}     | ${"P5DT0.000000S"}
      ${"2024-03-10"} | ${"2024-03-15"} | ${"nanosecond"}      | ${"P5DT0.000000000S"}
    `(
      "returns $expected for $start to $end with toStringSmallestUnit $toStringSmallestUnit",
      ({ start, end, toStringSmallestUnit, expected }) => {
        const result = durationUntilString(
          Temporal.PlainDate.from(start),
          Temporal.PlainDate.from(end),
          "day",
          { toStringSmallestUnit },
        );
        expect(result).toBe(expected);
      },
    );
  });

  describe("PlainDateTime", () => {
    it.each`
      start                    | end                      | largestUnit | expected
      ${"2024-03-10T12:00:00"} | ${"2024-03-10T12:00:00"} | ${"hour"}   | ${"PT0S"}
      ${"2024-03-10T12:00:00"} | ${"2024-03-15T14:30:00"} | ${"hour"}   | ${"PT122H30M"}
      ${"2024-03-10T12:00:00"} | ${"2024-03-15T14:30:00"} | ${"minute"} | ${"PT7350M"}
      ${"2024-03-10T00:00:00"} | ${"2024-03-15T00:00:00"} | ${"hour"}   | ${"PT120H"}
    `(
      "returns $expected for $start to $end with largestUnit $largestUnit",
      ({ start, end, largestUnit, expected }) => {
        const result = durationUntilString(
          Temporal.PlainDateTime.from(start),
          Temporal.PlainDateTime.from(end),
          largestUnit,
        );
        expect(result).toBe(expected);
      },
    );

    it.each`
      start                    | end                      | roundingIncrement | roundingMode | expected
      ${"2024-03-10T12:00:00"} | ${"2024-03-15T14:30:00"} | ${15}             | ${"floor"}   | ${"PT122H30M"}
      ${"2024-03-10T12:00:00"} | ${"2024-03-15T14:30:00"} | ${30}             | ${"ceil"}    | ${"PT122H30M"}
      ${"2024-03-10T12:34:56"} | ${"2024-03-15T14:30:00"} | ${15}             | ${"floor"}   | ${"PT121H45M"}
      ${"2024-03-10T12:34:56"} | ${"2024-03-15T14:30:00"} | ${15}             | ${"ceil"}    | ${"PT122H"}
    `(
      "returns $expected for $start to $end with roundingIncrement $roundingIncrement and roundingMode $roundingMode",
      ({ start, end, roundingIncrement, roundingMode, expected }) => {
        const result = durationUntilString(
          Temporal.PlainDateTime.from(start),
          Temporal.PlainDateTime.from(end),
          "hour",
          { smallestUnit: "minute", roundingIncrement, roundingMode },
        );
        expect(result).toBe(expected);
      },
    );

    it.each`
      start                              | end                                | fractionalSecondDigits | expected
      ${"2024-03-10T12:00:00"}           | ${"2024-03-15T14:30:00"}           | ${0}                   | ${"PT122H30M0S"}
      ${"2024-03-10T12:00:00"}           | ${"2024-03-15T14:30:00"}           | ${3}                   | ${"PT122H30M0.000S"}
      ${"2024-03-10T12:00:00.123456789"} | ${"2024-03-15T14:30:00.987654321"} | ${3}                   | ${"PT122H30M0.864S"}
      ${"2024-03-10T12:00:00.123456789"} | ${"2024-03-15T14:30:00.987654321"} | ${9}                   | ${"PT122H30M0.864197532S"}
    `(
      "returns $expected for $start to $end with fractionalSecondDigits $fractionalSecondDigits",
      ({ start, end, fractionalSecondDigits, expected }) => {
        const result = durationUntilString(
          Temporal.PlainDateTime.from(start),
          Temporal.PlainDateTime.from(end),
          "hour",
          { smallestUnit: "nanosecond", fractionalSecondDigits },
        );
        expect(result).toBe(expected);
      },
    );

    it.each`
      start                              | end                                | toStringSmallestUnit | toStringRoundingMode | expected
      ${"2024-03-10T12:00:00.123456789"} | ${"2024-03-15T14:30:00.987654321"} | ${"millisecond"}     | ${"floor"}           | ${"PT122H30M0.864S"}
      ${"2024-03-10T12:00:00.123456789"} | ${"2024-03-15T14:30:00.987654321"} | ${"millisecond"}     | ${"ceil"}            | ${"PT122H30M0.865S"}
    `(
      "returns $expected for $start to $end with toStringRoundingMode $toStringRoundingMode",
      ({
        start,
        end,
        toStringSmallestUnit,
        toStringRoundingMode,
        expected,
      }) => {
        const result = durationUntilString(
          Temporal.PlainDateTime.from(start),
          Temporal.PlainDateTime.from(end),
          "hour",
          {
            smallestUnit: "nanosecond",
            toStringSmallestUnit,
            toStringRoundingMode,
          },
        );
        expect(result).toBe(expected);
      },
    );
  });

  describe("ZonedDateTime", () => {
    it.each`
      start                                            | end                                              | largestUnit | expected
      ${"2024-04-10T12:00:00-04:00[America/New_York]"} | ${"2024-04-15T14:30:00-04:00[America/New_York]"} | ${"day"}    | ${"P5DT2H30M"}
      ${"2024-04-10T12:00:00-04:00[America/New_York]"} | ${"2024-04-15T14:30:00-04:00[America/New_York]"} | ${"hour"}   | ${"PT122H30M"}
    `(
      "returns $expected for zoned $start to $end with largestUnit $largestUnit",
      ({ start, end, largestUnit, expected }) => {
        const result = durationUntilString(
          Temporal.ZonedDateTime.from(start),
          Temporal.ZonedDateTime.from(end),
          largestUnit,
        );
        expect(result).toBe(expected);
      },
    );
  });
});
