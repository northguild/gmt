import { intervalDifferenceDate } from "./intervalDifferenceDate";

describe("intervalDifferenceDate", () => {
  // Closed [start, end]: the shared endpoint belongs to both intervals, so A minus B loses it and the
  // remaining piece stops (or starts) one unit short of it.
  it.each`
    aStart             | aEnd               | bStart             | bEnd               | expected                                              | reason
    ${"2024-01-01"}    | ${"2024-06-30"}    | ${"2024-06-30"}    | ${"2024-12-31"}    | ${[{ start: "2024-01-01", end: "2024-06-29" }]}       | ${"A ends where B starts"}
    ${"2024-06-30"}    | ${"2024-12-31"}    | ${"2024-01-01"}    | ${"2024-06-30"}    | ${[{ start: "2024-07-01", end: "2024-12-31" }]}       | ${"A starts where B ends"}
    ${"+275760-09-12"} | ${"+275760-09-13"} | ${"+275760-09-10"} | ${"+275760-09-12"} | ${[{ start: "+275760-09-13", end: "+275760-09-13" }]} | ${"A ends on the last PlainDate"}
    ${"-271821-04-19"} | ${"-271821-04-20"} | ${"-271821-04-20"} | ${"-271821-04-25"} | ${[{ start: "-271821-04-19", end: "-271821-04-19" }]} | ${"A starts on the first PlainDate"}
  `(
    "returns $expected for touching A=[$aStart, $aEnd] minus B=[$bStart, $bEnd] ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceDate(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-02"} | ${"2024-01-05"} | ${[{ start: "2024-01-01", end: "2024-01-01" }]}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${[]}
  `(
    "returns $expected for zero-length A=$aStart to $aEnd minus B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceDate(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-06-01"} | ${"2024-07-01"} | ${{ result: [{ start: "2024-01-01", end: "2024-05-31" }, { start: "2024-07-02", end: "2024-12-31" }] }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-03-01"} | ${"2024-10-31"} | ${{ result: [{ start: "2024-01-01", end: "2024-02-29" }, { start: "2024-11-01", end: "2024-12-31" }] }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-06-01"} | ${"2024-12-31"} | ${{ result: [{ start: "2024-01-01", end: "2024-05-31" }] }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${{ result: [{ start: "2024-07-01", end: "2024-12-31" }] }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-12-31"} | ${{ result: [] }}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceDate(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  // B entirely before A removes nothing from A: the remaining piece is A itself, never a piece that
  // starts the day after B ends, inside the gap between them.
  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-05"} | ${"2024-01-10"} | ${"2024-01-01"} | ${"2024-01-02"} | ${[{ start: "2024-01-05", end: "2024-01-10" }]}
    ${"2024-01-05"} | ${"2024-01-10"} | ${"2024-01-01"} | ${"2024-01-04"} | ${[{ start: "2024-01-05", end: "2024-01-10" }]}
  `(
    "returns $expected for A=[$aStart, $aEnd] minus B=[$bStart, $bEnd] entirely before A",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceDate(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-04-01"} | ${"2024-12-31"} | ${[]}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-15"} | ${"2024-06-10"} | ${[]}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceDate(aStart, aEnd, bStart, bEnd)).toEqual(
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
    "returns [] for malformed date: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalDifferenceDate(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${undefined}    | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${null}         | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${undefined}
  `("returns [] for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalDifferenceDate(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });
  // E5 (issue #78): same shared-calendar-or-reject rule as intervalUnionDate (D4). Golden
  // verified directly against @js-temporal/polyfill.
  it("computes the difference in the shared calendar when all four arguments carry the same tag", () => {
    expect(
      intervalDifferenceDate(
        "5784-06-01[u-ca=hebrew]",
        "5784-06-30[u-ca=hebrew]",
        "5784-06-10[u-ca=hebrew]",
        "5784-06-20[u-ca=hebrew]",
      ),
    ).toEqual([
      { start: "5784-06-01[u-ca=hebrew]", end: "5784-06-09[u-ca=hebrew]" },
      { start: "5784-06-21[u-ca=hebrew]", end: "5784-06-30[u-ca=hebrew]" },
    ]);
  });

  it("returns [] when calendars mismatch across the four arguments", () => {
    expect(
      intervalDifferenceDate(
        "5784-06-01[u-ca=hebrew]",
        "5784-06-30[u-ca=hebrew]",
        "2024-01-01",
        "2024-01-05",
      ),
    ).toEqual([]);
  });
});
