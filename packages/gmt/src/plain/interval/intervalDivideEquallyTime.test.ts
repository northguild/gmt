import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { intervalDivideEquallyTime } from "./intervalDivideEquallyTime";

describe("intervalDivideEquallyTime", () => {
  it.each`
    start         | end           | n    | expected
    ${"09:00:00"} | ${"17:00:00"} | ${4} | ${[{ start: "09:00:00", end: "11:00:00" }, { start: "11:00:00", end: "13:00:00" }, { start: "13:00:00", end: "15:00:00" }, { start: "15:00:00", end: "17:00:00" }]}
    ${"09:00:00"} | ${"17:00:00"} | ${3} | ${[{ start: "09:00:00", end: "11:40:00" }, { start: "11:40:00", end: "14:20:00" }, { start: "14:20:00", end: "17:00:00" }]}
    ${"09:00:00"} | ${"17:00:00"} | ${1} | ${[{ start: "09:00:00", end: "17:00:00" }]}
    ${"09:00:00"} | ${"09:00:00"} | ${2} | ${[{ start: "09:00:00", end: "09:00:00" }, { start: "09:00:00", end: "09:00:00" }]}
  `(
    "splits $start to $end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyTime(start, end, n)).toEqual(expected);
    },
  );

  // 1 second does not divide evenly by 3: boundaries are computed to nanosecond precision, so
  // the split is exact to the nanosecond. Verified against real @js-temporal/polyfill: 1e9 ns / 3
  // rounds to 333333333 and 666666667 ns.
  it("splits to nanosecond precision when the total does not divide evenly by n", () => {
    expect(intervalDivideEquallyTime("00:00:00", "00:00:01", 3)).toEqual([
      { start: "00:00:00", end: "00:00:00.333333333" },
      { start: "00:00:00.333333333", end: "00:00:00.666666667" },
      { start: "00:00:00.666666667", end: "00:00:01" },
    ]);
  });

  // The quotient must be rounded exactly, not after a double division: 86,399,999,999,999 ns · 63
  // / 65 = 83,741,538,461,537.49, whose nearest double is .5, so a float quotient rounds it up.
  // Boundary 63 is 83,741,538,461,537 ns = 23:15:41.538461537 (BigInt arithmetic, not GMT).
  it("rounds boundary 63 of 65 over the whole day from the exact quotient", () => {
    const pieces = intervalDivideEquallyTime(
      "00:00:00",
      "23:59:59.999999999",
      65,
    );
    expect(pieces[63].start).toBe("23:15:41.538461537");
    expect(pieces[62].end).toBe("23:15:41.538461537");
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
    expect(intervalDivideEquallyTime("09:00:00", "17:00:00", n)).toEqual([]);
  });

  it.each`
    start         | end           | n
    ${"invalid"}  | ${"17:00:00"} | ${3}
    ${"17:00:00"} | ${"09:00:00"} | ${3}
  `("returns [] for invalid $start, $end", ({ start, end, n }) => {
    expect(intervalDivideEquallyTime(start, end, n)).toEqual([]);
  });

  it("returns [] when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(intervalDivideEquallyTime("09:00:00", "17:00:00", 3)).toEqual([]);
  });
});

describe("intervalDivideEquallyTime maxPieces", () => {
  // 8 hours / 3 = 2h40m: n = 3 pieces, so a limit of 3 or more leaves the output unchanged.
  it.each`
    n    | maxPieces
    ${3} | ${3}
    ${3} | ${10}
  `(
    "returns the 3 pieces for n $n with maxPieces $maxPieces",
    ({ n, maxPieces }) => {
      expect(
        intervalDivideEquallyTime("09:00:00", "17:00:00", n, { maxPieces }),
      ).toEqual([
        { start: "09:00:00", end: "11:40:00" },
        { start: "11:40:00", end: "14:20:00" },
        { start: "14:20:00", end: "17:00:00" },
      ]);
    },
  );

  // Owner decision A2: an output larger than maxPieces returns the sentinel, decided before any
  // piece is built.
  it.each`
    start         | end           | n    | maxPieces
    ${"09:00:00"} | ${"17:00:00"} | ${3} | ${2}
    ${"09:00:00"} | ${"09:00:00"} | ${3} | ${2}
    ${"09:00:00"} | ${"17:00:00"} | ${2} | ${1}
  `(
    "returns [] for $start to $end with n $n over maxPieces $maxPieces",
    ({ start, end, n, maxPieces }) => {
      expect(
        intervalDivideEquallyTime(start, end, n, { maxPieces }).length,
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
      intervalDivideEquallyTime("09:00:00", "17:00:00", 3, options as never)
        .length,
    ).toBe(0);
  });
});

describe("intervalDivideEquallyTime default piece limit", () => {
  // Default maxPieces is 1_000_000 (owner decision A2). An array holds at most 2^32 - 1
  // elements (ECMA-262 §10.4.2), so n >= 2^32 is the sentinel whatever the limit.
  it.each`
    n            | options
    ${1_000_001} | ${undefined}
    ${2 ** 32}   | ${undefined}
    ${2 ** 32}   | ${{ maxPieces: 2 ** 40 }}
  `("returns [] for n $n with options $options", ({ n, options }) => {
    expect(
      intervalDivideEquallyTime("09:00:00", "17:00:00", n, options).length,
    ).toBe(0);
  });

  it("returns [] for equal endpoints and n 2^32 under maxPieces 2^40", () => {
    expect(
      intervalDivideEquallyTime("09:00:00", "09:00:00", 2 ** 32, {
        maxPieces: 2 ** 40,
      }).length,
    ).toBe(0);
  });
});
