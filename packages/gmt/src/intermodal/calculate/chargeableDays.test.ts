import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { dwellTime } from "../../transport/calculate/dwellTime";
import { chargeableDays } from "./chargeableDays";
import { hostileProxy, revokedProxy } from "../../test/noThrow";

/** A Friday afternoon discharge in New York: 15:00 EDT on 14 June 2024. Free time ends Monday 00:00. */
const friday = "2024-06-14T19:00:00Z";
const expiry = "2024-06-17T04:00:00Z";
const calendar = {
  basis: "calendar",
  chargeBasis: "calendar",
  timeZone: "America/New_York",
  firstDay: "eventDay",
} as const;
const weekdays = {
  weekend: [6, 7],
  holidays: [],
  timeZone: "America/New_York",
};
const working = { ...calendar, basis: "working", calendar: weekdays } as const;
const openBand = (days: number) => [{ from: 1, to: null, days }];

/** Sparse tier lists: `Array.prototype.every` skips a hole, so these must be rejected explicitly. */
const trailingHole: number[] = [5];
trailingHole.length = 2;
const leadingHole: number[] = [];
leadingHole[1] = 5;

/** An options bag whose `key` getter throws: the harness cannot see a hostile member. */
function throwingMember<T extends object>(base: T, key: string): T {
  return Object.defineProperty({ ...base }, key, {
    enumerable: true,
    get(): never {
      throw new Error(`hostile ${key}`);
    },
  }) as T;
}

