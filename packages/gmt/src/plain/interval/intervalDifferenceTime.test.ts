import { intervalDifferenceTime } from "./intervalDifferenceTime";

describe("intervalDifferenceTime", () => {
  // Closed [start, end]: the shared endpoint belongs to both intervals, so A minus B loses it and the
  // remaining piece stops (or starts) one unit short of it.
  it.each`
    aStart        | aEnd                    | bStart        | bEnd          | expected                                                        | reason
    ${"09:00:00"} | ${"12:00:00"}           | ${"12:00:00"} | ${"17:00:00"} | ${[{ start: "09:00:00", end: "11:59:59.999999999" }]}           | ${"A ends where B starts"}
    ${"12:00:00"} | ${"17:00:00"}           | ${"09:00:00"} | ${"12:00:00"} | ${[{ start: "12:00:00.000000001", end: "17:00:00" }]}           | ${"A starts where B ends"}
    ${"12:00:00"} | ${"23:59:59.999999999"} | ${"00:00:00"} | ${"12:00:00"} | ${[{ start: "12:00:00.000000001", end: "23:59:59.999999999" }]} | ${"A runs to the last nanosecond of the day"}
    ${"12:00:00"} | ${"12:00:00"}           | ${"12:00:00"} | ${"17:00:00"} | ${[]}                                                           | ${"zero-length A on B's start"}
  `(
    "returns $expected for touching A=[$aStart, $aEnd] minus B=[$bStart, $bEnd] ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${{ result: [{ start: "09:00:00", end: "11:59:59.999999999" }, { start: "13:00:00.000000001", end: "17:00:00" }] }}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${{ result: [] }}
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"17:00:00"} | ${{ result: [{ start: "09:00:00", end: "11:59:59.999999999" }] }}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${{ result: [{ start: "12:00:00.000000001", end: "17:00:00" }] }}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  // B entirely before A removes nothing from A: the remaining piece is A itself, never a piece that
  // starts one nanosecond after B ends, inside the gap between them.
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"12:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"10:00:00"} | ${[{ start: "12:00:00", end: "17:00:00" }]}
  `(
    "returns $expected for A=[$aStart, $aEnd] minus B=[$bStart, $bEnd] entirely before A",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
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
      expect(intervalDifferenceTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
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
      expect(intervalDifferenceTime(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${null}       | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${undefined}  | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${null}       | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${undefined}
  `("returns [] for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalDifferenceTime(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });
});
