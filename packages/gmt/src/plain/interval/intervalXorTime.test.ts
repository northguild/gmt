import { intervalXorTime } from "./intervalXorTime";

describe("intervalXorTime", () => {
  // Closed [start, end]: the shared endpoint is covered twice, so xor excludes it from both pieces,
  // each stepping one unit in from it. Pieces list A's remainder, then B's.
  it.each`
    aStart        | aEnd          | bStart        | bEnd                    | expected                                                                                                          | reason
    ${"09:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"17:00:00"}           | ${[{ start: "09:00:00", end: "11:59:59.999999999" }, { start: "12:00:00.000000001", end: "17:00:00" }]}           | ${"A ends where B starts"}
    ${"12:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"}           | ${[{ start: "12:00:00.000000001", end: "17:00:00" }, { start: "09:00:00", end: "11:59:59.999999999" }]}           | ${"A starts where B ends"}
    ${"00:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"23:59:59.999999999"} | ${[{ start: "00:00:00", end: "11:59:59.999999999" }, { start: "12:00:00.000000001", end: "23:59:59.999999999" }]} | ${"the whole day split at noon"}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"17:00:00"}           | ${[{ start: "12:00:00.000000001", end: "17:00:00" }]}                                                             | ${"zero-length A on B's start"}
  `(
    "returns $expected for touching A=[$aStart, $aEnd] xor B=[$bStart, $bEnd] ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorTime(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${"17:00:00"} | ${{ result: [{ start: "09:00:00", end: "10:59:59.999999999" }, { start: "12:00:00.000000001", end: "17:00:00" }] }}
    ${"09:00:00"} | ${"17:00:00"} | ${"11:00:00"} | ${"12:00:00"} | ${{ result: [{ start: "09:00:00", end: "10:59:59.999999999" }, { start: "12:00:00.000000001", end: "17:00:00" }] }}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${{ result: [] }}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"} | ${{ result: [{ start: "09:00:00", end: "12:00:00" }, { start: "13:00:00", end: "17:00:00" }] }}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${[]}
    ${"09:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${"10:00:00"} | ${[]}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorTime(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${"invalid"}  | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${""}         | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"invalid"}  | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${""}         | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"invalid"}  | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${""}         | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${"invalid"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${""}
  `(
    "returns [] for malformed time: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalXorTime(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${null}       | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${undefined}  | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${null}       | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${undefined}
  `("returns [] for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalXorTime(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });
});
