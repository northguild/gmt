import { intervalUnionUtc } from "./intervalUnionUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("intervalUnionUtc", () => {
  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-12-31T23:59:59Z" }}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-12-31T23:59:59Z" }}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-12-31T23:59:59Z"} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-12-31T23:59:59Z" }}
    ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-12-31T23:59:59Z" }}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-29T00:00:00Z"} | ${"2024-06-29T00:00:00Z"} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-06-30T23:59:59Z" }}
    ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${{ start: "2024-06-30T23:59:59Z", end: "2024-06-30T23:59:59Z" }}
  `(
    "returns merged interval when $aStart..$aEnd overlaps $bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionUtc(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${{ start: "2024-04-01T00:00:00Z", end: "2024-06-30T23:59:59Z" }}
    ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-12-31T23:59:59Z"} | ${{ start: "2024-06-30T23:59:59Z", end: "2024-12-31T23:59:59Z" }}
  `(
    "returns merged interval for zero-length $aStart interval",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionUtc(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-07-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${null}
    ${"2024-07-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${null}
  `(
    "returns null when $aEnd is before $bStart (disjoint)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-12-31T23:59:59Z"} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-12-31T23:59:59Z" }}
    ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-06-30T23:59:59Z" }}
  `(
    "returns merged interval when $aEnd equals $bStart (adjacent)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionUtc(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${null}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-15T00:00:00Z"} | ${"2024-06-10T00:00:00Z"} | ${null}
  `(
    "returns null when $aStart is after $aEnd (reversed)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"invalid"}              | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${""}                     | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-13-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"invalid"}              | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${""}                     | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"invalid"}              | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${""}                     | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"invalid"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${""}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-13-01T00:00:00Z"}
    ${"2024-12-31T23:59:60Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:60Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:60Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:60Z"}
  `(
    "returns null for malformed UTC datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalUnionUtc(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${null} | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${null} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
  `(
    "returns null for non-string input: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalUnionUtc(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBeNull();
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"2024-12-31T23:59:60Z"} | ${"2025-01-01T00:00:00Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:60Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
  `(
    "returns null for leap-second input: $aStart vs $aEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalUnionUtc(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalUnionUtc(
        "2024-01-01T00:00:00Z",
        "2024-06-30T23:59:59Z",
        "2024-04-01T00:00:00Z",
        "2024-12-31T23:59:59Z",
      ),
    ).toBeNull();
  });
});
