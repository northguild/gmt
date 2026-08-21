import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { getHoursInZonedDay } from "./getHoursInZonedDay";

describe("getHoursInZonedDay", () => {
  // 23-hour spring-forward day: America/New_York, March 10, 2024
  it("returns 23 for a spring-forward DST day", () => {
    expect(
      getHoursInZonedDay("2024-03-10T12:00:00-04:00[America/New_York]"),
    ).toBe(23);
  });

  // 25-hour fall-back day: America/New_York, November 3, 2024
  it("returns 25 for a fall-back DST day", () => {
    expect(
      getHoursInZonedDay("2024-11-03T12:00:00-05:00[America/New_York]"),
    ).toBe(25);
  });

  // Normal 24-hour day: UTC, February 29, 2024
  it("returns 24 for a normal day", () => {
    expect(getHoursInZonedDay("2024-02-29T12:00:00+00:00[UTC]")).toBe(24);
  });

  // Zone with no DST at all: Asia/Tokyo
  it("returns 24 for a zone with no DST", () => {
    expect(getHoursInZonedDay("2024-03-10T12:00:00+09:00[Asia/Tokyo]")).toBe(
      24,
    );
  });

  // Southern Hemisphere fall-back: Australia/Sydney, April 7, 2024
  it("returns 25 for a Southern Hemisphere fall-back day", () => {
    expect(
      getHoursInZonedDay("2024-04-07T12:00:00+10:00[Australia/Sydney]"),
    ).toBe(25);
  });

  // Australia/Lord_Howe shifts DST by only 30 minutes, so its transition
  // days are 23.5h/24.5h, not the usual whole-hour 23/25. The function used
  // to silently truncate these to 23/24 (Temporal.Duration.hours drops the
  // leftover minutes) — these are regression tests for that fix.
  it("returns 23.5 for a half-hour-shift spring-forward day (Australia/Lord_Howe)", () => {
    expect(
      getHoursInZonedDay("2024-10-06T12:00:00+11:00[Australia/Lord_Howe]"),
    ).toBe(23.5);
  });

  it("returns 24.5 for a half-hour-shift fall-back day (Australia/Lord_Howe)", () => {
    expect(
      getHoursInZonedDay("2024-04-07T12:00:00+10:30[Australia/Lord_Howe]"),
    ).toBe(24.5);
  });

  // Historical rule change: Africa/Casablanca paused DST for Ramadan in 2018,
  // producing three transitions in one year instead of the usual two.
  it.each`
    date            | expected
    ${"2018-03-25"} | ${23}
    ${"2018-05-13"} | ${25}
    ${"2018-06-17"} | ${23}
  `(
    "returns $expected on $date for Africa/Casablanca's 2018 Ramadan DST pause",
    ({ date, expected }) => {
      const zoned = Temporal.ZonedDateTime.from({
        year: Number(date.slice(0, 4)),
        month: Number(date.slice(5, 7)),
        day: Number(date.slice(8, 10)),
        hour: 12,
        timeZone: "Africa/Casablanca",
      });
      expect(getHoursInZonedDay(zoned.toString())).toBe(expected);
    },
  );

  // Battle-test: every canonical timeZone on a normal mid-year day is 24h,
  // including half/quarter-hour offset zones and the two extreme-offset zones.
  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "returns 24 for a normal day in $timeZone",
    ({ timeZone }) => {
      const zoned = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 7,
        day: 15,
        hour: 12,
        timeZone,
      });
      expect(getHoursInZonedDay(zoned.toString())).toBe(24);
    },
  );

  // Battle-test: every canonical timeZone that observes DST has matching
  // 23h/25h spring-forward and fall-back days in 2024.
  it.each`
    timeZone              | springForward   | fallBack
    ${"America/Nome"}     | ${"2024-03-10"} | ${"2024-11-03"}
    ${"Europe/Lisbon"}    | ${"2024-03-31"} | ${"2024-10-27"}
    ${"Europe/Dublin"}    | ${"2024-03-31"} | ${"2024-10-27"}
    ${"Europe/Berlin"}    | ${"2024-03-31"} | ${"2024-10-27"}
    ${"Europe/Helsinki"}  | ${"2024-03-31"} | ${"2024-10-27"}
    ${"America/New_York"} | ${"2024-03-10"} | ${"2024-11-03"}
    ${"America/Chicago"}  | ${"2024-03-10"} | ${"2024-11-03"}
    ${"Pacific/Chatham"}  | ${"2024-09-29"} | ${"2024-04-07"}
  `(
    "returns 23/25 on the spring-forward/fall-back days for battle-test timeZone $timeZone",
    ({ timeZone, springForward, fallBack }) => {
      const spring = Temporal.ZonedDateTime.from({
        year: Number(springForward.slice(0, 4)),
        month: Number(springForward.slice(5, 7)),
        day: Number(springForward.slice(8, 10)),
        hour: 12,
        timeZone,
      });
      const fall = Temporal.ZonedDateTime.from({
        year: Number(fallBack.slice(0, 4)),
        month: Number(fallBack.slice(5, 7)),
        day: Number(fallBack.slice(8, 10)),
        hour: 12,
        timeZone,
      });
      expect(getHoursInZonedDay(spring.toString())).toBe(23);
      expect(getHoursInZonedDay(fall.toString())).toBe(25);
    },
  );

  // Battle-test zones that never observe DST at all should always be 24h,
  // even on dates near where a DST-observing zone would transition.
  it.each(
    [
      "UTC",
      "GMT",
      "Etc/GMT",
      "Asia/Anadyr",
      "Europe/Istanbul",
      "Asia/Kolkata",
      "Asia/Kathmandu",
      "Asia/Shanghai",
      "America/Phoenix",
    ].map((timeZone) => ({ timeZone })),
  )(
    "returns 24 near a US/EU transition date for non-DST timeZone $timeZone",
    ({ timeZone }) => {
      const zoned = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 3,
        day: 10,
        hour: 12,
        timeZone,
      });
      expect(getHoursInZonedDay(zoned.toString())).toBe(24);
    },
  );

  // Invalid input → null, per GMT's number-return sentinel convention.
  it.each`
    value
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `("returns null for invalid input $value", ({ value }) => {
    expect(getHoursInZonedDay(value as never)).toBeNull();
  });

  it("returns null on Temporal.ZonedDateTime.from failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      getHoursInZonedDay("2024-03-10T12:00:00-04:00[America/New_York]"),
    ).toBeNull();
  });
});
