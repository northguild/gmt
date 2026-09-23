import { intervalIntersectionUtc } from "./intervalIntersectionUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("intervalIntersectionUtc", () => {
  // Half-open: null unless A.start < B.end && B.start < A.end (CORE-6 §3 intersectIntervals), so
  // touching intervals, identical empties and an empty interval at an edge have no intersection.
  it.each`
    aStart                        | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T09:00:00Z"}     | ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T17:00:00Z"} | ${null}
    ${"2024-01-01T09:00:00Z"}     | ${"2024-01-01T13:00:00Z"} | ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T17:00:00Z"} | ${{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T13:00:00Z" }}
    ${"2024-01-01T09:00:00Z"}     | ${"2024-01-01T17:00:00Z"} | ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T12:00:00Z"} | ${{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }}
    ${"2024-01-01T09:00:00.000Z"} | ${"2024-01-01T13:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"2024-01-01T17:00:00Z"} | ${{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T13:00:00Z" }}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${{ start: "2024-04-01T00:00:00Z", end: "2024-06-30T23:59:59Z" }}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-06-30T23:59:59Z" }}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-12-31T23:59:59Z"} | ${null}
    ${"2024-04-01T00:00:00Z"}     | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${{ start: "2024-04-01T00:00:00Z", end: "2024-06-30T23:59:59Z" }}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-06-30T23:59:59Z"} | ${"2024-02-01T00:00:00Z"} | ${"2024-03-01T00:00:00Z"} | ${{ start: "2024-02-01T00:00:00Z", end: "2024-03-01T00:00:00Z" }}
    ${"2024-06-30T23:59:59Z"}     | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${null}
  `(
    "returns $expected when intervals $aStart to $aEnd and $bStart to $bEnd overlap",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionUtc(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-07-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${null}
    ${"2024-07-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${null}
  `(
    "returns $expected for disjoint intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionUtc(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${null}
    ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${null}
  `(
    "returns $expected for adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionUtc(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${null}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionUtc(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"invalid"}              | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${""}                     | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00"}  | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"invalid"}              | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${""}                     | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"invalid"}              | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${""}                     | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"invalid"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${""}
  `(
    "returns null for malformed UTC: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalIntersectionUtc(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"2024-12-31T23:59:60Z"} | ${"2025-01-01T00:00:00Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:60Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
  `(
    "returns null for leap-second input: $aStart vs $aEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalIntersectionUtc(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
  `(
    "returns null for non-string input: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalIntersectionUtc(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalIntersectionUtc(
        "2024-01-01T00:00:00Z",
        "2024-06-30T23:59:59Z",
        "2024-04-01T00:00:00Z",
        "2024-12-31T23:59:59Z",
      ),
    ).toBeNull();
  });
});
