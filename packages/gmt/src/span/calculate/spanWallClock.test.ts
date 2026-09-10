import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, localRangeBattleCases } from "../../test";
import {
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalZonedDateTimeFromThrow,
} from "../../test/mocks";
import { spanMs } from "./spanMs";
import { spanWallClock } from "./spanWallClock";

/**
 * Local noon on two consecutive calendar days, in every battle-test timeZone, over four
 * windows chosen so that between them every kind of offset shift in the matrix is covered:
 * northern spring-forward, EU spring-forward, southern fall-back (including
 * `Australia/Lord_Howe`'s 30-minute shift and `Pacific/Chatham`'s quarter-hour offset) and
 * northern fall-back. `localNoonBattleCases`' fixed leap-day date has no transition near it,
 * so this is the sibling fixture the case needs.
 */
const wallClockDayBattleCases = [
  { window: "US spring forward", month: 3, day: 9 },
  { window: "EU spring forward", month: 3, day: 30 },
  { window: "southern fall back", month: 4, day: 6 },
  { window: "US fall back", month: 11, day: 2 },
].flatMap(({ window, month, day }) =>
  battleTestTimeZones.map((timeZone) => {
    const start = Temporal.ZonedDateTime.from({
      year: 2024,
      month,
      day,
      hour: 12,
      minute: 0,
      second: 0,
      timeZone,
    });

    return {
      window,
      timeZone,
      start: start.toString(),
      end: start.add({ days: 1 }).toString(),
    };
  }),
);

/**
 * The same four windows at 02:30 local, written **without** an offset — the form
 * `isValidZonedDateTime` accepts and `Temporal.ZonedDateTime.from` resolves through its
 * default `compatible` disambiguation. 02:30 is inside the US spring-forward gap, so
 * reading these back via an instant silently advances the start to 03:30 and reports 23
 * hours for a wall-clock day. Reading the wall clock directly cannot.
 */
const offsetlessWallClockDayBattleCases = [
  { window: "US spring forward", month: 3, day: 9 },
  { window: "EU spring forward", month: 3, day: 30 },
  { window: "southern fall back", month: 4, day: 6 },
  { window: "US fall back", month: 11, day: 2 },
].flatMap(({ window, month, day }) =>
  battleTestTimeZones.map((timeZone) => {
    const start = Temporal.PlainDateTime.from({
      year: 2024,
      month,
      day,
      hour: 2,
      minute: 30,
    });

    return {
      window,
      timeZone,
      start: `${start.toString()}[${timeZone}]`,
      end: `${start.add({ days: 1 }).toString()}[${timeZone}]`,
    };
  }),
);

