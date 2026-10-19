import {
  calendarZonedFixtures,
  dateLineCrossingAt,
  dateLineCrossingTimeZones,
} from "../../test";
import { Temporal } from "../../internal/temporal";
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
    "returns $expected $unit boundaries for $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                               | end                                 | unit       | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-03T00:00:00+00:00[UTC]"} | ${"days"}  | ${2}
    ${"2024-01-01T10:30:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"hours"} | ${2}
  `(
    "returns $expected for $start to $end with plural unit $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                               | end                                 | unit      | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"day"}  | ${0}
    ${"2024-01-01T05:00:00+00:00[UTC]"} | ${"2024-01-01T05:00:00+00:00[UTC]"} | ${"day"}  | ${0}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"hour"} | ${0}
    ${"2024-01-01T05:30:00+00:00[UTC]"} | ${"2024-01-01T05:30:00+00:00[UTC]"} | ${"hour"} | ${0}
  `(
    "returns $expected for zero-length $start to $end counted in $unit (an empty interval holds no instant)",
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
    "returns $expected $unit boundaries across a DST transition for $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  // America/Santiago springs forward AT midnight on 2024-09-08, so that local day
  // never has a 00:00 — its day boundary is 01:00.
  it.each`
    start                                            | end                                              | unit     | expected
    ${"2024-09-07T12:00:00-04:00[America/Santiago]"} | ${"2024-09-09T12:00:00-03:00[America/Santiago]"} | ${"day"} | ${3}
    ${"2024-09-08T12:00:00-03:00[America/Santiago]"} | ${"2024-09-08T13:00:00-03:00[America/Santiago]"} | ${"day"} | ${1}
  `(
    "returns $expected $unit boundaries for $start to $end when local midnight is skipped",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                                           | end                                             | unit     | expected
    ${"2024-01-01T23:59:00+13:45[Pacific/Chatham]"} | ${"2024-01-02T00:01:00+13:45[Pacific/Chatham]"} | ${"day"} | ${2}
    ${"2024-01-01T23:59:00-11:00[Pacific/Niue]"}    | ${"2024-01-02T00:01:00-11:00[Pacific/Niue]"}    | ${"day"} | ${2}
  `(
    "returns $expected $unit boundaries at an extreme offset for $start to $end",
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
    "returns $expected $unit boundaries across the repeated hour for $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                                            | end                                        | unit      | expected
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-03T00:00:00+09:00[Asia/Tokyo]"} | ${"day"}  | ${2}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}        | ${"hour"} | ${7}
  `(
    "returns $expected $unit boundaries counted in the start zone for $start to $end",
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
  // The arguments name different calendars (hebrew and a bare iso8601 string), so the
  // result is the sentinel (TC39 CalendarEquals makes until throw).
  it("returns null when start and end name different calendars", () => {
    expect(
      intervalCountZoned(
        "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "month",
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// E7 (issue #152) DoD-11. Same-calendar values produced by running @js-temporal/polyfill@0.5.1.
// Different calendars return null (native Chromium 153 until: "Mismatched calendars.").
// ---------------------------------------------------------------------------------------------
describe("intervalCountZoned with GMT calendar-annotated values", () => {
  const Y = calendarZonedFixtures.hebrewLeapYearSpan;
  const ISLAMIC_END =
    "2024-10-03T00:00:00-04:00[America/New_York][u-ca=islamic-tbla]";

  // DoD-11: the headline number. A Hebrew leap year crosses 13 month boundaries; the same span
  // measured in ISO crosses 14.
  it("counts 13 Hebrew month boundaries where the ISO equivalent counts 14", () => {
    expect(
      intervalCountZoned(Y.tishri1_5784NewYork, Y.tishri1_5785NewYork, "month"),
    ).toBe(13);
    expect(intervalCountZoned(Y.isoStart, Y.isoEnd, "month")).toBe(14);
  });

  it("counts 1 Hebrew year boundary where the ISO equivalent counts 2", () => {
    expect(
      intervalCountZoned(Y.tishri1_5784NewYork, Y.tishri1_5785NewYork, "year"),
    ).toBe(1);
    expect(intervalCountZoned(Y.isoStart, Y.isoEnd, "year")).toBe(2);
  });

  // TC39 CalendarEquals — endpoints naming different calendars return null, in every
  // unit.
  it.each`
    label                       | start                    | end
    ${"mismatched tags"}        | ${Y.tishri1_5784NewYork} | ${ISLAMIC_END}
    ${"tagged start, bare end"} | ${Y.tishri1_5784NewYork} | ${Y.isoEnd}
    ${"bare start, tagged end"} | ${Y.isoStart}            | ${Y.tishri1_5785NewYork}
  `("returns null for $label (different calendars)", ({ start, end }) => {
    expect(intervalCountZoned(start, end, "month")).toBeNull();
    expect(intervalCountZoned(start, end, "hour")).toBeNull();
  });

  it.each`
    value                                                         | reason
    ${"5784-01-01T00:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"-04:00 is not New York's offset on ISO 5784-01-01"}
    ${"2024-13-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"ISO month 13 (the digits are ISO)"}
    ${"2024-06-30T23:59:60+00:00[UTC]"}                           | ${"leap second"}
  `("returns null when the start is $value ($reason)", ({ value }) => {
    expect(intervalCountZoned(value, Y.isoEnd, "day")).toBeNull();
  });

  // The walker keeps the pair's calendar through a DST transition. 2024-03-01..20 in New York
  // crosses the Hebrew Adar I -> Adar II boundary (Mar 11) and the Mar 10 spring-forward, so it
  // counts 2 Hebrew months where the same ISO span counts 1; the Hebrew-tagged spring-forward
  // day still has 23 hour buckets. Verified on @js-temporal/polyfill@0.5.1.
  it.each`
    start                                                         | end                                                           | unit       | expected
    ${"2024-03-01T12:00:00-05:00[America/New_York][u-ca=hebrew]"} | ${"2024-03-20T12:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"month"} | ${2}
    ${"2024-03-01T12:00:00-05:00[America/New_York]"}              | ${"2024-03-20T12:00:00-04:00[America/New_York]"}              | ${"month"} | ${1}
    ${"2024-03-10T00:00:00-05:00[America/New_York][u-ca=hebrew]"} | ${"2024-03-11T00:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"hour"}  | ${23}
  `(
    "returns $expected $unit buckets for $start to $end across the spring-forward",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  // A transition the walk-back lands on keeps the pair's calendar. New York's 2024-11-03 fall-back
  // opens a second 01:00 hour; flooring inside it used to hand back an ISO transition, and mixing
  // it with a Hebrew bucket start made the count throw and return null. Each Hebrew row matches its
  // ISO twin (5785-02-01/02 in GMT digits is ISO 2024-11-02/03). Verified on
  // @js-temporal/polyfill@0.5.1.
  it.each`
    start                                                         | end                                                           | unit      | expected
    ${"2024-11-03T01:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"2024-11-03T01:45:00-05:00[America/New_York][u-ca=hebrew]"} | ${"hour"} | ${1}
    ${"2024-11-03T01:30:00-05:00[America/New_York]"}              | ${"2024-11-03T01:45:00-05:00[America/New_York]"}              | ${"hour"} | ${1}
    ${"2024-11-03T01:30:00-04:00[America/New_York][u-ca=hebrew]"} | ${"2024-11-03T01:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"hour"} | ${2}
    ${"2024-11-03T01:30:00-04:00[America/New_York]"}              | ${"2024-11-03T01:30:00-05:00[America/New_York]"}              | ${"hour"} | ${2}
    ${"2024-11-02T12:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"2024-11-03T01:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"day"}  | ${2}
    ${"2024-11-02T12:00:00-04:00[America/New_York]"}              | ${"2024-11-03T01:30:00-05:00[America/New_York]"}              | ${"day"}  | ${2}
  `(
    "returns $expected $unit buckets for $start to $end across the fall-back",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );
});

// A bounded walk that runs out answers with the sentinel, never a partial count. The stub puts a
// "next" transition every minute ("previous" stays real), so the week-long span needs 10,080
// transition steps, past the 10,000 the count walks. The 10-hour row proves the stub alone does
// not produce null.
describe("intervalCountZoned transition cap", () => {
  // Worst CI run 4 s for the 10,080-step row on the slowest runner; the timeout is three times that and more.
  it.each`
    start                               | end                                 | unit      | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T10:00:00+00:00[UTC]"} | ${"hour"} | ${10}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-08T00:00:00+00:00[UTC]"} | ${"hour"} | ${null}
  `(
    "returns $expected for $start to $end by $unit with a transition every minute",
    ({ start, end, unit, expected }) => {
      const realGetTimeZoneTransition =
        Temporal.ZonedDateTime.prototype.getTimeZoneTransition;
      vi.spyOn(
        Temporal.ZonedDateTime.prototype,
        "getTimeZoneTransition",
      ).mockImplementation(function (
        this: Temporal.ZonedDateTime,
        direction: Parameters<
          Temporal.ZonedDateTime["getTimeZoneTransition"]
        >[0],
      ) {
        return direction === "next"
          ? this.add({ minutes: 1 })
          : realGetTimeZoneTransition.call(this, direction);
      });

      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
    30_000,
  );
});

// The cap sits between 9,999 and 10,000 transitions: the count walks `startOfStart` to `startOfEnd`
// and gives up once that range holds 10,000. With a stubbed transition every minute, a minute
// count over 9,999 minutes holds 9,999 transitions and answers, and over 10,000 minutes holds
// 10,000 and answers null.
describe("intervalCountZoned at the transition cap", () => {
  it.each`
    end                                 | expected
    ${"2024-01-07T22:39:00+00:00[UTC]"} | ${9999}
    ${"2024-01-07T22:40:00+00:00[UTC]"} | ${null}
  `(
    "returns $expected minute buckets to $end with a transition every minute",
    ({ end, expected }) => {
      const realGetTimeZoneTransition =
        Temporal.ZonedDateTime.prototype.getTimeZoneTransition;
      vi.spyOn(
        Temporal.ZonedDateTime.prototype,
        "getTimeZoneTransition",
      ).mockImplementation(function (
        this: Temporal.ZonedDateTime,
        direction: Parameters<
          Temporal.ZonedDateTime["getTimeZoneTransition"]
        >[0],
      ) {
        return direction === "next"
          ? this.add({ minutes: 1 })
          : realGetTimeZoneTransition.call(this, direction);
      });

      expect(
        intervalCountZoned("2024-01-01T00:00:00+00:00[UTC]", end, "minute"),
      ).toBe(expected);
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------------------------
// Transition zones. Counts are the number of local buckets the half-open interval touches, as
// `bucketRange` walks them — a bucket may be shorter than its unit (Chatham's 15-minute 03:00
// hour, Goose Bay's 60-second 00:00 hour) or missing entirely (Samoa deleted 2011-12-30), so
// wall-clock truncation and a calendar-unit difference both get these wrong. Every expected
// value verified against `bucketRange(...).length` on @js-temporal/polyfill@0.5.1.
// ---------------------------------------------------------------------------------------------
describe("intervalCountZoned across zone transitions", () => {
  it.each`
    start                                               | end                                                 | unit       | expected | description
    ${"2024-09-29T03:50:00+13:45[Pacific/Chatham]"}     | ${"2024-09-29T04:10:00+13:45[Pacific/Chatham]"}     | ${"hour"}  | ${2}     | ${"Chatham spring-forward leaves a 15-minute 03:00 hour"}
    ${"2024-04-07T02:50:00+13:45[Pacific/Chatham]"}     | ${"2024-04-07T02:50:00+12:45[Pacific/Chatham]"}     | ${"hour"}  | ${3}     | ${"Chatham fall-back, first pass to second pass"}
    ${"2024-09-29T00:00:00+12:45[Pacific/Chatham]"}     | ${"2024-09-30T01:00:00+13:45[Pacific/Chatham]"}     | ${"hour"}  | ${25}    | ${"a fixed 24h span over Chatham's spring-forward"}
    ${"2020-10-04T00:00:30+08:00[Antarctica/Casey]"}    | ${"2020-10-04T03:30:00+11:00[Antarctica/Casey]"}    | ${"hour"}  | ${2}     | ${"Casey's three-hour jump at 00:01"}
    ${"2011-12-29T12:00:00-10:00[Pacific/Apia]"}        | ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}        | ${"day"}   | ${2}     | ${"Samoa deleted 2011-12-30"}
    ${"2010-11-06T23:30:00-03:00[America/Goose_Bay]"}   | ${"2010-11-07T00:30:00-04:00[America/Goose_Bay]"}   | ${"hour"}  | ${4}     | ${"Goose Bay fell back at 00:01, re-entering the previous day"}
    ${"2024-11-02T12:00:00-04:00[America/Havana]"}      | ${"2024-11-04T12:00:00-05:00[America/Havana]"}      | ${"day"}   | ${3}     | ${"Havana repeated midnight on the same date, one 25-hour day"}
    ${"2024-11-03T00:30:00-04:00[America/Havana]"}      | ${"2024-11-03T00:30:00-05:00[America/Havana]"}      | ${"day"}   | ${1}     | ${"both passes of Havana's repeated midnight hour share one day"}
    ${"2024-11-03T00:00:00-04:00[America/Havana]"}      | ${"2024-11-04T00:00:00-05:00[America/Havana]"}      | ${"hour"}  | ${25}    | ${"Havana's 25-hour day still has 25 hour buckets"}
    ${"2024-04-06T14:00:00+11:00[Australia/Lord_Howe]"} | ${"2024-04-07T02:30:00+10:30[Australia/Lord_Howe]"} | ${"hour"}  | ${13}    | ${"Lord Howe's 90-minute fall-back hour"}
    ${"+275760-08-15T12:00:00-04:00[America/Santiago]"} | ${"+275760-09-12T21:00:00-03:00[America/Santiago]"} | ${"month"} | ${2}     | ${"August and September, ending at the maximum instant"}
  `(
    "returns $expected $unit buckets for $start to $end ($description)",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );
});

describe("intervalCountZoned across a transition near the maximum", () => {
  // America/Santiago skips 7 Sep 275760 00:00: [22:00 -04:00, 03:00 -03:00) touches the 22, 23, 01
  // and 02 hours. Counting wall-clock labels without the transition would also count hour 00.
  it.each`
    start                                               | end                                                 | unit      | expected
    ${"+275760-09-06T22:00:00-04:00[America/Santiago]"} | ${"+275760-09-07T03:00:00-03:00[America/Santiago]"} | ${"hour"} | ${4}
  `(
    "counts $expected $unit buckets from $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );
});

// CORE-6 S5: calendar-unit buckets are the calendar's own months. Each count is the bucket holding
// the start plus every month start after it and at or before the end, from Chromium 153 native
// `with({ day: 1 })` / `add({ months })` reads:
// - hebrew 279517-08-05 (ISO +275760-07-10) to 279517-10-08 (+275760-09-10): months start at
//   +275760-07-06, +275760-08-05 and +275760-09-03, so 3.
// - hebrew -096239-06-23 (ISO -100000-01-01) to -096239-08-04 (-100000-02-10): months start at
//   -100001-12-10, -100000-01-08 and -100000-02-07, so 3.
// - buddhist 1543-01-15 (ISO 1000-01-15) to 1543-03-15: proleptic months start on the 1st, so 3.
describe("intervalCountZoned in non-ISO calendars (CORE-6)", () => {
  it.each`
    start                                                              | end                                                                | expected | reason
    ${"+275760-07-10T00:00:00+00:00[UTC][u-ca=hebrew]"}                | ${"+275760-09-10T00:00:00+00:00[UTC][u-ca=hebrew]"}                | ${3}     | ${"D1 near the maximum"}
    ${"+275760-07-10T00:00:00-04:00[America/New_York][u-ca=hebrew]"}   | ${"+275760-09-10T00:00:00-04:00[America/New_York][u-ca=hebrew]"}   | ${3}     | ${"D1 near the maximum in a named zone"}
    ${"-100000-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"}                | ${"-100000-02-10T00:00:00+00:00[UTC][u-ca=hebrew]"}                | ${3}     | ${"hebrew year <= 0"}
    ${"-100000-01-01T00:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"}         | ${"-100000-02-10T00:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"}         | ${3}     | ${"hebrew year <= 0 behind UTC"}
    ${"1000-01-15T00:00:00+00:00[UTC][u-ca=buddhist]"}                 | ${"1000-03-15T00:00:00+00:00[UTC][u-ca=buddhist]"}                 | ${3}     | ${"proleptic buddhist"}
    ${"1000-01-15T00:00:00-04:56:02[America/New_York][u-ca=buddhist]"} | ${"1000-03-15T00:00:00-04:56:02[America/New_York][u-ca=buddhist]"} | ${3}     | ${"proleptic buddhist in a named zone"}
  `(
    "counts $expected months from $start to $end ($reason)",
    ({ start, end, expected }) => {
      expect(intervalCountZoned(start, end, "month")).toBe(expected);
    },
  );

  // -271821-04-20T00:00:00Z is Temporal's minimum instant and a Tuesday. The week (from Monday
  // 04-19), month and year holding it began before it, but the interval still touches exactly that
  // one bucket — and one more once it reaches the next bucket start (04-26, 05-01, -271820-01-01).
  // The empty interval at the minimum instant holds no instant, so it touches no week.
  it.each`
    end                                    | unit       | expected
    ${"-271821-04-20T01:00:00+00:00[UTC]"} | ${"week"}  | ${1}
    ${"-271821-04-20T01:00:00+00:00[UTC]"} | ${"month"} | ${1}
    ${"-271821-04-20T01:00:00+00:00[UTC]"} | ${"year"}  | ${1}
    ${"-271821-04-27T00:00:00+00:00[UTC]"} | ${"week"}  | ${2}
    ${"-271821-05-02T00:00:00+00:00[UTC]"} | ${"month"} | ${2}
    ${"-271821-04-20T00:00:00+00:00[UTC]"} | ${"week"}  | ${0}
  `(
    "counts $expected $unit buckets from the minimum instant to $end",
    ({ end, unit, expected }) => {
      expect(
        intervalCountZoned("-271821-04-20T00:00:00+00:00[UTC]", end, unit),
      ).toBe(expected);
    },
  );
});

// The 1844 date-line crossings (zoned.E): Asia/Manila, Pacific/Guam, Saipan, Kosrae and Palau
// skipped 1844-12-31, jumping a whole day forward at local 1844-12-31T00:00 in LMT. Expected values
// are Chromium 153 native Temporal, never the polyfill (whose transition search starts at
// 1847-01-01). `dateLineCrossingAt(zone, h)` is the zone h hours from its crossing, from exact time.

describe("intervalCountZoned across the 1844 date-line crossings (zoned.E)", () => {
  // December 1844 has 31 dates less the skipped 12-31, January 31: 61 local days.
  it.each(dateLineCrossingTimeZones)(
    "counts 61 days from 1844-12-01 to 1845-02-01 in $timeZone",
    (crossing) => {
      expect(
        intervalCountZoned(
          dateLineCrossingAt(crossing, -30 * 24).toString(),
          dateLineCrossingAt(crossing, 31 * 24).toString(),
          "day",
        ),
      ).toBe(61);
    },
  );
});

// A zone with no clock change over a span far longer than the "no further change" horizon
// (three 366-day years past the later of the start and now). 4,000 Gregorian years are ten
// 400-year cycles of 146,097 days: 1,460,970. 1970 to 5000 is 3,030 years with 735 leap days:
// 1,106,685. The fixed-offset rows never search for a transition and give the same counts.
describe("intervalCountZoned over thousands of years with no clock change", () => {
  it.each`
    start                                           | end                                             | unit      | expected
    ${"2000-01-01T00:00:00+09:00[Asia/Tokyo]"}      | ${"6000-01-01T00:00:00+09:00[Asia/Tokyo]"}      | ${"day"}  | ${1460970}
    ${"2000-01-01T00:00:00+09:00[+09:00]"}          | ${"6000-01-01T00:00:00+09:00[+09:00]"}          | ${"day"}  | ${1460970}
    ${"2000-01-01T00:00:00+09:00[Asia/Tokyo]"}      | ${"6000-01-01T00:00:00+09:00[Asia/Tokyo]"}      | ${"year"} | ${4000}
    ${"2000-01-01T00:00:00+05:30[Asia/Kolkata]"}    | ${"6000-01-01T00:00:00+05:30[Asia/Kolkata]"}    | ${"day"}  | ${1460970}
    ${"2000-01-01T00:00:00+09:00[Etc/GMT-9]"}       | ${"6000-01-01T00:00:00+09:00[Etc/GMT-9]"}       | ${"day"}  | ${1460970}
    ${"1970-01-01T00:00:00-07:00[America/Phoenix]"} | ${"5000-01-01T00:00:00-07:00[America/Phoenix]"} | ${"day"}  | ${1106685}
    ${"1970-01-01T00:00:00-07:00[-07:00]"}          | ${"5000-01-01T00:00:00-07:00[-07:00]"}          | ${"day"}  | ${1106685}
    ${"2000-01-01T00:00:00+00:00[UTC]"}             | ${"6000-01-01T00:00:00+00:00[UTC]"}             | ${"day"}  | ${1460970}
  `(
    "counts $expected $unit units from $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
    10_000,
  );
});

// Spans long enough that every zone transition is crossed. Expected counts are read from the
// calendar and verified on @js-temporal/polyfill@0.5.1: 100 years from 2024-01-01 hold
// 100 * 365 + 24 leap days (2100 is not leap); each spring gap removes one hour bucket and each
// fall-back adds one, so the hours are 24 per day.
describe("intervalCountZoned over a century of transitions", () => {
  const london = (date: string) => `${date}T00:00:00+00:00[Europe/London]`;

  it.each`
    start                                        | end                                          | unit       | expected
    ${london("2024-01-01")}                      | ${london("2124-01-01")}                      | ${"day"}   | ${36_524}
    ${london("2024-01-01")}                      | ${london("2124-01-01")}                      | ${"hour"}  | ${876_576}
    ${london("2024-01-01")}                      | ${london("2124-01-01")}                      | ${"month"} | ${1200}
    ${"2011-12-29T00:00:00-10:00[Pacific/Apia]"} | ${"2012-01-01T00:00:00+14:00[Pacific/Apia]"} | ${"day"}   | ${2}
  `(
    "returns $expected $unit buckets from $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );

  // 20 Tevet 5784 to 1 Tevet 5785: PlainDate#until gives P12M11D in a leap year, and the end sits
  // on a bucket start, so the 13 months of the Hebrew leap year are touched.
  it("counts 13 Hebrew months across a leap year", () => {
    expect(
      intervalCountZoned(
        "2024-01-01T00:00:00+00:00[Europe/London][u-ca=hebrew]",
        "2025-01-01T00:00:00+00:00[Europe/London][u-ca=hebrew]",
        "month",
      ),
    ).toBe(13);
  });
});

// The integer bucket rule. Every count was derived by hand from the zone's rule
// and agrees with the pre-slice walk on @js-temporal/polyfill@0.5.1.
describe("intervalCountZoned bucket rule across half-hour and sub-minute offset changes", () => {
  // Lord Howe falls back 02:00 +11:00 to 01:30 +10:30 on 2024-04-07 and springs forward 02:00
  // +10:30 to 02:30 +11:00 on 2024-10-06. A bucket opens where the wall clock lands on a unit
  // boundary or on a new label. Africa/Monrovia held -00:44:30 until the clock jumped from
  // 00:00 to 00:44:30 on 1972-01-07, and New York's local mean time was -04:56:02 until
  // 12:03:58 became 12:00:00 on 1883-11-18: offsets with seconds move a bucket start off the
  // minute.
  it.each`
    start                                               | end                                                 | unit        | expected | description
    ${"2024-04-07T01:00:00+11:00[Australia/Lord_Howe]"} | ${"2024-04-07T02:40:00+10:30[Australia/Lord_Howe]"} | ${"minute"} | ${130}   | ${"60 minutes of 01:00 +11:00, then 01:30 to 02:39 +10:30"}
    ${"2024-04-07T01:50:00+11:00[Australia/Lord_Howe]"} | ${"2024-04-07T02:10:00+10:30[Australia/Lord_Howe]"} | ${"minute"} | ${50}    | ${"10 minutes before the fall-back, 40 after"}
    ${"2024-04-07T01:59:00+11:00[Australia/Lord_Howe]"} | ${"2024-04-07T01:31:00+10:30[Australia/Lord_Howe]"} | ${"second"} | ${120}   | ${"01:59:00 to 01:59:59 at +11:00, then 01:30:00 to 01:30:59 at +10:30: 60 seconds each"}
    ${"2024-10-06T01:50:00+10:30[Australia/Lord_Howe]"} | ${"2024-10-06T02:40:00+11:00[Australia/Lord_Howe]"} | ${"minute"} | ${20}    | ${"01:50 to 01:59, then 02:30 to 02:39: 02:00 to 02:29 never happened"}
    ${"2024-10-06T01:59:30+10:30[Australia/Lord_Howe]"} | ${"2024-10-06T02:30:30+11:00[Australia/Lord_Howe]"} | ${"second"} | ${60}    | ${"30 seconds before the jump, 30 after"}
    ${"2024-10-06T01:00:00+10:30[Australia/Lord_Howe]"} | ${"2024-10-06T04:00:00+11:00[Australia/Lord_Howe]"} | ${"hour"}   | ${3}     | ${"hours 01, the half hour starting 02:30, and 03"}
    ${"1972-01-06T23:00:00-00:45[Africa/Monrovia]"}     | ${"1972-01-07T01:44:30+00:00[Africa/Monrovia]"}     | ${"minute"} | ${121}   | ${"60 minutes before the jump, a 30-second 00:44 bucket, 59 more and a 30-second 01:44"}
    ${"1972-01-06T23:58:30-00:45[Africa/Monrovia]"}     | ${"1972-01-07T00:46:00+00:00[Africa/Monrovia]"}     | ${"second"} | ${180}   | ${"90 seconds before the jump, 90 after"}
    ${"1972-01-06T23:58:30-00:45[Africa/Monrovia]"}     | ${"1972-01-07T01:29:30+00:00[Africa/Monrovia]"}     | ${"minute"} | ${48}    | ${"minutes 23:58 and 23:59, then 00:44 to 01:29"}
    ${"1883-11-18T11:00:00-04:56:02[America/New_York]"} | ${"1883-11-18T13:00:00-05:00[America/New_York]"}    | ${"minute"} | ${124}   | ${"11:00 to 12:03 local mean time (64), then 12:00 to 12:59 standard time (60)"}
    ${"1883-11-18T11:00:00-04:56:02[America/New_York]"} | ${"1883-11-18T13:00:00-05:00[America/New_York]"}    | ${"hour"}   | ${3}     | ${"hours 11 and 12, then 12 again after the clock is set back"}
    ${"1960-04-09T23:50:00+00:00[Europe/London]"}       | ${"1960-04-10T03:10:00+01:00[Europe/London]"}       | ${"minute"} | ${140}   | ${"before 1970 (negative wall nanoseconds): 10 + 120 minutes, skip 02:00 hour, 10 more"}
    ${"1960-04-10T01:59:30+00:00[Europe/London]"}       | ${"1960-04-10T03:00:30+01:00[Europe/London]"}       | ${"second"} | ${60}    | ${"before 1970: 30 seconds either side of the spring-forward"}
  `(
    "returns $expected $unit buckets from $start to $end ($description)",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );
});

describe("intervalCountZoned month and year buckets across a deleted date", () => {
  // Pacific/Kiritimati deleted 1994-12-31 (the clock jumped from -10:00 to +14:00), so the
  // transition crosses both a date and a month and year boundary.
  it.each`
    start                                                                     | end                                                                       | unit       | expected | description
    ${"1994-12-30T12:00:00-10:00[Pacific/Kiritimati]"}                        | ${"1995-01-01T12:00:00+14:00[Pacific/Kiritimati]"}                        | ${"day"}   | ${2}     | ${"30 December and 1 January; 31 December never happened"}
    ${"1994-12-30T12:00:00-10:00[Pacific/Kiritimati]"}                        | ${"1995-01-01T12:00:00+14:00[Pacific/Kiritimati]"}                        | ${"hour"}  | ${24}    | ${"12 hours up to the jump, 12 after"}
    ${"1994-12-30T12:00:00-10:00[Pacific/Kiritimati]"}                        | ${"1995-01-01T12:00:00+14:00[Pacific/Kiritimati]"}                        | ${"month"} | ${2}     | ${"December then January"}
    ${"1994-12-30T12:00:00-10:00[Pacific/Kiritimati]"}                        | ${"1995-01-01T12:00:00+14:00[Pacific/Kiritimati]"}                        | ${"year"}  | ${2}     | ${"1994 then 1995"}
    ${"1994-12-30T00:00:00-10:00[Pacific/Kiritimati][u-ca=japanese]"}         | ${"1995-01-02T00:00:00+14:00[Pacific/Kiritimati][u-ca=japanese]"}         | ${"month"} | ${2}     | ${"a non-ISO calendar whose month changes at the jump"}
    ${"1994-12-30T00:00:00-10:00[Pacific/Kiritimati][u-ca=japanese]"}         | ${"1995-01-02T00:00:00+14:00[Pacific/Kiritimati][u-ca=japanese]"}         | ${"year"}  | ${2}     | ${"a non-ISO calendar whose year changes at the jump (Heisei 6 to 7)"}
    ${"1994-12-30T00:00:00-10:00[Pacific/Kiritimati][u-ca=islamic-umalqura]"} | ${"1995-01-02T00:00:00+14:00[Pacific/Kiritimati][u-ca=islamic-umalqura]"} | ${"month"} | ${1}     | ${"27 to 30 Rajab 1415: the jump crosses a date but not a month"}
    ${"2011-12-29T12:00:00-10:00[Pacific/Apia][u-ca=islamic-umalqura]"}       | ${"2012-01-01T12:00:00+14:00[Pacific/Apia][u-ca=islamic-umalqura]"}       | ${"month"} | ${1}     | ${"4 to 7 Safar 1433: Samoa's deleted 30 December stays inside one month"}
    ${"2011-12-29T12:00:00-10:00[Pacific/Apia][u-ca=japanese]"}               | ${"2012-01-01T12:00:00+14:00[Pacific/Apia][u-ca=japanese]"}               | ${"month"} | ${2}     | ${"December then January across Samoa's jump"}
  `(
    "returns $expected $unit buckets from $start to $end ($description)",
    ({ start, end, unit, expected }) => {
      expect(intervalCountZoned(start, end, unit)).toBe(expected);
    },
  );
});

// A zone with few or no transitions is searched once, not once per three years of the span.
// Expected counts are verified on @js-temporal/polyfill@0.5.1; the spy bounds the searches.
describe("intervalCountZoned over a span with no transitions", () => {
  it.each`
    start                                        | end                                             | expected
    ${"-271821-04-20T00:00:00+00:00[UTC]"}       | ${"+275760-09-13T00:00:00+00:00[UTC]"}          | ${200_000_000}
    ${"1950-01-01T00:00:00+05:30[Asia/Kolkata]"} | ${"+200000-01-01T00:00:00+05:30[Asia/Kolkata]"} | ${72_336_277}
  `(
    "counts $expected days from $start to $end in a few transition searches",
    ({ start, end, expected }) => {
      const search = vi.spyOn(
        Temporal.ZonedDateTime.prototype,
        "getTimeZoneTransition",
      );

      try {
        expect(intervalCountZoned(start, end, "day")).toBe(expected);
        expect(search.mock.calls.length).toBeLessThanOrEqual(10);
      } finally {
        search.mockRestore();
      }
    },
    30_000,
  );
});
