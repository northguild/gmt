import { intervalXorDate } from "./intervalXorDate";

describe("intervalXorDate", () => {
  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${{ result: [{ start: "2024-01-01", end: "2024-03-31" }, { start: "2024-07-01", end: "2024-12-31" }] }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-04-01"} | ${"2024-06-30"} | ${{ result: [{ start: "2024-01-01", end: "2024-03-31" }, { start: "2024-07-01", end: "2024-12-31" }] }}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-07-01"} | ${"2024-12-31"} | ${{ result: [{ start: "2024-01-01", end: "2024-06-30" }, { start: "2024-07-01", end: "2024-12-31" }] }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-12-31"} | ${{ result: [] }}
  `(
    "returns $expected when A=$aStart..$aEnd and B=$bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorDate(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
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
        "5784-06-01[u-ca=hebrew]",
        "5784-06-20[u-ca=hebrew]",
        "5784-06-10[u-ca=hebrew]",
        "5784-06-30[u-ca=hebrew]",
      ),
    ).toEqual([
      { start: "5784-06-01[u-ca=hebrew]", end: "5784-06-09[u-ca=hebrew]" },
      { start: "5784-06-21[u-ca=hebrew]", end: "5784-06-30[u-ca=hebrew]" },
    ]);
  });

  it("returns [] when calendars mismatch across the four arguments", () => {
    expect(
      intervalXorDate(
        "5784-06-01[u-ca=hebrew]",
        "5784-06-20[u-ca=hebrew]",
        "2024-01-01",
        "2024-01-05",
      ),
    ).toEqual([]);
  });
});