describe("spanWallClock", () => {
  it.each`
    start                                            | end                                              | unit       | expected
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${"hours"} | ${0}
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${"days"}  | ${0}
    ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"2024-03-02T12:00:00-05:00[America/New_York]"} | ${"hours"} | ${24}
    ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"2024-03-02T12:00:00-05:00[America/New_York]"} | ${"days"}  | ${1}
    ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"2024-03-08T12:00:00-05:00[America/New_York]"} | ${"days"}  | ${7}
    ${"2024-03-08T12:00:00-05:00[America/New_York]"} | ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"days"}  | ${-7}
    ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"2024-03-02T18:00:00-05:00[America/New_York]"} | ${"hours"} | ${30}
    ${"2024-03-02T18:00:00-05:00[America/New_York]"} | ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"hours"} | ${-30}
    ${"2024-02-28T12:00:00+00:00[UTC]"}              | ${"2024-03-01T12:00:00+00:00[UTC]"}              | ${"days"}  | ${2}
    ${"2023-02-28T12:00:00+00:00[UTC]"}              | ${"2023-03-01T12:00:00+00:00[UTC]"}              | ${"days"}  | ${1}
  `(
    "returns $expected $unit from $start to $end",
    ({ start, end, unit, expected }) => {
      expect(spanWallClock(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                                            | end                                              | unit       | expected
    ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"2024-03-02T18:00:00-05:00[America/New_York]"} | ${"days"}  | ${1}
    ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"2024-03-01T23:59:59-05:00[America/New_York]"} | ${"days"}  | ${0}
    ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"2024-03-02T11:59:59-05:00[America/New_York]"} | ${"days"}  | ${0}
    ${"2024-03-02T18:00:00-05:00[America/New_York]"} | ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"days"}  | ${-1}
    ${"2024-03-01T12:00:00-05:00[America/New_York]"} | ${"2024-03-01T12:59:59-05:00[America/New_York]"} | ${"hours"} | ${0}
  `(
    "truncates toward zero, returning $expected $unit from $start to $end",
    ({ start, end, unit, expected }) => {
      expect(spanWallClock(start, end, unit)).toBe(expected);
    },
  );

  it.each(wallClockDayBattleCases)(
    "counts a wall-clock day as 24 hours in $timeZone across $window",
    ({ start, end }) => {
      expect(spanWallClock(start, end, "hours")).toBe(24);
      expect(spanWallClock(start, end, "days")).toBe(1);
    },
  );

  it.each`
    start                                            | end                                              | elapsedMs   | transition
    ${"2024-03-09T12:00:00-05:00[America/New_York]"} | ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${82800000} | ${"US spring forward"}
    ${"2024-03-30T12:00:00+02:00[Europe/Helsinki]"}  | ${"2024-03-31T12:00:00+03:00[Europe/Helsinki]"}  | ${82800000} | ${"EU spring forward"}
    ${"2024-11-02T12:00:00-04:00[America/New_York]"} | ${"2024-11-03T12:00:00-05:00[America/New_York]"} | ${90000000} | ${"US fall back"}
    ${"2024-04-06T12:00:00+13:45[Pacific/Chatham]"}  | ${"2024-04-07T12:00:00+12:45[Pacific/Chatham]"}  | ${90000000} | ${"quarter-hour zone fall back"}
  `(
    "disagrees with spanMs by exactly one hour across $transition",
    ({ start, end, elapsedMs }) => {
      expect(spanWallClock(start, end, "hours")).toBe(24);
      expect(spanMs(start, end)).toBe(elapsedMs);
      expect(Math.abs(elapsedMs - 24 * 3600000)).toBe(3600000);
    },
  );

  it("disagrees with spanMs by half an hour where the transition is half an hour", () => {
    const start = "2024-04-06T12:00:00+11:00[Australia/Lord_Howe]";
    const end = "2024-04-07T12:00:00+10:30[Australia/Lord_Howe]";

    expect(spanWallClock(start, end, "hours")).toBe(24);
    expect(spanMs(start, end)).toBe(88200000);
  });

  it.each(localRangeBattleCases)(
    "returns the same wall-clock span in $timeZone as in every other zone",
    ({ start, end }) => {
      expect(spanWallClock(start, end, "days")).toBe(2);
      expect(spanWallClock(start, end, "hours")).toBe(48);
    },
  );

  it.each`
    start                                            | end                                           | unit       | expected
    ${"2024-03-10T23:00:00-04:00[America/New_York]"} | ${"2024-03-11T11:00:00+01:00[Europe/Berlin]"} | ${"hours"} | ${12}
    ${"2024-03-10T23:00:00-04:00[America/New_York]"} | ${"2024-03-11T11:00:00+01:00[Europe/Berlin]"} | ${"days"}  | ${0}
    ${"2024-03-10T09:00:00+00:00[UTC]"}              | ${"2024-03-11T09:00:00+13:00[Pacific/Apia]"}  | ${"days"}  | ${1}
  `(
    "measures each endpoint's own wall clock when the zones differ, returning $expected $unit",
    ({ start, end, unit, expected }) => {
      expect(spanWallClock(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                                                         | end                                              | unit      | reason
    ${"invalid"}                                                  | ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${"days"} | ${"unparseable start"}
    ${"2024-03-10T12:00:00-04:00[America/New_York]"}              | ${"invalid"}                                     | ${"days"} | ${"unparseable end"}
    ${"2024-03-10T12:00:00Z"}                                     | ${"2024-03-11T12:00:00Z"}                        | ${"days"} | ${"instant string with no bracketed zone"}
    ${"2024-03-10T12:00:00-04:00"}                                | ${"2024-03-11T12:00:00-04:00"}                   | ${"days"} | ${"offset only, no bracketed zone"}
    ${"2024-03-10T12:00:00"}                                      | ${"2024-03-11T12:00:00"}                         | ${"days"} | ${"plain datetime, no zone"}
    ${"2024-03-10"}                                               | ${"2024-03-11"}                                  | ${"days"} | ${"date-only"}
    ${"2016-12-31T23:59:60+00:00[UTC]"}                           | ${"2017-01-01T12:00:00+00:00[UTC]"}              | ${"days"} | ${"leap second"}
    ${"2024-03-10T12:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"2024-03-11T12:00:00-04:00[America/New_York]"} | ${"days"} | ${"calendar annotation"}
    ${"2024-03-10T12:00:00-04:00[Not/AZone]"}                     | ${"2024-03-11T12:00:00-04:00[America/New_York]"} | ${"days"} | ${"unknown timeZone"}
    ${""}                                                         | ${"2024-03-11T12:00:00-04:00[America/New_York]"} | ${"days"} | ${"empty string"}
  `(
    "returns null when the pair is invalid ($reason)",
    ({ start, end, unit }) => {
      expect(spanWallClock(start, end, unit)).toBeNull();
    },
  );

  it.each`
    unit
    ${"minutes"}
    ${"weeks"}
    ${"months"}
    ${"day"}
    ${"hour"}
    ${"Days"}
    ${""}
    ${null}
    ${undefined}
    ${123}
  `("returns null when $unit is not a wall-clock span unit", ({ unit }) => {
    expect(
      spanWallClock(
        "2024-03-01T12:00:00-05:00[America/New_York]",
        "2024-03-02T12:00:00-05:00[America/New_York]",
        unit as unknown as "days",
      ),
    ).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `("returns null when $value is non-string input", ({ value }) => {
    const valid = "2024-03-10T12:00:00-04:00[America/New_York]";

    expect(spanWallClock(value as unknown as string, valid, "days")).toBeNull();
    expect(spanWallClock(valid, value as unknown as string, "days")).toBeNull();
  });

  it.each(offsetlessWallClockDayBattleCases)(
    "counts an offset-less wall-clock day as 24 hours in $timeZone across $window",
    ({ start, end }) => {
      expect(spanWallClock(start, end, "hours")).toBe(24);
      expect(spanWallClock(start, end, "days")).toBe(1);
    },
  );

  it.each`
    start                                      | end                                        | unit       | expected
    ${"2024-03-10T02:30:00[America/New_York]"} | ${"2024-03-11T02:30:00[America/New_York]"} | ${"hours"} | ${24}
    ${"2024-03-10T02:30:00[America/New_York]"} | ${"2024-03-11T02:30:00[America/New_York]"} | ${"days"}  | ${1}
    ${"2024-03-09T02:30:00[America/New_York]"} | ${"2024-03-10T02:30:00[America/New_York]"} | ${"hours"} | ${24}
    ${"2024-03-10T02:30:00[America/New_York]"} | ${"2024-03-10T04:30:00[America/New_York]"} | ${"hours"} | ${2}
    ${"2024-11-03T01:30:00[America/New_York]"} | ${"2024-11-03T03:30:00[America/New_York]"} | ${"hours"} | ${2}
  `(
    "measures a nonexistent or ambiguous local time as written, returning $expected $unit from $start",
    ({ start, end, unit, expected }) => {
      expect(spanWallClock(start, end, unit)).toBe(expected);
    },
  );

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();

    expect(
      spanWallClock(
        "2024-03-01T12:00:00-05:00[America/New_York]",
        "2024-03-02T12:00:00-05:00[America/New_York]",
        "days",
      ),
    ).toBeNull();
  });

  it("returns null when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();

    expect(
      spanWallClock(
        "2024-03-01T12:00:00-05:00[America/New_York]",
        "2024-03-02T12:00:00-05:00[America/New_York]",
        "days",
      ),
    ).toBeNull();
  });
});
