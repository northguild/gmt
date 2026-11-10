import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { ACCEPTED_FIX_UTC_TIMESTAMPS } from "../../test/fixUtcTimestampCases";
import { NON_STRINGS } from "../../test/nonStrings";
import { parseFixUtcTimestamp } from "../parse/parseFixUtcTimestamp";
import { formatFixUtcTimestamp } from "./formatFixUtcTimestamp";

/**
 * Every expected value is decided from FIX Latest `UTCTimestamp` (UTC wall clock, 0, 3, 6, 9 or
 * 12 digits) and the GMT rule that the formatter cuts and never rounds. Ordinary values were
 * checked against real Temporal (`Instant.from(v).toString({ timeZone: "UTC",
 * fractionalSecondDigits })`). Second 60 cannot be confirmed by Temporal, which clamps it to 59;
 * those rows rest on ITU-R TF.460-6 Annex 1 §2.2 and Annex 3 (the inserted second is the one
 * before a positive step; `23h 59m 60.6s UTC`) and FIX Latest's own `19981231-23:59:60`.
 */
describe("formatFixUtcTimestamp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("precision", () => {
    it.each`
      precision         | expected
      ${"second"}       | ${"20240615-14:30:00"}
      ${"millisecond"}  | ${"20240615-14:30:00.123"}
      ${"microsecond"}  | ${"20240615-14:30:00.123456"}
      ${"nanosecond"}   | ${"20240615-14:30:00.123456789"}
      ${"picosecond"}   | ${"20240615-14:30:00.123456789000"}
      ${"seconds"}      | ${"20240615-14:30:00"}
      ${"milliseconds"} | ${"20240615-14:30:00.123"}
      ${"microseconds"} | ${"20240615-14:30:00.123456"}
      ${"nanoseconds"}  | ${"20240615-14:30:00.123456789"}
      ${"picoseconds"}  | ${"20240615-14:30:00.123456789000"}
    `(
      "writes '2024-06-15T16:30:00.123456789+02:00' at $precision",
      ({ precision, expected }) => {
        expect(
          formatFixUtcTimestamp(
            "2024-06-15T16:30:00.123456789+02:00",
            precision,
          ),
        ).toBe(expected);
      },
    );
  });

  describe("values", () => {
    it.each`
      value                                         | precision        | expected                            | why
      ${"2024-06-15T14:30:00Z"}                     | ${"millisecond"} | ${"20240615-14:30:00.000"}          | ${"widened to the asked width"}
      ${"2024-06-15T14:30:00.9999Z"}                | ${"second"}      | ${"20240615-14:30:00"}              | ${"cut, not rounded"}
      ${"2024-06-15T23:59:59.999999999Z"}           | ${"millisecond"} | ${"20240615-23:59:59.999"}          | ${"cut keeps the day"}
      ${"2024-06-15T14:30:00,5Z"}                   | ${"millisecond"} | ${"20240615-14:30:00.500"}          | ${"comma fraction"}
      ${"2024-06-15T16:30:00+02:00[Europe/Berlin]"} | ${"second"}      | ${"20240615-14:30:00"}              | ${"zoned string"}
      ${"2024-06-16T00:30:00+01:00"}                | ${"second"}      | ${"20240615-23:30:00"}              | ${"offset crosses the day"}
      ${"1969-12-31T23:59:59.999999999Z"}           | ${"nanosecond"}  | ${"19691231-23:59:59.999999999"}    | ${"before 1970, digits as the wall clock"}
      ${"1960-01-01T12:00:00Z"}                     | ${"second"}      | ${"19600101-12:00:00"}              | ${"before the leap table"}
      ${"0000-01-01T00:00:00Z"}                     | ${"second"}      | ${"00000101-00:00:00"}              | ${"FIX's first year"}
      ${"9999-12-31T23:59:59.999999999Z"}           | ${"picosecond"}  | ${"99991231-23:59:59.999999999000"} | ${"FIX's last instant"}
    `(
      "writes '$value' at $precision ($why)",
      ({ value, precision, expected }) => {
        expect(formatFixUtcTimestamp(value, precision)).toBe(expected);
      },
    );
  });

  describe("leap seconds", () => {
    it.each`
      value                               | precision        | expected                            | why
      ${"2016-12-31T23:59:60Z"}           | ${"second"}      | ${"20161231-23:59:60"}              | ${"leap second"}
      ${"2016-12-31T23:59:60.5Z"}         | ${"millisecond"} | ${"20161231-23:59:60.500"}          | ${"leap second, fraction"}
      ${"2016-12-31T23:59:60.5Z"}         | ${"picosecond"}  | ${"20161231-23:59:60.500000000000"} | ${"leap second, picosecond pad"}
      ${"2017-01-01T08:59:60+09:00"}      | ${"second"}      | ${"20161231-23:59:60"}              | ${"leap second at an offset"}
      ${"1998-12-31T23:59:60Z"}           | ${"second"}      | ${"19981231-23:59:60"}              | ${"FIX's own example"}
      ${"1972-06-30T23:59:60Z"}           | ${"second"}      | ${"19720630-23:59:60"}              | ${"first inserted second, ITU-R TF.460-6 Annex 3"}
      ${"1972-12-31T23:59:60Z"}           | ${"second"}      | ${"19721231-23:59:60"}              | ${"second inserted second"}
      ${"2016-12-31T23:59:60.999999999Z"} | ${"millisecond"} | ${"20161231-23:59:60.999"}          | ${"leap second fraction is cut"}
      ${"2016-12-31T23:59:60,5Z"}         | ${"millisecond"} | ${"20161231-23:59:60.500"}          | ${"leap second, comma fraction"}
      ${"2016-12-31T23:59:60+00:00[UTC]"} | ${"second"}      | ${"20161231-23:59:60"}              | ${"leap second, zoned string"}
      ${"2016-12-31T23:59:59Z"}           | ${"second"}      | ${"20161231-23:59:59"}              | ${"the second before the leap second"}
    `(
      "writes '$value' at $precision ($why)",
      ({ value, precision, expected }) => {
        expect(formatFixUtcTimestamp(value, precision)).toBe(expected);
      },
    );
  });

  describe("refused", () => {
    it.each`
      value                          | why
      ${"2017-12-31T23:59:60Z"}      | ${"no leap second was inserted on 2017-12-31"}
      ${"2024-06-15T14:30:60Z"}      | ${"second 60 at 14:30"}
      ${"1971-12-31T23:59:60Z"}      | ${"before 1972"}
      ${"2018-01-01T08:59:60+09:00"} | ${"UTC 2017-12-31 23:59:60: not inserted, at an offset"}
      ${"2016-12-31T23:58:60Z"}      | ${"second 60 on a leap-second day but at 23:58"}
      ${"2016-12-31T12:00:60Z"}      | ${"second 60 on a leap-second day but at 12:00"}
      ${"2016-12-31T23:59:60"}       | ${"local date-time with second 60"}
      ${"2024-06-15T14:30:00.123"}   | ${"local date-time with a fraction"}
      ${"2024-06-15T14:30:00"}       | ${"local date-time names no UTC second"}
      ${"2024-06-15"}                | ${"a date is not an instant"}
      ${"14:30:00"}                  | ${"a time is not an instant"}
      ${"20240615-14:30:00"}         | ${"a FIX value is not an instant"}
      ${"9999-12-31T23:30:00-01:00"} | ${"UTC year 10000"}
      ${"+010000-01-01T00:00:00Z"}   | ${"UTC year 10000"}
      ${"0000-01-01T00:30:00+01:00"} | ${"UTC year -1"}
      ${"-000001-12-31T23:30:00Z"}   | ${"UTC year -1"}
    `("returns '' for '$value' ($why)", ({ value }) => {
      expect(formatFixUtcTimestamp(value, "second")).toBe("");
    });

    it.each`
      label           | precision
      ${'"Second"'}   | ${"Second"}
      ${'"ms"'}       | ${"ms"}
      ${"''"}         | ${""}
      ${'"toString"'} | ${"toString"}
      ${"3"}          | ${3}
      ${"null"}       | ${null}
      ${"undefined"}  | ${undefined}
    `(
      "returns '' for a valid instant with precision $label",
      ({ precision }) => {
        expect(formatFixUtcTimestamp("2024-06-15T14:30:00Z", precision)).toBe(
          "",
        );
      },
    );

    it("returns '' for a value that is not a string", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(formatFixUtcTimestamp(make() as string, "second"), kind).toBe(
          "",
        );
      }
    });

    it("returns '' when Temporal throws", () => {
      mockTemporalInstantFromEpochNanosecondsThrow();
      expect(formatFixUtcTimestamp("2024-06-15T14:30:00Z", "second")).toBe("");
    });
  });

  describe("round trip", () => {
    it.each`
      iso                                 | precision        | instant
      ${"2024-06-15T14:30:00.123456789Z"} | ${"second"}      | ${"2024-06-15T14:30:00Z"}
      ${"2024-06-15T14:30:00.123456789Z"} | ${"millisecond"} | ${"2024-06-15T14:30:00.123Z"}
      ${"2024-06-15T14:30:00.123456789Z"} | ${"microsecond"} | ${"2024-06-15T14:30:00.123456Z"}
      ${"2024-06-15T14:30:00.123456789Z"} | ${"nanosecond"}  | ${"2024-06-15T14:30:00.123456789Z"}
      ${"2024-06-15T14:30:00.123456789Z"} | ${"picosecond"}  | ${"2024-06-15T14:30:00.123456789Z"}
      ${"2016-12-31T23:59:60.123456789Z"} | ${"second"}      | ${"2016-12-31T23:59:60Z"}
      ${"2016-12-31T23:59:60.123456789Z"} | ${"millisecond"} | ${"2016-12-31T23:59:60.123Z"}
      ${"2016-12-31T23:59:60.123456789Z"} | ${"microsecond"} | ${"2016-12-31T23:59:60.123456Z"}
      ${"2016-12-31T23:59:60.123456789Z"} | ${"nanosecond"}  | ${"2016-12-31T23:59:60.123456789Z"}
      ${"2016-12-31T23:59:60.123456789Z"} | ${"picosecond"}  | ${"2016-12-31T23:59:60.123456789Z"}
      ${"0000-01-01T00:00:00Z"}           | ${"second"}      | ${"0000-01-01T00:00:00Z"}
      ${"0000-01-01T00:00:00Z"}           | ${"millisecond"} | ${"0000-01-01T00:00:00.000Z"}
      ${"0000-01-01T00:00:00Z"}           | ${"microsecond"} | ${"0000-01-01T00:00:00.000000Z"}
      ${"0000-01-01T00:00:00Z"}           | ${"nanosecond"}  | ${"0000-01-01T00:00:00.000000000Z"}
      ${"0000-01-01T00:00:00Z"}           | ${"picosecond"}  | ${"0000-01-01T00:00:00.000000000Z"}
      ${"1969-12-31T23:59:59.999999999Z"} | ${"second"}      | ${"1969-12-31T23:59:59Z"}
      ${"1969-12-31T23:59:59.999999999Z"} | ${"millisecond"} | ${"1969-12-31T23:59:59.999Z"}
      ${"1969-12-31T23:59:59.999999999Z"} | ${"microsecond"} | ${"1969-12-31T23:59:59.999999Z"}
      ${"1969-12-31T23:59:59.999999999Z"} | ${"nanosecond"}  | ${"1969-12-31T23:59:59.999999999Z"}
      ${"1969-12-31T23:59:59.999999999Z"} | ${"picosecond"}  | ${"1969-12-31T23:59:59.999999999Z"}
    `(
      "parse(format('$iso', '$precision')) gives '$instant'",
      ({ iso, precision, instant }) => {
        const parsed = parseFixUtcTimestamp(
          formatFixUtcTimestamp(iso, precision),
        );
        expect(parsed).toStrictEqual({
          instant,
          precision,
          leapSecond: iso.includes(":60"),
          picoseconds: 0,
        });
      },
    );

    it.each(
      ACCEPTED_FIX_UTC_TIMESTAMPS.filter(
        (value) => (value.split(".")[1] ?? "").length < 12,
      ).map((fix) => ({ fix })),
    )("format(parse('$fix')) returns '$fix'", ({ fix }) => {
      const parsed = parseFixUtcTimestamp(fix);
      expect(parsed).not.toBeNull();
      expect(formatFixUtcTimestamp(parsed!.instant, parsed!.precision)).toBe(
        fix,
      );
    });

    it("returns the first nine digits and 000 for a picosecond value", () => {
      const parsed = parseFixUtcTimestamp("20240615-14:30:00.123456789012");
      expect(formatFixUtcTimestamp(parsed!.instant, parsed!.precision)).toBe(
        "20240615-14:30:00.123456789000",
      );
    });
  });
});
