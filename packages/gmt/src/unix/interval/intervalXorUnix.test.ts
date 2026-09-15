import { intervalXorUnix } from "./intervalXorUnix";

describe("intervalXorUnix", () => {
  // Closed [start, end]: the shared endpoint is covered twice, so xor excludes it from both pieces,
  // each stepping one unit in from it. Pieces list A's remainder, then B's.
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected                                                                   | reason
    ${0}          | ${1500000000} | ${1500000000} | ${1700000000} | ${[{ start: 0, end: 1499999999 }, { start: 1500000001, end: 1700000000 }]} | ${"A ends where B starts"}
    ${1500000000} | ${1700000000} | ${0}          | ${1500000000} | ${[{ start: 1500000001, end: 1700000000 }, { start: 0, end: 1499999999 }]} | ${"A starts where B ends"}
    ${1500000000} | ${1500000000} | ${1500000000} | ${1700000000} | ${[{ start: 1500000001, end: 1700000000 }]}                                | ${"zero-length A on B's start"}
  `(
    "returns $expected for touching A=[$aStart, $aEnd] xor B=[$bStart, $bEnd] ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorUnix(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${0}          | ${1500000000} | ${1400000000} | ${1700000000} | ${{ result: [{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }] }}
    ${0}          | ${1700000000} | ${1400000000} | ${1500000000} | ${{ result: [{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }] }}
    ${0}          | ${1700000000} | ${0}          | ${1700000000} | ${{ result: [] }}
    ${0}          | ${1500000000} | ${1600000000} | ${1700000000} | ${{ result: [{ start: 0, end: 1500000000 }, { start: 1600000000, end: 1700000000 }] }}
    ${1400000000} | ${1500000000} | ${0}          | ${1000000000} | ${{ result: [{ start: 1400000000, end: 1500000000 }, { start: 0, end: 1000000000 }] }}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorUnix(aStart, aEnd, bStart, bEnd)).toEqual(
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
      expect(intervalXorUnix(aStart, aEnd, bStart, bEnd)).toEqual(expected);
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
      expect(intervalXorUnix(aStart, aEnd, bStart, bEnd)).toEqual([]);
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
    expect(intervalXorUnix(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });

  it.each`
    aStart | aEnd            | bStart          | bEnd            | expected
    ${"0"} | ${"1500000000"} | ${"1400000000"} | ${"1700000000"} | ${{ result: [{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }] }}
    ${"0"} | ${"1700000000"} | ${"0"}          | ${"1700000000"} | ${{ result: [] }}
  `(
    "returns $expected for string numeric input",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  // Epoch values are whole units. A fraction would produce pieces such as [0, -0.5], and past 2^53
  // "one unit before/after" is not representable.
  it.each`
    aStart | aEnd       | bStart   | bEnd   | description
    ${0}   | ${1}       | ${0.5}   | ${2}   | ${"a fractional start (was [{0, -0.5}, {2, 2}])"}
    ${0}   | ${1.5}     | ${1}     | ${2}   | ${"a fractional end"}
    ${0}   | ${2 ** 53} | ${1}     | ${2}   | ${"an unsafe end"}
    ${"0"} | ${"1"}     | ${"0.5"} | ${"2"} | ${"a fractional numeric string"}
    ${""}  | ${"1"}     | ${"1"}   | ${"2"} | ${"an empty string, which Number() reads as 0"}
  `(
    "returns [] for A=[$aStart, $aEnd] xor B=[$bStart, $bEnd] ($description)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalXorUnix(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  // Overlap is [MAX - 7, MAX - 5]: A keeps [MAX - 10, MAX - 8], B keeps [MAX - 4, MAX].
  it("returns both one-sided pieces when B ends on the largest safe integer", () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(intervalXorUnix(max - 10, max - 5, max - 7, max)).toEqual([
      { start: max - 10, end: max - 8 },
      { start: max - 4, end: max },
    ]);
  });
});