describe("chargeableDays", () => {
  it("returns the spec's own example: twelve chargeable days in bands of 5, 5 and 2", () => {
    expect(
      chargeableDays(friday, "2024-06-28T15:00:00Z", 3, {
        ...calendar,
        tiers: [5, 10],
      }),
    ).toEqual({
      freeDaysUsed: 3,
      chargeableDays: 12,
      expiresAt: expiry,
      chargedDates: [
        "2024-06-17",
        "2024-06-18",
        "2024-06-19",
        "2024-06-20",
        "2024-06-21",
        "2024-06-22",
        "2024-06-23",
        "2024-06-24",
        "2024-06-25",
        "2024-06-26",
        "2024-06-27",
        "2024-06-28",
      ],
      byTier: [
        { from: 1, to: 5, days: 5 },
        { from: 6, to: 10, days: 5 },
        { from: 11, to: null, days: 2 },
      ],
    });
  });

  // Half-open at the exit: leaving exactly when free time ends is free, and any later instant
  // starts the first charged day.
  it.each`
    clockEnd                            | chargeableDays | chargedDates      | reason
    ${"2024-06-17T04:00:00Z"}           | ${0}           | ${[]}             | ${"exactly at expiresAt"}
    ${"2024-06-17T03:59:59.999999999Z"} | ${0}           | ${[]}             | ${"one nanosecond before expiresAt"}
    ${"2024-06-17T04:00:00.000000001Z"} | ${1}           | ${["2024-06-17"]} | ${"one nanosecond after expiresAt"}
    ${"2024-06-17T04:00:01Z"}           | ${1}           | ${["2024-06-17"]} | ${"one second after expiresAt"}
    ${"2024-06-18T04:00:00Z"}           | ${1}           | ${["2024-06-17"]} | ${"exactly at the next local midnight"}
  `(
    "charges $chargeableDays day(s) for a gate-out $reason",
    ({ clockEnd, chargeableDays: charged, chargedDates }) => {
      expect(chargeableDays(friday, clockEnd, 3, calendar)).toEqual({
        freeDaysUsed: 3,
        chargeableDays: charged,
        expiresAt: expiry,
        chargedDates,
        byTier: openBand(charged),
      });
    },
  );

  // Free days are used as the dwell touches them; a zero-length dwell touches its own day.
  it.each`
    clockStart                | clockEnd                  | freeDaysUsed | reason
    ${friday}                 | ${friday}                 | ${1}         | ${"a zero-length dwell on the event day"}
    ${friday}                 | ${"2024-06-15T15:00:00Z"} | ${2}         | ${"out on the second free day"}
    ${friday}                 | ${"2024-06-16T04:00:00Z"} | ${2}         | ${"out exactly at the start of the third"}
    ${friday}                 | ${"2024-06-16T04:00:01Z"} | ${3}         | ${"out one second into the third"}
    ${"2024-06-14T04:00:00Z"} | ${"2024-06-14T04:00:00Z"} | ${1}         | ${"a zero-length dwell exactly at local midnight"}
  `(
    "reports $freeDaysUsed free day(s) used for $reason",
    ({ clockStart, clockEnd, freeDaysUsed }) => {
      expect(chargeableDays(clockStart, clockEnd, 3, calendar)).toEqual({
        freeDaysUsed,
        chargeableDays: 0,
        expiresAt: expiry,
        chargedDates: [],
        byTier: openBand(0),
      });
    },
  );

  it("reads the other start-day convention: a Monday-morning gate-out is still free under nextDay", () => {
    expect(
      chargeableDays(friday, "2024-06-17T04:00:01Z", 3, {
        ...calendar,
        firstDay: "nextDay",
      }),
    ).toEqual({
      freeDaysUsed: 3,
      chargeableDays: 0,
      expiresAt: "2024-06-18T04:00:00Z",
      chargedDates: [],
      byTier: openBand(0),
    });
  });

  // Free days and charged days are counted on their own terms. Outside the US both are mostly
  // calendar days; the usual US shape is working-day free time with every calendar day charged
  // after it (Hapag-Lloyd US, ACL, CMA CGM US); California law and some tariffs charge working days only (Cal. Bus. & Prof. Code 22928).
  // Discharged Friday 14 June, three free days, terminal shut on Juneteenth (Wednesday 19 June).
  it.each`
    basis         | chargeBasis   | expiresAt                 | chargedDates                                                                                                        | shape
    ${"working"}  | ${"calendar"} | ${"2024-06-19T04:00:00Z"} | ${["2024-06-19", "2024-06-20", "2024-06-21", "2024-06-22", "2024-06-23", "2024-06-24"]}                             | ${"working-day free time, calendar-day charges: the holiday and the weekend are billed"}
    ${"working"}  | ${"working"}  | ${"2024-06-19T04:00:00Z"} | ${["2024-06-20", "2024-06-21", "2024-06-24"]}                                                                       | ${"working days throughout: the clock is suspended on closed days"}
    ${"calendar"} | ${"working"}  | ${"2024-06-17T04:00:00Z"} | ${["2024-06-17", "2024-06-18", "2024-06-20", "2024-06-21", "2024-06-24"]}                                           | ${"calendar-day free time, working-day charges"}
    ${"calendar"} | ${"calendar"} | ${"2024-06-17T04:00:00Z"} | ${["2024-06-17", "2024-06-18", "2024-06-19", "2024-06-20", "2024-06-21", "2024-06-22", "2024-06-23", "2024-06-24"]} | ${"calendar days throughout"}
  `("counts $shape", ({ basis, chargeBasis, expiresAt, chargedDates }) => {
    expect(
      chargeableDays(friday, "2024-06-24T15:00:00Z", 3, {
        ...calendar,
        basis,
        chargeBasis,
        calendar: { ...weekdays, holidays: ["2024-06-19"] },
      }),
    ).toEqual({
      freeDaysUsed: 3,
      chargeableDays: chargedDates.length,
      expiresAt,
      chargedDates,
      byTier: openBand(chargedDates.length),
    });
  });

  // Free time that ends at Saturday 00:00 on a working-day tariff: the weekend after expiry is
  // billed on calendar-day charging and not on working-day charging.
  it.each`
    chargeBasis   | chargedDates
    ${"calendar"} | ${["2024-06-15", "2024-06-16"]}
    ${"working"}  | ${[]}
  `(
    "charges $chargedDates for a weekend after expiry under $chargeBasis charging",
    ({ chargeBasis, chargedDates }) => {
      expect(
        chargeableDays("2024-06-12T19:00:00Z", "2024-06-16T20:00:00Z", 3, {
          ...working,
          chargeBasis,
        }),
      ).toMatchObject({ expiresAt: "2024-06-15T04:00:00Z", chargedDates });
    },
  );

  it("accepts a tariff with no free time: every day is charged from day one", () => {
    expect(chargeableDays(friday, "2024-06-16T15:00:00Z", 0, calendar)).toEqual(
      {
        freeDaysUsed: 0,
        chargeableDays: 3,
        expiresAt: "2024-06-14T04:00:00Z",
        chargedDates: ["2024-06-14", "2024-06-15", "2024-06-16"],
        byTier: openBand(3),
      },
    );
    expect(
      chargeableDays(friday, "2024-06-16T15:00:00Z", 0, {
        ...calendar,
        firstDay: "nextDay",
      }),
    ).toMatchObject({
      expiresAt: "2024-06-15T04:00:00Z",
      chargedDates: ["2024-06-15", "2024-06-16"],
    });
  });

  // Tiers are bands of chargeable-day ordinals; every band is listed and the last is open.
  it.each`
    tiers        | clockEnd                  | byTier
    ${undefined} | ${"2024-06-28T15:00:00Z"} | ${[{ from: 1, to: null, days: 12 }]}
    ${[]}        | ${"2024-06-28T15:00:00Z"} | ${[{ from: 1, to: null, days: 12 }]}
    ${[5, 10]}   | ${"2024-06-28T15:00:00Z"} | ${[{ from: 1, to: 5, days: 5 }, { from: 6, to: 10, days: 5 }, { from: 11, to: null, days: 2 }]}
    ${[5, 10]}   | ${"2024-06-26T15:00:00Z"} | ${[{ from: 1, to: 5, days: 5 }, { from: 6, to: 10, days: 5 }, { from: 11, to: null, days: 0 }]}
    ${[2, 20]}   | ${"2024-06-17T15:00:00Z"} | ${[{ from: 1, to: 2, days: 1 }, { from: 3, to: 20, days: 0 }, { from: 21, to: null, days: 0 }]}
    ${[1]}       | ${"2024-06-17T04:00:00Z"} | ${[{ from: 1, to: 1, days: 0 }, { from: 2, to: null, days: 0 }]}
  `(
    "splits the charged days into the bands $tiers describe",
    ({ tiers, clockEnd, byTier }) => {
      expect(
        chargeableDays(friday, clockEnd, 3, { ...calendar, tiers })?.byTier,
      ).toEqual(byTier);
    },
  );

  // Probe-zone transitions: a charged date is a real local date, listed once.
  it.each`
    clockStart                | clockEnd                  | timeZone                 | expiresAt                 | chargedDates                                                | transition
    ${"2011-12-28T10:00:00Z"} | ${"2012-01-02T10:00:00Z"} | ${"Pacific/Apia"}        | ${"2011-12-29T10:00:00Z"} | ${["2011-12-29", "2011-12-31", "2012-01-01", "2012-01-02"]} | ${"the deleted 30th is never charged"}
    ${"2010-11-05T12:00:00Z"} | ${"2010-11-09T12:00:00Z"} | ${"America/Goose_Bay"}   | ${"2010-11-06T03:00:00Z"} | ${["2010-11-06", "2010-11-07", "2010-11-08", "2010-11-09"]} | ${"the re-entered 6th and the twice-started 7th are one day each"}
    ${"2024-11-01T12:00:00Z"} | ${"2024-11-05T12:00:00Z"} | ${"America/New_York"}    | ${"2024-11-02T04:00:00Z"} | ${["2024-11-02", "2024-11-03", "2024-11-04", "2024-11-05"]} | ${"the 25-hour 3rd is one charged day"}
    ${"2024-11-01T12:00:00Z"} | ${"2024-11-05T12:00:00Z"} | ${"America/Havana"}      | ${"2024-11-02T04:00:00Z"} | ${["2024-11-02", "2024-11-03", "2024-11-04", "2024-11-05"]} | ${"a repeated midnight is one charged day"}
    ${"2024-09-07T15:00:00Z"} | ${"2024-09-09T15:00:00Z"} | ${"America/Santiago"}    | ${"2024-09-08T04:00:00Z"} | ${["2024-09-08", "2024-09-09"]}                             | ${"the 8th starts at 01:00 and is charged"}
    ${"2010-11-07T03:00:30Z"} | ${"2010-11-09T12:00:00Z"} | ${"America/Goose_Bay"}   | ${"2010-11-08T04:00:00Z"} | ${["2010-11-08", "2010-11-09"]}                             | ${"a clock starting in the first pass of the 7th never charges the re-entered 6th"}
    ${"1844-12-30T12:00:00Z"} | ${"1845-01-01T12:00:00Z"} | ${"Asia/Manila"}         | ${"1844-12-30T15:56:08Z"} | ${["1844-12-30", "1845-01-01"]}                             | ${"the 31st was deleted crossing the date line"}
    ${"2024-04-06T12:00:00Z"} | ${"2024-04-09T12:00:00Z"} | ${"Australia/Lord_Howe"} | ${"2024-04-06T13:00:00Z"} | ${["2024-04-07", "2024-04-08", "2024-04-09"]}               | ${"the 30-minute fall-back day is one charged day"}
    ${"2020-10-03T12:00:00Z"} | ${"2020-10-06T12:00:00Z"} | ${"Antarctica/Casey"}    | ${"2020-10-03T16:00:00Z"} | ${["2020-10-04", "2020-10-05", "2020-10-06"]}               | ${"the three-hour jump on the 4th is one charged day"}
  `(
    "charges real local dates in $timeZone where $transition",
    ({ clockStart, clockEnd, timeZone, expiresAt, chargedDates }) => {
      expect(
        chargeableDays(clockStart, clockEnd, 1, { ...calendar, timeZone }),
      ).toEqual({
        freeDaysUsed: 1,
        chargeableDays: chargedDates.length,
        expiresAt,
        chargedDates,
        byTier: openBand(chargedDates.length),
      });
    },
  );

  it("lists charged dates ascending from a start in Goose Bay's first pass of the 7th, with no free days too", () => {
    const goose = { ...calendar, timeZone: "America/Goose_Bay" };
    expect(
      chargeableDays("2010-11-07T03:00:30Z", "2010-11-09T12:00:00Z", 0, goose),
    ).toMatchObject({
      expiresAt: "2010-11-07T03:00:00Z",
      chargedDates: ["2010-11-07", "2010-11-08", "2010-11-09"],
    });
    // The one place the dwellTime invariant does not hold: dwellTime counts the re-entered 6th
    // as a date the dwell touched (4), while a tariff never counts a date before the event day.
    expect(
      dwellTime(
        "2010-11-07T03:00:30Z",
        "2010-11-09T12:00:00Z",
        "America/Goose_Bay",
      )?.calendarDays,
    ).toBe(4);
    const charges = chargeableDays(
      "2010-11-07T03:00:30Z",
      "2010-11-09T12:00:00Z",
      1,
      goose,
    )!;
    expect(charges.freeDaysUsed + charges.chargeableDays).toBe(3);
  });

  // Temporal's last instant is +275760-09-13T00:00:00Z: a free day ending there is representable,
  // a second one is not.
  it.each`
    freeDays | expected
    ${1}     | ${{ freeDaysUsed: 1, chargeableDays: 0, expiresAt: "+275760-09-13T00:00:00Z", chargedDates: [], byTier: [{ from: 1, to: null, days: 0 }] }}
    ${2}     | ${null}
  `(
    "handles $freeDays free day(s) at the range maximum",
    ({ freeDays, expected }) => {
      expect(
        chargeableDays(
          "+275760-09-12T23:00:00Z",
          "+275760-09-13T00:00:00Z",
          freeDays,
          { ...calendar, timeZone: "UTC" },
        ),
      ).toEqual(expected);
    },
  );

  // From Temporal's first instant: west of UTC the event day began before the range, and the
  // count still agrees with dwellTime in every zone.
  it.each`
    timeZone              | expiresAt                    | chargedDates
    ${"Etc/GMT+12"}       | ${"-271821-04-20T12:00:00Z"} | ${["-271821-04-20", "-271821-04-21"]}
    ${"America/New_York"} | ${"-271821-04-20T04:56:02Z"} | ${["-271821-04-20", "-271821-04-21"]}
    ${"Etc/GMT-14"}       | ${"-271821-04-20T10:00:00Z"} | ${["-271821-04-21", "-271821-04-22"]}
  `(
    "charges from the range minimum in $timeZone",
    ({ timeZone, expiresAt, chargedDates }) => {
      const start = "-271821-04-20T00:00:00Z";
      const end = "-271821-04-22T00:00:00Z";
      expect(chargeableDays(start, end, 1, { ...calendar, timeZone })).toEqual({
        freeDaysUsed: 1,
        chargeableDays: 2,
        expiresAt,
        chargedDates,
        byTier: openBand(2),
      });
      expect(dwellTime(start, end, timeZone)?.calendarDays).toBe(3);
    },
  );

  it("refuses an expiry that would be a day start before the range, and only that", () => {
    const start = "-271821-04-20T00:00:00Z";
    const end = "-271821-04-22T00:00:00Z";
    const west = { ...calendar, timeZone: "Etc/GMT+12" };
    // No free time: the expiry would be the event day's start, which Temporal cannot represent.
    expect(chargeableDays(start, end, 0, west)).toBeNull();
    // Under nextDay the expiry is the next day's start, which it can.
    expect(
      chargeableDays(start, end, 0, { ...west, firstDay: "nextDay" }),
    ).toEqual({
      freeDaysUsed: 0,
      chargeableDays: 2,
      expiresAt: "-271821-04-20T12:00:00Z",
      chargedDates: ["-271821-04-20", "-271821-04-21"],
      byTier: openBand(2),
    });
  });

  // No free time on a working-day tariff: day one is the first working day, and the days before
  // it are neither free nor charged, under either convention (a Saturday discharge).
  it.each`
    firstDay
    ${"eventDay"}
    ${"nextDay"}
  `(
    "starts charging a Saturday discharge with no free time on Monday under $firstDay",
    ({ firstDay }) => {
      expect(
        chargeableDays("2024-06-15T14:00:00Z", "2024-06-18T15:00:00Z", 0, {
          ...working,
          firstDay,
        }),
      ).toEqual({
        freeDaysUsed: 0,
        chargeableDays: 2,
        expiresAt: "2024-06-17T04:00:00Z",
        chargedDates: ["2024-06-17", "2024-06-18"],
        byTier: openBand(2),
      });
    },
  );
  // On the calendar basis with the event day counted, free days used plus days charged is
  // exactly dwellTime's local-day count: the two never disagree about a midnight.
  it.each(battleTestTimeZones.map((timeZone) => [timeZone]))(
    "agrees with dwellTime's calendarDays in %s",
    (timeZone) => {
      for (const clockEnd of [
        friday,
        "2024-06-15T15:00:00Z",
        "2024-06-17T04:00:00Z",
        "2024-06-17T04:00:01Z",
        "2024-06-28T15:00:00Z",
      ]) {
        const charges = chargeableDays(friday, clockEnd, 3, {
          ...calendar,
          timeZone,
        });
        const dwell = dwellTime(friday, clockEnd, timeZone);
        expect(charges!.freeDaysUsed + charges!.chargeableDays).toBe(
          dwell!.calendarDays,
        );
        expect(charges!.chargedDates).toHaveLength(charges!.chargeableDays);
      }
    },
  );

  it("walks a decades-long dwell but gives up past 10,000 local days", () => {
    // 2000-01-01 to 2020-01-01 touches 7,305 dates: one free, the rest charged.
    expect(
      chargeableDays("2000-01-01T00:00:00Z", "2020-01-01T00:00:00Z", 1, {
        ...calendar,
        timeZone: "UTC",
      }),
    ).toMatchObject({ freeDaysUsed: 1, chargeableDays: 7304 });
    expect(
      chargeableDays("2000-01-01T00:00:00Z", "2030-01-01T00:00:00Z", 1, {
        ...calendar,
        timeZone: "UTC",
      }),
    ).toBeNull();
  });

  it.each`
    clockStart               | clockEnd                 | freeDays   | options                                                                         | reason
    ${123}                   | ${expiry}                | ${3}       | ${calendar}                                                                     | ${"non-string clock start"}
    ${friday}                | ${undefined}             | ${3}       | ${calendar}                                                                     | ${"non-string clock end"}
    ${"2024-06-14T19:00:00"} | ${expiry}                | ${3}       | ${calendar}                                                                     | ${"clock start has no offset designator"}
    ${friday}                | ${"2024-06-17T04:00:00"} | ${3}       | ${calendar}                                                                     | ${"clock end has no offset designator"}
    ${expiry}                | ${friday}                | ${3}       | ${calendar}                                                                     | ${"exit before the clock started"}
    ${friday}                | ${expiry}                | ${-1}      | ${calendar}                                                                     | ${"negative free days"}
    ${friday}                | ${expiry}                | ${1.5}     | ${calendar}                                                                     | ${"fractional free days"}
    ${friday}                | ${expiry}                | ${3}       | ${undefined}                                                                    | ${"no options"}
    ${friday}                | ${expiry}                | ${3}       | ${null}                                                                         | ${"null options"}
    ${friday}                | ${expiry}                | ${3}       | ${{ basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York" }} | ${"firstDay has no default"}
    ${friday}                | ${expiry}                | ${3}       | ${{ basis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }}    | ${"chargeBasis has no default"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, chargeBasis: "weekdays" }}                                     | ${"unknown chargeBasis"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, chargeBasis: "working" }}                                      | ${"working charge basis without a calendar"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, basis: "working" }}                                            | ${"working basis without a calendar"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, timeZone: "America/Nueva_York" }}                              | ${"invalid timeZone"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, tiers: [10, 5] }}                                              | ${"tiers not ascending"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, tiers: [5, 5] }}                                               | ${"duplicate tier"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, tiers: [0, 5] }}                                               | ${"a tier below day one"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, tiers: [2.5] }}                                                | ${"fractional tier"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, tiers: "5,10" }}                                               | ${"tiers not an array"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, tiers: [null] }}                                               | ${"a non-numeric tier"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, tiers: trailingHole }}                                         | ${"a trailing hole in the tiers"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, tiers: leadingHole }}                                          | ${"a leading hole in the tiers"}
    ${friday}                | ${expiry}                | ${3}       | ${{ ...calendar, tiers: [2 ** 53] }}                                            | ${"a tier past the safe integer range"}
    ${friday}                | ${expiry}                | ${2 ** 53} | ${calendar}                                                                     | ${"free days past the safe integer range"}
  `(
    "returns the sentinel for $reason",
    ({ clockStart, clockEnd, freeDays, options }) => {
      expect(
        chargeableDays(clockStart, clockEnd, freeDays, options),
      ).toBeNull();
    },
  );

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(chargeableDays(friday, expiry, 3, calendar)).toBeNull();
  });

  // Core Rule 3: a value hostile to every access returns the sentinel, never throws (PR #281).
  it.each([
    ["a Proxy that throws on any trap", () => hostileProxy()],
    ["a revoked Proxy", () => revokedProxy()],
    [
      "a throwing chargeBasis getter",
      () => throwingMember(calendar, "chargeBasis"),
    ],
    [
      "a throwing tiers getter",
      () => throwingMember({ ...calendar, tiers: [5] }, "tiers"),
    ],
    ["a tiers Proxy", () => ({ ...calendar, tiers: hostileProxy() })],
    ["a calendar Proxy", () => ({ ...working, calendar: revokedProxy() })],
  ])("returns the sentinel for options that are %s", (_label, make) => {
    expect(() =>
      chargeableDays(friday, expiry, 3, make() as never),
    ).not.toThrow();
    expect(chargeableDays(friday, expiry, 3, make() as never)).toBeNull();
  });
});
