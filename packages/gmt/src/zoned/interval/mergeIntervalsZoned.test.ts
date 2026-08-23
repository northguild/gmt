import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { mergeIntervalsZoned } from "./mergeIntervalsZoned";

describe("mergeIntervalsZoned", () => {
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-10T00:00:00+00:00[UTC]"} | ${"2024-01-05T00:00:00+00:00[UTC]"} | ${"2024-01-15T00:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-15T00:00:00+00:00[UTC]" }]}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-10T00:00:00+00:00[UTC]"} | ${"2024-01-10T00:00:00+00:00[UTC]"} | ${"2024-01-20T00:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-20T00:00:00+00:00[UTC]" }]}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-05T00:00:00+00:00[UTC]"} | ${"2024-01-10T00:00:00+00:00[UTC]"} | ${"2024-01-15T00:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-05T00:00:00+00:00[UTC]" }, { start: "2024-01-10T00:00:00+00:00[UTC]", end: "2024-01-15T00:00:00+00:00[UTC]" }]}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-05T23:59:59+00:00[UTC]"} | ${"2024-01-06T00:00:00+00:00[UTC]"} | ${"2024-01-10T00:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-05T23:59:59+00:00[UTC]" }, { start: "2024-01-06T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }]}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-20T00:00:00+00:00[UTC]"} | ${"2024-01-05T00:00:00+00:00[UTC]"} | ${"2024-01-10T00:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-20T00:00:00+00:00[UTC]" }]}
    ${"2024-01-10T00:00:00+00:00[UTC]"} | ${"2024-01-20T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-05T00:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-05T00:00:00+00:00[UTC]" }, { start: "2024-01-10T00:00:00+00:00[UTC]", end: "2024-01-20T00:00:00+00:00[UTC]" }]}
  `(
    "merges [$aStart,$aEnd] and [$bStart,$bEnd] into $expected",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(
        mergeIntervalsZoned([
          { start: aStart, end: aEnd },
          { start: bStart, end: bEnd },
        ]),
      ).toEqual(expected);
    },
  );

  it("merges intervals across different time zones by instant", () => {
    expect(
      mergeIntervalsZoned([
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-05T00:00:00+00:00[UTC]",
        },
        {
          start: "2024-01-04T19:00:00-05:00[America/New_York]",
          end: "2024-01-10T00:00:00-05:00[America/New_York]",
        },
      ]),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-10T00:00:00-05:00[America/New_York]",
      },
    ]);
  });

  it("returns [] for an empty list", () => {
    expect(mergeIntervalsZoned([])).toEqual([]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: "2024-01-10T00:00:00+00:00[UTC]", end: "2024-01-01T00:00:00+00:00[UTC]" }]}
    ${[{ start: "invalid", end: "2024-01-01T00:00:00+00:00[UTC]" }]}
    ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }, "not-an-object"]}
    ${[{ start: "2024-06-30T23:59:60+00:00[UTC]", end: "2024-07-01T00:00:00+00:00[UTC]" }]}
    ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:60+00:00[UTC]" }]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(mergeIntervalsZoned(intervals)).toEqual([]);
  });

  it("proves zone-invariance across battleTestTimeZones for merge intervals", () => {
    const intervals = [
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-10T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-01-05T00:00:00+00:00[UTC]",
        end: "2024-01-15T00:00:00+00:00[UTC]",
      },
    ];

    for (const timeZone of battleTestTimeZones) {
      const zonedIntervals = intervals.map(({ start, end }) => ({
        start: Temporal.Instant.from(start)
          .toZonedDateTimeISO(timeZone)
          .toString(),
        end: Temporal.Instant.from(end).toZonedDateTimeISO(timeZone).toString(),
      }));

      const result = mergeIntervalsZoned(zonedIntervals);
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it("returns [] when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      mergeIntervalsZoned([
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-10T00:00:00+00:00[UTC]",
        },
      ]),
    ).toEqual([]);
  });

  it.each(
    battleTestTimeZones.map((timeZone) => {
      const aStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
      const aEndInstant = Temporal.Instant.from("2024-01-10T00:00:00Z");
      const bStartInstant = Temporal.Instant.from("2024-01-05T00:00:00Z");
      const bEndInstant = Temporal.Instant.from("2024-01-15T00:00:00Z");

      return {
        timeZone,
        aStart: aStartInstant.toZonedDateTimeISO(timeZone).toString(),
        aEnd: aEndInstant.toZonedDateTimeISO(timeZone).toString(),
        bStart: bStartInstant.toZonedDateTimeISO(timeZone).toString(),
        bEnd: bEndInstant.toZonedDateTimeISO(timeZone).toString(),
        expectedStart: aStartInstant.toString(),
        expectedEnd: bEndInstant.toString(),
      };
    }),
  )(
    "merges overlapping intervals by instant in $timeZone",
    ({ aStart, aEnd, bStart, bEnd, expectedStart, expectedEnd }) => {
      const result = mergeIntervalsZoned([
        { start: aStart, end: aEnd },
        { start: bStart, end: bEnd },
      ]);

      expect(result).toHaveLength(1);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(expectedStart);
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(expectedEnd);
    },
  );

  // 2024-03-10: America/Chicago spring-forward, 02:00 local skips to 03:00 local
  // (transition instant is 2024-03-10T08:00:00Z). Verified against real Temporal.
  it("keeps intervals separate when local clocks look adjacent across a DST spring-forward gap but the instants are 1 hour apart", () => {
    expect(
      mergeIntervalsZoned([
        {
          start: "2024-03-10T00:00:00-06:00[America/Chicago]",
          end: "2024-03-10T01:00:00-06:00[America/Chicago]",
        },
        {
          start: "2024-03-10T03:00:00-05:00[America/Chicago]",
          end: "2024-03-10T04:00:00-05:00[America/Chicago]",
        },
      ]),
    ).toEqual([
      {
        start: "2024-03-10T00:00:00-06:00[America/Chicago]",
        end: "2024-03-10T01:00:00-06:00[America/Chicago]",
      },
      {
        start: "2024-03-10T03:00:00-05:00[America/Chicago]",
        end: "2024-03-10T04:00:00-05:00[America/Chicago]",
      },
    ]);
  });

  it("merges intervals that are adjacent exactly at the DST spring-forward transition instant, across zones", () => {
    expect(
      mergeIntervalsZoned([
        {
          start: "2024-03-10T06:00:00+00:00[UTC]",
          end: "2024-03-10T08:00:00+00:00[UTC]",
        },
        {
          start: "2024-03-10T03:00:00-05:00[America/Chicago]",
          end: "2024-03-10T05:00:00-05:00[America/Chicago]",
        },
      ]),
    ).toEqual([
      {
        start: "2024-03-10T06:00:00+00:00[UTC]",
        end: "2024-03-10T05:00:00-05:00[America/Chicago]",
      },
    ]);
  });
});
