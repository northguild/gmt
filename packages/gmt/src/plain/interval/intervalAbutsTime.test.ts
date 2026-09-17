import { intervalAbutsTime } from "./intervalAbutsTime";

describe("intervalAbutsTime", () => {
  // Half-open [start, end): two non-empty intervals abut when one's end equals the other's start —
  // they share no value and leave no gap (Allen's "meets"). An empty interval abuts nothing, and
  // there is no one-unit step, so a one-unit gap is a gap.
  it.each`
    aStart                  | aEnd                    | bStart                  | bEnd                    | expected
    ${"09:00:00"}           | ${"12:00:00"}           | ${"12:00:00.000000001"} | ${"17:00:00"}           | ${false}
    ${"12:00:00"}           | ${"17:00:00"}           | ${"09:00:00"}           | ${"12:00:00.000000001"} | ${false}
    ${"09:00:00"}           | ${"09:00:00.000000001"} | ${"09:00:00.000000002"} | ${"17:00:00"}           | ${false}
    ${"12:00:00.000000001"} | ${"17:00:00"}           | ${"09:00:00"}           | ${"12:00:00"}           | ${false}
    ${"09:00:00"}           | ${"12:00:00"}           | ${"12:00:00"}           | ${"17:00:00"}           | ${true}
    ${"12:00:00"}           | ${"17:00:00"}           | ${"09:00:00"}           | ${"12:00:00"}           | ${true}
    ${"12:00:00"}           | ${"12:00:00"}           | ${"12:00:00"}           | ${"17:00:00"}           | ${false}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
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

  // PlainTime has no day rollover: `23:59:59.999999999` is the last time, and nothing follows it.
  // Half-open, an interval ending there excludes it, and `00:00:00` is ~22 hours before that end, never
  // one nanosecond after it: nothing wraps to midnight.
  it.each`
    aStart                  | aEnd                    | bStart                  | bEnd                    | expected
    ${"22:00:00"}           | ${"23:59:59.999999999"} | ${"00:00:00"}           | ${"01:00:00"}           | ${false}
    ${"00:00:00"}           | ${"01:00:00"}           | ${"22:00:00"}           | ${"23:59:59.999999999"} | ${false}
    ${"23:59:59.999999999"} | ${"23:59:59.999999999"} | ${"00:00:00"}           | ${"00:00:00"}           | ${false}
    ${"00:00:00"}           | ${"00:00:00"}           | ${"23:59:59.999999999"} | ${"23:59:59.999999999"} | ${false}
    ${"12:00:00"}           | ${"23:59:59.999999999"} | ${"00:00:00"}           | ${"11:59:59.999999999"} | ${false}
    ${"00:00:00"}           | ${"12:00:00"}           | ${"12:00:00"}           | ${"23:59:59.999999999"} | ${true}
  `(
    "returns $expected when A=[$aStart, $aEnd] and B=[$bStart, $bEnd] at the end of the day (no midnight wrap)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );
});
