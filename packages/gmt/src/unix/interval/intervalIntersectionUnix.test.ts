import { intervalIntersectionUnix } from "./intervalIntersectionUnix";

describe("intervalIntersectionUnix", () => {
  // Half-open [start, end) (coding-standards § 8; A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z,
  // D = 17:00Z in ms). The intersection exists only when `aStart < bEnd && bStart < aEnd`, as in
  // `intersectIntervals`, and is `[max(starts), min(ends))`.
  it.each`
    aStart           | aEnd             | bStart           | bEnd             | expected                                        | reason
    ${1704099600000} | ${1704114000000} | ${1704110400000} | ${1704128400000} | ${{ start: 1704110400000, end: 1704114000000 }} | ${"overlapping [A, C) and [B, D) give [B, C)"}
    ${1704099600000} | ${1704128400000} | ${1704110400000} | ${1704114000000} | ${{ start: 1704110400000, end: 1704114000000 }} | ${"[B, C) strictly inside [A, D)"}
    ${1704099600000} | ${1704110400000} | ${1704110400000} | ${1704128400000} | ${null}                                         | ${"touching [A, B) and [B, D) share no instant"}
    ${1704110400000} | ${1704128400000} | ${1704099600000} | ${1704110400000} | ${null}                                         | ${"touching, arguments swapped"}
    ${1704099600000} | ${1704110400001} | ${1704110400000} | ${1704128400000} | ${{ start: 1704110400000, end: 1704110400001 }} | ${"one-unit overlap"}
    ${1704099600000} | ${1704128400000} | ${1704110400000} | ${1704110400000} | ${{ start: 1704110400000, end: 1704110400000 }} | ${"empty [B, B) strictly inside [A, D) is itself"}
    ${1704099600000} | ${1704128400000} | ${1704128400000} | ${1704128400000} | ${null}                                         | ${"empty [D, D) at the end edge"}
    ${1704099600000} | ${1704128400000} | ${1704099600000} | ${1704099600000} | ${null}                                         | ${"empty [A, A) at the start edge"}
    ${1704110400000} | ${1704110400000} | ${1704110400000} | ${1704110400000} | ${null}                                         | ${"two identical empty intervals"}
  `(
    "returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart     | aEnd       | bStart     | bEnd       | expected
    ${0}       | ${1000000} | ${1000001} | ${2000000} | ${null}
    ${1000001} | ${2000000} | ${0}       | ${1000000} | ${null}
  `(
    "returns $expected for disjoint intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionUnix(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart     | aEnd       | bStart     | bEnd      | expected
    ${1000000} | ${0}       | ${2000000} | ${500000} | ${null}
    ${0}       | ${1000000} | ${1000000} | ${999999} | ${null}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionUnix(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart        | aEnd          | bStart       | bEnd
    ${NaN}        | ${1700000000} | ${1000000}   | ${2000000}
    ${Infinity}   | ${1700000000} | ${1000000}   | ${2000000}
    ${-Infinity}  | ${1700000000} | ${1000000}   | ${2000000}
    ${1700000000} | ${NaN}        | ${1000000}   | ${2000000}
    ${1700000000} | ${Infinity}   | ${1000000}   | ${2000000}
    ${1700000000} | ${-Infinity}  | ${1000000}   | ${2000000}
    ${1700000000} | ${1700000000} | ${NaN}       | ${2000000}
    ${1700000000} | ${1700000000} | ${Infinity}  | ${2000000}
    ${1700000000} | ${1700000000} | ${-Infinity} | ${2000000}
    ${1700000000} | ${1700000000} | ${1000000}   | ${NaN}
    ${1700000000} | ${1700000000} | ${1000000}   | ${Infinity}
    ${1700000000} | ${1700000000} | ${1000000}   | ${-Infinity}
  `(
    "returns null for non-finite: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalIntersectionUnix(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart        | aEnd          | bStart       | bEnd
    ${null}       | ${1700000000} | ${1000000}   | ${2000000}
    ${undefined}  | ${1700000000} | ${1000000}   | ${2000000}
    ${"abc"}      | ${1700000000} | ${1000000}   | ${2000000}
    ${1700000000} | ${null}       | ${1000000}   | ${2000000}
    ${1700000000} | ${undefined}  | ${1000000}   | ${2000000}
    ${1700000000} | ${"abc"}      | ${1000000}   | ${2000000}
    ${1700000000} | ${1700000000} | ${null}      | ${2000000}
    ${1700000000} | ${1700000000} | ${undefined} | ${2000000}
    ${1700000000} | ${1700000000} | ${"abc"}     | ${2000000}
    ${1700000000} | ${1700000000} | ${1000000}   | ${null}
    ${1700000000} | ${1700000000} | ${1000000}   | ${undefined}
    ${1700000000} | ${1700000000} | ${1000000}   | ${"abc"}
  `("returns null for non-numeric input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(
      intervalIntersectionUnix(
        aStart as never,
        aEnd as never,
        bStart as never,
        bEnd as never,
      ),
    ).toBeNull();
  });

  it.each`
    aStart | aEnd         | bStart       | bEnd         | expected
    ${"0"} | ${"1000000"} | ${"500000"}  | ${"2000000"} | ${{ start: 500000, end: 1000000 }}
    ${"0"} | ${"2000000"} | ${"0"}       | ${"1000000"} | ${{ start: 0, end: 1000000 }}
    ${"0"} | ${"1000000"} | ${"1000000"} | ${"2000000"} | ${null}
  `(
    "accepts string inputs: [$aStart, $aEnd) and [$bStart, $bEnd) give $expected",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionUnix(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
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
    "returns null for A=[$aStart, $aEnd] and B=[$bStart, $bEnd] ($description)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalIntersectionUnix(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );
});
