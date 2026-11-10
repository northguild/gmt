import { LEAP_SECOND_STEPS } from "../../internal";
import { Temporal } from "../../internal/temporal";
import {
  ACCEPTED_FIX_UTC_TIMESTAMPS,
  REFUSED_FIX_LEAP_SECONDS,
  REFUSED_FIX_UTC_TIMESTAMPS,
} from "../../test/fixUtcTimestampCases";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { NON_STRINGS } from "../../test/nonStrings";
import { parseFixUtcTimestamp } from "./parseFixUtcTimestamp";

/** Temporal writes the same instant at the digits the string carries (not for second 60). */
function expectTemporalAgrees(instant: string): void {
  const digits = Math.max((instant.split(".")[1] ?? "").length - 1, 0);
  expect(
    Temporal.Instant.from(instant).toString({
      fractionalSecondDigits: digits as 0 | 3 | 6 | 9,
    }),
  ).toBe(instant);
}

/**
 * Every expected value is decided from the FIX Latest `UTCTimestamp` rules (digit count states
 * the precision; the instant keeps the digits sent; digits 10-12 go to `picoseconds`) and
 * checked against real Temporal where Temporal can hold the value.
 */
describe("parseFixUtcTimestamp", () => {
  describe("accepted: the digit count states the precision", () => {
    it.each`
      value                               | instant                             | precision        | picoseconds
      ${"20240615-14:30:00"}              | ${"2024-06-15T14:30:00Z"}           | ${"second"}      | ${0}
      ${"20240615-14:30:00.123"}          | ${"2024-06-15T14:30:00.123Z"}       | ${"millisecond"} | ${0}
      ${"20240615-14:30:00.123456"}       | ${"2024-06-15T14:30:00.123456Z"}    | ${"microsecond"} | ${0}
      ${"20240615-14:30:00.123456789"}    | ${"2024-06-15T14:30:00.123456789Z"} | ${"nanosecond"}  | ${0}
      ${"20240615-14:30:00.123456789012"} | ${"2024-06-15T14:30:00.123456789Z"} | ${"picosecond"}  | ${12}
    `(
      "reads '$value' as $precision",
      ({ value, instant, precision, picoseconds }) => {
        expectTemporalAgrees(instant);
        expect(parseFixUtcTimestamp(value)).toStrictEqual({
          instant,
          precision,
          leapSecond: false,
          picoseconds,
        });
      },
    );
  });

  describe("accepted: the instant keeps the digits sent, and the edges of the range", () => {
    it.each`
      value                               | instant                             | precision        | picoseconds | reads
      ${"20240615-14:30:00.100"}          | ${"2024-06-15T14:30:00.100Z"}       | ${"millisecond"} | ${0}        | ${".100 is not .1: trailing zeros are the measurement"}
      ${"20240615-14:30:00.000"}          | ${"2024-06-15T14:30:00.000Z"}       | ${"millisecond"} | ${0}        | ${"a zero fraction still states milliseconds"}
      ${"20240615-14:30:00.000000000000"} | ${"2024-06-15T14:30:00.000000000Z"} | ${"picosecond"}  | ${0}        | ${"twelve zeros state picoseconds"}
      ${"20240615-14:30:00.000000000999"} | ${"2024-06-15T14:30:00.000000000Z"} | ${"picosecond"}  | ${999}      | ${"only digits 10-12 are set"}
      ${"19981231-23:59:59"}              | ${"1998-12-31T23:59:59Z"}           | ${"second"}      | ${0}        | ${"FIX's own example, the second before the leap second"}
      ${"19990101-00:00:00"}              | ${"1999-01-01T00:00:00Z"}           | ${"second"}      | ${0}        | ${"FIX's own example, the second after"}
      ${"20240229-00:00:00"}              | ${"2024-02-29T00:00:00Z"}           | ${"second"}      | ${0}        | ${"2024 has a 29 February"}
      ${"19600101-12:00:00"}              | ${"1960-01-01T12:00:00Z"}           | ${"second"}      | ${0}        | ${"before the leap-second table: an ordinary second is fine"}
      ${"00000101-00:00:00"}              | ${"0000-01-01T00:00:00Z"}           | ${"second"}      | ${0}        | ${"FIX allows year 0000"}
      ${"99991231-23:59:59.999999999999"} | ${"9999-12-31T23:59:59.999999999Z"} | ${"picosecond"}  | ${999}      | ${"the last second FIX can write"}
      ${"20240615-14:30:00.120000"}       | ${"2024-06-15T14:30:00.120000Z"}    | ${"microsecond"} | ${0}        | ${"six digits keep their trailing zeros"}
      ${"20240615-14:30:00.123000000"}    | ${"2024-06-15T14:30:00.123000000Z"} | ${"nanosecond"}  | ${0}        | ${"nine digits keep their trailing zeros"}
      ${"20240615-14:30:00.123456789000"} | ${"2024-06-15T14:30:00.123456789Z"} | ${"picosecond"}  | ${0}        | ${"digits 10-12 all zero: picoseconds 0, not folded"}
      ${"20240615-14:30:00.123456789120"} | ${"2024-06-15T14:30:00.123456789Z"} | ${"picosecond"}  | ${120}      | ${"picoseconds 120, the trailing zero is a digit of the value"}
    `(
      "reads '$value' ($reads)",
      ({ value, instant, precision, picoseconds }) => {
        expectTemporalAgrees(instant);
        expect(parseFixUtcTimestamp(value)).toStrictEqual({
          instant,
          precision,
          leapSecond: false,
          picoseconds,
        });
      },
    );
  });

  describe("second 60: an inserted leap second (IERS Bulletin C, ITU-R TF.460-6 Annex 1 section 2.2)", () => {
    // Temporal cannot hold second 60 (it clamps to 59), so the polyfill cannot confirm these
    // instants. The source is the IERS Leap_Second.dat: 2016-12-31 is followed by a +1 s step to
    // 2017-01-01, 1998-12-31 by the step to 1999-01-01 (FIX's own example) and 1972-06-30 by the
    // step to 1972-07-01.
    it.each`
      value                               | instant                             | precision        | picoseconds | reads
      ${"20161231-23:59:60"}              | ${"2016-12-31T23:59:60Z"}           | ${"second"}      | ${0}        | ${"the last insertion before the table closed"}
      ${"20161231-23:59:60.500"}          | ${"2016-12-31T23:59:60.500Z"}       | ${"millisecond"} | ${0}        | ${"half a second into the leap second"}
      ${"20161231-23:59:60.999999999999"} | ${"2016-12-31T23:59:60.999999999Z"} | ${"picosecond"}  | ${999}      | ${"the last picosecond of the leap second"}
      ${"19981231-23:59:60"}              | ${"1998-12-31T23:59:60Z"}           | ${"second"}      | ${0}        | ${"FIX's own example"}
      ${"19720630-23:59:60"}              | ${"1972-06-30T23:59:60Z"}           | ${"second"}      | ${0}        | ${"the first insertion"}
    `(
      "reads '$value' as a leap second ($reads)",
      ({ value, instant, precision, picoseconds }) => {
        expect(parseFixUtcTimestamp(value)).toStrictEqual({
          instant,
          precision,
          leapSecond: true,
          picoseconds,
        });
      },
    );

    it("reads each of the 27 inserted seconds as a leap second, and the second before it as ordinary", () => {
      // Rows 1-27 of the IERS table; the insertion is the second before each step's date.
      const days = LEAP_SECOND_STEPS.at.slice(1).map((at) =>
        Temporal.Instant.fromEpochNanoseconds(at - 1_000_000_000n)
          .toString()
          .slice(0, 10)
          .replaceAll("-", ""),
      );
      expect(days).toHaveLength(27);
      for (const day of days) {
        expect(parseFixUtcTimestamp(`${day}-23:59:60`)?.leapSecond, day).toBe(
          true,
        );
        expect(parseFixUtcTimestamp(`${day}-23:59:59`)?.leapSecond, day).toBe(
          false,
        );
      }
    });

    it.each(REFUSED_FIX_LEAP_SECONDS)(
      "refuses '$value' ($why)",
      ({ value }) => {
        expect(parseFixUtcTimestamp(value)).toBeNull();
      },
    );
  });

  it.each(ACCEPTED_FIX_UTC_TIMESTAMPS.map((value) => ({ value })))(
    "reads the shared accepted value '$value'",
    ({ value }) => {
      expect(parseFixUtcTimestamp(value)).not.toBeNull();
    },
  );

  describe("refused: the sentinel is null", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.each(REFUSED_FIX_UTC_TIMESTAMPS)(
      "refuses '$value' ($why)",
      ({ value }) => {
        expect(parseFixUtcTimestamp(value)).toBeNull();
      },
    );

    it("returns null for every value that is not a string, and none throws", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(parseFixUtcTimestamp(make() as string), kind).toBeNull();
      }
    });

    it("returns null when Temporal throws", () => {
      mockTemporalPlainDateTimeFromThrow();
      expect(parseFixUtcTimestamp("20240615-14:30:00")).toBeNull();
    });
  });
});
