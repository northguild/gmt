import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { intervalsOverlapUtc } from "./intervalsOverlapUtc";

describe("intervalsOverlapUtc", () => {
  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-12-31T23:59:59Z"} | ${true}
    ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${true}
  `(
    "returns $expected when intervals overlap",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-07-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${false}
    ${"2024-07-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${false}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${true}
    ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${true}
  `(
    "returns $expected for adjacent or disjoint intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-06-30T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${false}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-05-01T00:00:00Z"} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"invalid"}              | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${""}                     | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-13-01T10:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T10:00:00Z"} | ${"invalid"}              | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T10:00:00Z"} | ${""}                     | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-13-01T10:00:00Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"invalid"}              | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${""}                     | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"invalid"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${""}
    ${"2024-01-01T10:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-13-01T10:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:60Z"}
  `("returns false for malformed utc", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalsOverlapUtc(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(
      intervalsOverlapUtc(
        aStart as never,
        aEnd as never,
        bStart as never,
        bEnd as never,
      ),
    ).toBe(false);
  });

  it("returns false when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalsOverlapUtc(
        "2024-01-01T00:00:00Z",
        "2024-06-30T23:59:59Z",
        "2024-04-01T00:00:00Z",
        "2024-12-31T23:59:59Z",
      ),
    ).toBe(false);
  });
});
