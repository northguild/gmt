import { intervalEngulfsTime } from "./intervalEngulfsTime";

describe("intervalEngulfsTime", () => {
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${true}
    ${"09:00:00"} | ${"17:00:00"} | ${"12:00:00"} | ${"17:00:00"} | ${true}
  `(
    "returns $expected when B is inside A ($aStart..$aEnd, $bStart..$bEnd)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"12:00:00"} | ${"13:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${false}
    ${"09:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"17:00:00"} | ${false}
    ${"13:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${false}
  `(
    "returns $expected when B is not inside A",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${false}
    ${"09:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${"10:00:00"} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
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
      expect(intervalEngulfsTime(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${null}       | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${undefined}  | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${null}       | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${undefined}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalEngulfsTime(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
});
