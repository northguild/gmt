import { fromArrowLocalTimestamp } from "./fromArrowLocalTimestamp";
import { toArrowLocalTimestamp } from "./toArrowLocalTimestamp";

describe("toArrowLocalTimestamp", () => {
  it.each`
    dateTime                                              | unit              | expected
    ${"2024-01-01T00:00:00"}                              | ${"millisecond"}  | ${1_704_067_200_000n}
    ${"2024-01-01T00:00:00"}                              | ${"seconds"}      | ${1_704_067_200n}
    ${"2024-02-29T00:00:00.123456"}                       | ${"microsecond"}  | ${1_709_164_800_123_456n}
    ${"2024-01-01T00:00:00.123456789"}                    | ${"nanoseconds"}  | ${1_704_067_200_123_456_789n}
    ${"2024-01-01T00:00:00.123456789"}                    | ${"milliseconds"} | ${1_704_067_200_123n}
    ${"1969-12-31T23:59:59.999999999"}                    | ${"second"}       | ${-1n}
    ${"1969-12-31T23:59:59.999999999"}                    | ${"millisecond"}  | ${-1n}
    ${"1969-12-31T23:59:59.9999999"}                      | ${"microsecond"}  | ${-1n}
    ${"1969-12-31T00:00:00.000000001"}                    | ${"seconds"}      | ${-86_400n}
    ${"1970-01-01T00:00:00"}                              | ${"second"}       | ${0n}
    ${"2024-01-01T00:00:00.123456789"}                    | ${"microseconds"} | ${1_704_067_200_123_456n}
    ${"2024-01-01T00:00:00.123456789"}                    | ${"nanosecond"}   | ${1_704_067_200_123_456_789n}
    ${"1969-12-31T23:59:59.999999001"}                    | ${"microsecond"}  | ${-1n}
    ${"1969-12-31T23:59:59.000000001"}                    | ${"millisecond"}  | ${-1_000n}
    ${"1969-12-31T23:59:59.999999999"}                    | ${"nanosecond"}   | ${-1n}
    ${"+275760-09-13T00:00:00"}                           | ${"second"}       | ${8_640_000_000_000n}
    ${"-271821-04-20T00:00:00"}                           | ${"second"}       | ${-8_640_000_000_000n}
    ${"2024-01-01T00:00:00[Asia/Tokyo]"}                  | ${"second"}       | ${1_704_067_200n}
    ${"2024-01-01T00:00:00[u-ca=iso8601]"}                | ${"second"}       | ${1_704_067_200n}
    ${"2024-01-01T00:00:00[u-ca=iso8601][u-ca=japanese]"} | ${"second"}       | ${1_704_067_200n}
    ${"2262-04-11T23:47:16.854775807"}                    | ${"nanosecond"}   | ${9_223_372_036_854_775_807n}
    ${"1677-09-21T00:12:43.145224192"}                    | ${"nanosecond"}   | ${-(2n ** 63n)}
  `("returns $expected for $dateTime $unit", ({ dateTime, unit, expected }) => {
    expect(toArrowLocalTimestamp(dateTime, unit)).toBe(expected);
  });

  it.each`
    dateTime                                              | unit
    ${"2262-04-11T23:47:16.854775808"}                    | ${"nanosecond"}
    ${"1677-09-21T00:12:43.145224191"}                    | ${"nanosecond"}
    ${"+010000-01-01T00:00:00"}                           | ${"nanosecond"}
    ${"+275760-09-13T00:00:00.000000001"}                 | ${"second"}
    ${"-271821-04-19T23:59:59.999999999"}                 | ${"second"}
    ${"2024-01-01T00:00:00Z"}                             | ${"millisecond"}
    ${"2024-01-01T00:00:00+01:00"}                        | ${"second"}
    ${"2024-01-01T09:00:00+09:00[Asia/Tokyo]"}            | ${"second"}
    ${"2262-04-11T23:47:16.854775807Z"}                   | ${"nanosecond"}
    ${"2024-01-01"}                                       | ${"second"}
    ${"2024-01-01T23:59:60"}                              | ${"second"}
    ${"2024-01-01T00:00:00[u-ca=japanese]"}               | ${"second"}
    ${"2024-01-01T00:00:00[u-ca=japanese][u-ca=iso8601]"} | ${"second"}
    ${"2024-01-01 00:00:00"}                              | ${"second"}
    ${"2024-01-01T00:00:00[!foo=bar]"}                    | ${"second"}
    ${"2024-01-01T00:00:00"}                              | ${"ms"}
    ${"2024-01-01T00:00:00"}                              | ${"Second"}
    ${"2024-01-01T00:00:00"}                              | ${"SECOND"}
    ${"2024-01-01T00:00:00"}                              | ${"secondss"}
    ${"2024-01-01T00:00:00"}                              | ${"toString"}
    ${"2024-01-01T00:00:00"}                              | ${undefined}
    ${null}                                               | ${"second"}
    ${undefined}                                          | ${"second"}
    ${"invalid"}                                          | ${"second"}
    ${""}                                                 | ${"second"}
    ${42}                                                 | ${"second"}
  `("returns 0n for $dateTime $unit", ({ dateTime, unit }) => {
    expect(toArrowLocalTimestamp(dateTime, unit)).toBe(0n);
  });

  it.each`
    dateTime                           | unit
    ${"2024-01-01T00:00:00"}           | ${"second"}
    ${"1969-12-31T23:59:59.999999999"} | ${"nanosecond"}
    ${"+275760-09-13T00:00:00"}        | ${"second"}
    ${"1677-09-21T00:12:43.145224192"} | ${"nanosecond"}
  `("round-trips $dateTime $unit", ({ dateTime, unit }) => {
    expect(
      fromArrowLocalTimestamp(toArrowLocalTimestamp(dateTime, unit), unit),
    ).toBe(dateTime);
  });
});
