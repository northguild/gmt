import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { intervalDivideEquallyDate } from "./intervalDivideEquallyDate";

describe("intervalDivideEquallyDate", () => {
  it.each`
    start           | end             | n    | expected
    ${"2024-01-01"} | ${"2024-01-05"} | ${4} | ${[{ start: "2024-01-01", end: "2024-01-02" }, { start: "2024-01-02", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-04" }, { start: "2024-01-04", end: "2024-01-05" }]}
    ${"2024-01-01"} | ${"2024-01-10"} | ${1} | ${[{ start: "2024-01-01", end: "2024-01-10" }]}
    ${"2024-01-01"} | ${"2024-01-10"} | ${4} | ${[{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-06" }, { start: "2024-01-06", end: "2024-01-08" }, { start: "2024-01-08", end: "2024-01-10" }]}
    ${"2024-01-01"} | ${"2024-01-01"} | ${3} | ${[{ start: "2024-01-01", end: "2024-01-01" }, { start: "2024-01-01", end: "2024-01-01" }, { start: "2024-01-01", end: "2024-01-01" }]}
  `(
    "splits $start to $end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyDate(start, end, n)).toEqual(expected);
    },
  );

  // 9 days does not divide evenly by 4: PlainDate has no fractional-day representation, so
  // rounding produces a 2/3/2/2-day split rather than four exact 2.25-day pieces. Verified
  // against real @js-temporal/polyfill: Math.round(9*1/4)=2, Math.round(9*2/4)=5, Math.round(9*3/4)=7.
  it("rounds boundaries to the nearest whole day when n does not divide the total evenly", () => {
    expect(intervalDivideEquallyDate("2024-01-01", "2024-01-10", 4)).toEqual([
      { start: "2024-01-01", end: "2024-01-03" },
      { start: "2024-01-03", end: "2024-01-06" },
      { start: "2024-01-06", end: "2024-01-08" },
      { start: "2024-01-08", end: "2024-01-10" },
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
    expect(intervalDivideEquallyDate("2024-01-01", "2024-01-10", n)).toEqual(
      [],
    );
  });

  it.each`
    start           | end             | n
    ${"invalid"}    | ${"2024-01-10"} | ${3}
    ${"2024-01-10"} | ${"2024-01-01"} | ${3}
  `("returns [] for invalid $start, $end", ({ start, end, n }) => {
    expect(intervalDivideEquallyDate(start, end, n)).toEqual([]);
  });

  it("returns [] when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(intervalDivideEquallyDate("2024-01-01", "2024-01-10", 3)).toEqual(
      [],
    );
  });
  // E5 (issue #78): start and end must share the same calendar tag (or both be bare ISO)
  // (D4). Golden verified directly against @js-temporal/polyfill.
  it("divides in the shared calendar when start and end carry the same tag", () => {
    expect(
      intervalDivideEquallyDate(
        "2023-09-16[u-ca=hebrew]",
        "2023-09-26[u-ca=hebrew]",
        2,
      ),
    ).toEqual([
      { start: "2023-09-16[u-ca=hebrew]", end: "2023-09-21[u-ca=hebrew]" },
      { start: "2023-09-21[u-ca=hebrew]", end: "2023-09-26[u-ca=hebrew]" },
    ]);
  });

  it("returns [] when start and end carry mismatched calendar tags", () => {
    expect(
      intervalDivideEquallyDate("2023-09-16[u-ca=hebrew]", "2024-01-11", 2),
    ).toEqual([]);
  });
});

describe("intervalDivideEquallyDate maxPieces", () => {
  // Math.round(9*1/3)=3, Math.round(9*2/3)=6 days: n = 3 pieces, so a limit of 3 or more leaves the output unchanged.
  it.each`
    n    | maxPieces
    ${3} | ${3}
    ${3} | ${10}
  `(
    "returns the 3 pieces for n $n with maxPieces $maxPieces",
    ({ n, maxPieces }) => {
      expect(
        intervalDivideEquallyDate("2024-01-01", "2024-01-10", n, { maxPieces }),
      ).toEqual([
        { start: "2024-01-01", end: "2024-01-04" },
        { start: "2024-01-04", end: "2024-01-07" },
        { start: "2024-01-07", end: "2024-01-10" },
      ]);
    },
  );

  // Owner decision A2: an output larger than maxPieces returns the sentinel, decided before any
  // piece is built.
  it.each`
    start           | end             | n    | maxPieces
    ${"2024-01-01"} | ${"2024-01-10"} | ${3} | ${2}
    ${"2024-01-01"} | ${"2024-01-01"} | ${3} | ${2}
    ${"2024-01-01"} | ${"2024-01-10"} | ${2} | ${1}
  `(
    "returns [] for $start to $end with n $n over maxPieces $maxPieces",
    ({ start, end, n, maxPieces }) => {
      expect(
        intervalDivideEquallyDate(start, end, n, { maxPieces }).length,
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
      intervalDivideEquallyDate("2024-01-01", "2024-01-10", 3, options as never)
        .length,
    ).toBe(0);
  });
});

describe("intervalDivideEquallyDate default piece limit", () => {
  // Default maxPieces is 1_000_000 (owner decision A2). An array holds at most 2^32 - 1
  // elements (ECMA-262 §10.4.2), so n >= 2^32 is the sentinel whatever the limit.
  it.each`
    n            | options
    ${1_000_001} | ${undefined}
    ${2 ** 32}   | ${undefined}
    ${2 ** 32}   | ${{ maxPieces: 2 ** 40 }}
  `("returns [] for n $n with options $options", ({ n, options }) => {
    expect(
      intervalDivideEquallyDate("2024-01-01", "2024-01-10", n, options).length,
    ).toBe(0);
  });

  it("returns [] for equal endpoints and n 2^32 under maxPieces 2^40", () => {
    expect(
      intervalDivideEquallyDate("2024-01-01", "2024-01-01", 2 ** 32, {
        maxPieces: 2 ** 40,
      }).length,
    ).toBe(0);
  });
});
