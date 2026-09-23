import { intervalsOverlapTime } from "./intervalsOverlapTime";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";

describe("intervalsOverlapTime", () => {
  // Half-open [start, end): A.start < B.end && B.start < A.end (CORE-6 §3 intervalsOverlap).
  it.each`
    aStart        | aEnd                    | bStart                  | bEnd          | expected | reason
    ${"09:00:00"} | ${"17:00:00"}           | ${"12:00:00"}           | ${"18:00:00"} | ${true}  | ${"partial overlap"}
    ${"09:00:00"} | ${"17:00:00"}           | ${"09:00:00"}           | ${"12:00:00"} | ${true}  | ${"same start"}
    ${"09:00:00"} | ${"17:00:00"}           | ${"16:00:00"}           | ${"20:00:00"} | ${true}  | ${"B starts inside A"}
    ${"09:00:00"} | ${"17:00:00"}           | ${"17:00:00"}           | ${"18:00:00"} | ${false} | ${"touching"}
    ${"17:00:00"} | ${"18:00:00"}           | ${"09:00:00"}           | ${"17:00:00"} | ${false} | ${"touching, reversed order"}
    ${"09:00:00"} | ${"17:00:00"}           | ${"16:59:59.999999999"} | ${"18:00:00"} | ${true}  | ${"1 ns shared"}
    ${"09:00:00"} | ${"12:00:00"}           | ${"12:00:00"}           | ${"12:00:00"} | ${false} | ${"empty B at A's end"}
    ${"09:00:00"} | ${"17:00:00"}           | ${"09:00:00"}           | ${"09:00:00"} | ${false} | ${"empty B at A's start"}
    ${"09:00:00"} | ${"17:00:00"}           | ${"12:00:00"}           | ${"12:00:00"} | ${true}  | ${"empty B strictly inside A"}
    ${"12:00:00"} | ${"12:00:00"}           | ${"12:00:00"}           | ${"12:00:00"} | ${false} | ${"identical empties"}
    ${"22:00:00"} | ${"23:59:59.999999999"} | ${"00:00:00"}           | ${"01:00:00"} | ${false} | ${"no midnight wrap"}
    ${"17:00:00"} | ${"09:00:00"}           | ${"12:00:00"}           | ${"13:00:00"} | ${false} | ${"reversed A"}
    ${"09:00:00"} | ${"17:00:00"}           | ${"17:00:00"}           | ${"09:00:00"} | ${false} | ${"reversed B"}
    ${"12:00:00"} | ${"12:00:00"}           | ${"11:00:00"}           | ${"11:00:00"} | ${false} | ${"distinct empties"}
  `(
    "returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${"invalid"}  | ${"12:00:00"} | ${"12:00:00"} | ${"18:00:00"}
    ${""}         | ${"12:00:00"} | ${"12:00:00"} | ${"18:00:00"}
    ${"25:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"18:00:00"}
    ${"12:00:00"} | ${"invalid"}  | ${"12:00:00"} | ${"18:00:00"}
    ${"12:00:00"} | ${""}         | ${"12:00:00"} | ${"18:00:00"}
    ${"12:00:00"} | ${"25:00:00"} | ${"12:00:00"} | ${"18:00:00"}
    ${"12:00:00"} | ${"12:00:00"} | ${"invalid"}  | ${"18:00:00"}
    ${"12:00:00"} | ${"12:00:00"} | ${""}         | ${"18:00:00"}
    ${"12:00:00"} | ${"12:00:00"} | ${"25:00:00"} | ${"18:00:00"}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"invalid"}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${""}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"25:00:00"}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"23:59:60"}
  `(
    "returns false for malformed time: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalsOverlapTime(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${false}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${false}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${false}
  `(
    "returns false for non-string input: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalsOverlapTime(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBe(false);
    },
  );

  it("returns false when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(
      intervalsOverlapTime("09:00:00", "17:00:00", "12:00:00", "18:00:00"),
    ).toBe(false);
  });
});
