import { intervalXorTime } from "./intervalXorTime";

describe("intervalXorTime", () => {
  // Half-open [start, end): the symmetric difference is every maximal run covered by exactly one
  // interval, sorted by start. Pieces end exactly where the other interval starts (no one-unit
  // steps), touching intervals form one run, and an empty interval contributes nothing.
  it.each`
    aStart        | aEnd          | bStart        | bEnd                    | expected                                                                                      | reason
    ${"09:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"17:00:00"}           | ${[{ start: "09:00:00", end: "17:00:00" }]}                                                   | ${"touching: one run"}
    ${"12:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"}           | ${[{ start: "09:00:00", end: "17:00:00" }]}                                                   | ${"touching, reversed order"}
    ${"00:00:00"} | ${"12:00:00"} | ${"06:00:00"} | ${"23:59:59.999999999"} | ${[{ start: "00:00:00", end: "06:00:00" }, { start: "12:00:00", end: "23:59:59.999999999" }]} | ${"B runs to the last nanosecond of the day (no wrap)"}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"17:00:00"}           | ${[{ start: "12:00:00", end: "17:00:00" }]}                                                   | ${"zero-length A on B's start"}
    ${"09:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${"17:00:00"}           | ${[{ start: "09:00:00", end: "11:00:00" }, { start: "12:00:00", end: "17:00:00" }]}           | ${"partial overlap"}
    ${"09:00:00"} | ${"17:00:00"} | ${"11:00:00"} | ${"12:00:00"}           | ${[{ start: "09:00:00", end: "11:00:00" }, { start: "12:00:00", end: "17:00:00" }]}           | ${"B inside A"}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"17:00:00"}           | ${[]}                                                                                         | ${"identical"}
    ${"13:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"}           | ${[{ start: "09:00:00", end: "12:00:00" }, { start: "13:00:00", end: "17:00:00" }]}           | ${"disjoint, sorted by start"}
  `(
    "returns $expected for A=[$aStart, $aEnd) xor B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorTime(aStart, aEnd, bStart, bEnd)).toEqual(expected);
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
