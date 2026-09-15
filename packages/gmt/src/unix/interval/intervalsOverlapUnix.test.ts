import { intervalsOverlapUnix } from "./intervalsOverlapUnix";

describe("intervalsOverlapUnix", () => {
  it.each`
    aStart  | aEnd       | bStart     | bEnd       | expected
    ${0}    | ${1000000} | ${500000}  | ${2000000} | ${true}
    ${0}    | ${2000000} | ${0}       | ${1000000} | ${true}
    ${0}    | ${1000000} | ${1000000} | ${2000000} | ${true}
    ${1000} | ${1000}    | ${1000}    | ${1000}    | ${true}
    ${0}    | ${1000000} | ${1000000} | ${1000000} | ${true}
  `(
    "returns $expected when intervals overlap",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart     | aEnd       | bStart     | bEnd       | expected
    ${0}       | ${1000000} | ${1000000} | ${2000000} | ${true}
    ${1000000} | ${2000000} | ${0}       | ${1000000} | ${true}
    ${0}       | ${1000000} | ${1000000} | ${1000000} | ${true}
    ${1000000} | ${1000000} | ${0}       | ${1000000} | ${true}
    ${0}       | ${1000000} | ${1000000} | ${999999}  | ${false}
  `(
    "returns $expected for adjacent or contained intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart     | aEnd       | bStart     | bEnd      | expected
    ${1000000} | ${0}       | ${2000000} | ${500000} | ${false}
    ${0}       | ${1000000} | ${1000000} | ${999999} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart       | bEnd
    ${NaN}        | ${1700000000} | ${1000000}   | ${2000000}
    ${Infinity}   | ${1700000000} | ${1000000}   | ${2000000}
    ${-Infinity}  | ${1700000000} | ${1000000}   | ${2000000}
    ${1700000000} | ${NaN}        | ${1000000}   | ${2000000}
    ${1700000000} | ${Infinity}   | ${1000000}   | ${2000000}
    ${1700000000} | ${-Infinity}  | ${1000000}   | ${2000000}
    ${1700000000} | ${1700000000} | ${NaN}       | ${2000000}
    ${1700000000} | ${1700000000} | ${Infinity}  | ${2000000}
    ${1700000000} | ${1700000000} | ${-Infinity} | ${2000000}
    ${1700000000} | ${1700000000} | ${1000000}   | ${NaN}
    ${1700000000} | ${1700000000} | ${1000000}   | ${Infinity}
    ${1700000000} | ${1700000000} | ${1000000}   | ${-Infinity}
  `(
    "returns false for non-finite: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalsOverlapUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart        | aEnd          | bStart       | bEnd
    ${null}       | ${1700000000} | ${1000000}   | ${2000000}
    ${undefined}  | ${1700000000} | ${1000000}   | ${2000000}
    ${"abc"}      | ${1700000000} | ${1000000}   | ${2000000}
    ${1700000000} | ${null}       | ${1000000}   | ${2000000}
    ${1700000000} | ${undefined}  | ${1000000}   | ${2000000}
    ${1700000000} | ${"abc"}      | ${1000000}   | ${2000000}
    ${1700000000} | ${1700000000} | ${null}      | ${2000000}
    ${1700000000} | ${1700000000} | ${undefined} | ${2000000}
    ${1700000000} | ${1700000000} | ${"abc"}     | ${2000000}
    ${1700000000} | ${1700000000} | ${1000000}   | ${null}
    ${1700000000} | ${1700000000} | ${1000000}   | ${undefined}
    ${1700000000} | ${1700000000} | ${1000000}   | ${"abc"}
  `("returns false for non-numeric input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalsOverlapUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it.each`
    aStart | aEnd         | bStart       | bEnd
    ${"0"} | ${"1000000"} | ${"500000"}  | ${"2000000"}
    ${"0"} | ${"2000000"} | ${"0"}       | ${"1000000"}
    ${"0"} | ${"1000000"} | ${"1000000"} | ${"2000000"}
  `("accepts string inputs", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalsOverlapUnix(aStart, aEnd, bStart, bEnd)).toBe(true);
  });

  // Epoch values are whole units; fractions, unsafe integers and empty strings are invalid input.
  it.each`
    aStart | aEnd       | bStart   | bEnd   | description
    ${0}   | ${10}      | ${0.5}   | ${11}  | ${"a fractional start"}
    ${0}   | ${2 ** 53} | ${1}     | ${2}   | ${"an unsafe end"}
    ${"0"} | ${"10"}    | ${"1.5"} | ${"2"} | ${"a fractional numeric string"}
    ${""}  | ${"10"}    | ${"1"}   | ${"2"} | ${"an empty string, which Number() reads as 0"}
  `(
    "returns false for A=[$aStart, $aEnd] and B=[$bStart, $bEnd] ($description)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalsOverlapUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );
});
