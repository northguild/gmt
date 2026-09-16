import { intervalDivideEquallyUnix } from "./intervalDivideEquallyUnix";

describe("intervalDivideEquallyUnix", () => {
  it.each`
    start  | end         | n    | expected
    ${0}   | ${90000000} | ${3} | ${[{ start: 0, end: 30000000 }, { start: 30000000, end: 60000000 }, { start: 60000000, end: 90000000 }]}
    ${0}   | ${90000000} | ${1} | ${[{ start: 0, end: 90000000 }]}
    ${500} | ${500}      | ${2} | ${[{ start: 500, end: 500 }, { start: 500, end: 500 }]}
  `(
    "splits $start to $end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyUnix(start, end, n)).toEqual(expected);
    },
  );

  // 100000000 does not divide evenly by 3: boundaries are plain numeric arithmetic on the epoch
  // values, rounded. Verified: Math.round(100000000/3)=33333333, Math.round(200000000/3)=66666667.
  it("rounds boundaries to the nearest millisecond when the total does not divide evenly by n", () => {
    expect(intervalDivideEquallyUnix(0, 100000000, 3)).toEqual([
      { start: 0, end: 33333333 },
      { start: 33333333, end: 66666667 },
      { start: 66666667, end: 100000000 },
    ]);
  });

  it("accepts start/end as numeric strings", () => {
    expect(intervalDivideEquallyUnix("0", "90000000", 3)).toEqual([
      { start: 0, end: 30000000 },
      { start: 30000000, end: 60000000 },
      { start: 60000000, end: 90000000 },
    ]);
  });

  it.each`
    n
    ${0}
    ${-1}
    ${1.5}
    ${NaN}
    ${"3"}
    ${null}
    ${undefined}
    ${true}
  `("returns [] for invalid n = $n", ({ n }) => {
    expect(intervalDivideEquallyUnix(0, 90000000, n)).toEqual([]);
  });

  it.each`
    start             | end
    ${NaN}            | ${90000000}
    ${90000000}       | ${0}
    ${1.5}            | ${90000000}
    ${null}           | ${90000000}
    ${{}}             | ${90000000}
    ${"not-a-number"} | ${90000000}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(intervalDivideEquallyUnix(start, end, 3)).toEqual([]);
  });

  // Epoch values are safe whole units; an empty string is not a numeric string.
  it.each`
    start  | end         | description
    ${0}   | ${2 ** 53}  | ${"an unsafe end"}
    ${""}  | ${90000000} | ${"an empty-string start, which Number() reads as 0"}
    ${"0"} | ${"1.5"}    | ${"a fractional numeric-string end"}
  `(
    "returns [] for [$start, $end] divided into 3 ($description)",
    ({ start, end }) => {
      expect(intervalDivideEquallyUnix(start, end, 3)).toEqual([]);
    },
  );
});

describe("intervalDivideEquallyUnix maxPieces", () => {
  // 90000000 ms / 3 = 30000000 ms: n = 3 pieces, so a limit of 3 or more leaves the output unchanged.
  it.each`
    n    | maxPieces
    ${3} | ${3}
    ${3} | ${10}
  `(
    "returns the 3 pieces for n $n with maxPieces $maxPieces",
    ({ n, maxPieces }) => {
      expect(intervalDivideEquallyUnix(0, 90000000, n, { maxPieces })).toEqual([
        { start: 0, end: 30000000 },
        { start: 30000000, end: 60000000 },
        { start: 60000000, end: 90000000 },
      ]);
    },
  );

  // Owner decision A2: an output larger than maxPieces returns the sentinel, decided before any
  // piece is built.
  it.each`
    start | end         | n    | maxPieces
    ${0}  | ${90000000} | ${3} | ${2}
    ${0}  | ${0}        | ${3} | ${2}
    ${0}  | ${90000000} | ${2} | ${1}
  `(
    "returns [] for $start to $end with n $n over maxPieces $maxPieces",
    ({ start, end, n, maxPieces }) => {
      expect(
        intervalDivideEquallyUnix(start, end, n, { maxPieces }).length,
      ).toBe(0);
    },
  );

  it.each`
    label                   | options
    ${"maxPieces 0"}        | ${{ maxPieces: 0 }}
    ${"maxPieces -1"}       | ${{ maxPieces: -1 }}
    ${"maxPieces 1.5"}      | ${{ maxPieces: 1.5 }}
    ${"maxPieces NaN"}      | ${{ maxPieces: Number.NaN }}
    ${"maxPieces Infinity"} | ${{ maxPieces: Number.POSITIVE_INFINITY }}
    ${"maxPieces string"}   | ${{ maxPieces: "3" }}
    ${"null options"}       | ${null}
    ${"number options"}     | ${5}
  `("returns [] for invalid $label", ({ options }) => {
    expect(
      intervalDivideEquallyUnix(0, 90000000, 3, options as never).length,
    ).toBe(0);
  });
});

describe("intervalDivideEquallyUnix default piece limit", () => {
  // Default maxPieces is 1_000_000 (owner decision A2). An array holds at most 2^32 - 1
  // elements (ECMA-262 §10.4.2), so n >= 2^32 is the sentinel whatever the limit.
  it.each`
    n            | options
    ${1_000_001} | ${undefined}
    ${2 ** 32}   | ${undefined}
    ${2 ** 32}   | ${{ maxPieces: 2 ** 40 }}
  `("returns [] for n $n with options $options", ({ n, options }) => {
    expect(intervalDivideEquallyUnix(0, 90000000, n, options).length).toBe(0);
  });

  it("returns [] for equal endpoints and n 2^32 under maxPieces 2^40", () => {
    expect(
      intervalDivideEquallyUnix(0, 0, 2 ** 32, { maxPieces: 2 ** 40 }).length,
    ).toBe(0);
  });
});
