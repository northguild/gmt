import {
  FIX_UTC_TIMESTAMP,
  fixInstantText,
  fixPrecisionOfDigits,
  fixTimestampText,
  readFixUtcFields,
  resolveFixPrecision,
} from "./fixUtcTimestamp";
import { Temporal } from "./temporal";

/** 2024-06-15T14:30:00.123Z, checked with `Temporal.Instant.from(...).epochNanoseconds`. */
const ORDINARY = { epochNanoseconds: 1718461800123000000n, secondSixty: false };
/** The `…:59` instant of 2016-12-31 (Temporal's clamp of `23:59:60`) plus 500 ms. */
const LEAP_500 = { epochNanoseconds: 1483228799500000000n, secondSixty: true };
/** 2024-06-15T14:30:00.123456789Z, checked with the polyfill. */
const NINE = { epochNanoseconds: 1718461800123456789n, secondSixty: false };
/** 2024-06-15T14:30:00.999999999Z: a cut keeps :00, a round would reach :01. */
const NEAR_NEXT = {
  epochNanoseconds: 1718461800999999999n,
  secondSixty: false,
};
/** 2016-12-31T23:59:59.999999999Z read as second 60. */
const LEAP_NEAR_NEXT = {
  epochNanoseconds: 1483228799999999999n,
  secondSixty: true,
};
const LEAP_0 = { epochNanoseconds: 1483228799000000000n, secondSixty: true };

describe("FIX_UTC_TIMESTAMP", () => {
  it.each`
    value
    ${"20240615-14:30:00"}
    ${"20240615-14:30:00.123"}
    ${"20240615-14:30:00.123456"}
    ${"20240615-14:30:00.123456789"}
    ${"20240615-14:30:00.123456789012"}
    ${"20240615-14:30:60"}
  `("matches '$value'", ({ value }) => {
    expect(FIX_UTC_TIMESTAMP.test(value)).toBe(true);
  });

  it.each`
    value
    ${"20240615-14:30:00."}
    ${"20240615-14:30:00.1"}
    ${"20240615-14:30:00.12"}
    ${"20240615-14:30:00.1234"}
    ${"20240615-14:30:00.1234567890"}
    ${"20240615-14:30:00.1234567890123"}
    ${"20240615-14:30:61"}
    ${"20240615 14:30:00"}
    ${"20240615T14:30:00"}
    ${"2024-06-15T14:30:00Z"}
    ${"2024061514:30:00"}
    ${"20240615-143000"}
    ${"20240615-14:30:00Z"}
    ${"20240615-14:30:00\n"}
    ${" 20240615-14:30:00"}
    ${"٢٠٢٤0615-14:30:00"}
    ${"+20240615-14:30:00"}
    ${"202406151-4:30:00"}
    ${"junk\n20240615-14:30:00"}
    ${"20240615-14:30:00\njunk"}
    ${"20240615-14:30:00.123\n"}
  `("rejects '$value'", ({ value }) => {
    expect(FIX_UTC_TIMESTAMP.test(value)).toBe(false);
  });
});

describe("readFixUtcFields", () => {
  it("reads twelve fraction digits in four groups of three", () => {
    expect(readFixUtcFields("20240615-14:30:00.123456789012")).toEqual({
      year: 2024,
      month: 6,
      day: 15,
      hour: 14,
      minute: 30,
      second: 0,
      fractionDigits: 12,
      millisecond: 123,
      microsecond: 456,
      nanosecond: 789,
      picoseconds: 12,
    });
  });

  it("reads .050 as 50 ms with three digits", () => {
    expect(readFixUtcFields("20240615-14:30:00.050")).toMatchObject({
      fractionDigits: 3,
      millisecond: 50,
      microsecond: 0,
      nanosecond: 0,
      picoseconds: 0,
    });
  });

  it.each`
    value                            | digits | ms     | us     | ns
    ${"20240615-14:30:00.123456"}    | ${6}   | ${123} | ${456} | ${0}
    ${"20240615-14:30:00.123456789"} | ${9}   | ${123} | ${456} | ${789}
    ${"20240615-14:30:00.000000001"} | ${9}   | ${0}   | ${0}   | ${1}
  `("reads '$value' as $digits digits", ({ value, digits, ms, us, ns }) => {
    expect(readFixUtcFields(value)).toMatchObject({
      fractionDigits: digits,
      millisecond: ms,
      microsecond: us,
      nanosecond: ns,
      picoseconds: 0,
    });
  });

  it("reads second 60 with no fraction", () => {
    expect(readFixUtcFields("20161231-23:59:60")).toMatchObject({
      second: 60,
      fractionDigits: 0,
      millisecond: 0,
    });
  });

  it.each`
    value
    ${42}
    ${null}
    ${undefined}
    ${"2024-06-15"}
  `("returns null for $value", ({ value }) => {
    expect(readFixUtcFields(value)).toBeNull();
  });
});

