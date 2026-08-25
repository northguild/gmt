import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { intervalsOverlapDate } from "./intervalsOverlapDate";

describe("intervalsOverlapDate", () => {
  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${true}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-06-15"} | ${"2024-06-15"} | ${false}
  `(
    "returns $expected for zero-length A=$aStart..$aEnd overlapping B=$bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${true}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-12-31"} | ${true}
    ${"2024-04-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${true}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-29"} | ${"2024-06-29"} | ${true}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${true}
  `(
    "returns $expected when intervals $aStart..$aEnd and $bStart..$bEnd overlap",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart                   | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-07-01"}          | ${"2024-12-31"} | ${false}
    ${"2024-07-01"} | ${"2024-12-31"} | ${"2024-01-01"}          | ${"2024-06-30"} | ${false}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"}          | ${"2024-06-30"} | ${true}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-01-01"}          | ${"2024-06-30"} | ${true}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30T00:00:00"} | ${"2024-12-31"} | ${false}
  `(
    "returns $expected for adjacent-but-not-overlapping intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart                   | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-07-01"}          | ${"2024-12-31"} | ${false}
    ${"2024-07-01"} | ${"2024-12-31"} | ${"2024-01-01"}          | ${"2024-06-30"} | ${false}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"}          | ${"2024-06-30"} | ${true}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-01-01"}          | ${"2024-06-30"} | ${true}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30T00:00:00"} | ${"2024-12-31"} | ${false}
  `(
    "returns $expected for reversed intervals",
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
        "5785-01-01[u-ca=hebrew]",
        "2024-11-15",
      ),
    ).toBe(true);
  });
});
