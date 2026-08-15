import { intervalEngulfsDate } from "./intervalEngulfsDate";

describe("intervalEngulfsDate", () => {
  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-06-01"} | ${"2024-07-01"} | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-12-31"} | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-06-01"} | ${"2024-12-31"} | ${true}
  `(
    "returns $expected when B is inside A ($aStart..$aEnd, $bStart..$bEnd)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-06-01"} | ${"2024-07-01"} | ${"2024-01-01"} | ${"2024-12-31"} | ${false}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-01"} | ${"2024-12-31"} | ${false}
    ${"2024-07-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${false}
  `(
    "returns $expected when B is not inside A",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-04-01"} | ${"2024-12-31"} | ${false}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-15"} | ${"2024-06-10"} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
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
    "returns false for malformed date: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalEngulfsDate(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${undefined}    | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${null}         | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${undefined}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalEngulfsDate(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
});
