import { intervalAbutsUtc } from "./intervalAbutsUtc";

describe("intervalAbutsUtc", () => {
  it.each`
    aStart                    | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"}           | ${"2024-06-30T12:00:00.000000001Z"} | ${"2024-12-31T17:00:00Z"}           | ${true}
    ${"2024-06-30T12:00:00Z"} | ${"2024-12-31T17:00:00Z"}           | ${"2024-01-01T09:00:00Z"}           | ${"2024-06-30T12:00:00.000000001Z"} | ${false}
    ${"2024-01-01T09:00:00Z"} | ${"2024-01-01T09:00:00.000000001Z"} | ${"2024-01-01T09:00:00.000000002Z"} | ${"2024-12-31T17:00:00Z"}           | ${true}
  `(
    "returns $expected when A=$aStart..$aEnd and B=$bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-06-30T12:00:01Z"} | ${"2024-12-31T17:00:00Z"} | ${false}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T13:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${false}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-04-01T11:00:00Z"} | ${"2024-08-01T13:00:00Z"} | ${false}
  `(
    "returns $expected for non-adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-12-31T17:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${false}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-10T12:00:00Z"} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"invalid"}              | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${""}                     | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"invalid"}              | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${""}                     | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"invalid"}              | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${""}                     | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"invalid"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${""}
  `(
    "returns false for malformed UTC datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${null}                   | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${undefined}              | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${null}                   | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${undefined}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"2024-06-30T23:59:60Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T23:59:60Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-06-30T23:59:60Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-06-30T23:59:60Z"}
  `("returns false for leap second input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
});
