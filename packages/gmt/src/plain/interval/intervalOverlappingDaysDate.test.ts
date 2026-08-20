import { intervalOverlappingDaysDate } from "./intervalOverlappingDaysDate";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";

describe("intervalOverlappingDaysDate", () => {
  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2014-01-10"} | ${"2014-01-20"} | ${"2014-01-17"} | ${"2014-01-21"} | ${4}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${91}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-02-01"} | ${"2024-02-29"} | ${29}
    ${"2024-02-28"} | ${"2024-03-01"} | ${"2024-02-29"} | ${"2024-03-05"} | ${2}
    ${"2023-02-28"} | ${"2023-03-01"} | ${"2023-02-27"} | ${"2023-03-05"} | ${2}
    ${"2024-12-31"} | ${"2025-01-02"} | ${"2025-01-01"} | ${"2025-01-05"} | ${2}
  `(
    "returns $expected shared dates for $aStart..$aEnd × $bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-12-31"} | ${1}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${1}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-01-01"} | ${"2024-06-30"} | ${1}
  `(
    "returns $expected for adjacent/identical $aStart..$aEnd × $bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-07-01"} | ${"2024-12-31"}
    ${"2024-07-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"}
  `(
    "returns 0 for disjoint $aStart..$aEnd × $bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd)).toBe(0);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${"2024-06-30"} | ${"2024-01-01"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-15"} | ${"2024-06-10"}
  `(
    "returns null for inverted interval $aStart..$aEnd × $bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
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
      expect(
        intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
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
        intervalOverlappingDaysDate(
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
      intervalOverlappingDaysDate(
        "2024-01-01",
        "2024-06-30",
        "2024-04-01",
        "2024-12-31",
      ),
    ).toBeNull();
  });
});
