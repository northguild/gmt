import { intervalAbutsUnix } from "./intervalAbutsUnix";

describe("intervalAbutsUnix", () => {
  // Half-open [start, end): two non-empty intervals abut when one's end equals the other's start
  // (Allen's "meets", either order), so they share no value and leave no gap. An empty interval
  // abuts nothing (coding-standards § 8; A = 2024-01-01T09:00Z, B = 12:00Z, D = 17:00Z in ms).
  it.each`
    aStart           | aEnd             | bStart           | bEnd             | expected | reason
    ${1704099600000} | ${1704110400000} | ${1704110400000} | ${1704128400000} | ${true}  | ${"[A, B) ends where [B, D) starts"}
    ${1704099600000} | ${1704110400000} | ${1704110400001} | ${1704128400000} | ${false} | ${"one unit apart"}
    ${0}             | ${1500000000}    | ${1500000000}    | ${1700000000}    | ${true}  | ${"shared value"}
    ${1500000000}    | ${1700000000}    | ${0}             | ${1500000000}    | ${true}  | ${"B ends where A starts"}
    ${0}             | ${1500000000}    | ${1500000001}    | ${1700000000}    | ${false} | ${"one unit apart, larger values"}
    ${1000}          | ${1000}          | ${1000}          | ${2000}          | ${false} | ${"an empty A at B's start abuts nothing"}
    ${0}             | ${1000}          | ${1000}          | ${1000}          | ${false} | ${"an empty B at A's end abuts nothing"}
  `(
    "returns $expected for A=[$aStart, $aEnd) and B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart | aEnd          | bStart        | bEnd          | expected
    ${0}   | ${1500000000} | ${1500000001} | ${1700000000} | ${false}
    ${0}   | ${1500000001} | ${1500000000} | ${1700000000} | ${false}
    ${0}   | ${1500000000} | ${1600000000} | ${1700000000} | ${false}
  `(
    "returns $expected for non-adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${1700000000} | ${0}          | ${1500000000} | ${1600000000} | ${false}
    ${1500000000} | ${1000000000} | ${1200000000} | ${1100000000} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart       | aEnd          | bStart        | bEnd
    ${NaN}       | ${1700000000} | ${1500000000} | ${1600000000}
    ${Infinity}  | ${1700000000} | ${1500000000} | ${1600000000}
    ${-Infinity} | ${1700000000} | ${1500000000} | ${1600000000}
    ${0}         | ${NaN}        | ${1500000000} | ${1600000000}
    ${0}         | ${Infinity}   | ${1500000000} | ${1600000000}
    ${0}         | ${-Infinity}  | ${1500000000} | ${1600000000}
    ${0}         | ${1700000000} | ${NaN}        | ${1600000000}
    ${0}         | ${1700000000} | ${Infinity}   | ${1600000000}
    ${0}         | ${1700000000} | ${-Infinity}  | ${1600000000}
    ${0}         | ${1700000000} | ${1500000000} | ${NaN}
    ${0}         | ${1700000000} | ${1500000000} | ${Infinity}
    ${0}         | ${1700000000} | ${1500000000} | ${-Infinity}
  `(
    "returns false for non-finite values: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart  | aEnd          | bStart        | bEnd
    ${null} | ${1700000000} | ${1500000000} | ${1600000000}
    ${0}    | ${undefined}  | ${1500000000} | ${1600000000}
    ${0}    | ${1700000000} | ${null}       | ${1600000000}
    ${0}    | ${1700000000} | ${1500000000} | ${undefined}
    ${true} | ${1700000000} | ${1500000000} | ${1600000000}
  `("returns false for invalid types", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"0"}          | ${"1500000000"} | ${"1500000000"} | ${"1700000000"} | ${true}
    ${"1500000000"} | ${"1700000000"} | ${"0"}          | ${"1500000000"} | ${true}
  `(
    "returns $expected for string numeric input",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  // Epoch values are whole units: fractions are invalid, and past 2^53 consecutive integers
  // collapse (2 ** 53 + 1 === 2 ** 53), so a value there does not name one unit.
  it.each`
    aStart | aEnd       | bStart     | bEnd           | description
    ${0}   | ${1.5}     | ${1.5}     | ${3}           | ${"a fractional shared end"}
    ${0}   | ${1}       | ${0.5}     | ${2}           | ${"a fractional start"}
    ${0}   | ${2 ** 53} | ${2 ** 53} | ${2 ** 53 + 4} | ${"unsafe integers (2^53 + 1 === 2^53)"}
    ${"0"} | ${"1.5"}   | ${"1.5"}   | ${"3"}         | ${"fractional numeric strings"}
    ${""}  | ${"0"}     | ${"1"}     | ${"2"}         | ${"an empty string, which Number() reads as 0"}
  `(
    "returns false for A=[$aStart, $aEnd) and B=[$bStart, $bEnd) ($description)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  // Range edge (CORE-6): no value is stepped past the largest safe integer. Half-open, B abuts A when
  // it starts at A's end, and an empty B there abuts nothing.
  it.each`
    aEnd                           | bStart                         | expected | description
    ${Number.MAX_SAFE_INTEGER - 1} | ${Number.MAX_SAFE_INTEGER - 1} | ${true}  | ${"B = [MAX - 1, MAX) starts at A's end"}
    ${Number.MAX_SAFE_INTEGER - 2} | ${Number.MAX_SAFE_INTEGER - 1} | ${false} | ${"one unit apart below the maximum"}
    ${Number.MAX_SAFE_INTEGER}     | ${Number.MAX_SAFE_INTEGER}     | ${false} | ${"an empty B = [MAX, MAX)"}
  `(
    "returns $expected for A=[0, $aEnd) and B=[$bStart, MAX_SAFE_INTEGER) ($description)",
    ({ aEnd, bStart, expected }) => {
      expect(intervalAbutsUnix(0, aEnd, bStart, Number.MAX_SAFE_INTEGER)).toBe(
        expected,
      );
    },
  );
});
