import { intervalsOverlapUnix } from "./intervalsOverlapUnix";

describe("intervalsOverlapUnix", () => {
  // Half-open [start, end): A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z, D = 17:00Z in ms
  // (coding-standards § 8). Overlap is `aStart < bEnd && bStart < aEnd`, as in `intervalsOverlap`.
  it.each`
    aStart           | aEnd             | bStart           | bEnd             | expected | reason
    ${1704099600000} | ${1704114000000} | ${1704110400000} | ${1704128400000} | ${true}  | ${"partial overlap [A, C) and [B, D)"}
    ${1704099600000} | ${1704128400000} | ${1704110400000} | ${1704114000000} | ${true}  | ${"[B, C) strictly inside [A, D)"}
    ${1704099600000} | ${1704110400000} | ${1704110400000} | ${1704128400000} | ${false} | ${"touching: [A, B) ends where [B, D) starts"}
    ${1704110400000} | ${1704128400000} | ${1704099600000} | ${1704110400000} | ${false} | ${"touching, arguments swapped"}
    ${1704099600000} | ${1704110400000} | ${1704110400001} | ${1704128400000} | ${false} | ${"one-unit gap"}
    ${1704099600000} | ${1704110400001} | ${1704110400000} | ${1704128400000} | ${true}  | ${"one-unit overlap"}
    ${1704099600000} | ${1704128400000} | ${1704110400000} | ${1704110400000} | ${true}  | ${"empty [B, B) strictly inside [A, D)"}
    ${1704099600000} | ${1704128400000} | ${1704099600000} | ${1704099600000} | ${false} | ${"empty [A, A) at A's start edge"}
    ${1704099600000} | ${1704128400000} | ${1704128400000} | ${1704128400000} | ${false} | ${"empty [D, D) at A's end edge"}
    ${1704110400000} | ${1704110400000} | ${1704110400000} | ${1704110400000} | ${false} | ${"two identical empty intervals"}
  `(
    "returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
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
    aStart | aEnd         | bStart       | bEnd         | expected
    ${"0"} | ${"1000000"} | ${"500000"}  | ${"2000000"} | ${true}
    ${"0"} | ${"2000000"} | ${"0"}       | ${"1000000"} | ${true}
    ${"0"} | ${"1000000"} | ${"1000000"} | ${"2000000"} | ${false}
  `(
    "accepts string inputs: [$aStart, $aEnd) and [$bStart, $bEnd) gives $expected",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

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
