import { Temporal } from "./temporal";
import { battleTestTimeZones } from "../test";
import {
  calendarScale,
  type CalendarUnit,
  periodsEndingAt,
  type UnitScale,
  type UnitSpan,
} from "./dutyPeriods";
import { zoneFrame, type ZoneFrame } from "./zoneFrame";

const ns = (instant: string) => Temporal.Instant.from(instant).epochNanoseconds;

/** The period `periods` after the one holding `x`, found by stepping through each in between. */
function walked(scale: UnitScale, x: bigint, periods: number): UnitSpan {
  let span = scale.containing(x) as UnitSpan;

  for (let step = 0; step < Math.abs(periods); step++) {
    span = scale.containing(
      periods > 0 ? span.end : span.start - 1n,
    ) as UnitSpan;
  }

  return span;
}

// Each probe zone at the clock change that tests it: Chatham's +12:45 spring-forward, Casey's
// three-hour jump, New York's fall-back, Lord Howe's 30-minute fall-back, Santiago's skipped
// midnight, Havana's repeated midnight, Goose Bay's fall-back into the previous date, and the date
// Apia deleted.
const probes = [
  ["Pacific/Chatham", "2024-09-29T00:00:00Z"],
  ["Antarctica/Casey", "2020-10-04T00:00:00Z"],
  ["America/New_York", "2024-11-03T06:00:00Z"],
  ["Australia/Lord_Howe", "2024-04-07T00:00:00Z"],
  ["America/Santiago", "2024-09-08T04:30:00Z"],
  ["America/Havana", "2024-11-03T04:30:00Z"],
  ["America/Goose_Bay", "2010-11-07T03:30:00Z"],
  ["Pacific/Apia", "2011-12-30T10:00:00Z"],
] as const;
const cases = [
  ...battleTestTimeZones.map((timeZone) => [timeZone, "2024-02-29T12:00:00Z"]),
  ...probes,
].flatMap(([timeZone, instant]) =>
  (["week", "month", "year"] as const).map((unit) => ({
    timeZone,
    instant,
    unit,
  })),
);

describe("calendarScale jump", () => {
  it.each(cases)(
    "finds the $unit periods around $instant in $timeZone as a walk does",
    ({ timeZone, instant, unit }) => {
      const scale = calendarScale(
        zoneFrame(timeZone) as ZoneFrame,
        unit as CalendarUnit,
      );
      const x = ns(instant);
      const here = scale.containing(x) as UnitSpan;

      for (const periods of [-13, -2, -1, 0, 1, 2, 13]) {
        const jumped = scale.jump?.(here, periods);

        expect(
          jumped === undefined ? walked(scale, x, periods) : jumped,
          `${periods}`,
        ).toEqual(walked(scale, x, periods));
      }
    },
  );

  // A zone that never changes its clock starts each period at local midnight at one offset, so the
  // period k units on starts at midnight on the date k units on, worked out here with Temporal's own
  // date arithmetic instead of a walk through every period between.
  it.each`
    timeZone       | unit       | offsetSeconds | first
    ${"UTC"}       | ${"week"}  | ${0}          | ${"2024-02-26"}
    ${"UTC"}       | ${"month"} | ${0}          | ${"2024-02-01"}
    ${"UTC"}       | ${"year"}  | ${0}          | ${"2024-01-01"}
    ${"+05:30"}    | ${"year"}  | ${19_800}     | ${"2024-01-01"}
    ${"-00:44:30"} | ${"month"} | ${-2_670}     | ${"2024-02-01"}
  `(
    "jumps $unit periods in $timeZone, which never changes its clock",
    ({ timeZone, unit, offsetSeconds, first }) => {
      const scale = calendarScale(zoneFrame(timeZone) as ZoneFrame, unit);
      const here = scale.containing(ns("2024-02-29T12:00:00Z")) as UnitSpan;
      const field = `${unit}s` as "weeks" | "months" | "years";
      const midnight = (units: number) =>
        ns(
          `${Temporal.PlainDate.from(first).add({ [field]: units })}T00:00:00Z`,
        ) -
        BigInt(offsetSeconds) * 1_000_000_000n;

      for (const periods of [-9_999, -1, 1, 9_999]) {
        expect(scale.jump?.(here, periods), `${periods}`).toEqual({
          start: midnight(periods),
          end: midnight(periods + 1),
        });
      }
    },
  );

  // Goose Bay's fall-back at 00:01 on 1 November 2009 reopened 31 October for 59 minutes: a month
  // period of its own. A month later is not one jump away, so the jump declines and the walk counts.
  it("declines to jump across a clock change", () => {
    const scale = calendarScale(
      zoneFrame("America/Goose_Bay") as ZoneFrame,
      "month",
    );
    const october = scale.containing(ns("2009-10-15T12:00:00Z")) as UnitSpan;

    expect(scale.jump?.(october, 1)).toBeUndefined();
    expect(walked(scale, ns("2009-10-15T12:00:00Z"), 2)).toEqual({
      start: ns("2009-11-01T03:01:00Z"),
      end: ns("2009-11-01T04:00:00Z"),
    });
  });

  it("is absent for days, which a deleted date makes uneven", () => {
    expect(
      calendarScale(zoneFrame("Pacific/Apia") as ZoneFrame, "day").jump,
    ).toBeUndefined();
  });

  it("returns null past the instant range", () => {
    const scale = calendarScale(zoneFrame("UTC") as ZoneFrame, "year");
    const here = scale.containing(ns("2024-06-01T00:00:00Z")) as UnitSpan;

    expect(scale.jump?.(here, 300_000)).toBeNull();
  });
});

