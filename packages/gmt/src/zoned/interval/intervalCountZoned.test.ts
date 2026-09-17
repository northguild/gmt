import { calendarZonedFixtures } from "../../test";
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
