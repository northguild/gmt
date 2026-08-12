import { intervalIntersectionDate } from "./intervalIntersectionDate";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";

describe("intervalIntersectionDate", () => {
  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${{ start: "2024-04-01", end: "2024-06-30" }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${{ start: "2024-01-01", end: "2024-06-30" }}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-12-31"} | ${{ start: "2024-06-30", end: "2024-06-30" }}
    ${"2024-04-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${{ start: "2024-04-01", end: "2024-06-30" }}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-29"} | ${"2024-06-29"} | ${{ start: "2024-06-29", end: "2024-06-29" }}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${{ start: "2024-06-30", end: "2024-06-30" }}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-02-01"} | ${"2024-03-01"} | ${{ start: "2024-02-01", end: "2024-03-01" }}
  `(
    "returns $expected when intervals $aStart..$aEnd and $bStart..$bEnd overlap",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionDate(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-07-01"} | ${"2024-12-31"} | ${null}
    ${"2024-07-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${null}
  `(
    "returns $expected for disjoint intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionDate(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${{ start: "2024-06-30", end: "2024-06-30" }}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-01-01"} | ${"2024-06-30"} | ${{ start: "2024-06-30", end: "2024-06-30" }}
  `(
    "returns $expected for adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionDate(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-04-01"} | ${"2024-12-31"} | ${null}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-15"} | ${"2024-06-10"} | ${null}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionDate(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${"invalid"}    | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${""}           | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-13-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"invalid"}    | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${""}           | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"invalid"}    | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${""}           | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"invalid"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${""}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-13-01"}
  `(
    "returns null for malformed date: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalIntersectionDate(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${undefined}    | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${123}          | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${true}         | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${[]}           | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${{}}           | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${null}         | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${undefined}    | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${123}          | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${true}         | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${[]}           | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${{}}           | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${null}         | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${undefined}    | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${123}          | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${true}         | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${[]}           | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${{}}           | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${null}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${undefined}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${123}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${true}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${[]}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${{}}
  `(
    "returns null for non-string input: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalIntersectionDate(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      intervalIntersectionDate(
        "2024-01-01",
        "2024-06-30",
        "2024-04-01",
        "2024-12-31",
      ),
    ).toBeNull();
  });
});
