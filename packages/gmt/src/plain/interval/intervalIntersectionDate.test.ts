import { intervalIntersectionDate } from "./intervalIntersectionDate";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";

describe("intervalIntersectionDate", () => {
  // Half-open: null unless A.start < B.end && B.start < A.end (CORE-6 §3 intersectIntervals), so
  // touching intervals, identical empties and an empty interval at an edge have no intersection.
  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-06-15"} | ${"2024-06-15"} | ${null}
  `(
    "returns $expected for zero-length A=$aStart to $aEnd intersect B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionDate(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${{ start: "2024-04-01", end: "2024-06-30" }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${{ start: "2024-01-01", end: "2024-06-30" }}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-12-31"} | ${null}
    ${"2024-04-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${{ start: "2024-04-01", end: "2024-06-30" }}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-29"} | ${"2024-06-29"} | ${{ start: "2024-06-29", end: "2024-06-29" }}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${null}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-02-01"} | ${"2024-03-01"} | ${{ start: "2024-02-01", end: "2024-03-01" }}
  `(
    "returns $expected when intervals $aStart to $aEnd and $bStart to $bEnd overlap",
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
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${null}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-01-01"} | ${"2024-06-30"} | ${null}
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
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${null}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${null}
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
  // E5 (issue #78): same shared-calendar-or-reject rule as intervalUnionDate (D4). Goldens
  // verified directly against @js-temporal/polyfill.
  it("intersects in the shared calendar when all four arguments carry the same tag", () => {
    expect(
      intervalIntersectionDate(
        "2024-02-24[u-ca=hebrew]",
        "2024-03-05[u-ca=hebrew]",
        "2024-02-29[u-ca=hebrew]",
        "2024-03-11[u-ca=hebrew]",
      ),
    ).toEqual({
      start: "2024-02-29[u-ca=hebrew]",
      end: "2024-03-05[u-ca=hebrew]",
    });
  });

  it("returns null when calendars mismatch across the four arguments", () => {
    expect(
      intervalIntersectionDate(
        "2024-02-24[u-ca=hebrew]",
        "2024-03-05[u-ca=hebrew]",
        "2024-01-01",
        "2024-01-05",
      ),
    ).toBeNull();
  });
});
