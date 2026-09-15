import { intervalAbutsUnix } from "./intervalAbutsUnix";

describe("intervalAbutsUnix", () => {
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${0}          | ${1500000000} | ${1500000001} | ${1700000000} | ${true}
    ${1500000001} | ${1700000000} | ${0}          | ${1500000000} | ${true}
    ${0}          | ${1000}       | ${1001}       | ${2000}       | ${true}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart | aEnd          | bStart        | bEnd          | expected
    ${0}   | ${1500000000} | ${1500000002} | ${1700000000} | ${false}
    ${0}   | ${1500000001} | ${1500000000} | ${1700000000} | ${false}
    ${0}   | ${1500000000} | ${1600000000} | ${1700000000} | ${false}
  `(
    "returns $expected for non-adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${1700000000} | ${0}          | ${1500000000} | ${1600000000} | ${false}
    ${1500000000} | ${1000000000} | ${1200000000} | ${1100000000} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart       | aEnd          | bStart        | bEnd
    ${NaN}       | ${1700000000} | ${1500000000} | ${1600000000}
    ${Infinity}  | ${1700000000} | ${1500000000} | ${1600000000}
    ${-Infinity} | ${1700000000} | ${1500000000} | ${1600000000}
    ${0}         | ${NaN}        | ${1500000000} | ${1600000000}
    ${0}         | ${Infinity}   | ${1500000000} | ${1600000000}
    ${0}         | ${-Infinity}  | ${1500000000} | ${1600000000}
    ${0}         | ${1700000000} | ${NaN}        | ${1600000000}
    ${0}         | ${1700000000} | ${Infinity}   | ${1600000000}
    ${0}         | ${1700000000} | ${-Infinity}  | ${1600000000}
    ${0}         | ${1700000000} | ${1500000000} | ${NaN}
    ${0}         | ${1700000000} | ${1500000000} | ${Infinity}
    ${0}         | ${1700000000} | ${1500000000} | ${-Infinity}
  `(
    "returns false for non-finite values: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart  | aEnd          | bStart        | bEnd
    ${null} | ${1700000000} | ${1500000000} | ${1600000000}
    ${0}    | ${undefined}  | ${1500000000} | ${1600000000}
    ${0}    | ${1700000000} | ${null}       | ${1600000000}
    ${0}    | ${1700000000} | ${1500000000} | ${undefined}
    ${true} | ${1700000000} | ${1500000000} | ${1600000000}
  `("returns false for invalid types", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"0"}          | ${"1500000000"} | ${"1500000001"} | ${"1700000000"} | ${true}
    ${"1500000001"} | ${"1700000000"} | ${"0"}          | ${"1500000000"} | ${true}
  `(
    "returns $expected for string numeric input",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  // Epoch values are whole units. A fraction has no "next unit", and past 2^53 consecutive
  // integers collapse (2 ** 53 + 1 === 2 ** 53), so neither can be tested for adjacency.
  it.each`
    aStart | aEnd       | bStart     | bEnd           | description
    ${0}   | ${1.5}     | ${2.5}     | ${3}           | ${"fractional ends (1.5 + 1 === 2.5)"}
    ${0}   | ${1}       | ${0.5}     | ${2}           | ${"a fractional start"}
    ${0}   | ${2 ** 53} | ${2 ** 53} | ${2 ** 53 + 4} | ${"unsafe integers (2^53 + 1 === 2^53)"}
    ${"0"} | ${"1.5"}   | ${"2.5"}   | ${"3"}         | ${"fractional numeric strings"}
    ${""}  | ${"0"}     | ${"1"}     | ${"2"}         | ${"an empty string, which Number() reads as 0"}
  `(
    "returns false for A=[$aStart, $aEnd] and B=[$bStart, $bEnd] ($description)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it("returns true when B ends on the largest safe integer, one unit after A", () => {
    expect(
      intervalAbutsUnix(
        0,
        Number.MAX_SAFE_INTEGER - 1,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
      ),
    ).toBe(true);
  });
});
