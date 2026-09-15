import { intervalDifferenceUnix } from "./intervalDifferenceUnix";

describe("intervalDifferenceUnix", () => {
  // Closed [start, end]: the shared endpoint belongs to both intervals, so A minus B loses it and the
  // remaining piece stops (or starts) one unit short of it.
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected                                    | reason
    ${0}          | ${1500000000} | ${1500000000} | ${1700000000} | ${[{ start: 0, end: 1499999999 }]}          | ${"A ends where B starts"}
    ${1500000000} | ${1700000000} | ${0}          | ${1500000000} | ${[{ start: 1500000001, end: 1700000000 }]} | ${"A starts where B ends"}
    ${1500000000} | ${1500000000} | ${1500000000} | ${1700000000} | ${[]}                                       | ${"zero-length A on B's start"}
  `(
    "returns $expected for touching A=[$aStart, $aEnd] minus B=[$bStart, $bEnd] ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart | aEnd          | bStart        | bEnd          | expected
    ${0}   | ${1700000000} | ${1500000000} | ${1600000000} | ${{ result: [{ start: 0, end: 1499999999 }, { start: 1600000001, end: 1700000000 }] }}
    ${0}   | ${1700000000} | ${0}          | ${1700000000} | ${{ result: [] }}
    ${0}   | ${1700000000} | ${1500000000} | ${1700000000} | ${{ result: [{ start: 0, end: 1499999999 }] }}
    ${0}   | ${1700000000} | ${0}          | ${1500000000} | ${{ result: [{ start: 1500000001, end: 1700000000 }] }}
    ${0}   | ${1700000000} | ${500000000}  | ${1000000000} | ${{ result: [{ start: 0, end: 499999999 }, { start: 1000000001, end: 1700000000 }] }}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  // B entirely before A removes nothing from A: the remaining piece is A itself, never a piece that
  // starts at bEnd + 1 inside the gap between them.
  it.each`
    aStart | aEnd  | bStart | bEnd | expected                   | description
    ${5}   | ${10} | ${0}   | ${2} | ${[{ start: 5, end: 10 }]} | ${"a two-unit gap (3 and 4 are not in A)"}
    ${5}   | ${10} | ${0}   | ${3} | ${[{ start: 5, end: 10 }]} | ${"a one-unit gap (4 is not in A)"}
    ${5}   | ${10} | ${0}   | ${4} | ${[{ start: 5, end: 10 }]} | ${"B ends one unit before A starts"}
  `(
    "returns $expected for A=[$aStart, $aEnd] minus B=[$bStart, $bEnd] ($description)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
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
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  // Epoch values are whole units. A fraction would produce pieces such as [0, -0.5], and past 2^53
  // "one unit before" is not representable.
  it.each`
    aStart | aEnd       | bStart   | bEnd   | description
    ${0}   | ${2}       | ${0.5}   | ${1}   | ${"a fractional start"}
    ${0}   | ${1.5}     | ${1}     | ${2}   | ${"a fractional end"}
    ${0}   | ${2 ** 53} | ${1}     | ${2}   | ${"an unsafe end"}
    ${"0"} | ${"2"}     | ${"0.5"} | ${"1"} | ${"a fractional numeric string"}
    ${""}  | ${"2"}     | ${"1"}   | ${"2"} | ${"an empty string, which Number() reads as 0"}
  `(
    "returns [] for A=[$aStart, $aEnd] minus B=[$bStart, $bEnd] ($description)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  it("returns the piece before B when B ends on the largest safe integer", () => {
    expect(
      intervalDifferenceUnix(
        0,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
      ),
    ).toEqual([{ start: 0, end: Number.MAX_SAFE_INTEGER - 1 }]);
  });
});
