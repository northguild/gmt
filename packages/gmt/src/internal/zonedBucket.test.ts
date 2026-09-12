import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../test";
import { getStartOfZonedUnit } from "./intervalCountHelpers";
import { nextZonedBucketStart } from "./zonedBucket";

const zonedAt = (instant: string, timeZone: string) =>
  Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);

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
      const current = getStartOfZonedUnit(zonedAt(instant, timeZone), unit);

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
      const current = getStartOfZonedUnit(
        zonedAt(instant, "Australia/Lord_Howe"),
        "hour",
      );

      expect(
        nextZonedBucketStart(current, "hour")?.toInstant().toString(),
      ).toBe(expected);
    },
  );

  it("skips the calendar day Samoa deleted crossing the date line", () => {
    const current = getStartOfZonedUnit(
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
        let current = getStartOfZonedUnit(
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
            getStartOfZonedUnit(next as Temporal.ZonedDateTime, unit).equals(
              next as Temporal.ZonedDateTime,
            ),
          ).toBe(true);

          current = next as Temporal.ZonedDateTime;
        }
      }
    },
  );
});
