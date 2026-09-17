import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { intervalsOverlapDateTime } from "./intervalsOverlapDateTime";

describe("intervalsOverlapDateTime", () => {
  // Half-open [start, end): A.start < B.end && B.start < A.end (CORE-6 §3 intervalsOverlap).
  it.each`
    aStart                   | aEnd                     | bStart                             | bEnd                     | expected | reason
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"}           | ${"2024-12-31T23:59:59"} | ${true}  | ${"partial overlap"}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"}           | ${"2024-06-30T23:59:59"} | ${true}  | ${"same start"}
    ${"2024-01-01T09:00:00"} | ${"2024-01-01T12:00:00"} | ${"2024-01-01T12:00:00"}           | ${"2024-01-01T17:00:00"} | ${false} | ${"touching"}
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T17:00:00"} | ${"2024-01-01T09:00:00"}           | ${"2024-01-01T12:00:00"} | ${false} | ${"touching, reversed order"}
    ${"2024-01-01T09:00:00"} | ${"2024-01-01T12:00:00"} | ${"2024-01-01T11:59:59.999999999"} | ${"2024-01-01T17:00:00"} | ${true}  | ${"1 ns shared"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-07-01T00:00:00"}           | ${"2024-12-31T23:59:59"} | ${false} | ${"disjoint"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-06-30T23:59:59"}           | ${"2024-06-30T23:59:59"} | ${false} | ${"empty B at A's end"}
    ${"2024-06-30T23:59:59"} | ${"2024-06-30T23:59:59"} | ${"2024-01-01T10:00:00"}           | ${"2024-06-30T23:59:59"} | ${false} | ${"empty A at B's end"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-01-01T10:00:00"}           | ${"2024-01-01T10:00:00"} | ${false} | ${"empty B at A's start"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-03-01T00:00:00"}           | ${"2024-03-01T00:00:00"} | ${true}  | ${"empty B strictly inside A"}
    ${"2024-06-15T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-15T12:00:00"}           | ${"2024-06-15T12:00:00"} | ${false} | ${"identical empties"}
    ${"2024-06-30T23:59:59"} | ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"}           | ${"2024-04-01T00:00:00"} | ${false} | ${"both reversed"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-06-30T23:59:59"}           | ${"2024-05-01T00:00:00"} | ${false} | ${"reversed B"}
  `(
    "returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapDateTime(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${"invalid"}             | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${""}                    | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-13-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${"invalid"}             | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${""}                    | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${"2024-13-01T10:00:00"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"invalid"}             | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${""}                    | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"invalid"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${""}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"2024-13-01T10:00:00"}
    ${"2024-01-01T10:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:60"}
  `(
    "returns false for malformed datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalsOverlapDateTime(aStart, aEnd, bStart, bEnd)).toBe(false);
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
        intervalsOverlapDateTime(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBe(false);
    },
  );

  it("returns false when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalsOverlapDateTime(
        "2024-01-01T10:00:00",
        "2024-06-30T23:59:59",
        "2024-04-01T00:00:00",
        "2024-12-31T23:59:59",
      ),
    ).toBe(false);
  });
});
