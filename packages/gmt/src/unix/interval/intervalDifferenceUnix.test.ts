import { intervalDifferenceUnix } from "./intervalDifferenceUnix";

describe("intervalDifferenceUnix", () => {
  // Half-open [start, end), as in `subtractIntervals`: touching intervals share no instant, so
  // A minus B is A whole, and every cut lands exactly on B's own start or end (coding-standards § 8:
  // A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z, D = 17:00Z in ms).
  it.each`
    aStart           | aEnd             | bStart           | bEnd             | expected                                                                                        | reason
    ${1704099600000} | ${1704128400000} | ${1704110400000} | ${1704114000000} | ${[{ start: 1704099600000, end: 1704110400000 }, { start: 1704114000000, end: 1704128400000 }]} | ${"[A, D) minus [B, C) is [A, B) and [C, D)"}
    ${0}             | ${1500000000}    | ${1500000000}    | ${1700000000}    | ${[{ start: 0, end: 1500000000 }]}                                                              | ${"A ends where B starts"}
    ${1500000000}    | ${1700000000}    | ${0}             | ${1500000000}    | ${[{ start: 1500000000, end: 1700000000 }]}                                                     | ${"A starts where B ends"}
    ${1500000000}    | ${1500000000}    | ${1500000000}    | ${1700000000}    | ${[]}                                                                                           | ${"empty A holds no instant"}
    ${1500000000}    | ${1500000000}    | ${0}             | ${1000}          | ${[]}                                                                                           | ${"empty A apart from B"}
    ${0}             | ${1700000000}    | ${1500000000}    | ${1500000000}    | ${[{ start: 0, end: 1700000000 }]}                                                              | ${"empty B strictly inside removes nothing"}
    ${0}             | ${1700000000}    | ${1699999999}    | ${1700000000}    | ${[{ start: 0, end: 1699999999 }]}                                                              | ${"B covers A's last unit"}
  `(
    "returns $expected for A=[$aStart, $aEnd) minus B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart | aEnd          | bStart        | bEnd          | expected
    ${0}   | ${1700000000} | ${1500000000} | ${1600000000} | ${{ result: [{ start: 0, end: 1500000000 }, { start: 1600000000, end: 1700000000 }] }}
    ${0}   | ${1700000000} | ${0}          | ${1700000000} | ${{ result: [] }}
    ${0}   | ${1700000000} | ${1500000000} | ${1700000000} | ${{ result: [{ start: 0, end: 1500000000 }] }}
    ${0}   | ${1700000000} | ${0}          | ${1500000000} | ${{ result: [{ start: 1500000000, end: 1700000000 }] }}
    ${0}   | ${1700000000} | ${500000000}  | ${1000000000} | ${{ result: [{ start: 0, end: 500000000 }, { start: 1000000000, end: 1700000000 }] }}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  // B entirely before A removes nothing from A: the remaining piece is A itself, never a piece that
  // starts inside the gap between them.
  it.each`
    aStart | aEnd  | bStart | bEnd | expected                   | description
    ${5}   | ${10} | ${0}   | ${2} | ${[{ start: 5, end: 10 }]} | ${"a two-unit gap (3 and 4 are not in A)"}
    ${5}   | ${10} | ${0}   | ${3} | ${[{ start: 5, end: 10 }]} | ${"a one-unit gap (4 is not in A)"}
    ${5}   | ${10} | ${0}   | ${4} | ${[{ start: 5, end: 10 }]} | ${"B ends one unit before A starts"}
    ${5}   | ${10} | ${0}   | ${5} | ${[{ start: 5, end: 10 }]} | ${"B ends where A starts (touching)"}
  `(
    "returns $expected for A=[$aStart, $aEnd) minus B=[$bStart, $bEnd) ($description)",
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
    ${"0"} | ${"1700000000"} | ${"1500000000"} | ${"1600000000"} | ${{ result: [{ start: 0, end: 1500000000 }, { start: 1600000000, end: 1700000000 }] }}
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

  // Range edge (CORE-6): no boundary is stepped, so nothing is computed past the largest safe
  // integer. Restated for half-open: an empty B at the maximum removes nothing, and a B covering the
  // last unit cuts exactly at its own start.
  it.each`
    bStart                         | expected                                            | description
    ${Number.MAX_SAFE_INTEGER}     | ${[{ start: 0, end: Number.MAX_SAFE_INTEGER }]}     | ${"an empty B at the largest safe integer"}
    ${Number.MAX_SAFE_INTEGER - 1} | ${[{ start: 0, end: Number.MAX_SAFE_INTEGER - 1 }]} | ${"a B covering the last unit"}
  `(
    "returns $expected for A=[0, MAX_SAFE_INTEGER) minus B=[$bStart, MAX_SAFE_INTEGER) ($description)",
    ({ bStart, expected }) => {
      expect(
        intervalDifferenceUnix(
          0,
          Number.MAX_SAFE_INTEGER,
          bStart,
          Number.MAX_SAFE_INTEGER,
        ),
      ).toEqual(expected);
    },
  );
});
