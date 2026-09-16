import {
  parseUnixEpochInterval,
  parseUnixEpochIntervalList,
  parseUnixEpochIntervalPair,
  parseUnixEpochValue,
  coerceUnixEpochNumber,
  isUnixEpochInInstantRange,
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

describe("coerceUnixEpochNumber", () => {
  // Blank strings become NaN (StringToNumber would give +0); every other input keeps Number().
  it.each`
    value           | expected      | description
    ${1700000000}   | ${1700000000} | ${"a number unchanged"}
    ${1.5}          | ${1.5}        | ${"a fraction unchanged (validated later)"}
    ${"1700000000"} | ${1700000000} | ${"a digit string"}
    ${" 12 "}       | ${12}         | ${"a padded digit string, as Number() reads it"}
    ${"0x10"}       | ${16}         | ${"a hex string, as Number() reads it"}
    ${"abc"}        | ${Number.NaN} | ${"a non-numeric string"}
    ${""}           | ${Number.NaN} | ${"an empty string"}
    ${"   "}        | ${Number.NaN} | ${"a spaces-only string"}
    ${"\n\t"}       | ${Number.NaN} | ${"a newline and tab string"}
    ${" "}          | ${Number.NaN} | ${"a no-break space string"}
  `("returns $expected for $description ($value)", ({ value, expected }) => {
    expect(coerceUnixEpochNumber(value)).toBe(expected);
  });
});

describe("isUnixEpochInInstantRange", () => {
  // Integer epochs within ±8.64e15 (Temporal nsMaxInstant / 10^6) name an instant.
  it.each`
    value                     | expected | description
    ${0}                      | ${true}  | ${"the epoch"}
    ${8_640_000_000_000_000}  | ${true}  | ${"the maximum instant"}
    ${-8_640_000_000_000_000} | ${true}  | ${"the minimum instant"}
    ${8_640_000_000_000_001}  | ${false} | ${"one past the maximum instant"}
    ${-8_640_000_000_000_001} | ${false} | ${"one past the minimum instant"}
    ${1.5}                    | ${false} | ${"a fraction"}
    ${NaN}                    | ${false} | ${"NaN"}
    ${"5"}                    | ${false} | ${"a numeric string"}
  `("returns $expected for $description ($value)", ({ value, expected }) => {
    expect(isUnixEpochInInstantRange(value)).toBe(expected);
  });
});
