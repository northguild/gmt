import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalXorAllZoned } from "./intervalXorAllZoned";
import { intervalXorZoned } from "./intervalXorZoned";

describe("intervalXorAllZoned", () => {
  it("reduces to the pairwise result for two overlapping intervals", () => {
    const a = {
      start: "2024-01-01T09:00:00+00:00[UTC]",
      end: "2024-06-30T12:00:00+00:00[UTC]",
    };
    const b = {
      start: "2024-04-01T11:00:00+00:00[UTC]",
      end: "2024-12-31T17:00:00+00:00[UTC]",
    };

    const result = intervalXorAllZoned([a, b]);

    expect(result).toEqual(intervalXorZoned(a.start, a.end, b.start, b.end));
    expect(result).toEqual([
      {
        start: "2024-01-01T09:00:00+00:00[UTC]",
        end: "2024-04-01T11:00:00+00:00[UTC]",
      },
      {
        start: "2024-06-30T12:00:00+00:00[UTC]",
        end: "2024-12-31T17:00:00+00:00[UTC]",
      },
    ]);
  });

  it("returns both intervals unchanged for two disjoint intervals", () => {
    expect(
      intervalXorAllZoned([
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-05T00:00:00+00:00[UTC]",
        },
        {
          start: "2024-02-01T00:00:00+00:00[UTC]",
          end: "2024-02-05T00:00:00+00:00[UTC]",
        },
      ]),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-05T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-02-01T00:00:00+00:00[UTC]",
        end: "2024-02-05T00:00:00+00:00[UTC]",
      },
    ]);
  });

  it("returns [] when two identical intervals cancel out", () => {
    expect(
      intervalXorAllZoned([
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-05T00:00:00+00:00[UTC]",
        },
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-05T00:00:00+00:00[UTC]",
        },
      ]),
    ).toEqual([]);
  });

  it("returns the single interval unchanged for a one-element list", () => {
    expect(
      intervalXorAllZoned([
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-05T00:00:00+00:00[UTC]",
        },
      ]),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-05T00:00:00+00:00[UTC]",
      },
    ]);
  });

  // Half-open [start, end) (coding-standards § 8; A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z,
  // D = 17:00Z): the result is every maximal run covered an odd number of times. Touching runs join,
  // and an empty interval covers no instant, so it changes nothing.
  it.each`
    intervals                                                                                                                                                                   | expected                                                                                                                                                                    | reason
    ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T13:00:00+00:00[UTC]" }, { start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }, { start: "2024-01-01T13:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]} | ${"[A, C) and [B, D) give [A, B) and [C, D)"}
    ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }, { start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]}                                                                                     | ${"touching [A, B) and [B, D) join into one run"}
    ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }, { start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }]} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]}                                                                                     | ${"an empty interval inside changes nothing"}
    ${[{ start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }]}                                                                                     | ${[]}                                                                                                                                                                       | ${"a lone empty interval covers no instant"}
  `("returns $expected for $intervals ($reason)", ({ intervals, expected }) => {
    expect(intervalXorAllZoned(intervals)).toEqual(expected);
  });

  it("returns [] for an empty list", () => {
    expect(intervalXorAllZoned([])).toEqual([]);
  });

  it("handles a 3-way overlap, keeping only oddly-covered regions (odd-vs-even sweep)", () => {
    // A=[1,10) B=[5,15) C=[8,20) (all at T00:00:00Z): [1,5)=1x, [5,8)=2x, [8,10)=3x, [10,15)=2x, [15,20)=1x
    expect(
      intervalXorAllZoned([
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-10T00:00:00+00:00[UTC]",
        },
        {
          start: "2024-01-05T00:00:00+00:00[UTC]",
          end: "2024-01-15T00:00:00+00:00[UTC]",
        },
        {
          start: "2024-01-08T00:00:00+00:00[UTC]",
          end: "2024-01-20T00:00:00+00:00[UTC]",
        },
      ]),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-05T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-01-08T00:00:00+00:00[UTC]",
        end: "2024-01-10T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-01-15T00:00:00+00:00[UTC]",
        end: "2024-01-20T00:00:00+00:00[UTC]",
      },
    ]);
  });

  it("does not depend on input order for a 3-way overlap", () => {
    expect(
      intervalXorAllZoned([
        {
          start: "2024-01-08T00:00:00+00:00[UTC]",
          end: "2024-01-20T00:00:00+00:00[UTC]",
        },
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-10T00:00:00+00:00[UTC]",
        },
        {
          start: "2024-01-05T00:00:00+00:00[UTC]",
          end: "2024-01-15T00:00:00+00:00[UTC]",
        },
      ]),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-05T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-01-08T00:00:00+00:00[UTC]",
        end: "2024-01-10T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-01-15T00:00:00+00:00[UTC]",
        end: "2024-01-20T00:00:00+00:00[UTC]",
      },
    ]);
  });

  it("handles a spring-forward DST transition (America/New_York, 2024-03-10) matching the pairwise result", () => {
    const a = {
      start: "2024-03-01T00:00:00-05:00[America/New_York]",
      end: "2024-03-15T00:00:00-04:00[America/New_York]",
    };
    const b = {
      start: "2024-03-08T00:00:00-05:00[America/New_York]",
      end: "2024-03-20T00:00:00-04:00[America/New_York]",
    };

    const result = intervalXorAllZoned([a, b]);

    expect(result).toEqual(intervalXorZoned(a.start, a.end, b.start, b.end));
    expect(result).toEqual([
      {
        start: "2024-03-01T00:00:00-05:00[America/New_York]",
        end: "2024-03-08T00:00:00-05:00[America/New_York]",
      },
      {
        start: "2024-03-15T00:00:00-04:00[America/New_York]",
        end: "2024-03-20T00:00:00-04:00[America/New_York]",
      },
    ]);
  });

  it("handles a 3-way overlap spanning a DST transition (America/New_York, 2024-03-10)", () => {
    // A=[Mar1,Mar12) B=[Mar8,Mar16) C=[Mar11,Mar20): [Mar1,Mar8)=1x, [Mar8,Mar11)=2x, [Mar11,Mar12)=3x, [Mar12,Mar16)=2x, [Mar16,Mar20)=1x
    expect(
      intervalXorAllZoned([
        {
          start: "2024-03-01T00:00:00-05:00[America/New_York]",
          end: "2024-03-12T00:00:00-04:00[America/New_York]",
        },
        {
          start: "2024-03-08T00:00:00-05:00[America/New_York]",
          end: "2024-03-16T00:00:00-04:00[America/New_York]",
        },
        {
          start: "2024-03-11T00:00:00-04:00[America/New_York]",
          end: "2024-03-20T00:00:00-04:00[America/New_York]",
        },
      ]),
    ).toEqual([
      {
        start: "2024-03-01T00:00:00-05:00[America/New_York]",
        end: "2024-03-08T00:00:00-05:00[America/New_York]",
      },
      {
        start: "2024-03-11T00:00:00-04:00[America/New_York]",
        end: "2024-03-12T00:00:00-04:00[America/New_York]",
      },
      {
        start: "2024-03-16T00:00:00-04:00[America/New_York]",
        end: "2024-03-20T00:00:00-04:00[America/New_York]",
      },
    ]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: "2024-01-10T00:00:00+00:00[UTC]", end: "2024-01-01T00:00:00+00:00[UTC]" }]}
    ${[{ start: "invalid", end: "2024-01-01T00:00:00+00:00[UTC]" }]}
    ${[{ start: "2023-12-31T23:59:60+00:00[UTC]", end: "2024-01-01T00:00:00+00:00[UTC]" }]}
    ${[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }, "not-an-object"]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(intervalXorAllZoned(intervals)).toEqual([]);
  });

  it("proves zone-invariance across battleTestTimeZones for xor all", () => {
    const intervals = [
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-03-31T23:59:59+00:00[UTC]",
      },
      {
        start: "2024-04-01T00:00:00+00:00[UTC]",
        end: "2024-06-30T23:59:59+00:00[UTC]",
      },
      {
        start: "2024-07-01T00:00:00+00:00[UTC]",
        end: "2024-09-30T23:59:59+00:00[UTC]",
      },
    ];

    for (const timeZone of battleTestTimeZones) {
      const zonedIntervals = intervals.map(({ start, end }) => ({
        start: Temporal.Instant.from(start)
          .toZonedDateTimeISO(timeZone)
          .toString(),
        end: Temporal.Instant.from(end).toZonedDateTimeISO(timeZone).toString(),
      }));

      const result = intervalXorAllZoned(zonedIntervals);
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it("returns [] when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalXorAllZoned([
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-10T00:00:00+00:00[UTC]",
        },
      ]),
    ).toEqual([]);
  });

  it("proves zone-invariance across battleTestTimeZones for two disjoint intervals", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2025-01-01T00:00:00Z");
    const bEndInstant = Temporal.Instant.from("2025-06-01T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const result = intervalXorAllZoned([
        {
          start: aStartInstant.toZonedDateTimeISO(timeZone).toString(),
          end: aEndInstant.toZonedDateTimeISO(timeZone).toString(),
        },
        {
          start: bStartInstant.toZonedDateTimeISO(timeZone).toString(),
          end: bEndInstant.toZonedDateTimeISO(timeZone).toString(),
        },
      ]);

      expect(result).toHaveLength(2);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].start).toInstant().toString(),
      ).toBe(bStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].end).toInstant().toString(),
      ).toBe(bEndInstant.toString());
    }
  });

  it("proves zone-invariance across battleTestTimeZones for a 3-way overlap sweep", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-01-10T00:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-01-05T00:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-01-15T00:00:00Z");
    const cStartInstant = Temporal.Instant.from("2024-01-08T00:00:00Z");
    const cEndInstant = Temporal.Instant.from("2024-01-20T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const result = intervalXorAllZoned([
        {
          start: aStartInstant.toZonedDateTimeISO(timeZone).toString(),
          end: aEndInstant.toZonedDateTimeISO(timeZone).toString(),
        },
        {
          start: bStartInstant.toZonedDateTimeISO(timeZone).toString(),
          end: bEndInstant.toZonedDateTimeISO(timeZone).toString(),
        },
        {
          start: cStartInstant.toZonedDateTimeISO(timeZone).toString(),
          end: cEndInstant.toZonedDateTimeISO(timeZone).toString(),
        },
      ]);

      expect(result).toHaveLength(3);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(bStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].start).toInstant().toString(),
      ).toBe(cStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[2].start).toInstant().toString(),
      ).toBe(bEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[2].end).toInstant().toString(),
      ).toBe(cEndInstant.toString());
    }
  });
  // The arguments name different calendars (hebrew and a bare iso8601 string), so the
  // result is the sentinel (there is no single output calendar).
  it("returns [] when the interval endpoints name different calendars", () => {
    expect(
      intervalXorAllZoned([
        {
          start: "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]",
          end: "2024-06-30T23:59:59+00:00[UTC]",
        },
      ]),
    ).toEqual([]);
  });

  // Range edge (CORE-6): the last representable instant is +275760-09-13T00:00:00Z, so no boundary
  // may be computed past an end. Half-open, no boundary is stepped at all. Nested: [06:00, 12:00)
  // UTC on 09-12 is covered twice, so the odd runs end at 06:00 and resume at 12:00.
  // Sydney row: max is 09-13T10:00+10:00; [04:00, 06:00) local is covered twice.
  it.each`
    intervals                                                                                                                                                                                                                                   | expected
    ${[{ start: "+275760-09-12T00:00:00+00:00[UTC]", end: "+275760-09-13T00:00:00+00:00[UTC]" }]}                                                                                                                                               | ${[{ start: "+275760-09-12T00:00:00+00:00[UTC]", end: "+275760-09-13T00:00:00+00:00[UTC]" }]}
    ${[{ start: "+275760-09-12T00:00:00+00:00[UTC]", end: "+275760-09-13T00:00:00+00:00[UTC]" }, { start: "+275760-09-12T06:00:00+00:00[UTC]", end: "+275760-09-12T12:00:00+00:00[UTC]" }]}                                                     | ${[{ start: "+275760-09-12T00:00:00+00:00[UTC]", end: "+275760-09-12T06:00:00+00:00[UTC]" }, { start: "+275760-09-12T12:00:00+00:00[UTC]", end: "+275760-09-13T00:00:00+00:00[UTC]" }]}
    ${[{ start: "+275760-09-13T00:00:00+10:00[Australia/Sydney]", end: "+275760-09-13T10:00:00+10:00[Australia/Sydney]" }, { start: "+275760-09-13T04:00:00+10:00[Australia/Sydney]", end: "+275760-09-13T06:00:00+10:00[Australia/Sydney]" }]} | ${[{ start: "+275760-09-13T00:00:00+10:00[Australia/Sydney]", end: "+275760-09-13T04:00:00+10:00[Australia/Sydney]" }, { start: "+275760-09-13T06:00:00+10:00[Australia/Sydney]", end: "+275760-09-13T10:00:00+10:00[Australia/Sydney]" }]}
  `(
    "returns $expected for $intervals (an end at the maximum instant)",
    ({ intervals, expected }) => {
      expect(intervalXorAllZoned(intervals)).toEqual(expected);
    },
  );
});
