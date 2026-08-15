import { intervalDifferenceDateTime } from "./intervalDifferenceDateTime";

describe("intervalDifferenceDateTime", () => {
  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"} | ${{ result: [{ start: "2024-01-01T09:00:00", end: "2024-06-01T11:59:59.999999999" }, { start: "2024-07-01T13:00:00.000000001", end: "2024-12-31T17:00:00" }] }}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${{ result: [] }}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-12-31T17:00:00"} | ${{ result: [{ start: "2024-01-01T09:00:00", end: "2024-06-01T11:59:59.999999999" }] }}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${{ result: [{ start: "2024-06-30T12:00:00.000000001", end: "2024-12-31T17:00:00" }] }}
  `(
    "returns $expected when A=$aStart..$aEnd and B=$bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceDateTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"} | ${[]}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-10T12:00:00"} | ${[]}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceDateTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${"invalid"}             | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"}
    ${""}                    | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${"invalid"}             | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${""}                    | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"invalid"}             | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${""}                    | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${"invalid"}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${""}
  `(
    "returns [] for malformed datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalDifferenceDateTime(aStart, aEnd, bStart, bEnd)).toEqual(
        [],
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${null}                  | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${undefined}             | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${null}                  | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${undefined}
  `("returns [] for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalDifferenceDateTime(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });
});