describe("fixPrecisionOfDigits", () => {
  it.each`
    count | expected
    ${0}  | ${"second"}
    ${3}  | ${"millisecond"}
    ${6}  | ${"microsecond"}
    ${9}  | ${"nanosecond"}
    ${12} | ${"picosecond"}
  `("maps $count digits to $expected", ({ count, expected }) => {
    expect(fixPrecisionOfDigits(count)).toBe(expected);
  });
});

describe("resolveFixPrecision", () => {
  it.each`
    label               | value             | expected
    ${'"second"'}       | ${"second"}       | ${"second"}
    ${'"seconds"'}      | ${"seconds"}      | ${"second"}
    ${'"millisecond"'}  | ${"millisecond"}  | ${"millisecond"}
    ${'"milliseconds"'} | ${"milliseconds"} | ${"millisecond"}
    ${'"microsecond"'}  | ${"microsecond"}  | ${"microsecond"}
    ${'"microseconds"'} | ${"microseconds"} | ${"microsecond"}
    ${'"nanosecond"'}   | ${"nanosecond"}   | ${"nanosecond"}
    ${'"nanoseconds"'}  | ${"nanoseconds"}  | ${"nanosecond"}
    ${'"picosecond"'}   | ${"picosecond"}   | ${"picosecond"}
    ${'"picoseconds"'}  | ${"picoseconds"}  | ${"picosecond"}
    ${'"Second"'}       | ${"Second"}       | ${null}
    ${'"ms"'}           | ${"ms"}           | ${null}
    ${'"seconds "'}     | ${"seconds "}     | ${null}
    ${'""'}             | ${""}             | ${null}
    ${"3"}              | ${3}              | ${null}
    ${"null"}           | ${null}           | ${null}
    ${"undefined"}      | ${undefined}      | ${null}
    ${"{}"}             | ${{}}             | ${null}
    ${'"toString"'}     | ${"toString"}     | ${null}
    ${'"__proto__"'}    | ${"__proto__"}    | ${null}
  `("resolves $label to $expected", ({ value, expected }) => {
    expect(resolveFixPrecision(value)).toBe(expected);
  });
});

describe("fixInstantText", () => {
  it.each`
    label                | value                               | expected
    ${"no fraction"}     | ${"20240615-14:30:00"}              | ${"2024-06-15T14:30:00Z"}
    ${"3 digits"}        | ${"20240615-14:30:00.123"}          | ${"2024-06-15T14:30:00.123Z"}
    ${"trailing zeros"}  | ${"20240615-14:30:00.100"}          | ${"2024-06-15T14:30:00.100Z"}
    ${"6 digits"}        | ${"20240615-14:30:00.123000"}       | ${"2024-06-15T14:30:00.123000Z"}
    ${"9 digits"}        | ${"20240615-14:30:00.123456789"}    | ${"2024-06-15T14:30:00.123456789Z"}
    ${"12 digits"}       | ${"20240615-14:30:00.123456789012"} | ${"2024-06-15T14:30:00.123456789Z"}
    ${"near next"}       | ${"20240615-14:30:00.999999999"}    | ${"2024-06-15T14:30:00.999999999Z"}
    ${"leap, no fract."} | ${"20161231-23:59:60"}              | ${"2016-12-31T23:59:60Z"}
    ${"leap, .5"}        | ${"20161231-23:59:60.500"}          | ${"2016-12-31T23:59:60.500Z"}
    ${"leap, 9 digits"}  | ${"20161231-23:59:60.999999999"}    | ${"2016-12-31T23:59:60.999999999Z"}
    ${"leap, 12 digits"} | ${"20161231-23:59:60.500000000999"} | ${"2016-12-31T23:59:60.500000000Z"}
    ${"before 1970"}     | ${"19691231-23:59:59.999"}          | ${"1969-12-31T23:59:59.999Z"}
    ${"year 0"}          | ${"00000101-00:00:00"}              | ${"0000-01-01T00:00:00Z"}
    ${"year 9999 end"}   | ${"99991231-23:59:59"}              | ${"9999-12-31T23:59:59Z"}
    ${"leading zeros"}   | ${"00010203-04:05:06.007008009"}    | ${"0001-02-03T04:05:06.007008009Z"}
  `("writes $label ($value) as '$expected'", ({ value, expected }) => {
    expect(fixInstantText(readFixUtcFields(value)!)).toBe(expected);
  });

  it.each`
    value
    ${"20240615-14:30:00"}
    ${"20240615-14:30:00.123"}
    ${"20240615-14:30:00.123456"}
    ${"20240615-14:30:00.123456789"}
    ${"19691231-23:59:59.999999999"}
    ${"00000101-00:00:00"}
    ${"99991231-23:59:59.999"}
  `("writes $value as Temporal writes the same instant", ({ value }) => {
    const fields = readFixUtcFields(value)!;
    const instant = Temporal.PlainDateTime.from({
      year: fields.year,
      month: fields.month,
      day: fields.day,
      hour: fields.hour,
      minute: fields.minute,
      second: fields.second,
      millisecond: fields.millisecond,
      microsecond: fields.microsecond,
      nanosecond: fields.nanosecond,
    })
      .toZonedDateTime("UTC")
      .toInstant();
    expect(fixInstantText(fields)).toBe(
      instant.toString({
        fractionalSecondDigits: fields.fractionDigits as 0 | 3 | 6 | 9,
      }),
    );
  });
});

