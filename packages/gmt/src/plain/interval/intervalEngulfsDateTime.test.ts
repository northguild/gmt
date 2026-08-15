import { intervalEngulfsDateTime } from "./intervalEngulfsDateTime";

describe("intervalEngulfsDateTime", () => {
  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"} | ${true}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${true}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${true}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-12-31T17:00:00"} | ${true}
  `(
    "returns $expected when B is inside A ($aStart..$aEnd, $bStart..$bEnd)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsDateTime(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${false}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-12-31T17:00:00"} | ${false}
    ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${false}
  `(
    "returns $expected when B is not inside A",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsDateTime(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"} | ${false}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-10T12:00:00"} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsDateTime(aStart, aEnd, bStart, bEnd)).toBe(
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
    "returns false for malformed datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalEngulfsDateTime(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${null}                  | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${undefined}             | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${null}                  | ${"2024-07-01T13:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-06-01T12:00:00"} | ${undefined}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalEngulfsDateTime(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
});
