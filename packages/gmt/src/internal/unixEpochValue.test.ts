import {
  parseUnixEpochInterval,
  parseUnixEpochIntervalList,
  parseUnixEpochIntervalPair,
  parseUnixEpochValue,
  parseUnixEpochInInstantRange,
  resolveUnixEpochUnit,
  resolveUnixEpochUnitOptions,
  toUnixEpoch,
  unixEpochToInstant,
} from "./unixEpochValue";

describe("parseUnixEpochValue", () => {
  it.each`
    value                       | expected                    | description
    ${0}                        | ${0}                        | ${"the epoch"}
    ${1704067200000}            | ${1704067200000}            | ${"milliseconds"}
    ${-8640000000000000}        | ${-8640000000000000}        | ${"the first Temporal instant in milliseconds"}
    ${Number.MAX_SAFE_INTEGER}  | ${Number.MAX_SAFE_INTEGER}  | ${"the largest safe integer, 2^53 - 1"}
    ${-Number.MAX_SAFE_INTEGER} | ${-Number.MAX_SAFE_INTEGER} | ${"the smallest safe integer"}
    ${"1704067200"}             | ${1704067200}               | ${"a numeric string"}
    ${"-86400"}                 | ${-86400}                   | ${"a negative numeric string"}
    ${"007"}                    | ${7}                        | ${"leading zeros are still ASCII digits"}
    ${"-0"}                     | ${0}                        | ${"negative zero string reads as the epoch"}
    ${-0}                       | ${0}                        | ${"negative zero number reads as the epoch"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(parseUnixEpochValue(value)).toBe(expected);
  });

  it.each`
    value                 | description
    ${1.5}                | ${"a fractional number"}
    ${-0.5}               | ${"a negative fraction"}
    ${2 ** 53}            | ${"2^53, the first unsafe integer"}
    ${-(2 ** 53)}         | ${"-2^53"}
    ${NaN}                | ${"NaN"}
    ${Infinity}           | ${"Infinity"}
    ${-Infinity}          | ${"-Infinity"}
    ${"1.5"}              | ${"a fractional numeric string"}
    ${"9007199254740992"} | ${"an unsafe numeric string"}
    ${""}                 | ${"an empty string, which Number() reads as 0"}
    ${"   "}              | ${"a whitespace-only string, which Number() reads as 0"}
    ${"abc"}              | ${"a non-numeric string"}
    ${null}               | ${"null"}
    ${undefined}          | ${"undefined"}
    ${true}               | ${"a boolean"}
    ${[1]}                | ${"an array, which Number() would read as 1"}
    ${" 12"}              | ${"a leading space"}
    ${"12 "}              | ${"a trailing space"}
    ${"12\n"}             | ${"a trailing newline"}
    ${"+12"}              | ${"an explicit plus sign"}
    ${"--12"}             | ${"a doubled minus sign"}
    ${"-"}                | ${"a bare minus sign"}
    ${"0x10"}             | ${"a hex literal, which Number() reads as 16"}
    ${"0b11"}             | ${"a binary literal"}
    ${"1e3"}              | ${"exponent notation, which Number() reads as 1000"}
    ${"12.0"}             | ${"a decimal point with a zero fraction"}
    ${"1_000"}            | ${"a numeric separator"}
    ${"١٢"}               | ${"non-ASCII (Arabic-Indic) digits"}
    ${"Infinity"}         | ${"the string Infinity"}
    ${12n}                | ${"a bigint"}
  `("returns null for $value ($description)", ({ value }) => {
    expect(parseUnixEpochValue(value)).toBeNull();
  });
});

describe("parseUnixEpochInterval", () => {
  it.each`
    start  | end        | expected                 | description
    ${0}   | ${10}      | ${{ start: 0, end: 10 }} | ${"an ascending interval"}
    ${5}   | ${5}       | ${{ start: 5, end: 5 }}  | ${"a zero-length interval"}
    ${"0"} | ${"10"}    | ${{ start: 0, end: 10 }} | ${"numeric strings"}
    ${10}  | ${0}       | ${null}                  | ${"a reversed interval"}
    ${0}   | ${1.5}     | ${null}                  | ${"a fractional end"}
    ${""}  | ${1}       | ${null}                  | ${"an empty-string start"}
    ${0}   | ${2 ** 53} | ${null}                  | ${"an unsafe end"}
  `(
    "returns $expected for [$start, $end] ($description)",
    ({ start, end, expected }) => {
      expect(parseUnixEpochInterval(start, end)).toEqual(expected);
    },
  );
});

describe("parseUnixEpochIntervalPair", () => {
  it.each`
    aStart | aEnd   | bStart | bEnd    | expected                                          | description
    ${0}   | ${10}  | ${"5"} | ${"20"} | ${[{ start: 0, end: 10 }, { start: 5, end: 20 }]} | ${"two valid intervals"}
    ${0}   | ${10}  | ${20}  | ${5}    | ${null}                                           | ${"B reversed"}
    ${10}  | ${0}   | ${5}   | ${20}   | ${null}                                           | ${"A reversed"}
    ${0}   | ${1.5} | ${5}   | ${20}   | ${null}                                           | ${"A with a fractional end"}
    ${0}   | ${10}  | ${""}  | ${20}   | ${null}                                           | ${"B with an empty-string start"}
  `(
    "returns $expected for A=[$aStart, $aEnd] and B=[$bStart, $bEnd] ($description)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );
});

describe("parseUnixEpochIntervalList", () => {
  it.each`
    intervals                                           | expected                                        | description
    ${[]}                                               | ${[]}                                           | ${"an empty list"}
    ${[{ start: 0, end: 1 }, { start: "2", end: "3" }]} | ${[{ start: 0, end: 1 }, { start: 2, end: 3 }]} | ${"numbers and numeric strings, in input order"}
    ${[{ start: 0, end: 1 }, { start: 3, end: 2 }]}     | ${null}                                         | ${"a reversed element"}
    ${[{ start: 0, end: 1 }, "not-an-object"]}          | ${null}                                         | ${"a non-object element"}
    ${[null]}                                           | ${null}                                         | ${"a null element"}
    ${[{ start: 0 }]}                                   | ${null}                                         | ${"a missing end"}
    ${"not-an-array"}                                   | ${null}                                         | ${"not an array"}
  `(
    "returns $expected for $intervals ($description)",
    ({ intervals, expected }) => {
      expect(parseUnixEpochIntervalList(intervals)).toEqual(expected);
    },
  );
});

describe("resolveUnixEpochUnit", () => {
  // Temporal §13.17 GetTemporalUnitValuedOption: singular and plural names are the same unit.
  it.each`
    unit              | expected
    ${undefined}      | ${"milliseconds"}
    ${"milliseconds"} | ${"milliseconds"}
    ${"millisecond"}  | ${"milliseconds"}
    ${"seconds"}      | ${"seconds"}
    ${"second"}       | ${"seconds"}
    ${"nanoseconds"}  | ${null}
    ${"Seconds"}      | ${null}
    ${""}             | ${null}
    ${null}           | ${null}
    ${1000}           | ${null}
  `("returns $expected for epochUnit $unit", ({ unit, expected }) => {
    expect(resolveUnixEpochUnit(unit)).toBe(expected);
  });
});

describe("unixEpochToInstant", () => {
  it.each`
    value             | epochUnit         | expected                      | description
    ${0}              | ${"seconds"}      | ${"1970-01-01T00:00:00Z"}     | ${"the epoch"}
    ${"1710685845"}   | ${"seconds"}      | ${"2024-03-17T14:30:45Z"}     | ${"a seconds digit string"}
    ${-1}             | ${"milliseconds"} | ${"1969-12-31T23:59:59.999Z"} | ${"one millisecond before the epoch"}
    ${8.64e15}        | ${"milliseconds"} | ${"+275760-09-13T00:00:00Z"}  | ${"the last Temporal instant"}
    ${-8.64e15}       | ${"milliseconds"} | ${"-271821-04-20T00:00:00Z"}  | ${"the first Temporal instant"}
    ${8.64e12}        | ${"seconds"}      | ${"+275760-09-13T00:00:00Z"}  | ${"the last Temporal instant in seconds"}
    ${8.64e15 + 1}    | ${"milliseconds"} | ${null}                       | ${"one millisecond past the range"}
    ${8.64e12 + 1}    | ${"seconds"}      | ${null}                       | ${"one second past the range"}
    ${1.5}            | ${"milliseconds"} | ${null}                       | ${"a fractional millisecond"}
    ${" 1710685845 "} | ${"seconds"}      | ${null}                       | ${"a padded digit string"}
    ${"abc"}          | ${"seconds"}      | ${null}                       | ${"a non-numeric string"}
  `(
    "returns $expected for $value in $epochUnit ($description)",
    ({ value, epochUnit, expected }) => {
      expect(unixEpochToInstant(value, epochUnit)?.toString() ?? null).toBe(
        expected,
      );
    },
  );
});

describe("toUnixEpoch", () => {
  // Seconds floor toward -Infinity, so an instant 1 ms before the epoch is second -1.
  it.each`
    epochMilliseconds | epochUnit         | expected
    ${1710685845123}  | ${"milliseconds"} | ${1710685845123}
    ${1710685845999}  | ${"seconds"}      | ${1710685845}
    ${-1}             | ${"seconds"}      | ${-1}
    ${-1000}          | ${"seconds"}      | ${-1}
  `(
    "returns $expected for $epochMilliseconds ms in $epochUnit",
    ({ epochMilliseconds, epochUnit, expected }) => {
      expect(toUnixEpoch({ epochMilliseconds }, epochUnit)).toBe(expected);
    },
  );
});

describe("parseUnixEpochInInstantRange", () => {
  // Epochs within ±8.64e15 (Temporal nsMaxInstant / 10^6) name an instant in either unit.
  it.each`
    value                     | expected                  | description
    ${0}                      | ${0}                      | ${"the epoch"}
    ${"-5"}                   | ${-5}                     | ${"a negative digit string"}
    ${8_640_000_000_000_000}  | ${8_640_000_000_000_000}  | ${"the maximum instant"}
    ${-8_640_000_000_000_000} | ${-8_640_000_000_000_000} | ${"the minimum instant"}
    ${8_640_000_000_000_001}  | ${null}                   | ${"one past the maximum instant"}
    ${-8_640_000_000_000_001} | ${null}                   | ${"one past the minimum instant"}
    ${1.5}                    | ${null}                   | ${"a fraction"}
    ${NaN}                    | ${null}                   | ${"NaN"}
    ${"1e3"}                  | ${null}                   | ${"exponent notation"}
  `("returns $expected for $description ($value)", ({ value, expected }) => {
    expect(parseUnixEpochInInstantRange(value)).toBe(expected);
  });
});

describe("resolveUnixEpochUnitOptions", () => {
  // TC39 GetOptionsObject: undefined → defaults; a non-object → TypeError (here null).
  it.each`
    options                     | expected
    ${undefined}                | ${"milliseconds"}
    ${{}}                       | ${"milliseconds"}
    ${{ epochUnit: undefined }} | ${"milliseconds"}
    ${{ epochUnit: "second" }}  | ${"seconds"}
    ${{ epochUnit: "minutes" }} | ${null}
    ${"seconds"}                | ${null}
    ${null}                     | ${null}
    ${1000}                     | ${null}
  `("returns $expected for options $options", ({ options, expected }) => {
    expect(resolveUnixEpochUnitOptions(options)).toBe(expected);
  });
});
