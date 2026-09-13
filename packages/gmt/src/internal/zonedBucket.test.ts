import { Temporal } from "@js-temporal/polyfill";
import { bucketRange } from "../calendar/calculate/bucketRange";
import { floorToZone } from "../calendar/calculate/floorToZone";
import { battleTestTimeZones } from "../test";
import type { ZoneBucketUnit } from "../types";
import {
  nextZonedBucketStart,
  zonedUnitEnd,
  zonedUnitStart,
} from "./zonedBucket";

const zonedAt = (instant: string, timeZone: string) =>
  Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);

// Seeds a walk from a real bucket start. Only called on inputs whose start always exists.
const unitStart = (zoned: Temporal.ZonedDateTime, unit: ZoneBucketUnit) =>
  zonedUnitStart(zoned, unit) as Temporal.ZonedDateTime;

describe("nextZonedBucketStart", () => {
  it.each`
    instant                   | unit       | timeZone              | expected                  | description
    ${"2024-06-15T03:00:00Z"} | ${"hour"}  | ${"UTC"}              | ${"2024-06-15T04:00:00Z"} | ${"an ordinary hour"}
    ${"2024-06-15T03:00:00Z"} | ${"day"}   | ${"UTC"}              | ${"2024-06-16T00:00:00Z"} | ${"an ordinary day"}
    ${"2024-06-15T03:00:00Z"} | ${"week"}  | ${"UTC"}              | ${"2024-06-17T00:00:00Z"} | ${"the next Monday"}
    ${"2024-06-15T03:00:00Z"} | ${"month"} | ${"UTC"}              | ${"2024-07-01T00:00:00Z"} | ${"the next month"}
    ${"2024-03-10T05:00:00Z"} | ${"day"}   | ${"America/New_York"} | ${"2024-03-11T04:00:00Z"} | ${"a 23-hour spring-forward day"}
    ${"2024-11-03T04:00:00Z"} | ${"day"}   | ${"America/New_York"} | ${"2024-11-04T05:00:00Z"} | ${"a 25-hour fall-back day"}
    ${"2024-11-03T05:00:00Z"} | ${"hour"}  | ${"America/New_York"} | ${"2024-11-03T06:00:00Z"} | ${"the first pass of a repeated wall hour"}
    ${"2024-11-03T06:00:00Z"} | ${"hour"}  | ${"America/New_York"} | ${"2024-11-03T07:00:00Z"} | ${"its second pass"}
  `(
    "advances $instant by one $unit in $timeZone to $expected ($description)",
    ({ instant, unit, timeZone, expected }) => {
      const current = unitStart(zonedAt(instant, timeZone), unit);

      expect(nextZonedBucketStart(current, unit)?.toInstant().toString()).toBe(
        expected,
      );
    },
  );

  it.each`
    instant                   | expected                  | description
    ${"2024-04-06T14:00:00Z"} | ${"2024-04-06T15:30:00Z"} | ${"a 30-minute fall-back, where one added hour lands back inside the same bucket"}
    ${"2024-10-05T14:30:00Z"} | ${"2024-10-05T15:30:00Z"} | ${"the hour before a 30-minute spring-forward"}
    ${"2024-10-05T15:30:00Z"} | ${"2024-10-05T16:00:00Z"} | ${"the half-length hour the spring-forward leaves behind"}
  `(
    "advances $instant by one hour in Australia/Lord_Howe to $expected ($description)",
    ({ instant, expected }) => {
      const current = unitStart(
        zonedAt(instant, "Australia/Lord_Howe"),
        "hour",
      );

      expect(
        nextZonedBucketStart(current, "hour")?.toInstant().toString(),
      ).toBe(expected);
    },
  );

  it("skips the calendar day Samoa deleted crossing the date line", () => {
    const current = unitStart(
      zonedAt("2011-12-29T12:00:00Z", "Pacific/Apia"),
      "day",
    );

    expect(nextZonedBucketStart(current, "day")?.toPlainDate().toString()).toBe(
      "2011-12-31",
    );
  });

  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "always advances, and lands on a real bucket start, in $timeZone",
    ({ timeZone }) => {
      for (const unit of ["hour", "day", "week", "month"] as const) {
        let current = unitStart(
          zonedAt("2024-06-15T03:00:00Z", timeZone),
          unit,
        );

        for (let step = 0; step < 8; step++) {
          const next = nextZonedBucketStart(current, unit);

          expect(next).not.toBeNull();
          expect(
            Temporal.ZonedDateTime.compare(
              next as Temporal.ZonedDateTime,
              current,
            ),
          ).toBe(1);
          expect(
            unitStart(next as Temporal.ZonedDateTime, unit).equals(
              next as Temporal.ZonedDateTime,
            ),
          ).toBe(true);

          current = next as Temporal.ZonedDateTime;
        }
      }
    },
  );
});

