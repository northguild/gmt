import { intervalUnionDate } from "./intervalUnionDate";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";

describe("intervalUnionDate", () => {
  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${{ start: "2024-01-01", end: "2024-01-01" }}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-06-15"} | ${"2024-06-15"} | ${null}
  `(
    "returns $expected for zero-length A=$aStart..$aEnd union B=$bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionDate(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${{ start: "2024-01-01", end: "2024-12-31" }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${{ start: "2024-01-01", end: "2024-12-31" }}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-12-31"} | ${{ start: "2024-01-01", end: "2024-12-31" }}
    ${"2024-04-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${{ start: "2024-01-01", end: "2024-12-31" }}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-29"} | ${"2024-06-29"} | ${{ start: "2024-01-01", end: "2024-06-30" }}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${{ start: "2024-06-30", end: "2024-06-30" }}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-02-01"} | ${"2024-03-01"} | ${{ start: "2024-01-01", end: "2024-06-30" }}
  `(
    "returns merged interval when $aStart..$aEnd overlaps $bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionDate(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-07-01"} | ${"2024-12-31"} | ${null}
    ${"2024-07-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${null}
  `(
    "returns null when $aStart..$aEnd is disjoint from $bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalUnionDate(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-12-31"} | ${{ start: "2024-01-01", end: "2024-12-31" }}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-01-01"} | ${"2024-06-30"} | ${{ start: "2024-01-01", end: "2024-06-30" }}
  `(
    "returns merged interval when $aEnd equals $bStart (adjacent)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionDate(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-04-01"} | ${"2024-12-31"} | ${null}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-15"} | ${"2024-06-10"} | ${null}
  `(
    "returns null when $aStart is after $aEnd (reversed)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalUnionDate(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | param
    ${"invalid"}    | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${"aStart"}
    ${"2024-01-01"} | ${"invalid"}    | ${"2024-04-01"} | ${"2024-12-31"} | ${"aEnd"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"invalid"}    | ${"2024-12-31"} | ${"bStart"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"invalid"}    | ${"bEnd"}
    ${""}           | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${"aStart"}
    ${"2024-01-01"} | ${""}           | ${"2024-04-01"} | ${"2024-12-31"} | ${"aEnd"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${""}           | ${"2024-12-31"} | ${"bStart"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${""}           | ${"bEnd"}
    ${"2024-13-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${"aStart"}
    ${"2024-01-01"} | ${"2024-13-01"} | ${"2024-04-01"} | ${"2024-12-31"} | ${"aEnd"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-13-01"} | ${"2024-12-31"} | ${"bStart"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-13-01"} | ${"bEnd"}
  `("returns null for malformed $param", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalUnionDate(aStart, aEnd, bStart, bEnd)).toBeNull();
  });

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | param
    ${null}         | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${"aStart"}
    ${"2024-01-01"} | ${null}         | ${"2024-04-01"} | ${"2024-12-31"} | ${"aEnd"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${null}         | ${"2024-12-31"} | ${"bStart"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${null}         | ${"bEnd"}
  `("returns null for non-string $param", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(
      intervalUnionDate(
        aStart as never,
        aEnd as never,
        bStart as never,
        bEnd as never,
      ),
    ).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      intervalUnionDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31"),
    ).toBeNull();
  });
  // E5 (issue #78): accepts GMT calendar-annotated PlainDate strings when all four arguments
  // share the same tag -- the output's date value is re-derived in that calendar (E5
  // decision of record D4). A mismatch returns null rather than guessing an output calendar.
  // Goldens verified directly against @js-temporal/polyfill.
  it("merges in the shared calendar when all four arguments carry the same tag", () => {
    expect(
      intervalUnionDate(
        "5784-06-15[u-ca=hebrew]",
        "5784-06-20[u-ca=hebrew]",
        "5784-06-18[u-ca=hebrew]",
        "5784-07-01[u-ca=hebrew]",
      ),
    ).toEqual({
      start: "5784-06-15[u-ca=hebrew]",
      end: "5784-07-01[u-ca=hebrew]",
    });
  });

  it("returns null when calendars mismatch across the four arguments", () => {
    expect(
      intervalUnionDate(
        "5784-06-15[u-ca=hebrew]",
        "5784-06-20[u-ca=hebrew]",
        "2024-01-01",
        "2024-01-05",
      ),
    ).toBeNull();
  });
});
