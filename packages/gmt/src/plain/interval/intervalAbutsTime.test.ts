import { intervalAbutsTime } from "./intervalAbutsTime";

describe("intervalAbutsTime", () => {
  it.each`
    aStart        | aEnd                    | bStart                  | bEnd                    | expected
    ${"09:00:00"} | ${"12:00:00"}           | ${"12:00:00.000000001"} | ${"17:00:00"}           | ${true}
    ${"12:00:00"} | ${"17:00:00"}           | ${"09:00:00"}           | ${"12:00:00.000000001"} | ${false}
    ${"09:00:00"} | ${"09:00:00.000000001"} | ${"09:00:00.000000002"} | ${"17:00:00"}           | ${true}
  `(
    "returns $expected when A=$aStart..$aEnd and B=$bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"12:00:00"} | ${"12:00:01"} | ${"17:00:00"} | ${false}
    ${"09:00:00"} | ${"13:00:00"} | ${"12:00:00"} | ${"17:00:00"} | ${false}
    ${"09:00:00"} | ${"12:00:00"} | ${"10:00:00"} | ${"14:00:00"} | ${false}
  `(
    "returns $expected for non-adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${false}
    ${"09:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${"10:00:00"} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${"invalid"}  | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${""}         | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"invalid"}  | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${""}         | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"invalid"}  | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${""}         | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${"invalid"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${""}
  `(
    "returns false for malformed time: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsTime(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${null}       | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${undefined}  | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${null}       | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${undefined}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsTime(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
});