// Decision 6: a bounded walk that runs out must answer with the sentinel, never a partial value.
// The stub makes every "previous" transition land one minute before the instant it is asked
// from, mid-hour and without changing the UTC label, so no transition ever opens an hour bucket
// and the walk-back never reaches its own-offset start. "next" is left real, so only the
// walk-back is exhausted and `nextZonedBucketStart` cannot be what produces the sentinel.
describe("zonedUnitStart transition walk-back exhaustion", () => {
  const realGetTimeZoneTransition =
    Temporal.ZonedDateTime.prototype.getTimeZoneTransition;

  const endlessPreviousTransitions = () =>
    vi
      .spyOn(Temporal.ZonedDateTime.prototype, "getTimeZoneTransition")
      .mockImplementation(function (
        this: Temporal.ZonedDateTime,
        direction: Parameters<
          Temporal.ZonedDateTime["getTimeZoneTransition"]
        >[0],
      ) {
        return direction === "previous"
          ? this.subtract({ minutes: 1 })
          : realGetTimeZoneTransition.call(this, direction);
      });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each`
    instant                   | unit      | timeZone
    ${"2024-06-15T12:30:00Z"} | ${"hour"} | ${"UTC"}
  `(
    "returns null for $instant by $unit in $timeZone when every transition runs through the bucket",
    ({ instant, unit, timeZone }) => {
      endlessPreviousTransitions();

      expect(zonedUnitStart(zonedAt(instant, timeZone), unit)).toBeNull();
    },
  );

  it.each`
    instant                   | unit      | timeZone
    ${"2024-06-15T12:30:00Z"} | ${"hour"} | ${"UTC"}
  `(
    'floorToZone returns "" for $instant by $unit in $timeZone when the walk-back is exhausted',
    ({ instant, unit, timeZone }) => {
      endlessPreviousTransitions();

      expect(floorToZone(instant, unit, timeZone)).toBe("");
    },
  );

  it.each`
    start                     | end                       | unit      | timeZone
    ${"2024-06-15T12:30:00Z"} | ${"2024-06-15T14:00:00Z"} | ${"hour"} | ${"UTC"}
  `(
    "bucketRange returns [] for $start to $end by $unit in $timeZone when the walk-back is exhausted",
    ({ start, end, unit, timeZone }) => {
      endlessPreviousTransitions();

      expect(bucketRange(start, end, unit, timeZone)).toEqual([]);
    },
  );
});

