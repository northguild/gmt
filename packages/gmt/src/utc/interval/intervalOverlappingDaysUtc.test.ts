import { intervalOverlappingDaysUtc } from "./intervalOverlappingDaysUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("intervalOverlappingDaysUtc", () => {
  it.each`
    aStart                       | aEnd                         | bStart                       | bEnd                         | expected
    ${"2024-01-01T23:59:00Z"}    | ${"2024-01-02T00:01:00Z"}    | ${"2024-01-01T23:59:00Z"}    | ${"2024-01-02T00:01:00Z"}    | ${2}
    ${"2014-01-10T00:00:00Z"}    | ${"2014-01-20T00:00:00Z"}    | ${"2014-01-17T00:00:00Z"}    | ${"2014-01-21T00:00:00Z"}    | ${3}
    ${"2024-01-01T00:00:00Z"}    | ${"2024-01-02T00:00:00Z"}    | ${"2024-01-01T00:00:00Z"}    | ${"2024-01-02T00:00:00Z"}    | ${1}
    ${"2024-01-01T12:00:00Z"}    | ${"2024-01-01T12:00:00Z"}    | ${"2024-01-01T09:00:00Z"}    | ${"2024-01-01T17:00:00Z"}    | ${0}
    ${"+275760-09-12T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"} | ${"-271821-04-20T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"} | ${1}
  `(
    "returns $expected shared dates for $aStart to $aEnd × $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalOverlappingDaysUtc(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  // Half-open (coding-standards § 8): touching intervals share no instant, so no day.
  it("returns 0 for touching intervals [01-01, 01-02) and [01-02, 01-03)", () => {
    expect(
      intervalOverlappingDaysUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-02T00:00:00Z",
        "2024-01-02T00:00:00Z",
        "2024-01-03T00:00:00Z",
      ),
    ).toBe(0);
  });

  it("returns 0 for disjoint intervals", () => {
    expect(
      intervalOverlappingDaysUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-02T00:00:00Z",
        "2024-01-03T00:00:00Z",
        "2024-01-04T00:00:00Z",
      ),
    ).toBe(0);
  });

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"2024-12-31T23:59:60Z"} | ${"2025-01-01T00:00:00Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:60Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
  `(
    "returns null for leap-second input: $aStart vs $aEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalOverlappingDaysUtc(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
  `(
    "returns null for inverted interval $aStart to $aEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalOverlappingDaysUtc(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"invalid"}              | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${""}                     | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"invalid"}              | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${""}                     | ${"2024-04-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"invalid"}              | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${""}                     | ${"2024-12-31T23:59:59Z"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"invalid"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${""}
  `(
    "returns null for malformed UTC: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalOverlappingDaysUtc(aStart, aEnd, bStart, bEnd)).toBeNull();
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
        intervalOverlappingDaysUtc(
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
      intervalOverlappingDaysUtc(
        "2024-01-01T00:00:00Z",
        "2024-06-30T23:59:59Z",
        "2024-04-01T00:00:00Z",
        "2024-12-31T23:59:59Z",
      ),
    ).toBeNull();
  });
});
