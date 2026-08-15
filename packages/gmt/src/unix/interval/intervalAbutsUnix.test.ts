import { intervalAbutsUnix } from "./intervalAbutsUnix";

describe("intervalAbutsUnix", () => {
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${0}          | ${1500000000} | ${1500000001} | ${1700000000} | ${true}
    ${1500000001} | ${1700000000} | ${0}          | ${1500000000} | ${true}
    ${0}          | ${1000}       | ${1001}       | ${2000}       | ${true}
  `(
    "returns $expected when A=$aStart..$aEnd and B=$bStart..$bEnd",
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
});
