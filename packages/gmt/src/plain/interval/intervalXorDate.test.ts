import { intervalXorDate } from "./intervalXorDate";

describe("intervalXorDate", () => {
  // Half-open [start, end): the symmetric difference is every maximal run covered by exactly one
  // interval, sorted by start. Pieces end exactly where the other interval starts (no one-unit
  // steps), touching intervals form one run, and an empty interval contributes nothing.
  it.each`
    aStart             | aEnd               | bStart             | bEnd               | expected                                                                                                | reason
    ${"2024-01-01"}    | ${"2024-06-30"}    | ${"2024-06-30"}    | ${"2024-12-31"}    | ${[{ start: "2024-01-01", end: "2024-12-31" }]}                                                         | ${"touching: one run"}
    ${"2024-06-30"}    | ${"2024-12-31"}    | ${"2024-01-01"}    | ${"2024-06-30"}    | ${[{ start: "2024-01-01", end: "2024-12-31" }]}                                                         | ${"touching, reversed order"}
    ${"+275760-09-10"} | ${"+275760-09-12"} | ${"+275760-09-11"} | ${"+275760-09-13"} | ${[{ start: "+275760-09-10", end: "+275760-09-11" }, { start: "+275760-09-12", end: "+275760-09-13" }]} | ${"B ends on the last PlainDate"}
    ${"-271821-04-19"} | ${"-271821-04-21"} | ${"-271821-04-19"} | ${"-271821-04-20"} | ${[{ start: "-271821-04-20", end: "-271821-04-21" }]}                                                   | ${"both start on the first PlainDate"}
    ${"2024-01-01"}    | ${"2024-06-30"}    | ${"2024-04-01"}    | ${"2024-12-31"}    | ${[{ start: "2024-01-01", end: "2024-04-01" }, { start: "2024-06-30", end: "2024-12-31" }]}             | ${"partial overlap"}
    ${"2024-01-01"}    | ${"2024-12-31"}    | ${"2024-04-01"}    | ${"2024-06-30"}    | ${[{ start: "2024-01-01", end: "2024-04-01" }, { start: "2024-06-30", end: "2024-12-31" }]}             | ${"B inside A"}
    ${"2024-07-01"}    | ${"2024-12-31"}    | ${"2024-01-01"}    | ${"2024-06-30"}    | ${[{ start: "2024-01-01", end: "2024-06-30" }, { start: "2024-07-01", end: "2024-12-31" }]}             | ${"disjoint, sorted by start"}
    ${"2024-01-01"}    | ${"2024-12-31"}    | ${"2024-01-01"}    | ${"2024-12-31"}    | ${[]}                                                                                                   | ${"identical"}
    ${"2024-01-01"}    | ${"2024-12-31"}    | ${"2024-06-01"}    | ${"2024-06-01"}    | ${[{ start: "2024-01-01", end: "2024-12-31" }]}                                                         | ${"empty B"}
    ${"2024-06-01"}    | ${"2024-06-01"}    | ${"2024-06-01"}    | ${"2024-06-01"}    | ${[]}                                                                                                   | ${"identical empties"}
  `(
    "returns $expected for A=[$aStart, $aEnd) xor B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorDate(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-04-01"} | ${"2024-12-31"} | ${[]}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-15"} | ${"2024-06-10"} | ${[]}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorDate(aStart, aEnd, bStart, bEnd)).toEqual(expected);
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
      expect(intervalXorDate(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${undefined}    | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${null}         | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${undefined}
  `("returns [] for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalXorDate(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });
  // E5 (issue #78): same shared-calendar-or-reject rule as intervalUnionDate (D4). Golden
  // verified directly against @js-temporal/polyfill.
  it("computes the symmetric difference in the shared calendar when all four arguments carry the same tag", () => {
    expect(
      intervalXorDate(
        "2024-02-10[u-ca=hebrew]",
        "2024-02-29[u-ca=hebrew]",
        "2024-02-19[u-ca=hebrew]",
        "2024-03-10[u-ca=hebrew]",
      ),
    ).toEqual([
      { start: "2024-02-10[u-ca=hebrew]", end: "2024-02-19[u-ca=hebrew]" },
      { start: "2024-02-29[u-ca=hebrew]", end: "2024-03-10[u-ca=hebrew]" },
    ]);
  });

  it("returns [] when calendars mismatch across the four arguments", () => {
    expect(
      intervalXorDate(
        "2024-02-10[u-ca=hebrew]",
        "2024-02-29[u-ca=hebrew]",
        "2024-01-01",
        "2024-01-05",
      ),
    ).toEqual([]);
  });
});
