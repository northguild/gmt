import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalCountZoned } from "./intervalCountZoned";

// Local-anchored 24h span per zone. 2024-06-15 is used instead of the canonical
// leap-day fixture because no battle-test zone has a DST transition in mid-June —
// this isolates offset behavior from transition behavior.
const localDayBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  start: Temporal.ZonedDateTime.from({
    year: 2024,
    month: 6,
    day: 15,
    hour: 0,
    timeZone,
  }).toString(),
  end: Temporal.ZonedDateTime.from({
    year: 2024,
    month: 6,
    day: 16,
    hour: 0,
    timeZone,
  }).toString(),
}));

// Two-minute span straddling local midnight in every zone.
const localMidnightCrossingBattleCases = battleTestTimeZones.map(
  (timeZone) => ({
    timeZone,
    start: Temporal.ZonedDateTime.from({
      year: 2024,
      month: 6,
      day: 15,
      hour: 23,
      minute: 59,
      timeZone,
    }).toString(),
    end: Temporal.ZonedDateTime.from({
      year: 2024,
      month: 6,
      day: 16,
      hour: 0,
      minute: 1,
      timeZone,
    }).toString(),
  }),
);

describe("intervalCountZoned", () => {
  it.each`
    start                               | end                                 | unit       | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-03T00:00:00+00:00[UTC]"} | ${"day"}   | ${2}
    ${"2024-01-01T23:59:00+00:00[UTC]"} | ${"2024-01-02T00:01:00+00:00[UTC]"} | ${"day"}   | ${2}
    ${"2024-01-01T10:30:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"hour"}  | ${2}
    ${"2024-01-15T00:00:00+00:00[UTC]"} | ${"2024-03-10T00:00:00+00:00[UTC]"} | ${"month"} | ${3}
    ${"2024-01-04T00:00:00+00:00[UTC]"} | ${"2024-01-15T00:00:00+00:00[UTC]"} | ${"week"}  | ${2}
    ${"2024-12-31T23:00:00+00:00[UTC]"} | ${"2025-01-01T01:00:00+00:00[UTC]"} | ${"year"}  | ${2}
  `(
    "returns $expected $unit boundaries for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                               | end                                 | unit       | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-03T00:00:00+00:00[UTC]"} | ${"days"}  | ${2}
    ${"2024-01-01T10:30:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"hours"} | ${2}
  `(
    "returns $expected for $start..$end with plural unit $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                               | end                                 | unit      | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"day"}  | ${0}
    ${"2024-01-01T05:00:00+00:00[UTC]"} | ${"2024-01-01T05:00:00+00:00[UTC]"} | ${"day"}  | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"hour"} | ${0}
    ${"2024-01-01T05:30:00+00:00[UTC]"} | ${"2024-01-01T05:30:00+00:00[UTC]"} | ${"hour"} | ${1}
  `(
    "returns $expected for zero-length $start..$end counted in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  // DST: a local calendar day is 23 or 25 hours long across a transition, so the
  // hour-boundary count is not 24 — this is exactly what count() must report.
  it.each`
    start                                            | end                                              | unit      | expected
    ${"2024-03-10T00:00:00-05:00[America/New_York]"} | ${"2024-03-11T00:00:00-04:00[America/New_York]"} | ${"hour"} | ${23}
    ${"2024-11-03T00:00:00-04:00[America/New_York]"} | ${"2024-11-04T00:00:00-05:00[America/New_York]"} | ${"hour"} | ${25}
    ${"2024-03-09T12:00:00-05:00[America/New_York]"} | ${"2024-03-11T12:00:00-04:00[America/New_York]"} | ${"day"}  | ${3}
    ${"2024-11-02T12:00:00-04:00[America/New_York]"} | ${"2024-11-04T12:00:00-05:00[America/New_York]"} | ${"day"}  | ${3}
  `(
    "returns $expected $unit boundaries across a DST transition for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  // America/Santiago springs forward AT midnight on 2024-09-08, so that local day
  // never has a 00:00 — its day boundary is 01:00.
  it.each`
    start                                            | end                                              | unit     | expected
    ${"2024-09-07T12:00:00-04:00[America/Santiago]"} | ${"2024-09-09T12:00:00-03:00[America/Santiago]"} | ${"day"} | ${3}
    ${"2024-09-08T12:00:00-03:00[America/Santiago]"} | ${"2024-09-08T12:00:00-03:00[America/Santiago]"} | ${"day"} | ${1}
  `(
    "returns $expected $unit boundaries for $start..$end when local midnight is skipped",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                                           | end                                             | unit     | expected
    ${"2024-01-01T23:59:00+13:45[Pacific/Chatham]"} | ${"2024-01-02T00:01:00+13:45[Pacific/Chatham]"} | ${"day"} | ${2}
    ${"2024-01-01T23:59:00-11:00[Pacific/Niue]"}    | ${"2024-01-02T00:01:00-11:00[Pacific/Niue]"}    | ${"day"} | ${2}
  `(
    "returns $expected $unit boundaries at an extreme offset for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  // Both endpoints are "1:30am" on the fall-back day, one hour apart in real time —
  // instant-based truncation must see two distinct 1am hours, not one.
  it.each`
    start                                            | end                                              | unit      | expected
    ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"hour"} | ${2}
    ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"day"}  | ${1}
  `(
    "returns $expected $unit boundaries across the repeated hour for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                                            | end                                        | unit      | expected
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-03T00:00:00+09:00[Asia/Tokyo]"} | ${"day"}  | ${2}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}        | ${"hour"} | ${7}
  `(
    "returns $expected $unit boundaries counted in the start zone for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  it("returns 24 hour boundaries and 1 day boundary for a local 24h span in every battleTestTimeZone", () => {
    for (const { timeZone, start, end } of localDayBattleCases) {
      expect(
        intervalCountZoned(start, end, "hour"),
        `hour count in ${timeZone}`,
      ).toBe(24);
      expect(
        intervalCountZoned(start, end, "day"),
        `day count in ${timeZone}`,
      ).toBe(1);
    }
  });

  it("returns 2 day boundaries for a 2-minute span across local midnight in every battleTestTimeZone", () => {
    for (const { timeZone, start, end } of localMidnightCrossingBattleCases) {
      expect(
        intervalCountZoned(start, end, "day"),
        `day count in ${timeZone}`,
      ).toBe(2);
    }
  });

  // A fixed 24h *instant* span touches 25 local hour boundaries in zones whose
  // offset is not a whole hour, because local hour boundaries are shifted by :30/:45.
  it.each`
    timeZone              | expected
    ${"UTC"}              | ${24}
    ${"America/New_York"} | ${24}
    ${"Asia/Kolkata"}     | ${25}
    ${"Asia/Kathmandu"}   | ${25}
    ${"Pacific/Chatham"}  | ${25}
  `(
    "returns $expected hour boundaries in $timeZone for a fixed 24h instant span",
    ({ timeZone, expected }) => {
      const start = Temporal.Instant.from("2024-01-01T00:00:00Z")
        .toZonedDateTimeISO(timeZone)
        .toString();
      const end = Temporal.Instant.from("2024-01-02T00:00:00Z")
        .toZonedDateTimeISO(timeZone)
        .toString();

      expect(intervalCountZoned(start, end, "hour")).toBe(expected);
    },
  );

  it.each`
    start                                        | end                                 | unit
    ${"invalid"}                                 | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${""}                                        | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-01T00:00:00"}                     | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-01T00:00:00+00:00[Invalid/Zone]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}          | ${"invalid"}                        | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}          | ${""}                               | ${"day"}
    ${"2024-12-31T23:59:60+00:00[UTC]"}          | ${"2025-01-01T01:30:00+00:00[UTC]"} | ${"hour"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}          | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"hour"}
    ${"2024-01-02T00:00:00+00:00[UTC]"}          | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}          | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"invalid"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}          | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${""}
    ${"2024-01-01T00:00:00+00:00[UTC]"}          | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"quarter"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalCountZoned(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start                               | end                                 | unit
    ${null}                             | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${undefined}                        | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${123}                              | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${true}                             | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${[]}                               | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${{}}                               | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${null}                             | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${undefined}                        | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${123}                              | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${true}                             | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${[]}                               | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${{}}                               | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${null}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${undefined}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${123}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${true}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${[]}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${{}}
  `(
    "returns null for non-string input: $start, $end, $unit",
    ({ start, end, unit }) => {
      expect(
        intervalCountZoned(start as never, end as never, unit as never),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalCountZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-02T00:00:00+00:00[UTC]",
        "day",
      ),
    ).toBeNull();
  });
});
