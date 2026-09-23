import { intervalEngulfsUnix } from "./intervalEngulfsUnix";

describe("intervalEngulfsUnix", () => {
  it.each`
    aStart | aEnd          | bStart        | bEnd          | expected
    ${0}   | ${1700000000} | ${1500000000} | ${1600000000} | ${true}
    ${0}   | ${1700000000} | ${0}          | ${1700000000} | ${true}
    ${0}   | ${1700000000} | ${0}          | ${1500000000} | ${true}
    ${0}   | ${1700000000} | ${1500000000} | ${1700000000} | ${true}
  `(
    "returns $expected when B is inside A ($aStart to $aEnd, $bStart to $bEnd)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  // Half-open [start, end) (coding-standards § 8; A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z,
  // D = 17:00Z in ms). B is inside A when the two overlap and B's bounds lie within A's, so B may
  // share A's end, and an empty B counts only strictly inside A — as `clampInterval` clamps it to
  // itself there and to `null` at an edge.
  it.each`
    aStart           | aEnd             | bStart           | bEnd             | expected | reason
    ${1704099600000} | ${1704128400000} | ${1704110400000} | ${1704128400000} | ${true}  | ${"[B, D) shares the end of [A, D)"}
    ${1704099600000} | ${1704128400000} | ${1704110400000} | ${1704110400000} | ${true}  | ${"empty [B, B) strictly inside"}
    ${1704099600000} | ${1704128400000} | ${1704128400000} | ${1704128400000} | ${false} | ${"empty [D, D) at the end edge"}
    ${1704099600000} | ${1704128400000} | ${1704099600000} | ${1704099600000} | ${false} | ${"empty [A, A) at the start edge"}
    ${1704110400000} | ${1704110400000} | ${1704110400000} | ${1704110400000} | ${false} | ${"identical empty intervals"}
    ${1704099600000} | ${1704110400000} | ${1704114000000} | ${1704114000000} | ${false} | ${"empty [C, C) beyond the end of [A, B)"}
    ${1704099600000} | ${1704110400000} | ${1704110400000} | ${1704110400001} | ${false} | ${"B runs one unit past A's end"}
  `(
    "returns $expected for A=[$aStart, $aEnd) and B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${1500000000} | ${1600000000} | ${0}          | ${1700000000} | ${false}
    ${0}          | ${1500000000} | ${1500000000} | ${1700000000} | ${false}
    ${1500000000} | ${1700000000} | ${0}          | ${1400000000} | ${false}
  `(
    "returns $expected when B is not inside A",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${1700000000} | ${0}          | ${1500000000} | ${1600000000} | ${false}
    ${1500000000} | ${1000000000} | ${1200000000} | ${1100000000} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
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
      expect(intervalEngulfsUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
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
    expect(intervalEngulfsUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it.each`
    aStart | aEnd            | bStart          | bEnd            | expected
    ${"0"} | ${"1700000000"} | ${"1500000000"} | ${"1600000000"} | ${true}
    ${"0"} | ${"1700000000"} | ${"0"}          | ${"1700000000"} | ${true}
  `(
    "returns $expected for string numeric input",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsUnix(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  // Epoch values are whole units; fractions, unsafe integers and empty strings are invalid input.
  it.each`
    aStart | aEnd       | bStart   | bEnd   | description
    ${0}   | ${10}      | ${0.5}   | ${1}   | ${"a fractional start"}
    ${0}   | ${2 ** 53} | ${1}     | ${2}   | ${"an unsafe end"}
    ${"0"} | ${"10"}    | ${"1.5"} | ${"2"} | ${"a fractional numeric string"}
    ${""}  | ${"10"}    | ${"1"}   | ${"2"} | ${"an empty string, which Number() reads as 0"}
  `(
    "returns false for A=[$aStart, $aEnd] engulfing B=[$bStart, $bEnd] ($description)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalEngulfsUnix(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );
});
