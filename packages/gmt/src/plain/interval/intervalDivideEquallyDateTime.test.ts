import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { intervalDivideEquallyDateTime } from "./intervalDivideEquallyDateTime";

describe("intervalDivideEquallyDateTime", () => {
  it.each`
    start                    | end                      | n    | expected
    ${"2024-01-01T00:00:00"} | ${"2024-01-04T00:00:00"} | ${3} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-02T00:00:00" }, { start: "2024-01-02T00:00:00", end: "2024-01-03T00:00:00" }, { start: "2024-01-03T00:00:00", end: "2024-01-04T00:00:00" }]}
    ${"2024-01-01T00:00:00"} | ${"2024-01-04T00:00:00"} | ${1} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-04T00:00:00" }]}
    ${"2024-01-01T00:00:00"} | ${"2024-01-01T00:00:00"} | ${2} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-01T00:00:00" }, { start: "2024-01-01T00:00:00", end: "2024-01-01T00:00:00" }]}
  `(
    "splits $start to $end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyDateTime(start, end, n)).toEqual(expected);
    },
  );

  // 1 second does not divide evenly by 3: boundaries are computed from total elapsed
  // nanoseconds, so the split is exact to the nanosecond rather than day-rounded. Verified
  // against real @js-temporal/polyfill: 1e9 ns / 3 rounds to 333333333 and 666666667 ns.
  it("splits to nanosecond precision when the total does not divide evenly by n", () => {
    expect(
      intervalDivideEquallyDateTime(
        "2024-01-01T00:00:00",
        "2024-01-01T00:00:01",
        3,
      ),
    ).toEqual([
      { start: "2024-01-01T00:00:00", end: "2024-01-01T00:00:00.333333333" },
      {
        start: "2024-01-01T00:00:00.333333333",
        end: "2024-01-01T00:00:00.666666667",
      },
      { start: "2024-01-01T00:00:00.666666667", end: "2024-01-01T00:00:01" },
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
    expect(
      intervalDivideEquallyDateTime(
        "2024-01-01T00:00:00",
        "2024-01-04T00:00:00",
        n,
      ),
    ).toEqual([]);
  });

  it.each`
    start                    | end
    ${"invalid"}             | ${"2024-01-04T00:00:00"}
    ${"2024-01-04T00:00:00"} | ${"2024-01-01T00:00:00"}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(intervalDivideEquallyDateTime(start, end, 3)).toEqual([]);
  });

  it("returns [] when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalDivideEquallyDateTime(
        "2024-01-01T00:00:00",
        "2024-01-04T00:00:00",
        3,
      ),
    ).toEqual([]);
  });
});

describe("intervalDivideEquallyDateTime maxPieces", () => {
  // 72 hours / 3 = 24 hours: n = 3 pieces, so a limit of 3 or more leaves the output unchanged.
  it.each`
    n    | maxPieces
    ${3} | ${3}
    ${3} | ${10}
  `(
    "returns the 3 pieces for n $n with maxPieces $maxPieces",
    ({ n, maxPieces }) => {
      expect(
        intervalDivideEquallyDateTime(
          "2024-01-01T00:00:00",
          "2024-01-04T00:00:00",
          n,
          { maxPieces },
        ),
      ).toEqual([
        { start: "2024-01-01T00:00:00", end: "2024-01-02T00:00:00" },
        { start: "2024-01-02T00:00:00", end: "2024-01-03T00:00:00" },
        { start: "2024-01-03T00:00:00", end: "2024-01-04T00:00:00" },
      ]);
    },
  );

  // Owner decision A2: an output larger than maxPieces returns the sentinel, decided before any
  // piece is built.
  it.each`
    start                    | end                      | n    | maxPieces
    ${"2024-01-01T00:00:00"} | ${"2024-01-04T00:00:00"} | ${3} | ${2}
    ${"2024-01-01T00:00:00"} | ${"2024-01-01T00:00:00"} | ${3} | ${2}
    ${"2024-01-01T00:00:00"} | ${"2024-01-04T00:00:00"} | ${2} | ${1}
  `(
    "returns [] for $start to $end with n $n over maxPieces $maxPieces",
    ({ start, end, n, maxPieces }) => {
      expect(
        intervalDivideEquallyDateTime(start, end, n, { maxPieces }).length,
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
      intervalDivideEquallyDateTime(
        "2024-01-01T00:00:00",
        "2024-01-04T00:00:00",
        3,
        options as never,
      ).length,
    ).toBe(0);
  });
});

describe("intervalDivideEquallyDateTime default piece limit", () => {
  // Default maxPieces is 1_000_000 (owner decision A2). An array holds at most 2^32 - 1
  // elements (ECMA-262 §10.4.2), so n >= 2^32 is the sentinel whatever the limit.
  it.each`
    n            | options
    ${1_000_001} | ${undefined}
    ${2 ** 32}   | ${undefined}
    ${2 ** 32}   | ${{ maxPieces: 2 ** 40 }}
  `("returns [] for n $n with options $options", ({ n, options }) => {
    expect(
      intervalDivideEquallyDateTime(
        "2024-01-01T00:00:00",
        "2024-01-04T00:00:00",
        n,
        options,
      ).length,
    ).toBe(0);
  });

  it("returns [] for equal endpoints and n 2^32 under maxPieces 2^40", () => {
    expect(
      intervalDivideEquallyDateTime(
        "2024-01-01T00:00:00",
        "2024-01-01T00:00:00",
        2 ** 32,
        { maxPieces: 2 ** 40 },
      ).length,
    ).toBe(0);
  });
});
