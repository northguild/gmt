import { intervalUnionUnix } from "./intervalUnionUnix";

describe("intervalUnionUnix", () => {
  it.each`
    aStart     | aEnd          | bStart     | bEnd          | expected
    ${0}       | ${1700000000} | ${1000000} | ${2000000}    | ${{ start: 0, end: 1700000000 }}
    ${0}       | ${1000000}    | ${1000000} | ${2000000}    | ${{ start: 0, end: 2000000 }}
    ${1000000} | ${2000000}    | ${0}       | ${1700000000} | ${{ start: 0, end: 1700000000 }}
    ${0}       | ${1000000}    | ${500000}  | ${500000}     | ${{ start: 0, end: 1000000 }}
    ${500000}  | ${500000}     | ${0}       | ${1000000}    | ${{ start: 0, end: 1000000 }}
    ${0}       | ${1000000}    | ${100}     | ${200}        | ${{ start: 0, end: 1000000 }}
  `(
    "returns merged interval when $aStart to $aEnd overlaps $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionUnix(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart     | aEnd       | bStart     | bEnd       | expected
    ${0}       | ${1000000} | ${1000001} | ${2000000} | ${null}
    ${1000001} | ${2000000} | ${0}       | ${1000000} | ${null}
  `(
    "returns null when $aEnd is before $bStart (disjoint)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart     | aEnd       | bStart     | bEnd       | expected
    ${0}       | ${1000000} | ${1000000} | ${2000000} | ${{ start: 0, end: 2000000 }}
    ${1000000} | ${1000000} | ${0}       | ${1000000} | ${{ start: 0, end: 1000000 }}
  `(
    "returns merged interval when $aEnd equals $bStart (adjacent)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionUnix(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart     | aEnd       | bStart | bEnd   | expected
    ${1000000} | ${0}       | ${100} | ${200} | ${null}
    ${0}       | ${1000000} | ${200} | ${100} | ${null}
  `(
    "returns null when $aStart is after $aEnd (reversed)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart       | aEnd          | bStart      | bEnd
    ${NaN}       | ${1700000000} | ${1000000}  | ${2000000}
    ${Infinity}  | ${1700000000} | ${1000000}  | ${2000000}
    ${-Infinity} | ${1700000000} | ${1000000}  | ${2000000}
    ${0}         | ${NaN}        | ${1000000}  | ${2000000}
    ${0}         | ${Infinity}   | ${1000000}  | ${2000000}
    ${0}         | ${1000000}    | ${NaN}      | ${2000000}
    ${0}         | ${1000000}    | ${Infinity} | ${2000000}
  `(
    "returns null for non-finite values: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalUnionUnix(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart       | aEnd          | bStart       | bEnd
    ${null}      | ${1700000000} | ${1000000}   | ${2000000}
    ${undefined} | ${1700000000} | ${1000000}   | ${2000000}
    ${"abc"}     | ${1700000000} | ${1000000}   | ${2000000}
    ${0}         | ${null}       | ${1000000}   | ${2000000}
    ${0}         | ${undefined}  | ${1000000}   | ${2000000}
    ${0}         | ${"abc"}      | ${1000000}   | ${2000000}
    ${0}         | ${1700000000} | ${null}      | ${2000000}
    ${0}         | ${1700000000} | ${undefined} | ${2000000}
    ${0}         | ${1700000000} | ${"abc"}     | ${2000000}
    ${0}         | ${1000000}    | ${1000001}   | ${null}
    ${0}         | ${1000000}    | ${1000001}   | ${undefined}
    ${0}         | ${1000000}    | ${1000001}   | ${"abc"}
  `(
    "returns null for non-string/number input: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalUnionUnix(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBeNull();
    },
  );

  it.each`
    aStart | aEnd         | bStart       | bEnd         | expected
    ${"0"} | ${"1000000"} | ${"1000000"} | ${"2000000"} | ${{ start: 0, end: 2000000 }}
    ${"0"} | ${"1000000"} | ${"500000"}  | ${"2000000"} | ${{ start: 0, end: 2000000 }}
    ${"0"} | ${"2000000"} | ${"0"}       | ${"1000000"} | ${{ start: 0, end: 2000000 }}
  `(
    "returns merged interval when string inputs $aStart to $aEnd overlap $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionUnix(aStart, aEnd, bStart, bEnd)).toEqual(expected);
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
    "returns null for A=[$aStart, $aEnd] and B=[$bStart, $bEnd] ($description)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalUnionUnix(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );
});
