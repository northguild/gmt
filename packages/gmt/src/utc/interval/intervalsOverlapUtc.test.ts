import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { intervalsOverlapUtc } from "./intervalsOverlapUtc";

describe("intervalsOverlapUtc", () => {
  // A = 09:00Z, B = 12:00Z, C = 13:00Z, D = 17:00Z on 2024-01-01 (coding-standards § 8).
  // Half-open [start, end): A.start < B.end && B.start < A.end (CORE-6 §3 intervalsOverlap).
  it.each`
    aStart                    | aEnd                      | bStart                              | bEnd                      | expected | reason
    ${"2024-01-01T09:00:00Z"} | ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T12:00:00Z"}           | ${"2024-01-01T17:00:00Z"} | ${false} | ${"story row: touching"}
    ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T17:00:00Z"} | ${"2024-01-01T09:00:00Z"}           | ${"2024-01-01T12:00:00Z"} | ${false} | ${"touching, reversed order"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T11:59:59.999999999Z"} | ${"2024-01-01T17:00:00Z"} | ${true}  | ${"1 ns shared"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"}           | ${"2024-12-31T23:59:59Z"} | ${true}  | ${"partial overlap"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"}           | ${"2024-06-30T23:59:59Z"} | ${true}  | ${"same start"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-07-01T00:00:00Z"}           | ${"2024-12-31T23:59:59Z"} | ${false} | ${"disjoint"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"}           | ${"2024-06-30T23:59:59Z"} | ${false} | ${"empty B at A's end"}
    ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-01-01T00:00:00Z"}           | ${"2024-06-30T23:59:59Z"} | ${false} | ${"empty A at B's end"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-01-01T17:00:00Z"} | ${"2024-01-01T12:00:00Z"}           | ${"2024-01-01T12:00:00Z"} | ${true}  | ${"empty B strictly inside A"}
    ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00Z"}           | ${"2024-06-15T12:00:00Z"} | ${false} | ${"identical empties"}
    ${"2024-06-30T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}           | ${"2024-04-01T00:00:00Z"} | ${false} | ${"both reversed"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-06-30T23:59:59Z"}           | ${"2024-05-01T00:00:00Z"} | ${false} | ${"reversed B"}
  `(
    "returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
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
