import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalDivideEquallyZoned } from "./intervalDivideEquallyZoned";

describe("intervalDivideEquallyZoned", () => {
  it("splits a DST-crossing interval by real elapsed time, not local clock time", () => {
    const result = intervalDivideEquallyZoned(
      "2024-03-09T12:00:00-05:00[America/New_York]",
      "2024-03-11T12:00:00-04:00[America/New_York]",
      2,
    );
    expect(result).toHaveLength(2);
    expect(result[0].start).toBe("2024-03-09T12:00:00-05:00[America/New_York]");
    expect(result[1].end).toBe("2024-03-11T12:00:00-04:00[America/New_York]");
    expect(result[0].end).toBe(result[1].start);
    // 47 real hours split in half => 23.5h from start => 2024-03-10T12:30 local (after spring-forward)
    expect(result[0].end).toBe("2024-03-10T12:30:00-04:00[America/New_York]");
  });

  it.each`
    start                               | end                                 | n    | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-04T00:00:00+00:00[UTC]"} | ${1} | ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-04T00:00:00+00:00[UTC]" }]}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${2} | ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T00:00:00+00:00[UTC]" }, { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T00:00:00+00:00[UTC]" }]}
  `(
    "splits $start to $end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyZoned(start, end, n)).toEqual(expected);
    },
  );

  // 1 second (no DST involved) does not divide evenly by 3: boundaries are computed from total
  // elapsed real nanoseconds, so the split is exact to the nanosecond. Verified against real
  // @js-temporal/polyfill: 1e9 ns / 3 rounds to 333333333 and 666666667 ns.
  it("splits to nanosecond precision when the total does not divide evenly by n", () => {
    expect(
      intervalDivideEquallyZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-01T00:00:01+00:00[UTC]",
        3,
      ),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-01T00:00:00.333333333+00:00[UTC]",
      },
      {
        start: "2024-01-01T00:00:00.333333333+00:00[UTC]",
        end: "2024-01-01T00:00:00.666666667+00:00[UTC]",
      },
      {
        start: "2024-01-01T00:00:00.666666667+00:00[UTC]",
        end: "2024-01-01T00:00:01+00:00[UTC]",
      },
    ]);
  });

  // Spans past 2^53 ns (about 104 days) must still split exactly: each boundary is
  // start + round((end - start) · i / n) in integer epoch nanoseconds. 365 d + 3 ns splits into
  // 121 d 16 h + 1 ns steps: 2024-05-01T16:00:00.000000001Z and 2024-08-31T08:00:00.000000002Z, read
  // at Tokyo's fixed +09:00. Values from BigInt epoch-nanosecond arithmetic, not GMT.
  it("splits a span longer than 2^53 nanoseconds exactly", () => {
    expect(
      intervalDivideEquallyZoned(
        "2024-01-01T09:00:00+09:00[Asia/Tokyo]",
        "2024-12-31T09:00:00.000000003+09:00[Asia/Tokyo]",
        3,
      ),
    ).toEqual([
      {
        start: "2024-01-01T09:00:00+09:00[Asia/Tokyo]",
        end: "2024-05-02T01:00:00.000000001+09:00[Asia/Tokyo]",
      },
      {
        start: "2024-05-02T01:00:00.000000001+09:00[Asia/Tokyo]",
        end: "2024-08-31T17:00:00.000000002+09:00[Asia/Tokyo]",
      },
      {
        start: "2024-08-31T17:00:00.000000002+09:00[Asia/Tokyo]",
        end: "2024-12-31T09:00:00.000000003+09:00[Asia/Tokyo]",
      },
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
      intervalDivideEquallyZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-04T00:00:00+00:00[UTC]",
        n,
      ),
    ).toEqual([]);
  });

  it.each`
    start                               | end
    ${"invalid"}                        | ${"2024-01-04T00:00:00+00:00[UTC]"}
    ${"2024-01-04T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-01-04T00:00:00+00:00[UTC]"}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(intervalDivideEquallyZoned(start, end, 3)).toEqual([]);
  });

  it("returns [] when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalDivideEquallyZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-04T00:00:00+00:00[UTC]",
        3,
      ),
    ).toEqual([]);
  });

  it("proves zone-invariance across battleTestTimeZones for a fixed real-time span split in two", () => {
    const startInstant = Temporal.Instant.from("2024-06-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-06-01T10:00:00Z");
    const midInstant = Temporal.Instant.from("2024-06-01T05:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalDivideEquallyZoned(start, end, 2);

      expect(result).toHaveLength(2);
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(midInstant.toString());
    }
  });
  // E5 (issue #78), decision of record D2 — see isValidZonedDateTime.test.ts for the full
  // rationale: zoned/ rejects any [u-ca=...] calendar annotation outright.
  it("returns [] when start carries a calendar annotation", () => {
    expect(
      intervalDivideEquallyZoned(
        "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]",
        "2024-06-30T23:59:59+00:00[UTC]",
        2,
      ),
    ).toEqual([]);
  });
});

describe("intervalDivideEquallyZoned maxPieces", () => {
  // 72 real hours / 3 = 24 hours in UTC: n = 3 pieces, so a limit of 3 or more leaves the output unchanged.
  it.each`
    n    | maxPieces
    ${3} | ${3}
    ${3} | ${10}
  `(
    "returns the 3 pieces for n $n with maxPieces $maxPieces",
    ({ n, maxPieces }) => {
      expect(
        intervalDivideEquallyZoned(
          "2024-01-01T00:00:00+00:00[UTC]",
          "2024-01-04T00:00:00+00:00[UTC]",
          n,
          { maxPieces },
        ),
      ).toEqual([
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-02T00:00:00+00:00[UTC]",
        },
        {
          start: "2024-01-02T00:00:00+00:00[UTC]",
          end: "2024-01-03T00:00:00+00:00[UTC]",
        },
        {
          start: "2024-01-03T00:00:00+00:00[UTC]",
          end: "2024-01-04T00:00:00+00:00[UTC]",
        },
      ]);
    },
  );

  // Owner decision A2: an output larger than maxPieces returns the sentinel, decided before any
  // piece is built.
  it.each`
    start                               | end                                 | n    | maxPieces
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-04T00:00:00+00:00[UTC]"} | ${3} | ${2}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${3} | ${2}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-04T00:00:00+00:00[UTC]"} | ${2} | ${1}
  `(
    "returns [] for $start to $end with n $n over maxPieces $maxPieces",
    ({ start, end, n, maxPieces }) => {
      expect(
        intervalDivideEquallyZoned(start, end, n, { maxPieces }).length,
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
      intervalDivideEquallyZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-04T00:00:00+00:00[UTC]",
        3,
        options as never,
      ).length,
    ).toBe(0);
  });
});

describe("intervalDivideEquallyZoned default piece limit", () => {
  // Default maxPieces is 1_000_000 (owner decision A2). An array holds at most 2^32 - 1
  // elements (ECMA-262 §10.4.2), so n >= 2^32 is the sentinel whatever the limit.
  it.each`
    n            | options
    ${1_000_001} | ${undefined}
    ${2 ** 32}   | ${undefined}
    ${2 ** 32}   | ${{ maxPieces: 2 ** 40 }}
  `("returns [] for n $n with options $options", ({ n, options }) => {
    expect(
      intervalDivideEquallyZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-04T00:00:00+00:00[UTC]",
        n,
        options,
      ).length,
    ).toBe(0);
  });

  it("returns [] for equal endpoints and n 2^32 under maxPieces 2^40", () => {
    expect(
      intervalDivideEquallyZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-01T00:00:00+00:00[UTC]",
        2 ** 32,
        { maxPieces: 2 ** 40 },
      ).length,
    ).toBe(0);
  });
});
