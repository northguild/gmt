import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { intervalsOverlapDate } from "./intervalsOverlapDate";

describe("intervalsOverlapDate", () => {
  // Half-open [start, end): A.start < B.end && B.start < A.end (CORE-6 §3 intervalsOverlap).
  it.each`
    aStart          | aEnd            | bStart                   | bEnd            | expected | reason
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"}          | ${"2024-12-31"} | ${true}  | ${"partial overlap"}
    ${"2024-04-01"} | ${"2024-12-31"} | ${"2024-01-01"}          | ${"2024-06-30"} | ${true}  | ${"partial overlap, reversed order"}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"}          | ${"2024-06-30"} | ${true}  | ${"same start"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-29"}          | ${"2024-07-01"} | ${true}  | ${"B starts on A's last day"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"}          | ${"2024-12-31"} | ${false} | ${"touching: A ends before 06-30"}
    ${"2024-06-30"} | ${"2024-12-31"} | ${"2024-01-01"}          | ${"2024-06-30"} | ${false} | ${"touching, reversed order"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-07-01"}          | ${"2024-12-31"} | ${false} | ${"disjoint"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-29"}          | ${"2024-06-29"} | ${true}  | ${"empty B strictly inside A"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"}          | ${"2024-06-30"} | ${false} | ${"empty B at A's end"}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-01-01"}          | ${"2024-06-30"} | ${false} | ${"empty A at B's end"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"}          | ${"2024-01-01"} | ${false} | ${"identical empties"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-06-15"}          | ${"2024-06-15"} | ${false} | ${"distinct empties"}
    ${"2024-06-30"} | ${"2024-01-01"} | ${"2024-04-01"}          | ${"2024-12-31"} | ${false} | ${"reversed A"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-12-31"}          | ${"2024-04-01"} | ${false} | ${"reversed B"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30T00:00:00"} | ${"2024-12-31"} | ${false} | ${"datetime is not a date"}
  `(
    "returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
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
    "returns false for malformed date: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalsOverlapDate(aStart, aEnd, bStart, bEnd)).toBe(false);
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
        intervalsOverlapDate(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBe(false);
    },
  );

  it("returns false when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      intervalsOverlapDate(
        "2024-01-01",
        "2024-06-30",
        "2024-04-01",
        "2024-12-31",
      ),
    ).toBe(false);
  });
  // E5 (issue #78): accepts GMT calendar-annotated PlainDate strings; mixed calendars are
  // accepted (D4). Golden verified directly against @js-temporal/polyfill.
  it("accepts mixed calendars since overlap is an ordering check, not a value", () => {
    expect(
      intervalsOverlapDate(
        "2024-10-01",
        "2024-10-31",
        "2024-10-03[u-ca=hebrew]",
        "2024-11-15",
      ),
    ).toBe(true);
  });
});
