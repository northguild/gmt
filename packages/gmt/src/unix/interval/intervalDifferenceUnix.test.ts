import { intervalDifferenceUnix } from "./intervalDifferenceUnix";

describe("intervalDifferenceUnix", () => {
  it.each`
    aStart | aEnd          | bStart        | bEnd          | expected
    ${0}   | ${1700000000} | ${1500000000} | ${1600000000} | ${{ result: [{ start: 0, end: 1499999999 }, { start: 1600000001, end: 1700000000 }] }}
    ${0}   | ${1700000000} | ${0}          | ${1700000000} | ${{ result: [] }}
    ${0}   | ${1700000000} | ${1500000000} | ${1700000000} | ${{ result: [{ start: 0, end: 1499999999 }] }}
    ${0}   | ${1700000000} | ${0}          | ${1500000000} | ${{ result: [{ start: 1500000001, end: 1700000000 }] }}
    ${0}   | ${1700000000} | ${500000000}  | ${1000000000} | ${{ result: [{ start: 0, end: 499999999 }, { start: 1000000001, end: 1700000000 }] }}
  `(
    "returns $expected when A=$aStart..$aEnd and B=$bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      console.log("EXPECTED:", JSON.stringify(expected));
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${1700000000} | ${0}          | ${1500000000} | ${1600000000} | ${[]}
    ${1500000000} | ${1000000000} | ${1200000000} | ${1100000000} | ${[]}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
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
    "returns [] for non-finite values: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  it.each`
    aStart  | aEnd          | bStart        | bEnd
    ${null} | ${1700000000} | ${1500000000} | ${1600000000}
    ${0}    | ${undefined}  | ${1500000000} | ${1600000000}
    ${0}    | ${1700000000} | ${null}       | ${1600000000}
    ${0}    | ${1700000000} | ${1500000000} | ${undefined}
    ${true} | ${1700000000} | ${1500000000} | ${1600000000}
  `("returns [] for invalid types", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });

  it.each`
    aStart | aEnd            | bStart          | bEnd            | expected
    ${"0"} | ${"1700000000"} | ${"1500000000"} | ${"1600000000"} | ${{ result: [{ start: 0, end: 1499999999 }, { start: 1600000001, end: 1700000000 }] }}
    ${"0"} | ${"1700000000"} | ${"0"}          | ${"1700000000"} | ${{ result: [] }}
  `(
    "returns $expected for string numeric input",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      console.log("STRING EXPECTED:", JSON.stringify(expected));
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );
});
