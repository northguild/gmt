import { intervalDifferenceUtc } from "./intervalDifferenceUtc";

describe("intervalDifferenceUtc", () => {
  // Closed [start, end]: the shared endpoint belongs to both intervals, so A minus B loses it and the
  // remaining piece stops (or starts) one unit short of it.
  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected                                                                      | reason
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${[{ start: "2024-01-01T09:00:00Z", end: "2024-06-30T11:59:59.999999999Z" }]} | ${"A ends where B starts"}
    ${"2024-06-30T12:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${[{ start: "2024-06-30T12:00:00.000000001Z", end: "2024-12-31T17:00:00Z" }]} | ${"A starts where B ends"}
  `(
    "returns $expected for touching A=[$aStart, $aEnd] minus B=[$bStart, $bEnd] ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceUtc(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${{ result: [{ start: "2024-01-01T09:00:00Z", end: "2024-06-01T11:59:59.999999999Z" }, { start: "2024-07-01T13:00:00.000000001Z", end: "2024-12-31T17:00:00Z" }] }}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${{ result: [] }}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${{ result: [{ start: "2024-01-01T09:00:00Z", end: "2024-06-01T11:59:59.999999999Z" }] }}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${{ result: [{ start: "2024-06-30T12:00:00.000000001Z", end: "2024-12-31T17:00:00Z" }] }}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceUtc(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  // B entirely before A removes nothing from A: the remaining piece is A itself, never a piece that
  // starts one nanosecond after B ends, inside the gap between them.
  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-06-01T12:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"2024-01-31T09:00:00Z"} | ${[{ start: "2024-06-01T12:00:00Z", end: "2024-06-30T12:00:00Z" }]}
  `(
    "returns $expected for A=[$aStart, $aEnd] minus B=[$bStart, $bEnd] entirely before A",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceUtc(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-12-31T17:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${[]}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-10T12:00:00Z"} | ${[]}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceUtc(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"invalid"}              | ${"2024-12-31T17:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"}
    ${""}                     | ${"2024-12-31T17:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"invalid"}              | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${""}                     | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"invalid"}              | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${""}                     | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"invalid"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${""}
  `(
    "returns [] for malformed UTC datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalDifferenceUtc(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${null}                   | ${"2024-12-31T17:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${undefined}              | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${null}                   | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${undefined}
  `("returns [] for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalDifferenceUtc(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"2024-06-30T23:59:60Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T23:59:60Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-06-30T23:59:60Z"} | ${"2024-07-01T13:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-06-30T23:59:60Z"}
  `("returns [] for leap second input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalDifferenceUtc(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });
});
