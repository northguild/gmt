import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { intervalDivideEquallyUtc } from "./intervalDivideEquallyUtc";

describe("intervalDivideEquallyUtc", () => {
  it.each`
    start                     | end                       | n    | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-04T00:00:00Z"} | ${3} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, { start: "2024-01-02T00:00:00Z", end: "2024-01-03T00:00:00Z" }, { start: "2024-01-03T00:00:00Z", end: "2024-01-04T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-04T00:00:00Z"} | ${1} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-04T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${2} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" }, { start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" }]}
  `(
    "splits $start to $end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyUtc(start, end, n)).toEqual(expected);
    },
  );

  // 1 second does not divide evenly by 3: boundaries are computed from total elapsed
  // nanoseconds, so the split is exact to the nanosecond rather than day-rounded. Verified
  // against real @js-temporal/polyfill: 1e9 ns / 3 rounds to 333333333 and 666666667 ns.
  it("splits to nanosecond precision when the total does not divide evenly by n", () => {
    expect(
      intervalDivideEquallyUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-01T00:00:01Z",
        3,
      ),
    ).toEqual([
      { start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00.333333333Z" },
      {
        start: "2024-01-01T00:00:00.333333333Z",
        end: "2024-01-01T00:00:00.666666667Z",
      },
      { start: "2024-01-01T00:00:00.666666667Z", end: "2024-01-01T00:00:01Z" },
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
      intervalDivideEquallyUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-04T00:00:00Z",
        n,
      ),
    ).toEqual([]);
  });

  it.each`
    start                     | end
    ${"invalid"}              | ${"2024-01-04T00:00:00Z"}
    ${"2024-01-04T00:00:00Z"} | ${"2024-01-01T00:00:00Z"}
    ${"2024-12-31T23:59:60Z"} | ${"2024-01-04T00:00:00Z"}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(intervalDivideEquallyUtc(start, end, 3)).toEqual([]);
  });

  it("returns [] when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalDivideEquallyUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-04T00:00:00Z",
        3,
      ),
    ).toEqual([]);
  });
});

describe("intervalDivideEquallyUtc maxPieces", () => {
  // 72 hours / 3 = 24 hours: n = 3 pieces, so a limit of 3 or more leaves the output unchanged.
  it.each`
    n    | maxPieces
    ${3} | ${3}
    ${3} | ${10}
  `(
    "returns the 3 pieces for n $n with maxPieces $maxPieces",
    ({ n, maxPieces }) => {
      expect(
        intervalDivideEquallyUtc(
          "2024-01-01T00:00:00Z",
          "2024-01-04T00:00:00Z",
          n,
          { maxPieces },
        ),
      ).toEqual([
        { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" },
        { start: "2024-01-02T00:00:00Z", end: "2024-01-03T00:00:00Z" },
        { start: "2024-01-03T00:00:00Z", end: "2024-01-04T00:00:00Z" },
      ]);
    },
  );

  // Owner decision A2: an output larger than maxPieces returns the sentinel, decided before any
  // piece is built.
  it.each`
    start                     | end                       | n    | maxPieces
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-04T00:00:00Z"} | ${3} | ${2}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${3} | ${2}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-04T00:00:00Z"} | ${2} | ${1}
  `(
    "returns [] for $start to $end with n $n over maxPieces $maxPieces",
    ({ start, end, n, maxPieces }) => {
      expect(
        intervalDivideEquallyUtc(start, end, n, { maxPieces }).length,
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
      intervalDivideEquallyUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-04T00:00:00Z",
        3,
        options as never,
      ).length,
    ).toBe(0);
  });
});

describe("intervalDivideEquallyUtc default piece limit", () => {
  // Default maxPieces is 1_000_000 (owner decision A2). An array holds at most 2^32 - 1
  // elements (ECMA-262 §10.4.2), so n >= 2^32 is the sentinel whatever the limit.
  it.each`
    n            | options
    ${1_000_001} | ${undefined}
    ${2 ** 32}   | ${undefined}
    ${2 ** 32}   | ${{ maxPieces: 2 ** 40 }}
  `("returns [] for n $n with options $options", ({ n, options }) => {
    expect(
      intervalDivideEquallyUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-04T00:00:00Z",
        n,
        options,
      ).length,
    ).toBe(0);
  });

  it("returns [] for equal endpoints and n 2^32 under maxPieces 2^40", () => {
    expect(
      intervalDivideEquallyUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-01T00:00:00Z",
        2 ** 32,
        { maxPieces: 2 ** 40 },
      ).length,
    ).toBe(0);
  });
});
