import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { freeTimeExpiry } from "./freeTimeExpiry";

/** A Friday afternoon discharge in New York: 15:00 EDT on 14 June 2024. */
const friday = "2024-06-14T19:00:00Z";
const calendar = {
  basis: "calendar",
  timeZone: "America/New_York",
  firstDay: "eventDay",
} as const;
const weekdays = {
  weekend: [6, 7],
  holidays: [],
  timeZone: "America/New_York",
};
const working = { ...calendar, basis: "working", calendar: weekdays } as const;

describe("freeTimeExpiry", () => {
  it("returns the spec's own example: a Friday discharge with three calendar days consumes the weekend", () => {
    expect(freeTimeExpiry(friday, 3, calendar)).toEqual({
      freeTimeStart: "2024-06-14",
      lastFreeDay: "2024-06-16",
      expiresAt: "2024-06-17T04:00:00Z",
    });
  });

  // The four term combinations on the same discharge. Working days skip the weekend; the start
  // day convention moves the whole window by one counted day.
  it.each`
    basis         | firstDay      | freeTimeStart   | lastFreeDay     | expiresAt                 | reads
    ${"calendar"} | ${"eventDay"} | ${"2024-06-14"} | ${"2024-06-16"} | ${"2024-06-17T04:00:00Z"} | ${"Friday, Saturday, Sunday"}
    ${"calendar"} | ${"nextDay"}  | ${"2024-06-15"} | ${"2024-06-17"} | ${"2024-06-18T04:00:00Z"} | ${"Saturday, Sunday, Monday"}
    ${"working"}  | ${"eventDay"} | ${"2024-06-14"} | ${"2024-06-18"} | ${"2024-06-19T04:00:00Z"} | ${"Friday, Monday, Tuesday"}
    ${"working"}  | ${"nextDay"}  | ${"2024-06-17"} | ${"2024-06-19"} | ${"2024-06-20T04:00:00Z"} | ${"Monday, Tuesday, Wednesday"}
  `(
    "counts $reads for basis $basis and firstDay $firstDay",
    ({ basis, firstDay, freeTimeStart, lastFreeDay, expiresAt }) => {
      expect(
        freeTimeExpiry(friday, 3, { ...working, basis, firstDay }),
      ).toEqual({ freeTimeStart, lastFreeDay, expiresAt });
    },
  );

  it("differs by exactly one local day between the two start-day conventions", () => {
    const eventDay = freeTimeExpiry(friday, 3, calendar);
    const nextDay = freeTimeExpiry(friday, 3, {
      ...calendar,
      firstDay: "nextDay",
    });
    expect(
      Temporal.Instant.from(eventDay!.expiresAt)
        .until(Temporal.Instant.from(nextDay!.expiresAt), {
          largestUnit: "hours",
        })
        .toString(),
    ).toBe("PT24H");
    expect(
      Temporal.PlainDate.from(eventDay!.lastFreeDay).until(
        Temporal.PlainDate.from(nextDay!.lastFreeDay),
      ).days,
    ).toBe(1);
  });

  it("moves a working-day expiry by one day for a terminal holiday, and a calendar-day expiry not at all", () => {
    const holiday = { ...weekdays, holidays: ["2024-06-17"] };
    expect(
      freeTimeExpiry(friday, 3, { ...working, calendar: holiday }),
    ).toEqual({
      freeTimeStart: "2024-06-14",
      lastFreeDay: "2024-06-19",
      expiresAt: "2024-06-20T04:00:00Z",
    });
    expect(
      freeTimeExpiry(friday, 3, { ...calendar, calendar: holiday }),
    ).toEqual(freeTimeExpiry(friday, 3, calendar));
  });

  // A Saturday discharge on the working basis: the event day does not count, so free time starts
  // Monday under either convention.
  it.each`
    firstDay
    ${"eventDay"}
    ${"nextDay"}
  `(
    "starts a Saturday discharge's working-day free time on Monday under $firstDay",
    ({ firstDay }) => {
      expect(
        freeTimeExpiry("2024-06-15T14:00:00Z", 2, { ...working, firstDay }),
      ).toEqual({
        freeTimeStart: "2024-06-17",
        lastFreeDay: "2024-06-18",
        expiresAt: "2024-06-19T04:00:00Z",
      });
    },
  );

  // The event day is the local date in the counting zone, to the nanosecond.
  it.each`
    clockStart                          | freeTimeStart   | expiresAt                 | reason
    ${"2024-06-15T03:00:00Z"}           | ${"2024-06-14"} | ${"2024-06-15T04:00:00Z"} | ${"23:00 local on the 14th: the free day is over an hour later"}
    ${"2024-06-15T03:59:59.999999999Z"} | ${"2024-06-14"} | ${"2024-06-15T04:00:00Z"} | ${"one nanosecond before local midnight"}
    ${"2024-06-15T04:00:00Z"}           | ${"2024-06-15"} | ${"2024-06-16T04:00:00Z"} | ${"exactly local midnight"}
  `(
    "takes the event day from the local date when discharged at $reason",
    ({ clockStart, freeTimeStart, expiresAt }) => {
      expect(freeTimeExpiry(clockStart, 1, calendar)).toEqual({
        freeTimeStart,
        lastFreeDay: freeTimeStart,
        expiresAt,
      });
    },
  );

  // Probe-zone transitions (coding-standards § Calendar & zone semantics): the expiry is the real
  // first instant of the next local date, and a date is counted once whatever the clock did.
  it.each`
    clockStart                | freeDays | timeZone                 | freeTimeStart   | lastFreeDay     | expiresAt                 | transition
    ${"2024-09-07T15:00:00Z"} | ${1}     | ${"America/Santiago"}    | ${"2024-09-07"} | ${"2024-09-07"} | ${"2024-09-08T04:00:00Z"} | ${"the 8th's midnight is skipped, so the day starts at 01:00"}
    ${"2011-12-29T10:00:00Z"} | ${2}     | ${"Pacific/Apia"}        | ${"2011-12-29"} | ${"2011-12-31"} | ${"2011-12-31T10:00:00Z"} | ${"the 30th was deleted and is never a free day"}
    ${"2010-11-06T12:00:00Z"} | ${1}     | ${"America/Goose_Bay"}   | ${"2010-11-06"} | ${"2010-11-06"} | ${"2010-11-07T03:00:00Z"} | ${"the 7th starts at 00:00 -03:00 before falling back into the 6th"}
    ${"2024-11-02T12:00:00Z"} | ${2}     | ${"America/New_York"}    | ${"2024-11-02"} | ${"2024-11-03"} | ${"2024-11-04T05:00:00Z"} | ${"the 25-hour fall-back day is one day"}
    ${"2024-11-02T12:00:00Z"} | ${2}     | ${"America/Havana"}      | ${"2024-11-02"} | ${"2024-11-03"} | ${"2024-11-04T05:00:00Z"} | ${"a repeated midnight on the same date is one day"}
    ${"2024-09-28T12:00:00Z"} | ${1}     | ${"Pacific/Chatham"}     | ${"2024-09-29"} | ${"2024-09-29"} | ${"2024-09-29T10:15:00Z"} | ${"a +12:45 spring-forward day ends at 00:00 +13:45"}
    ${"2010-11-07T03:00:30Z"} | ${1}     | ${"America/Goose_Bay"}   | ${"2010-11-07"} | ${"2010-11-07"} | ${"2010-11-08T04:00:00Z"} | ${"the clock starts in the one-minute first pass of the 7th: the re-entered 6th is never a free day"}
    ${"2010-11-07T03:00:30Z"} | ${2}     | ${"America/Goose_Bay"}   | ${"2010-11-07"} | ${"2010-11-08"} | ${"2010-11-09T04:00:00Z"} | ${"the same start with two free days runs forward, not back into the 6th"}
    ${"1844-12-30T12:00:00Z"} | ${1}     | ${"Asia/Manila"}         | ${"1844-12-29"} | ${"1844-12-29"} | ${"1844-12-30T15:56:08Z"} | ${"the date line crossing before the polyfill's transition search floor"}
    ${"2024-04-06T12:00:00Z"} | ${2}     | ${"Australia/Lord_Howe"} | ${"2024-04-06"} | ${"2024-04-07"} | ${"2024-04-07T13:30:00Z"} | ${"a 30-minute fall-back day is one day"}
    ${"2020-10-03T12:00:00Z"} | ${2}     | ${"Antarctica/Casey"}    | ${"2020-10-03"} | ${"2020-10-04"} | ${"2020-10-04T13:00:00Z"} | ${"a three-hour jump on the 4th is one day"}
    ${"2024-06-14T19:00:00Z"} | ${1}     | ${"+02:00"}              | ${"2024-06-14"} | ${"2024-06-14"} | ${"2024-06-14T22:00:00Z"} | ${"a fixed offset counts days with no DST"}
  `(
    "finds the real day boundary in $timeZone where $transition",
    ({
      clockStart,
      freeDays,
      timeZone,
      freeTimeStart,
      lastFreeDay,
      expiresAt,
    }) => {
      expect(
        freeTimeExpiry(clockStart, freeDays, { ...calendar, timeZone }),
      ).toEqual({
        freeTimeStart,
        lastFreeDay,
        expiresAt,
      });
    },
  );

  it("never starts free time on the day before the event: nextDay in Goose Bay's first pass of the 7th", () => {
    expect(
      freeTimeExpiry("2010-11-07T03:00:30Z", 1, {
        basis: "calendar",
        timeZone: "America/Goose_Bay",
        firstDay: "nextDay",
      }),
    ).toEqual({
      freeTimeStart: "2010-11-08",
      lastFreeDay: "2010-11-08",
      expiresAt: "2010-11-09T04:00:00Z",
    });
  });

  it("counts working days against the calendar's own weekend (Friday–Saturday in Riyadh)", () => {
    expect(
      freeTimeExpiry("2024-07-04T10:00:00Z", 2, {
        basis: "working",
        timeZone: "Asia/Riyadh",
        firstDay: "eventDay",
        calendar: { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" },
      }),
    ).toEqual({
      freeTimeStart: "2024-07-04",
      lastFreeDay: "2024-07-07",
      expiresAt: "2024-07-07T21:00:00Z",
    });
  });

  it("does not read the calendar's timeZone: the options' zone counts the days", () => {
    expect(
      freeTimeExpiry(friday, 3, {
        ...working,
        calendar: { ...weekdays, timeZone: "Asia/Tokyo" },
      }),
    ).toEqual(freeTimeExpiry(friday, 3, working));
  });

  // Across the battle-test zones the expiry is exactly the polyfill's start of the local day
  // three dates after the event date, and the window is the event date and the two after it.
  it.each(battleTestTimeZones.map((timeZone) => [timeZone]))(
    "lays free time out on %s's local dates",
    (timeZone) => {
      const event = Temporal.Instant.from(friday)
        .toZonedDateTimeISO(timeZone)
        .toPlainDate();
      expect(freeTimeExpiry(friday, 3, { ...calendar, timeZone })).toEqual({
        freeTimeStart: event.toString(),
        lastFreeDay: event.add({ days: 2 }).toString(),
        expiresAt: event
          .add({ days: 3 })
          .toZonedDateTime(timeZone)
          .toInstant()
          .toString(),
      });
    },
  );

  // Temporal's last instant is +275760-09-13T00:00:00Z: a free day ending there is representable,
  // one that would end a day later is not.
  it.each`
    clockStart                   | expected
    ${"+275760-09-12T23:00:00Z"} | ${{ freeTimeStart: "+275760-09-12", lastFreeDay: "+275760-09-12", expiresAt: "+275760-09-13T00:00:00Z" }}
    ${"+275760-09-13T00:00:00Z"} | ${null}
  `(
    "handles a free day at the range maximum ($clockStart)",
    ({ clockStart, expected }) => {
      expect(
        freeTimeExpiry(clockStart, 1, { ...calendar, timeZone: "UTC" }),
      ).toEqual(expected);
    },
  );

  // Temporal's first instant is -271821-04-20T00:00:00Z. West of UTC the event day began before
  // it, but the date is known and every later boundary is representable, so free time is laid out.
  it.each`
    timeZone              | freeTimeStart      | expiresAt
    ${"Etc/GMT+12"}       | ${"-271821-04-19"} | ${"-271821-04-20T12:00:00Z"}
    ${"America/New_York"} | ${"-271821-04-19"} | ${"-271821-04-20T04:56:02Z"}
    ${"Etc/GMT-14"}       | ${"-271821-04-20"} | ${"-271821-04-20T10:00:00Z"}
    ${"UTC"}              | ${"-271821-04-20"} | ${"-271821-04-21T00:00:00Z"}
  `(
    "lays out a free day from the range minimum in $timeZone",
    ({ timeZone, freeTimeStart, expiresAt }) => {
      expect(
        freeTimeExpiry("-271821-04-20T00:00:00Z", 1, { ...calendar, timeZone }),
      ).toEqual({
        freeTimeStart,
        lastFreeDay: freeTimeStart,
        expiresAt,
      });
    },
  );

  it("returns the sentinel when the expiry itself would pass the range maximum east of UTC", () => {
    expect(
      freeTimeExpiry("+275760-09-12T23:00:00Z", 1, {
        ...calendar,
        timeZone: "Etc/GMT-14",
      }),
    ).toBeNull();
  });

  it.each`
    clockStart                | freeDays   | options                                                                      | reason
    ${123}                    | ${3}       | ${calendar}                                                                  | ${"non-string clock start"}
    ${""}                     | ${3}       | ${calendar}                                                                  | ${"empty clock start"}
    ${"2024-06-14T19:00:00"}  | ${3}       | ${calendar}                                                                  | ${"no offset designator: not an instant"}
    ${"2024-06-14"}           | ${3}       | ${calendar}                                                                  | ${"a date is not an instant"}
    ${"2016-12-31T23:59:60Z"} | ${3}       | ${calendar}                                                                  | ${"leap second"}
    ${friday}                 | ${0}       | ${calendar}                                                                  | ${"no free days means no last free day"}
    ${friday}                 | ${-1}      | ${calendar}                                                                  | ${"negative free days"}
    ${friday}                 | ${2.5}     | ${calendar}                                                                  | ${"fractional free days"}
    ${friday}                 | ${"3"}     | ${calendar}                                                                  | ${"free days as a string"}
    ${friday}                 | ${2 ** 53} | ${calendar}                                                                  | ${"free days past the safe integer range"}
    ${friday}                 | ${3}       | ${undefined}                                                                 | ${"no options"}
    ${friday}                 | ${3}       | ${null}                                                                      | ${"null options"}
    ${friday}                 | ${3}       | ${"calendar"}                                                                | ${"options as a string"}
    ${friday}                 | ${3}       | ${{ basis: "calendar", timeZone: "America/New_York" }}                       | ${"firstDay has no default"}
    ${friday}                 | ${3}       | ${{ ...calendar, firstDay: "sameDay" }}                                      | ${"unknown firstDay"}
    ${friday}                 | ${3}       | ${{ ...calendar, basis: "business" }}                                        | ${"unknown basis"}
    ${friday}                 | ${3}       | ${{ timeZone: "America/New_York", firstDay: "eventDay" }}                    | ${"basis has no default"}
    ${friday}                 | ${3}       | ${{ ...calendar, timeZone: "America/Nueva_York" }}                           | ${"invalid timeZone"}
    ${friday}                 | ${3}       | ${{ ...calendar, timeZone: undefined }}                                      | ${"missing timeZone"}
    ${friday}                 | ${3}       | ${{ ...calendar, basis: "working" }}                                         | ${"working basis without a calendar"}
    ${friday}                 | ${3}       | ${{ ...working, calendar: { ...weekdays, weekend: [1, 2, 3, 4, 5, 6, 7] } }} | ${"working basis with a calendar that has no working day"}
    ${friday}                 | ${3}       | ${{ ...working, calendar: { ...weekdays, holidays: ["2024-02-30"] } }}       | ${"working basis with a holiday that does not exist"}
  `("returns the sentinel for $reason", ({ clockStart, freeDays, options }) => {
    expect(freeTimeExpiry(clockStart, freeDays, options)).toBeNull();
  });

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(freeTimeExpiry(friday, 3, calendar)).toBeNull();
  });
});
