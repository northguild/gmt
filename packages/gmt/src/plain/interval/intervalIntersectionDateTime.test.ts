import { intervalIntersectionDateTime } from "./intervalIntersectionDateTime";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";

describe("intervalIntersectionDateTime", () => {
  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"} | ${{ start: "2024-04-01T00:00:00", end: "2024-06-30T23:59:59" }}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${{ start: "2024-01-01T10:00:00", end: "2024-06-30T23:59:59" }}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-06-30T23:59:59"} | ${"2024-12-31T23:59:59"} | ${{ start: "2024-06-30T23:59:59", end: "2024-06-30T23:59:59" }}
    ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${{ start: "2024-04-01T00:00:00", end: "2024-06-30T23:59:59" }}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-02-01T00:00:00"} | ${"2024-03-01T00:00:00"} | ${{ start: "2024-02-01T00:00:00", end: "2024-03-01T00:00:00" }}
    ${"2024-06-30T23:59:59"} | ${"2024-06-30T23:59:59"} | ${"2024-06-30T23:59:59"} | ${"2024-06-30T23:59:59"} | ${{ start: "2024-06-30T23:59:59", end: "2024-06-30T23:59:59" }}
  `(
    "returns $expected when intervals $aStart..$aEnd and $bStart..$bEnd overlap",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionDateTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-07-01T00:00:00"} | ${"2024-12-31T23:59:59"} | ${null}
    ${"2024-07-01T00:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${null}
  `(
    "returns $expected for disjoint intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionDateTime(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-06-30T23:59:59"} | ${"2024-06-30T23:59:59"} | ${{ start: "2024-06-30T23:59:59", end: "2024-06-30T23:59:59" }}
    ${"2024-06-30T23:59:59"} | ${"2024-06-30T23:59:59"} | ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${{ start: "2024-06-30T23:59:59", end: "2024-06-30T23:59:59" }}
  `(
    "returns $expected for adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionDateTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"} | ${null}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-06-15T12:00:00"} | ${"2024-06-10T12:00:00"} | ${null}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionDateTime(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${"invalid"}             | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${""}                    | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${"invalid"}             | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${""}                    | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"invalid"}             | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${""}                    | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"invalid"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${""}
  `(
    "returns null for malformed datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalIntersectionDateTime(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
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
        intervalIntersectionDateTime(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalIntersectionDateTime(
        "2024-01-01T10:00:00",
        "2024-06-30T23:59:59",
        "2024-04-01T00:00:00",
        "2024-12-31T23:59:59",
      ),
    ).toBeNull();
  });
});