describe("periodsEndingAt", () => {
  // 10,000 calendar years ending with 2024 start on 1 January of year -7975.
  it("counts 10,000 years back with one jump", () => {
    const scale = calendarScale(zoneFrame("UTC") as ZoneFrame, "year");

    expect(periodsEndingAt(scale, 10_000, ns("2024-06-01T00:00:00Z"))).toEqual({
      start: ns("-007975-01-01T00:00:00Z"),
      end: ns("2025-01-01T00:00:00Z"),
    });
  });

  // Apia deleted 30 December 2011, so the three days ending with the 31st are the 28th, 29th and
  // 31st: the walk counts days, not dates.
  it("walks days, so a deleted date is not counted", () => {
    const scale = calendarScale(zoneFrame("Pacific/Apia") as ZoneFrame, "day");

    expect(periodsEndingAt(scale, 3, ns("2011-12-30T12:00:00Z"))).toEqual({
      start: ns("2011-12-28T10:00:00Z"),
      end: ns("2011-12-31T10:00:00Z"),
    });
  });
});

describe("calendarScale containing keeps its cache in order", () => {
  const day = (date: string): UnitSpan => ({
    start: ns(`${date}T00:00:00Z`),
    end: ns(`${date}T00:00:00Z`) + 86_400_000_000_000n,
  });
  const utcDays = () => calendarScale(zoneFrame("UTC") as ZoneFrame, "day");

  // Each order ends with every day from the 1st to the 5th asked for again: a cache that kept
  // spans out of order, or lost one, answers one of them wrongly.
  it.each`
    order                                  | days
    ${"ascending, each appended"}          | ${[1, 2, 3, 4, 5]}
    ${"descending, each put at the start"} | ${[5, 4, 3, 2, 1]}
    ${"the middle last"}                   | ${[1, 5, 3]}
    ${"the ends after the middle"}         | ${[3, 5, 1]}
    ${"the same day twice"}                | ${[2, 2, 4, 4]}
  `("answers every day after asking $order", ({ days }) => {
    const scale = utcDays();

    for (const asked of days as number[]) {
      expect(scale.containing(ns(`2024-03-0${asked}T12:00:00Z`))).toEqual(
        day(`2024-03-0${asked}`),
      );
    }
    for (const date of [1, 2, 3, 4, 5]) {
      expect(scale.containing(ns(`2024-03-0${date}T06:00:00Z`))).toEqual(
        day(`2024-03-0${date}`),
      );
    }
  });

  // A day is [start, end): its first instant is in it, its last instant is the one before the end,
  // and the end itself is the next day's start.
  it.each`
    instant                   | date
    ${"2024-03-03T00:00:00Z"} | ${"2024-03-03"}
    ${"2024-03-03T23:59:59Z"} | ${"2024-03-03"}
    ${"2024-03-04T00:00:00Z"} | ${"2024-03-04"}
    ${"2024-03-02T23:59:59Z"} | ${"2024-03-02"}
  `("puts $instant in the day of $date, cached or not", ({ instant, date }) => {
    const scale = utcDays();
    const expected = day(date);

    // Cache the day either side first, so the instant meets neighbours that touch its day.
    scale.containing(ns("2024-03-02T12:00:00Z"));
    scale.containing(ns("2024-03-04T12:00:00Z"));
    expect(scale.containing(ns(instant))).toEqual(expected);
    expect(scale.containing(ns(instant))).toEqual(expected);
  });

  it("caches nothing for a period it cannot represent", () => {
    const scale = calendarScale(zoneFrame("UTC") as ZoneFrame, "year");
    const last = 8_640_000_000_000_000_000_000n;

    expect(scale.containing(last)).toBeNull();
    expect(scale.containing(ns("2024-06-01T00:00:00Z"))).toEqual({
      start: ns("2024-01-01T00:00:00Z"),
      end: ns("2025-01-01T00:00:00Z"),
    });
    expect(scale.containing(last)).toBeNull();
  });
});
