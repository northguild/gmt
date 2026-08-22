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
    "splits $start..$end into $n parts as $expected",
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
});
