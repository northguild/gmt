import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { intervalUnionTime } from "./intervalUnionTime";

describe("intervalUnionTime", () => {
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"18:00:00"} | ${{ start: "09:00:00", end: "18:00:00" }}
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${"18:00:00"} | ${{ start: "09:00:00", end: "18:00:00" }}
    ${"12:00:00"} | ${"18:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${{ start: "09:00:00", end: "18:00:00" }}
    ${"09:00:00"} | ${"17:00:00"} | ${"16:00:00"} | ${"16:00:00"} | ${{ start: "09:00:00", end: "17:00:00" }}
    ${"17:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${{ start: "09:00:00", end: "17:00:00" }}
    ${"09:00:00"} | ${"17:00:00"} | ${"10:00:00"} | ${"11:00:00"} | ${{ start: "09:00:00", end: "17:00:00" }}
  `(
    "returns merged interval when $aStart..$aEnd overlaps $bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionTime(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"18:00:00"} | ${"20:00:00"} | ${null}
    ${"18:00:00"} | ${"20:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${null}
  `(
    "returns null when $aEnd is before $bStart (disjoint)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${"18:00:00"} | ${{ start: "09:00:00", end: "18:00:00" }}
    ${"17:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${{ start: "09:00:00", end: "17:00:00" }}
  `(
    "returns merged interval when $aEnd equals $bStart (adjacent)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionTime(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${"18:00:00"} | ${null}
    ${"09:00:00"} | ${"17:00:00"} | ${"16:00:00"} | ${"15:00:00"} | ${null}
  `(
    "returns null when $aStart is after $aEnd (reversed)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${"invalid"}  | ${"17:00:00"} | ${"12:00:00"} | ${"18:00:00"}
    ${""}         | ${"17:00:00"} | ${"12:00:00"} | ${"18:00:00"}
    ${"25:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"18:00:00"}
    ${"09:00:00"} | ${"invalid"}  | ${"12:00:00"} | ${"18:00:00"}
    ${"09:00:00"} | ${""}         | ${"12:00:00"} | ${"18:00:00"}
    ${"09:00:00"} | ${"17:00:00"} | ${"invalid"}  | ${"18:00:00"}
    ${"09:00:00"} | ${"17:00:00"} | ${""}         | ${"18:00:00"}
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"invalid"}
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${""}
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"25:00:00"}
  `(
    "returns null for malformed time: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalUnionTime(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${null}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${null}
  `(
    "returns null for non-string input: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalUnionTime(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(
      intervalUnionTime("09:00:00", "17:00:00", "12:00:00", "18:00:00"),
    ).toBeNull();
  });
});
