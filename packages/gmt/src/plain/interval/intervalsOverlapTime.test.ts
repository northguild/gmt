import { intervalsOverlapTime } from "./intervalsOverlapTime";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";

describe("intervalsOverlapTime", () => {
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"18:00:00"} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"16:00:00"} | ${"20:00:00"} | ${true}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${true}
  `(
    "returns $expected when intervals $aStart..$aEnd and $bStart..$bEnd overlap",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${"18:00:00"} | ${true}
    ${"17:00:00"} | ${"18:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${true}
    ${"09:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${true}
    ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${true}
  `(
    "returns $expected for adjacent or touching intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${false}
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${false}
    ${"12:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${"11:00:00"} | ${false}
  `(
    "returns $expected for reversed intervals",
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
