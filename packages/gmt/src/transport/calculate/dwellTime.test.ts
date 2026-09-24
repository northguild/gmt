import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, MustTestDstTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { dwellTime } from "./dwellTime";

/** Late evening UTC on 15 June to the small hours of 16 June: two local dates in some zones, one in others. */
const entry = "2024-06-15T22:30:00Z";
const exit = "2024-06-16T01:00:00Z";

// Local calendar dates touched by [entry, exit) per battle-test zone, from the June 2024 offsets:
// only zones within an hour of UTC see both 15 and 16 June.
const calendarDaysByZone = {
  UTC: 2,
  GMT: 2,
  "Etc/GMT": 2,
  "America/Nome": 1,
  "Asia/Anadyr": 1,
  "Europe/Lisbon": 2,
  "Europe/Dublin": 2,
  "Europe/Berlin": 1,
  "Europe/Helsinki": 1,
  "Europe/Istanbul": 1,
  "Asia/Kolkata": 1,
  "Asia/Kathmandu": 1,
  "Asia/Shanghai": 1,
  "Australia/Lord_Howe": 1,
  "Pacific/Chatham": 1,
  "Pacific/Apia": 1,
  "Pacific/Niue": 1,
  "America/New_York": 1,
  "America/Chicago": 1,
  "America/Phoenix": 1,
} satisfies Record<keyof typeof MustTestDstTimeZones, number>;

