import { intervalIntersectionTime } from "./intervalIntersectionTime";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";

describe("intervalIntersectionTime", () => {
  // Half-open: null unless A.start < B.end && B.start < A.end (CORE-6 §3 intersectIntervals), so
  // touching intervals, identical empties and an empty interval at an edge have no intersection.
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"18:00:00"} | ${{ start: "12:00:00", end: "17:00:00" }}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${{ start: "09:00:00", end: "12:00:00" }}
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${"18:00:00"} | ${null}
    ${"12:00:00"} | ${"18:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${{ start: "12:00:00", end: "17:00:00" }}
    ${"09:00:00"} | ${"17:00:00"} | ${"10:00:00"} | ${"11:00:00"} | ${{ start: "10:00:00", end: "11:00:00" }}
    ${"10:00:00"} | ${"10:00:00"} | ${"10:00:00"} | ${"10:00:00"} | ${null}
  `(
    "returns $expected when intervals $aStart to $aEnd and $bStart to $bEnd overlap",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"17:00:00"} | ${"18:00:00"} | ${null}
    ${"17:00:00"} | ${"18:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${null}
  `(
    "returns $expected for adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"18:00:00"} | ${"20:00:00"} | ${null}
    ${"18:00:00"} | ${"20:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${null}
  `(
    "returns $expected for disjoint intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionTime(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${"18:00:00"} | ${null}
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${null}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionTime(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${"invalid"}  | ${"17:00:00"} | ${"12:00:00"} | ${"18:00:00"}
    ${""}         | ${"17:00:00"} | ${"12:00:00"} | ${"18:00:00"}
    ${"09:00:00"} | ${"invalid"}  | ${"12:00:00"} | ${"18:00:00"}
    ${"09:00:00"} | ${""}         | ${"12:00:00"} | ${"18:00:00"}
    ${"09:00:00"} | ${"17:00:00"} | ${"invalid"}  | ${"18:00:00"}
    ${"09:00:00"} | ${"17:00:00"} | ${""}         | ${"18:00:00"}
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"invalid"}
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${""}
  `(
    "returns null for malformed time: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalIntersectionTime(aStart, aEnd, bStart, bEnd)).toBeNull();
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
        intervalIntersectionTime(
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
      intervalIntersectionTime("09:00:00", "17:00:00", "12:00:00", "18:00:00"),
    ).toBeNull();
  });
});
