import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { ZoneBucketUnit } from "../../types";
import { bucketRange } from "./bucketRange";
import { floorToZone } from "./floorToZone";

const rangeStart = "2024-06-15T03:00:00Z";
const rangeEnd = "2024-06-18T03:00:00Z";
const units: readonly ZoneBucketUnit[] = ["hour", "day", "week", "month"];

describe("bucketRange", () => {
  it.each`
    timeZone                 | expected
    ${"UTC"}                 | ${["2024-06-15T00:00:00Z", "2024-06-16T00:00:00Z", "2024-06-17T00:00:00Z", "2024-06-18T00:00:00Z"]}
    ${"GMT"}                 | ${["2024-06-15T00:00:00Z", "2024-06-16T00:00:00Z", "2024-06-17T00:00:00Z", "2024-06-18T00:00:00Z"]}
    ${"Etc/GMT"}             | ${["2024-06-15T00:00:00Z", "2024-06-16T00:00:00Z", "2024-06-17T00:00:00Z", "2024-06-18T00:00:00Z"]}
    ${"America/Nome"}        | ${["2024-06-14T08:00:00Z", "2024-06-15T08:00:00Z", "2024-06-16T08:00:00Z", "2024-06-17T08:00:00Z"]}
    ${"Asia/Anadyr"}         | ${["2024-06-14T12:00:00Z", "2024-06-15T12:00:00Z", "2024-06-16T12:00:00Z", "2024-06-17T12:00:00Z"]}
    ${"Europe/Lisbon"}       | ${["2024-06-14T23:00:00Z", "2024-06-15T23:00:00Z", "2024-06-16T23:00:00Z", "2024-06-17T23:00:00Z"]}
    ${"Europe/Dublin"}       | ${["2024-06-14T23:00:00Z", "2024-06-15T23:00:00Z", "2024-06-16T23:00:00Z", "2024-06-17T23:00:00Z"]}
    ${"Europe/Berlin"}       | ${["2024-06-14T22:00:00Z", "2024-06-15T22:00:00Z", "2024-06-16T22:00:00Z", "2024-06-17T22:00:00Z"]}
    ${"Europe/Helsinki"}     | ${["2024-06-14T21:00:00Z", "2024-06-15T21:00:00Z", "2024-06-16T21:00:00Z", "2024-06-17T21:00:00Z"]}
    ${"Europe/Istanbul"}     | ${["2024-06-14T21:00:00Z", "2024-06-15T21:00:00Z", "2024-06-16T21:00:00Z", "2024-06-17T21:00:00Z"]}
    ${"Asia/Kolkata"}        | ${["2024-06-14T18:30:00Z", "2024-06-15T18:30:00Z", "2024-06-16T18:30:00Z", "2024-06-17T18:30:00Z"]}
    ${"Asia/Kathmandu"}      | ${["2024-06-14T18:15:00Z", "2024-06-15T18:15:00Z", "2024-06-16T18:15:00Z", "2024-06-17T18:15:00Z"]}
    ${"Asia/Shanghai"}       | ${["2024-06-14T16:00:00Z", "2024-06-15T16:00:00Z", "2024-06-16T16:00:00Z", "2024-06-17T16:00:00Z"]}
    ${"Australia/Lord_Howe"} | ${["2024-06-14T13:30:00Z", "2024-06-15T13:30:00Z", "2024-06-16T13:30:00Z", "2024-06-17T13:30:00Z"]}
    ${"Pacific/Chatham"}     | ${["2024-06-14T11:15:00Z", "2024-06-15T11:15:00Z", "2024-06-16T11:15:00Z", "2024-06-17T11:15:00Z"]}
    ${"Pacific/Apia"}        | ${["2024-06-14T11:00:00Z", "2024-06-15T11:00:00Z", "2024-06-16T11:00:00Z", "2024-06-17T11:00:00Z"]}
    ${"Pacific/Niue"}        | ${["2024-06-14T11:00:00Z", "2024-06-15T11:00:00Z", "2024-06-16T11:00:00Z", "2024-06-17T11:00:00Z"]}
    ${"America/New_York"}    | ${["2024-06-14T04:00:00Z", "2024-06-15T04:00:00Z", "2024-06-16T04:00:00Z", "2024-06-17T04:00:00Z"]}
    ${"America/Chicago"}     | ${["2024-06-14T05:00:00Z", "2024-06-15T05:00:00Z", "2024-06-16T05:00:00Z", "2024-06-17T05:00:00Z"]}
    ${"America/Phoenix"}     | ${["2024-06-14T07:00:00Z", "2024-06-15T07:00:00Z", "2024-06-16T07:00:00Z", "2024-06-17T07:00:00Z"]}
  `(
    "buckets a three-day range by local day in $timeZone as $expected",
    ({ timeZone, expected }) => {
      expect(bucketRange(rangeStart, rangeEnd, "day", timeZone)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                     | end                       | expected                                                                    | description
    ${"2024-03-09T05:00:00Z"} | ${"2024-03-12T04:00:00Z"} | ${["2024-03-09T05:00:00Z", "2024-03-10T05:00:00Z", "2024-03-11T04:00:00Z"]} | ${"spring forward: the middle day is 23 hours"}
    ${"2024-11-02T04:00:00Z"} | ${"2024-11-05T05:00:00Z"} | ${["2024-11-02T04:00:00Z", "2024-11-03T04:00:00Z", "2024-11-04T05:00:00Z"]} | ${"fall back: the middle day is 25 hours"}
  `(
    "buckets $start to $end by local day in America/New_York as $expected ($description)",
    ({ start, end, expected }) => {
      expect(bucketRange(start, end, "day", "America/New_York")).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                     | end                       | expectedHours | description
    ${"2024-03-09T05:00:00Z"} | ${"2024-03-12T04:00:00Z"} | ${[24, 23]}   | ${"a 23-hour day across spring forward"}
    ${"2024-11-02T04:00:00Z"} | ${"2024-11-05T05:00:00Z"} | ${[24, 25]}   | ${"a 25-hour day across fall back"}
  `(
    "yields day buckets of $expectedHours hours for $start to $end ($description)",
    ({ start, end, expectedHours }) => {
      const buckets = bucketRange(start, end, "day", "America/New_York");
      const lengths = buckets
        .slice(1)
        .map(
          (boundary, index) =>
            Temporal.Instant.from(buckets[index]).until(
              Temporal.Instant.from(boundary),
              { largestUnit: "hour" },
            ).hours,
        );

      expect(lengths).toEqual(expectedHours);
    },
  );

  it.each`
    start                     | end                       | timeZone                 | expected                                                                                                                    | description
    ${"2024-11-03T04:00:00Z"} | ${"2024-11-03T08:00:00Z"} | ${"America/New_York"}    | ${["2024-11-03T04:00:00Z", "2024-11-03T05:00:00Z", "2024-11-03T06:00:00Z", "2024-11-03T07:00:00Z"]}                         | ${"the repeated 01:00 is its own bucket, so a fall-back day has 25 hour buckets"}
    ${"2024-04-06T13:00:00Z"} | ${"2024-04-06T17:00:00Z"} | ${"Australia/Lord_Howe"} | ${["2024-04-06T13:00:00Z", "2024-04-06T14:00:00Z", "2024-04-06T15:30:00Z", "2024-04-06T16:30:00Z"]}                         | ${"a 30-minute fall-back, where local 01:00 labels 90 minutes"}
    ${"2024-10-05T13:00:00Z"} | ${"2024-10-05T17:00:00Z"} | ${"Australia/Lord_Howe"} | ${["2024-10-05T12:30:00Z", "2024-10-05T13:30:00Z", "2024-10-05T14:30:00Z", "2024-10-05T15:30:00Z", "2024-10-05T16:00:00Z"]} | ${"a 30-minute spring-forward, where local 02:00 begins at 02:30"}
  `(
    "buckets $start to $end by local hour in $timeZone as $expected ($description)",
    ({ start, end, timeZone, expected }) => {
      expect(bucketRange(start, end, "hour", timeZone)).toEqual(expected);
    },
  );

  it.each`
    start                     | end                       | timeZone              | expected                                                                                                                    | description
    ${"2011-12-28T12:00:00Z"} | ${"2012-01-01T12:00:00Z"} | ${"Pacific/Apia"}     | ${["2011-12-28T10:00:00Z", "2011-12-29T10:00:00Z", "2011-12-30T10:00:00Z", "2011-12-31T10:00:00Z", "2012-01-01T10:00:00Z"]} | ${"2011-12-30 is absent — Samoa deleted it crossing the date line"}
    ${"2024-09-07T12:00:00Z"} | ${"2024-09-09T12:00:00Z"} | ${"America/Santiago"} | ${["2024-09-07T04:00:00Z", "2024-09-08T04:00:00Z", "2024-09-09T03:00:00Z"]}                                                 | ${"a local day whose midnight is skipped starts at 01:00"}
  `(
    "buckets $start to $end by local day in $timeZone as $expected ($description)",
    ({ start, end, timeZone, expected }) => {
      expect(bucketRange(start, end, "day", timeZone)).toEqual(expected);
    },
  );

  it.each`
    unit      | timeZone              | expected                                                                                            | description
    ${"week"} | ${"America/New_York"} | ${["2024-06-10T04:00:00Z", "2024-06-17T04:00:00Z", "2024-06-24T04:00:00Z", "2024-07-01T04:00:00Z"]} | ${"weeks start on Monday"}
  `(
    "buckets by $unit in $timeZone as $expected ($description)",
    ({ unit, timeZone, expected }) => {
      expect(
        bucketRange(
          "2024-06-12T00:00:00Z",
          "2024-07-03T00:00:00Z",
          unit,
          timeZone,
        ),
      ).toEqual(expected);
    },
  );

  it.each`
    timeZone             | expected                                                                                            | description
    ${"Asia/Kathmandu"}  | ${["2023-12-31T18:15:00Z", "2024-01-31T18:15:00Z", "2024-02-29T18:15:00Z", "2024-03-31T18:15:00Z"]} | ${"a +05:45 zone"}
    ${"Pacific/Chatham"} | ${["2023-12-31T10:15:00Z", "2024-01-31T10:15:00Z", "2024-02-29T10:15:00Z", "2024-03-31T10:15:00Z"]} | ${"a +12:45/+13:45 zone across its months"}
  `(
    "buckets by local month in $timeZone as $expected ($description)",
    ({ timeZone, expected }) => {
      expect(
        bucketRange(
          "2024-01-15T00:00:00Z",
          "2024-04-15T00:00:00Z",
          "month",
          timeZone,
        ),
      ).toEqual(expected);
    },
  );

  it.each`
    start                     | end                       | expected                    | description
    ${"2024-06-15T03:00:00Z"} | ${"2024-06-15T03:00:00Z"} | ${["2024-06-14T04:00:00Z"]} | ${"a zero-length range mid-bucket still touches the bucket holding it"}
    ${"2024-06-14T04:00:00Z"} | ${"2024-06-14T04:00:00Z"} | ${[]}                       | ${"a zero-length range on a boundary touches nothing"}
    ${"2024-06-14T04:00:00Z"} | ${"2024-06-15T04:00:00Z"} | ${["2024-06-14T04:00:00Z"]} | ${"the range is half-open, so an end on a boundary excludes that bucket"}
    ${"2024-06-16T00:00:00Z"} | ${"2024-06-15T00:00:00Z"} | ${[]}                       | ${"start after end"}
  `(
    "returns $expected for $start to $end ($description)",
    ({ start, end, expected }) => {
      expect(bucketRange(start, end, "day", "America/New_York")).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                     | end                       | expected                                                                                                                    | description
    ${"2025-09-27T13:30:00Z"} | ${"2025-09-27T15:00:00Z"} | ${["2025-09-27T13:15:00Z", "2025-09-27T14:00:00Z", "2025-09-27T14:15:00Z"]}                                                 | ${"a 02:45 -> 03:45 spring-forward: the shortened 03:00 hour is 15 minutes long"}
    ${"2025-04-05T13:00:00Z"} | ${"2025-04-05T16:00:00Z"} | ${["2025-04-05T12:15:00Z", "2025-04-05T13:15:00Z", "2025-04-05T14:00:00Z", "2025-04-05T14:15:00Z", "2025-04-05T15:15:00Z"]} | ${"a 03:45 -> 02:45 fall-back: the repeated quarter-hour is its own bucket, not skipped"}
  `(
    "buckets $start to $end by local hour in Pacific/Chatham as $expected ($description)",
    ({ start, end, expected }) => {
      expect(bucketRange(start, end, "hour", "Pacific/Chatham")).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                     | end                       | timeZone                 | probe                     | description
    ${"2025-04-05T13:00:00Z"} | ${"2025-04-05T16:00:00Z"} | ${"Pacific/Chatham"}     | ${"2025-04-05T14:00:00Z"} | ${"an instant in the repeated quarter-hour of a sub-hour fall-back"}
    ${"2025-09-27T13:30:00Z"} | ${"2025-09-27T15:00:00Z"} | ${"Pacific/Chatham"}     | ${"2025-09-27T14:05:00Z"} | ${"an instant in the shortened hour of a sub-hour spring-forward"}
    ${"2024-04-06T13:00:00Z"} | ${"2024-04-06T17:00:00Z"} | ${"Australia/Lord_Howe"} | ${"2024-04-06T15:00:00Z"} | ${"an instant in a 90-minute local hour"}
    ${"2024-11-03T04:00:00Z"} | ${"2024-11-03T08:00:00Z"} | ${"America/New_York"}    | ${"2024-11-03T06:30:00Z"} | ${"the second pass of a repeated whole hour"}
  `(
    "agrees with floorToZone for $probe in $timeZone ($description)",
    ({ start, end, timeZone, probe }) => {
      const buckets = bucketRange(start, end, "hour", timeZone);

      expect(buckets).toContain(floorToZone(probe, "hour", timeZone));
    },
  );

  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "returns only genuine bucket starts, strictly increasing, in $timeZone",
    ({ timeZone }) => {
      for (const unit of units) {
        const buckets = bucketRange(rangeStart, rangeEnd, unit, timeZone);

        expect(buckets.length).toBeGreaterThan(0);
        for (const boundary of buckets) {
          expect(floorToZone(boundary, unit, timeZone)).toBe(boundary);
        }
        for (let i = 1; i < buckets.length; i++) {
          expect(buckets[i] > buckets[i - 1]).toBe(true);
        }
      }
    },
  );

  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "opens on the bucket holding start and closes on the bucket holding end, in $timeZone",
    ({ timeZone }) => {
      for (const unit of units) {
        const buckets = bucketRange(rangeStart, rangeEnd, unit, timeZone);

        const last = buckets[buckets.length - 1];

        expect(buckets[0]).toBe(floorToZone(rangeStart, unit, timeZone));
        expect(last < rangeEnd).toBe(true);
        // Nothing is left over: the last bucket is the only one from its own start to end.
        expect(bucketRange(last, rangeEnd, unit, timeZone)).toEqual([last]);
      }
    },
  );

  it.each`
    end                       | expectedLength | description
    ${"2025-02-20T16:00:00Z"} | ${10000}       | ${"exactly the maximum number of buckets"}
    ${"2025-02-20T15:00:00Z"} | ${9999}        | ${"one under it"}
  `(
    "returns $expectedLength buckets when a range needs $description",
    ({ end, expectedLength }) => {
      expect(
        bucketRange("2024-01-01T00:00:00Z", end, "hour", "UTC"),
      ).toHaveLength(expectedLength);
    },
  );

  it.each`
    end                       | description
    ${"2025-02-20T17:00:00Z"} | ${"one bucket over the maximum"}
    ${"3024-01-01T00:00:00Z"} | ${"a thousand years of hours"}
  `("returns an empty array when a range needs $description", ({ end }) => {
    expect(bucketRange("2024-01-01T00:00:00Z", end, "hour", "UTC")).toEqual([]);
  });

  it.each`
    unit         | description
    ${"minute"}  | ${"a unit below hour"}
    ${"year"}    | ${"a unit above month"}
    ${"days"}    | ${"a plural spelling"}
    ${""}        | ${"an empty string"}
    ${undefined} | ${"absent"}
    ${null}      | ${"null"}
    ${1}         | ${"a number"}
  `("returns an empty array when unit is $unit ($description)", ({ unit }) => {
    expect(
      bucketRange(rangeStart, rangeEnd, unit as "day", "America/New_York"),
    ).toEqual([]);
  });

  it.each`
    timeZone          | description
    ${"Invalid/Zone"} | ${"an unknown identifier"}
    ${""}             | ${"an empty string"}
    ${undefined}      | ${"absent"}
    ${null}           | ${"null"}
    ${123}            | ${"a number"}
  `(
    "returns an empty array when timeZone is $timeZone ($description)",
    ({ timeZone }) => {
      expect(
        bucketRange(rangeStart, rangeEnd, "day", timeZone as string),
      ).toEqual([]);
    },
  );

  it.each`
    start                     | end                      | description
    ${"2024-06-15T03:00:00"}  | ${rangeEnd}              | ${"a zoneless start, which names no instant"}
    ${rangeStart}             | ${"2024-06-18T03:00:00"} | ${"a zoneless end"}
    ${"invalid"}              | ${rangeEnd}              | ${"an unparseable start"}
    ${rangeStart}             | ${"invalid"}             | ${"an unparseable end"}
    ${""}                     | ${rangeEnd}              | ${"an empty start"}
    ${"2016-12-31T23:59:60Z"} | ${rangeEnd}              | ${"a leap-second start"}
    ${"2024-06-15"}           | ${rangeEnd}              | ${"a date start"}
  `(
    "returns an empty array for $start to $end ($description)",
    ({ start, end }) => {
      expect(bucketRange(start, end, "day", "America/New_York")).toEqual([]);
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `("returns an empty array when $value is non-string input", ({ value }) => {
    expect(
      bucketRange(
        value as unknown as string,
        rangeEnd,
        "day",
        "America/New_York",
      ),
    ).toEqual([]);
    expect(
      bucketRange(
        rangeStart,
        value as unknown as string,
        "day",
        "America/New_York",
      ),
    ).toEqual([]);
  });

  it.each`
    start                        | end                          | expected                                                                             | description
    ${"+275760-09-12T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"} | ${["+275760-09-12T00:00:00Z"]}                                                       | ${"a range ending on the last instant Temporal supports"}
    ${"-271821-04-20T00:00:00Z"} | ${"-271821-04-23T00:00:00Z"} | ${["-271821-04-20T00:00:00Z", "-271821-04-21T00:00:00Z", "-271821-04-22T00:00:00Z"]} | ${"a range opening on the first instant it supports"}
  `(
    "buckets $start to $end by day in UTC as $expected ($description)",
    ({ start, end, expected }) => {
      expect(bucketRange(start, end, "day", "UTC")).toEqual(expected);
    },
  );

  it("returns an empty array when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      bucketRange(rangeStart, rangeEnd, "day", "America/New_York"),
    ).toEqual([]);
  });
});