// The walker generalized past the four public bucketing units: every DateTimeUnit, and a
// configurable week start (ISO day number, 1 = Monday .. 7 = Sunday). Expected values come from
// Temporal's own `startOfDay()` for year/week starts away from a repeated midnight, and from
// wall-clock `with()` in a zone with no nearby transition for sub-hour units.
describe("zonedUnitStart and nextZonedBucketStart for every DateTimeUnit", () => {
  it.each`
    instant                             | unit             | weekStartsOn | timeZone               | expectedStart                       | expectedNext
    ${"2024-06-15T03:00:00Z"}           | ${"year"}        | ${undefined} | ${"Pacific/Chatham"}   | ${"2023-12-31T10:15:00Z"}           | ${"2024-12-31T10:15:00Z"}
    ${"2024-06-15T03:00:00Z"}           | ${"year"}        | ${undefined} | ${"America/New_York"}  | ${"2024-01-01T05:00:00Z"}           | ${"2025-01-01T05:00:00Z"}
    ${"2010-12-15T10:00:00Z"}           | ${"year"}        | ${undefined} | ${"Africa/Cairo"}      | ${"2009-12-31T22:00:00Z"}           | ${"2010-12-31T22:00:00Z"}
    ${"2018-11-06T14:00:00Z"}           | ${"week"}        | ${7}         | ${"America/Sao_Paulo"} | ${"2018-11-04T03:00:00Z"}           | ${"2018-11-11T02:00:00Z"}
    ${"2018-11-06T14:00:00Z"}           | ${"week"}        | ${1}         | ${"America/Sao_Paulo"} | ${"2018-11-05T02:00:00Z"}           | ${"2018-11-12T02:00:00Z"}
    ${"1970-06-15T13:19:26.789Z"}       | ${"minute"}      | ${undefined} | ${"Africa/Monrovia"}   | ${"1970-06-15T13:18:30Z"}           | ${"1970-06-15T13:19:30Z"}
    ${"1970-06-15T13:19:26.789Z"}       | ${"second"}      | ${undefined} | ${"Africa/Monrovia"}   | ${"1970-06-15T13:19:26Z"}           | ${"1970-06-15T13:19:27Z"}
    ${"2024-06-15T03:00:00.123456789Z"} | ${"millisecond"} | ${undefined} | ${"UTC"}               | ${"2024-06-15T03:00:00.123Z"}       | ${"2024-06-15T03:00:00.124Z"}
    ${"2024-06-15T03:00:00.123456789Z"} | ${"microsecond"} | ${undefined} | ${"UTC"}               | ${"2024-06-15T03:00:00.123456Z"}    | ${"2024-06-15T03:00:00.123457Z"}
    ${"2024-06-15T03:00:00.123456789Z"} | ${"nanosecond"}  | ${undefined} | ${"UTC"}               | ${"2024-06-15T03:00:00.123456789Z"} | ${"2024-06-15T03:00:00.12345679Z"}
  `(
    "floors $instant by $unit (week start $weekStartsOn) in $timeZone to $expectedStart, next $expectedNext",
    ({
      instant,
      unit,
      weekStartsOn,
      timeZone,
      expectedStart,
      expectedNext,
    }) => {
      const start = zonedUnitStart(
        zonedAt(instant, timeZone),
        unit,
        weekStartsOn,
      );

      expect(start?.toInstant().toString()).toBe(expectedStart);
      expect(
        nextZonedBucketStart(
          start as Temporal.ZonedDateTime,
          unit,
          weekStartsOn,
        )
          ?.toInstant()
          .toString(),
      ).toBe(expectedNext);
    },
  );

  it("keeps a non-ISO calendar, flooring to the Hebrew month and year", () => {
    const zoned = Temporal.ZonedDateTime.from(
      "2024-03-15T10:30:00-04:00[America/New_York][u-ca=hebrew]",
    );

    expect(zonedUnitStart(zoned, "month")?.toString()).toBe(
      "2024-03-11T00:00:00-04:00[America/New_York][u-ca=hebrew]",
    );
    expect(zonedUnitStart(zoned, "year")?.toString()).toBe(
      "2023-09-16T00:00:00-04:00[America/New_York][u-ca=hebrew]",
    );
  });
});

describe("zonedUnitEnd", () => {
  it.each`
    instant                   | unit      | timeZone                 | expected                            | description
    ${"2024-11-03T06:30:00Z"} | ${"hour"} | ${"America/New_York"}    | ${"2024-11-03T06:59:59.999999999Z"} | ${"the second pass of a repeated wall hour"}
    ${"2024-04-06T15:10:00Z"} | ${"hour"} | ${"Australia/Lord_Howe"} | ${"2024-04-06T15:29:59.999999999Z"} | ${"a 90-minute hour"}
    ${"2024-09-28T14:05:00Z"} | ${"hour"} | ${"Pacific/Chatham"}     | ${"2024-09-28T14:14:59.999999999Z"} | ${"the 15-minute hour a spring-forward leaves"}
    ${"2024-06-15T03:00:00Z"} | ${"day"}  | ${"UTC"}                 | ${"2024-06-15T23:59:59.999999999Z"} | ${"an ordinary day"}
  `(
    "ends the $unit containing $instant in $timeZone at $expected ($description)",
    ({ instant, unit, timeZone, expected }) => {
      expect(
        zonedUnitEnd(zonedAt(instant, timeZone), unit)?.toInstant().toString(),
      ).toBe(expected);
    },
  );

  it("returns null when the unit start cannot be found", () => {
    vi.spyOn(
      Temporal.ZonedDateTime.prototype,
      "getTimeZoneTransition",
    ).mockImplementation(function (this: Temporal.ZonedDateTime) {
      return this.subtract({ minutes: 1 });
    });

    expect(
      zonedUnitEnd(zonedAt("2024-06-15T12:30:00Z", "UTC"), "hour"),
    ).toBeNull();
  });
});