describe("fixTimestampText", () => {
  it.each`
    label          | reading                                                             | precision        | expected
    ${"ordinary"}  | ${ORDINARY}                                                         | ${"second"}      | ${"20240615-14:30:00"}
    ${"ordinary"}  | ${ORDINARY}                                                         | ${"millisecond"} | ${"20240615-14:30:00.123"}
    ${"ordinary"}  | ${ORDINARY}                                                         | ${"microsecond"} | ${"20240615-14:30:00.123000"}
    ${"ordinary"}  | ${ORDINARY}                                                         | ${"nanosecond"}  | ${"20240615-14:30:00.123000000"}
    ${"ordinary"}  | ${ORDINARY}                                                         | ${"picosecond"}  | ${"20240615-14:30:00.123000000000"}
    ${"leap"}      | ${LEAP_500}                                                         | ${"millisecond"} | ${"20161231-23:59:60.500"}
    ${"leap"}      | ${LEAP_0}                                                           | ${"second"}      | ${"20161231-23:59:60"}
    ${"leap .5"}   | ${LEAP_500}                                                         | ${"second"}      | ${"20161231-23:59:60"}
    ${"leap"}      | ${LEAP_500}                                                         | ${"microsecond"} | ${"20161231-23:59:60.500000"}
    ${"leap"}      | ${LEAP_500}                                                         | ${"nanosecond"}  | ${"20161231-23:59:60.500000000"}
    ${"leap"}      | ${LEAP_500}                                                         | ${"picosecond"}  | ${"20161231-23:59:60.500000000000"}
    ${"leap"}      | ${LEAP_NEAR_NEXT}                                                   | ${"millisecond"} | ${"20161231-23:59:60.999"}
    ${"nine"}      | ${NINE}                                                             | ${"millisecond"} | ${"20240615-14:30:00.123"}
    ${"nine"}      | ${NINE}                                                             | ${"microsecond"} | ${"20240615-14:30:00.123456"}
    ${"nine"}      | ${NINE}                                                             | ${"nanosecond"}  | ${"20240615-14:30:00.123456789"}
    ${"nine"}      | ${NINE}                                                             | ${"picosecond"}  | ${"20240615-14:30:00.123456789000"}
    ${"near next"} | ${NEAR_NEXT}                                                        | ${"second"}      | ${"20240615-14:30:00"}
    ${"near next"} | ${NEAR_NEXT}                                                        | ${"millisecond"} | ${"20240615-14:30:00.999"}
    ${"near next"} | ${NEAR_NEXT}                                                        | ${"microsecond"} | ${"20240615-14:30:00.999999"}
    ${"-1n"}       | ${{ epochNanoseconds: -1n, secondSixty: false }}                    | ${"millisecond"} | ${"19691231-23:59:59.999"}
    ${"year 9999"} | ${{ epochNanoseconds: 253402300799999999999n, secondSixty: false }} | ${"nanosecond"}  | ${"99991231-23:59:59.999999999"}
    ${"before 0"}  | ${{ epochNanoseconds: -62167219201000000000n, secondSixty: false }} | ${"second"}      | ${""}
    ${"-1n"}       | ${{ epochNanoseconds: -1n, secondSixty: false }}                    | ${"nanosecond"}  | ${"19691231-23:59:59.999999999"}
    ${"-1n"}       | ${{ epochNanoseconds: -1n, secondSixty: false }}                    | ${"picosecond"}  | ${"19691231-23:59:59.999999999000"}
    ${"-1n"}       | ${{ epochNanoseconds: -1n, secondSixty: false }}                    | ${"second"}      | ${"19691231-23:59:59"}
    ${"year 0"}    | ${{ epochNanoseconds: -62167219200000000000n, secondSixty: false }} | ${"second"}      | ${"00000101-00:00:00"}
    ${"past 9999"} | ${{ epochNanoseconds: 253402300800000000000n, secondSixty: false }} | ${"second"}      | ${""}
  `(
    "writes $label at $precision as '$expected'",
    ({ reading, precision, expected }) => {
      expect(fixTimestampText(reading, precision)).toBe(expected);
    },
  );
});