describe("dwellTime", () => {
  it("returns the spec's own example: two hours, two local days", () => {
    expect(
      dwellTime(
        "2024-06-15T23:00:00-04:00[America/New_York]",
        "2024-06-16T01:00:00-04:00[America/New_York]",
      ),
    ).toEqual({
      duration: "PT2H",
      enter: "2024-06-15T23:00:00-04:00[America/New_York]",
      exit: "2024-06-16T01:00:00-04:00[America/New_York]",
      calendarDays: 2,
    });
  });

  it.each`
    entry                     | exit                        | targetZone            | duration     | enter                                            | exitLocal                                        | calendarDays
    ${"2024-06-15T08:00:00Z"} | ${"2024-06-15T17:30:00Z"}   | ${"Europe/Berlin"}    | ${"PT9H30M"} | ${"2024-06-15T10:00:00+02:00[Europe/Berlin]"}    | ${"2024-06-15T19:30:00+02:00[Europe/Berlin]"}    | ${1}
    ${"2024-06-15T22:30:00Z"} | ${"2024-06-16T01:00:00Z"}   | ${"Europe/London"}    | ${"PT2H30M"} | ${"2024-06-15T23:30:00+01:00[Europe/London]"}    | ${"2024-06-16T02:00:00+01:00[Europe/London]"}    | ${2}
    ${"2024-06-15T22:30:00Z"} | ${"2024-06-16T01:00:00Z"}   | ${"Europe/Amsterdam"} | ${"PT2H30M"} | ${"2024-06-16T00:30:00+02:00[Europe/Amsterdam]"} | ${"2024-06-16T03:00:00+02:00[Europe/Amsterdam]"} | ${1}
    ${"2024-06-10T12:00:00Z"} | ${"2024-06-15T12:00:00Z"}   | ${"UTC"}              | ${"PT120H"}  | ${"2024-06-10T12:00:00+00:00[UTC]"}              | ${"2024-06-15T12:00:00+00:00[UTC]"}              | ${6}
    ${"2024-06-15T10:00:00Z"} | ${"2024-06-15T10:00:00.5Z"} | ${"UTC"}              | ${"PT0.5S"}  | ${"2024-06-15T10:00:00+00:00[UTC]"}              | ${"2024-06-15T10:00:00.5+00:00[UTC]"}            | ${1}
    ${"2024-06-15T10:00:00Z"} | ${"2024-06-15T10:00:00Z"}   | ${"Asia/Tokyo"}       | ${"PT0S"}    | ${"2024-06-15T19:00:00+09:00[Asia/Tokyo]"}       | ${"2024-06-15T19:00:00+09:00[Asia/Tokyo]"}       | ${1}
    ${"2024-06-15T22:30:00Z"} | ${"2024-06-16T01:00:00Z"}   | ${"+02:00"}           | ${"PT2H30M"} | ${"2024-06-16T00:30:00+02:00[+02:00]"}           | ${"2024-06-16T03:00:00+02:00[+02:00]"}           | ${1}
    ${"2011-12-30T08:00:00Z"} | ${"2011-12-30T11:00:00Z"}   | ${"Pacific/Apia"}     | ${"PT3H"}    | ${"2011-12-29T22:00:00-10:00[Pacific/Apia]"}     | ${"2011-12-31T01:00:00+14:00[Pacific/Apia]"}     | ${2}
  `(
    "measures $duration over $calendarDays local day(s) in $targetZone",
    ({ entry, exit, targetZone, duration, enter, exitLocal, calendarDays }) => {
      expect(dwellTime(entry, exit, targetZone)).toEqual({
        duration,
        enter,
        exit: exitLocal,
        calendarDays,
      });
    },
  );

  // Half-open at the exit: leaving exactly at local midnight does not touch the new day, and
  // one nanosecond later does.
  it.each`
    exit                                | calendarDays | reason
    ${"2024-06-16T04:00:00Z"}           | ${1}         | ${"exit is exactly local midnight on the 16th"}
    ${"2024-06-16T04:00:00.000000001Z"} | ${2}         | ${"one nanosecond into the 16th"}
    ${"2024-06-16T03:59:59.999999999Z"} | ${1}         | ${"one nanosecond before midnight"}
  `(
    "counts $calendarDays day(s) when $reason (America/New_York)",
    ({ exit, calendarDays }) => {
      expect(
        dwellTime("2024-06-15T22:00:00Z", exit, "America/New_York")
          ?.calendarDays,
      ).toBe(calendarDays);
    },
  );

  // Exact elapsed time across the transitions, one local day each way.
  it.each`
    entry                     | exit                      | duration  | enter                                            | exitLocal                                        | transition
    ${"2024-03-10T05:00:00Z"} | ${"2024-03-10T12:00:00Z"} | ${"PT7H"} | ${"2024-03-10T00:00:00-05:00[America/New_York]"} | ${"2024-03-10T08:00:00-04:00[America/New_York]"} | ${"spring forward: midnight to 08:00 local is seven hours"}
    ${"2024-11-03T04:00:00Z"} | ${"2024-11-03T13:00:00Z"} | ${"PT9H"} | ${"2024-11-03T00:00:00-04:00[America/New_York]"} | ${"2024-11-03T08:00:00-05:00[America/New_York]"} | ${"fall back: midnight to 08:00 local is nine hours"}
  `(
    "reports exact elapsed time and one local day across the $transition",
    ({ entry, exit, duration, enter, exitLocal }) => {
      expect(dwellTime(entry, exit, "America/New_York")).toEqual({
        duration,
        enter,
        exit: exitLocal,
        calendarDays: 1,
      });
    },
  );

  it("counts a whole local day as one day even when it is 23 or 25 hours long", () => {
    // Local midnight to local midnight across each transition in New York.
    expect(
      dwellTime(
        "2024-03-10T05:00:00Z",
        "2024-03-11T04:00:00Z",
        "America/New_York",
      ),
    ).toMatchObject({ duration: "PT23H", calendarDays: 1 });
    expect(
      dwellTime(
        "2024-11-03T04:00:00Z",
        "2024-11-04T05:00:00Z",
        "America/New_York",
      ),
    ).toMatchObject({ duration: "PT25H", calendarDays: 1 });
  });

  // Probe-zone transitions (coding-standards § Calendar & zone semantics). Expected counts are the
  // distinct local date labels of [entry, exit), from tzdb's transition data: a deleted date is
  // never touched, and a date the clock falls back into again is counted once.
  it.each`
    entry                     | exit                                | targetZone               | calendarDays | reason
    ${"2011-12-30T08:00:00Z"} | ${"2011-12-30T11:00:00Z"}           | ${"Pacific/Apia"}        | ${2}         | ${"29th 22:00 -10:00 to 31st 01:00 +14:00: the 30th was deleted"}
    ${"2010-11-07T02:30:00Z"} | ${"2010-11-07T03:45:00Z"}           | ${"America/Goose_Bay"}   | ${2}         | ${"6th, the 7th's first minute, then the 6th again at 00:01 -03:00 -> 23:01 -04:00"}
    ${"2010-11-07T03:00:30Z"} | ${"2010-11-07T03:30:00Z"}           | ${"America/Goose_Bay"}   | ${2}         | ${"entry on the 7th at 00:00:30 -03:00, exit back on the 6th at 23:30 -04:00"}
    ${"2010-11-07T02:30:00Z"} | ${"2010-11-08T04:00:00Z"}           | ${"America/Goose_Bay"}   | ${2}         | ${"6th, 7th, 6th, 7th: two distinct dates, exit at the 8th's midnight"}
    ${"1844-12-30T12:00:00Z"} | ${"1845-01-01T12:00:00Z"}           | ${"Asia/Manila"}         | ${3}         | ${"29th, 30th, then 1 January: Manila deleted 1844-12-31 crossing the date line"}
    ${"2024-11-03T04:00:00Z"} | ${"2024-11-04T04:00:00Z"}           | ${"America/Havana"}      | ${1}         | ${"3rd 00:00 -04:00 to 23:00 -05:00: the repeated midnight stays on the 3rd"}
    ${"2024-11-03T03:30:00Z"} | ${"2024-11-03T06:00:00Z"}           | ${"America/Havana"}      | ${2}         | ${"2nd 23:30 -04:00 to 3rd 01:00 -05:00 across the repeated hour"}
    ${"2024-09-07T20:00:00Z"} | ${"2024-09-08T04:00:00Z"}           | ${"America/Santiago"}    | ${1}         | ${"exit 2024-09-08T01:00-03:00 is the 8th's first instant: midnight was skipped"}
    ${"2024-09-07T20:00:00Z"} | ${"2024-09-08T04:00:00.000000001Z"} | ${"America/Santiago"}    | ${2}         | ${"one nanosecond into the 8th after the skipped midnight"}
    ${"2020-10-03T12:00:00Z"} | ${"2020-10-03T17:00:00Z"}           | ${"Antarctica/Casey"}    | ${2}         | ${"3rd 20:00 +08:00 to 4th 04:00 +11:00 across the three-hour jump"}
    ${"2024-09-28T10:00:00Z"} | ${"2024-09-28T15:00:00Z"}           | ${"Pacific/Chatham"}     | ${2}         | ${"28th 22:45 +12:45 to 29th 04:45 +13:45 across the spring-forward"}
    ${"2024-04-06T10:00:00Z"} | ${"2024-04-06T15:00:00Z"}           | ${"Pacific/Chatham"}     | ${2}         | ${"6th 23:45 +13:45 to 7th 03:45 +12:45 across the fall-back"}
    ${"2024-04-06T13:00:00Z"} | ${"2024-04-06T16:00:00Z"}           | ${"Australia/Lord_Howe"} | ${1}         | ${"7th 00:00 +11:00 to 02:30 +10:30 through the half-hour fall-back"}
    ${"2024-10-05T13:00:00Z"} | ${"2024-10-05T16:00:00Z"}           | ${"Australia/Lord_Howe"} | ${2}         | ${"5th 23:30 +10:30 to 6th 03:00 +11:00 across the half-hour spring-forward"}
  `(
    "counts $calendarDays distinct local date(s) in $targetZone: $reason",
    ({ entry, exit, targetZone, calendarDays }) => {
      expect(dwellTime(entry, exit, targetZone)?.calendarDays).toBe(
        calendarDays,
      );
    },
  );

  it.each(battleTestTimeZones)(
    "counts the local dates touched in %s from the zone's own boundaries",
    (timeZone) => {
      const result = dwellTime(entry, exit, timeZone);
      const zone = timeZone as keyof typeof calendarDaysByZone;

      expect(result).not.toBeNull();
      expect(result?.calendarDays).toBe(calendarDaysByZone[zone]);
      expect(result?.duration).toBe("PT2H30M");
      expect(result?.enter).toBe(
        Temporal.Instant.from(entry).toZonedDateTimeISO(timeZone).toString(),
      );
      expect(result?.exit).toBe(
        Temporal.Instant.from(exit).toZonedDateTimeISO(timeZone).toString(),
      );
    },
  );

  it("takes the zone from a bracketed entry when no targetZone is given", () => {
    expect(
      dwellTime(
        "2024-06-15T23:30:00+01:00[Europe/London]",
        "2024-06-16T01:00:00Z",
      ),
    ).toMatchObject({
      calendarDays: 2,
      exit: "2024-06-16T02:00:00+01:00[Europe/London]",
    });
  });

  it.each`
    entry                                         | exit                                 | targetZone         | reason
    ${"2024-06-15T23:30:00+01:00[Europe/London]"} | ${"2024-06-16T01:00:00Z[Not/AZone]"} | ${undefined}       | ${"the exit's bracket is never read"}
    ${"2024-06-15T22:30:00Z[Not/AZone]"}          | ${"2024-06-16T01:00:00Z"}            | ${"Europe/London"} | ${"the entry's bracket is not read when targetZone is given"}
  `(
    "reads only the instant when $reason, as Temporal.Instant.from does",
    ({ entry, exit, targetZone }) => {
      expect(dwellTime(entry, exit, targetZone)).toMatchObject({
        calendarDays: 2,
        exit: "2024-06-16T02:00:00+01:00[Europe/London]",
      });
    },
  );

  it("lets targetZone override the entry's bracketed zone", () => {
    expect(
      dwellTime(
        "2024-06-15T23:30:00+01:00[Europe/London]",
        "2024-06-16T01:00:00Z",
        "Europe/Amsterdam",
      ),
    ).toMatchObject({
      calendarDays: 1,
      enter: "2024-06-16T00:30:00+02:00[Europe/Amsterdam]",
    });
  });

  it.each`
    entry                                            | exit                      | targetZone          | reason
    ${"2024-06-15T22:30:00Z"}                        | ${"2024-06-16T01:00:00Z"} | ${undefined}        | ${"bare instants and no zone: the day count has no locality"}
    ${"2024-06-15T22:30:00+00:00"}                   | ${"2024-06-16T01:00:00Z"} | ${undefined}        | ${"an offset is not a zone"}
    ${"2024-06-15T22:30:00Z[Not/AZone]"}             | ${"2024-06-16T01:00:00Z"} | ${undefined}        | ${"bracketed zone that does not exist"}
    ${"2024-06-15T22:30:00-04:00[America/New_York]"} | ${"2024-06-16T01:00:00Z"} | ${"Europe/Londres"} | ${"targetZone does not exist"}
    ${"2024-06-15T22:30:00Z"}                        | ${"2024-06-16T01:00:00Z"} | ${""}               | ${"empty targetZone"}
    ${"2024-06-16T01:00:00Z"}                        | ${"2024-06-15T22:30:00Z"} | ${"Europe/London"}  | ${"exit before entry"}
    ${"2024-06-15T22:30:00"}                         | ${"2024-06-16T01:00:00Z"} | ${"Europe/London"}  | ${"entry has no offset designator"}
    ${"2024-06-15T22:30:00Z"}                        | ${"2024-06-16T01:00:00"}  | ${"Europe/London"}  | ${"exit has no offset designator"}
    ${"2016-12-31T23:59:60Z"}                        | ${"2017-01-01T01:00:00Z"} | ${"Europe/London"}  | ${"leap second"}
    ${""}                                            | ${"2024-06-16T01:00:00Z"} | ${"Europe/London"}  | ${"empty entry"}
    ${"2024-06-15T22:30:00Z"}                        | ${"invalid"}              | ${"Europe/London"}  | ${"garbage exit"}
  `("returns the sentinel when $reason", ({ entry, exit, targetZone }) => {
    expect(dwellTime(entry, exit, targetZone)).toBeNull();
  });

  // Temporal's last instant, +275760-09-13T00:00:00Z (TC39 nsMaxInstant), is 10:00 +10:00 in
  // Sydney; the zone comes from the bracket, so the zoned parse must work at the limit.
  it.each`
    entry                                                         | exit                                                          | expected
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}           | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}           | ${{ duration: "PT0S", enter: "+275760-09-13T10:00:00+10:00[Australia/Sydney]", exit: "+275760-09-13T10:00:00+10:00[Australia/Sydney]", calendarDays: 1 }}
    ${"+275760-09-12T23:30:00+10:00[Australia/Sydney]"}           | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}           | ${{ duration: "PT10H30M", enter: "+275760-09-12T23:30:00+10:00[Australia/Sydney]", exit: "+275760-09-13T10:00:00+10:00[Australia/Sydney]", calendarDays: 2 }}
    ${"+275760-09-13T10:00:00.000000001+10:00[Australia/Sydney]"} | ${"+275760-09-13T10:00:00.000000001+10:00[Australia/Sydney]"} | ${null}
    ${"+275760-09-13T09:00:00+10:00[Australia/Sydney]"}           | ${"+275760-09-13T10:00:00.000000001+10:00[Australia/Sydney]"} | ${null}
  `(
    "measures $entry to $exit at the range maximum",
    ({ entry, exit, expected }) => {
      expect(dwellTime(entry, exit)).toEqual(expected);
    },
  );

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(dwellTime(entry, exit, "Europe/London")).toBeNull();
  });
});
