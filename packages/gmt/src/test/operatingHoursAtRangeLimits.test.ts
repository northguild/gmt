/**
 * Operating hours at the two ends of Temporal's instant range.
 *
 * A schedule is a rule about local clock time, so it holds on the first local date Temporal can
 * reach even when the window began the day before, at an instant before Temporal's first
 * (`-271821-04-20T00:00:00Z`). The open interval is clipped to the first instant. The mirror
 * holds at the last instant (`+275760-09-13T00:00:00Z`): a window that runs past it is open up
 * to it.
 *
 * Every expected value is worked by hand from one rule: local time is the instant plus the
 * offset, so an instant is the local time less the offset. Each block states the offset and the
 * local time of the limit it starts from. For a named zone the offset is the zone's local mean
 * time, read from plain Temporal and asserted before it is used.
 */
import { Temporal } from "@js-temporal/polyfill";
import { addOperatingTime } from "../calendar/hours/addOperatingTime";
import { isOpenAt } from "../calendar/hours/isOpenAt";
import { nextCloseAt } from "../calendar/hours/nextCloseAt";
import { nextOpenAt } from "../calendar/hours/nextOpenAt";
import { operatingIntervals } from "../calendar/hours/operatingIntervals";
import { operatingTimeBetween } from "../calendar/hours/operatingTimeBetween";
import { recurringWindows } from "../calendar/hours/recurringWindows";
import type { Interval, OperatingSchedule } from "../types";

const FIRST = "-271821-04-20T00:00:00Z";
const LAST = "+275760-09-13T00:00:00Z";
const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

/** The same window on every weekday. */
function daily(from: string, to: string): OperatingSchedule["weekly"] {
  return Object.fromEntries(
    WEEKDAYS.map((day) => [day, [{ from, to }]]),
  ) as OperatingSchedule["weekly"];
}

/** What the seven calendar/hours functions say about one instant and one range. */
function readings(
  schedule: OperatingSchedule,
  at: string,
  range: Interval,
  duration: string,
) {
  return {
    isOpenAt: isOpenAt(at, schedule),
    nextOpenAt: nextOpenAt(at, schedule),
    nextCloseAt: nextCloseAt(at, schedule),
    addOperatingTime: addOperatingTime(at, duration, schedule),
    operatingIntervals: operatingIntervals(schedule, range),
    recurringWindows: recurringWindows(
      schedule.weekly,
      range,
      schedule.timeZone,
    ),
    operatingTimeBetween: operatingTimeBetween(
      range.start,
      range.end,
      schedule,
    ),
  };
}

describe("a window that began on the local date before the first instant", () => {
  // 22:00 to 06:00 every night. The window that opened on the evening of 19 April is open from
  // the first instant until 06:00 local on the 20th; the next opens at 22:00 local on the 20th.
  // "PT7H" of open time uses up the first window and the rest of the seven hours in the next.
  it.each`
    timeZone       | at                           | localAtFirst              | closes                       | reopens                      | sevenHoursLater              | rangeEnd                     | openTime
    ${"UTC"}       | ${FIRST}                     | ${"00:00:00 on 20 April"} | ${"-271821-04-20T06:00:00Z"} | ${"-271821-04-20T22:00:00Z"} | ${"-271821-04-20T23:00:00Z"} | ${"-271821-04-20T12:00:00Z"} | ${"PT6H"}
    ${"+01:00"}    | ${FIRST}                     | ${"01:00:00 on 20 April"} | ${"-271821-04-20T05:00:00Z"} | ${"-271821-04-20T21:00:00Z"} | ${"-271821-04-20T23:00:00Z"} | ${"-271821-04-20T12:00:00Z"} | ${"PT5H"}
    ${"+00:44:30"} | ${FIRST}                     | ${"00:44:30 on 20 April"} | ${"-271821-04-20T05:15:30Z"} | ${"-271821-04-20T21:15:30Z"} | ${"-271821-04-20T23:00:00Z"} | ${"-271821-04-20T12:00:00Z"} | ${"PT5H15M30S"}
    ${"-00:00:30"} | ${"-271821-04-20T00:00:30Z"} | ${"00:00:00 on 20 April"} | ${"-271821-04-20T06:00:30Z"} | ${"-271821-04-20T22:00:30Z"} | ${"-271821-04-20T23:00:30Z"} | ${"-271821-04-20T12:00:30Z"} | ${"PT6H"}
  `(
    "at $timeZone ($localAtFirst) the night window is open from $at until $closes",
    ({
      timeZone,
      at,
      closes,
      reopens,
      sevenHoursLater,
      rangeEnd,
      openTime,
    }) => {
      const schedule = { timeZone, weekly: daily("22:00", "06:00") };
      const range = { start: at, end: rangeEnd };
      const open = [{ start: at, end: closes }];

      expect(readings(schedule, at, range, "PT7H")).toEqual({
        isOpenAt: true,
        nextOpenAt: at,
        nextCloseAt: closes,
        addOperatingTime: sevenHoursLater,
        operatingIntervals: open,
        recurringWindows: open,
        operatingTimeBetween: openTime,
      });
      expect(isOpenAt(closes, schedule)).toBe(false);
      expect(nextOpenAt(closes, schedule)).toBe(reopens);
    },
  );

  // At -00:00:30 and -00:44:30 the first 30 seconds stay the sentinel (the documented limit at
  // an offset with seconds); the row above starts at the first instant that answers.
  it("keeps the sentinel inside the seconds of an offset west of UTC", () => {
    const schedule = { timeZone: "-00:00:30", weekly: daily("22:00", "06:00") };

    expect(isOpenAt("-271821-04-20T00:00:29.999Z", schedule)).toBe(false);
    expect(nextCloseAt("-271821-04-20T00:00:29.999Z", schedule)).toBe("");
  });

  // 23:00 to 22:00: open for all but one hour of every day.
  it("a window that wraps for most of a day is open from the first instant in UTC", () => {
    const schedule = { timeZone: "UTC", weekly: daily("23:00", "22:00") };
    const range = { start: FIRST, end: "-271821-04-20T12:00:00Z" };

    // Open until 22:00Z, closed for an hour, open again from 23:00Z: 23 hours of open time
    // end at 22:00Z and the 24th runs from 23:00Z to midnight.
    expect(readings(schedule, FIRST, range, "PT24H")).toEqual({
      isOpenAt: true,
      nextOpenAt: FIRST,
      nextCloseAt: "-271821-04-20T22:00:00Z",
      addOperatingTime: "-271821-04-21T01:00:00Z",
      operatingIntervals: [range],
      recurringWindows: [range],
      operatingTimeBetween: "PT12H",
    });
  });

  // Asia/Tokyo stood at local mean time, +09:18:59, so the first instant is 09:18:59 on 20 April.
  // The window of the 19th ends at 22:00 local: 22:00:00 less 09:18:59 is 12:41:01Z. The next
  // opens at 23:00 local, 13:41:01Z. Thirteen hours of open time: 12 h 41 min 1 s, then 18 min
  // 59 s from 13:41:01Z, which is 14:00:00Z.
  it("a named zone east of UTC: Asia/Tokyo", () => {
    expect(
      Temporal.Instant.from(FIRST).toZonedDateTimeISO("Asia/Tokyo").offset,
    ).toBe("+09:18:59");

    const schedule = {
      timeZone: "Asia/Tokyo",
      weekly: daily("23:00", "22:00"),
    };
    const range = { start: FIRST, end: "-271821-04-20T13:00:00Z" };
    const open = [{ start: FIRST, end: "-271821-04-20T12:41:01Z" }];

    expect(readings(schedule, FIRST, range, "PT13H")).toEqual({
      isOpenAt: true,
      nextOpenAt: FIRST,
      nextCloseAt: "-271821-04-20T12:41:01Z",
      addOperatingTime: "-271821-04-20T14:00:00Z",
      operatingIntervals: open,
      recurringWindows: open,
      operatingTimeBetween: "PT12H41M1S",
    });
    expect(nextOpenAt("-271821-04-20T12:41:01Z", schedule)).toBe(
      "-271821-04-20T13:41:01Z",
    );
  });
});

describe("a window from a local date before Temporal's first date", () => {
  // West of UTC the first instant falls on -271821-04-19, the first date Temporal has. The date
  // before it is not a date Temporal can hold, but the weekly pattern still names its weekday:
  // 19 April -271821 is a Monday, so the day before is a Sunday.
  it("19 April -271821 is a Monday", () => {
    expect(Temporal.PlainDate.from("-271821-04-19").dayOfWeek).toBe(1);
  });

  // At -01:00 the first instant is 23:00 on the 19th. The 23:30 to 23:15 window of the day
  // before ends at 23:15 local, 00:15Z; the window of the 19th opens at 23:30 local, 00:30Z.
  // Twenty minutes of open time: 15 to 00:15Z, then 5 from 00:30Z.
  it("an offset west of UTC: -01:00", () => {
    const schedule = { timeZone: "-01:00", weekly: daily("23:30", "23:15") };
    const range = { start: FIRST, end: "-271821-04-20T01:00:00Z" };
    const open = [
      { start: FIRST, end: "-271821-04-20T00:15:00Z" },
      { start: "-271821-04-20T00:30:00Z", end: "-271821-04-20T01:00:00Z" },
    ];

    expect(readings(schedule, FIRST, range, "PT20M")).toEqual({
      isOpenAt: true,
      nextOpenAt: FIRST,
      nextCloseAt: "-271821-04-20T00:15:00Z",
      addOperatingTime: "-271821-04-20T00:35:00Z",
      operatingIntervals: open,
      recurringWindows: open,
      operatingTimeBetween: "PT45M",
    });
    expect(nextOpenAt("-271821-04-20T00:20:00Z", schedule)).toBe(
      "-271821-04-20T00:30:00Z",
    );
  });

  // The same window on one weekday only. On Sunday it is the window of the day before the first
  // date, open until 00:15Z and never again that week. On Monday it is the window of the 19th
  // itself, which opens at 00:30Z.
  it.each`
    weekday | name        | openAtFirst | nextOpen                     | intervals
    ${"7"}  | ${"Sunday"} | ${true}     | ${FIRST}                     | ${[{ start: FIRST, end: "-271821-04-20T00:15:00Z" }]}
    ${"1"}  | ${"Monday"} | ${false}    | ${"-271821-04-20T00:30:00Z"} | ${[{ start: "-271821-04-20T00:30:00Z", end: "-271821-04-20T01:00:00Z" }]}
  `(
    "a 23:30 to 23:15 window on $name only is open at the first instant at -01:00: $openAtFirst",
    ({ weekday, openAtFirst, nextOpen, intervals }) => {
      const weekly = { [weekday]: [{ from: "23:30", to: "23:15" }] };
      const schedule = { timeZone: "-01:00", weekly };
      const range = { start: FIRST, end: "-271821-04-20T01:00:00Z" };

      expect(isOpenAt(FIRST, schedule)).toBe(openAtFirst);
      expect(nextOpenAt(FIRST, schedule)).toBe(nextOpen);
      expect(operatingIntervals(schedule, range)).toEqual(intervals);
      expect(recurringWindows(weekly, range, "-01:00")).toEqual(intervals);
    },
  );

  // At -00:44:30 the first instant that answers is 00:00:30Z, 23:16:00 local on the 19th. The
  // 23:30 to 23:20 window of the day before ends at 23:20 local: 23:20:00 plus 00:44:30 is
  // 00:04:30Z. The window of the 19th opens at 23:30 local, 00:14:30Z. Twenty minutes of open
  // time: 4 to 00:04:30Z, then 16 from 00:14:30Z.
  it("an offset with seconds west of UTC: -00:44:30", () => {
    const at = "-271821-04-20T00:00:30Z";
    const schedule = { timeZone: "-00:44:30", weekly: daily("23:30", "23:20") };
    const range = { start: at, end: "-271821-04-20T01:00:30Z" };
    const open = [
      { start: at, end: "-271821-04-20T00:04:30Z" },
      { start: "-271821-04-20T00:14:30Z", end: "-271821-04-20T01:00:30Z" },
    ];

    expect(readings(schedule, at, range, "PT20M")).toEqual({
      isOpenAt: true,
      nextOpenAt: at,
      nextCloseAt: "-271821-04-20T00:04:30Z",
      addOperatingTime: "-271821-04-20T00:30:30Z",
      operatingIntervals: open,
      recurringWindows: open,
      operatingTimeBetween: "PT50M",
    });
  });

  // America/New_York stood at local mean time, -04:56:02, so the first instant is 19:03:58 on the
  // 19th. The 23:00 to 22:00 window of the day before ends at 22:00 local: 22:00:00 plus 04:56:02
  // is 02:56:02Z on the 20th. The window of the 19th opens at 23:00 local, 03:56:02Z. Three hours
  // of open time: 2 h 56 min 2 s, then 3 min 58 s from 03:56:02Z, which is 04:00:00Z. Over the
  // first twelve hours: 2:56:02 and then 03:56:02Z to 12:00:00Z, 8:03:58, eleven hours in all.
  it("a named zone west of UTC: America/New_York", () => {
    expect(
      Temporal.Instant.from(FIRST).toZonedDateTimeISO("America/New_York")
        .offset,
    ).toBe("-04:56:02");

    const schedule = {
      timeZone: "America/New_York",
      weekly: daily("23:00", "22:00"),
    };
    const range = { start: FIRST, end: "-271821-04-20T12:00:00Z" };
    const open = [
      { start: FIRST, end: "-271821-04-20T02:56:02Z" },
      { start: "-271821-04-20T03:56:02Z", end: "-271821-04-20T12:00:00Z" },
    ];

    expect(readings(schedule, FIRST, range, "PT3H")).toEqual({
      isOpenAt: true,
      nextOpenAt: FIRST,
      nextCloseAt: "-271821-04-20T02:56:02Z",
      addOperatingTime: "-271821-04-20T04:00:00Z",
      operatingIntervals: open,
      recurringWindows: open,
      operatingTimeBetween: "PT11H",
    });
  });
});

describe("the date before the first instant follows its holiday or override", () => {
  // In UTC the date before the first instant is -271821-04-19, a date a schedule can name.
  const weekly = daily("22:00", "06:00");
  const range = { start: FIRST, end: "-271821-04-20T12:00:00Z" };

  it("a holiday on the 19th closes its night window, so the first instant is closed", () => {
    const schedule = {
      timeZone: "UTC",
      weekly,
      holidays: ["-271821-04-19"],
    };

    expect(isOpenAt(FIRST, schedule)).toBe(false);
    expect(nextOpenAt(FIRST, schedule)).toBe("-271821-04-20T22:00:00Z");
    expect(nextCloseAt(FIRST, schedule)).toBe(FIRST);
    expect(operatingIntervals(schedule, range)).toEqual([]);
    expect(operatingTimeBetween(range.start, range.end, schedule)).toBe("PT0S");
    // Seven hours of open time all come from the window of the 20th, 22:00Z to 05:00Z.
    expect(addOperatingTime(FIRST, "PT7H", schedule)).toBe(
      "-271821-04-21T05:00:00Z",
    );
  });

  // The override's 23:00 to 03:00 replaces the weekly 22:00 to 06:00 on the 19th.
  it("an override on the 19th sets how long the first instant stays open", () => {
    const schedule = {
      timeZone: "UTC",
      weekly,
      overrides: [
        { date: "-271821-04-19", windows: [{ from: "23:00", to: "03:00" }] },
      ],
    };
    const open = [{ start: FIRST, end: "-271821-04-20T03:00:00Z" }];

    expect(isOpenAt(FIRST, schedule)).toBe(true);
    expect(nextCloseAt(FIRST, schedule)).toBe("-271821-04-20T03:00:00Z");
    expect(operatingIntervals(schedule, range)).toEqual(open);
    expect(operatingTimeBetween(range.start, range.end, schedule)).toBe("PT3H");
    // Three hours to 03:00Z, then four from 22:00Z.
    expect(addOperatingTime(FIRST, "PT7H", schedule)).toBe(
      "-271821-04-21T02:00:00Z",
    );
  });

  it("an override with no windows on the 19th closes the first instant", () => {
    const schedule = {
      timeZone: "UTC",
      weekly,
      overrides: [{ date: "-271821-04-19", windows: [] }],
    };

    expect(isOpenAt(FIRST, schedule)).toBe(false);
    expect(nextOpenAt(FIRST, schedule)).toBe("-271821-04-20T22:00:00Z");
    expect(operatingIntervals(schedule, range)).toEqual([]);
  });

  // An edge before the first instant is outside the range, not an ambiguous or skipped wall time,
  // so "reject" has nothing to refuse.
  it("answers under every disambiguation", () => {
    const schedule = { timeZone: "UTC", weekly };

    for (const disambiguation of [
      "compatible",
      "earlier",
      "later",
      "reject",
    ] as const) {
      expect(isOpenAt(FIRST, schedule, { disambiguation })).toBe(true);
      expect(nextCloseAt(FIRST, schedule, { disambiguation })).toBe(
        "-271821-04-20T06:00:00Z",
      );
      expect(operatingIntervals(schedule, range, { disambiguation })).toEqual([
        { start: FIRST, end: "-271821-04-20T06:00:00Z" },
      ]);
    }
  });
});

describe("a window that runs past the last instant", () => {
  // Every row reads the hour before the last instant and the three hours before it. A window
  // still open at the last instant never closes inside the range, so nextCloseAt has no answer,
  // and thirty minutes of open time from 23:00Z end at 23:30Z.
  //
  // - UTC, 22:00 to 06:00: the window of 12 September opens at 22:00Z and wraps into the 13th.
  // - -01:00 (23:00 on the 12th): the same window opens at 22:00 local, 23:00Z.
  // - +14:00 (14:00 on the 13th, Temporal's last date), 13:00 to 12:00: the window of the 12th
  //   ran until 12:00 local on the 13th, 22:00Z on the 12th; the window of the 13th opened at
  //   13:00 local, 23:00Z, and wraps into a date Temporal cannot hold.
  // - +00:44:30: 22:00 local is 21:15:30Z. -00:44:30: 22:00 local is 22:44:30Z.
  it.each`
    timeZone       | from       | to         | intervals                                                                                                                  | openTime
    ${"UTC"}       | ${"22:00"} | ${"06:00"} | ${[{ start: "+275760-09-12T22:00:00Z", end: LAST }]}                                                                       | ${"PT2H"}
    ${"-01:00"}    | ${"22:00"} | ${"06:00"} | ${[{ start: "+275760-09-12T23:00:00Z", end: LAST }]}                                                                       | ${"PT1H"}
    ${"+14:00"}    | ${"13:00"} | ${"12:00"} | ${[{ start: "+275760-09-12T21:00:00Z", end: "+275760-09-12T22:00:00Z" }, { start: "+275760-09-12T23:00:00Z", end: LAST }]} | ${"PT2H"}
    ${"+00:44:30"} | ${"22:00"} | ${"06:00"} | ${[{ start: "+275760-09-12T21:15:30Z", end: LAST }]}                                                                       | ${"PT2H44M30S"}
    ${"-00:44:30"} | ${"22:00"} | ${"06:00"} | ${[{ start: "+275760-09-12T22:44:30Z", end: LAST }]}                                                                       | ${"PT1H15M30S"}
  `(
    "at $timeZone a $from to $to window is open up to the last instant",
    ({ timeZone, from, to, intervals, openTime }) => {
      const schedule = { timeZone, weekly: daily(from, to) };
      const at = "+275760-09-12T23:00:00Z";
      const range = { start: "+275760-09-12T21:00:00Z", end: LAST };

      expect(readings(schedule, at, range, "PT30M")).toEqual({
        isOpenAt: true,
        nextOpenAt: at,
        nextCloseAt: "",
        addOperatingTime: "+275760-09-12T23:30:00Z",
        operatingIntervals: intervals,
        recurringWindows: intervals,
        operatingTimeBetween: openTime,
      });
      expect(isOpenAt(LAST, schedule)).toBe(true);
      // More open time than the range has left has no answer.
      expect(addOperatingTime(at, "PT2H", schedule)).toBe("");
    },
  );

  // Named zones at the last instant: Asia/Tokyo is at +09:00 (09:00 on the 13th) and
  // America/New_York at -04:00 (20:00 on the 12th); both offsets are read from Temporal.
  // Tokyo, 23:00 to 22:00: open since 23:00 local on the 12th, 14:00Z. New York, 18:00 to 06:00:
  // open since 18:00 local, 22:00Z.
  it.each`
    timeZone              | offset      | from       | to         | intervals                                            | openTime
    ${"Asia/Tokyo"}       | ${"+09:00"} | ${"23:00"} | ${"22:00"} | ${[{ start: "+275760-09-12T21:00:00Z", end: LAST }]} | ${"PT3H"}
    ${"America/New_York"} | ${"-04:00"} | ${"18:00"} | ${"06:00"} | ${[{ start: "+275760-09-12T22:00:00Z", end: LAST }]} | ${"PT2H"}
  `(
    "in $timeZone ($offset) a $from to $to window is open up to the last instant",
    ({ timeZone, offset, from, to, intervals, openTime }) => {
      expect(
        Temporal.Instant.from(LAST).toZonedDateTimeISO(timeZone).offset,
      ).toBe(offset);

      const schedule = { timeZone, weekly: daily(from, to) };
      const range = { start: "+275760-09-12T21:00:00Z", end: LAST };

      expect(isOpenAt(LAST, schedule)).toBe(true);
      expect(nextCloseAt("+275760-09-12T23:00:00Z", schedule)).toBe("");
      expect(operatingIntervals(schedule, range)).toEqual(intervals);
      expect(operatingTimeBetween(range.start, range.end, schedule)).toBe(
        openTime,
      );
    },
  );

  // 00:00 to 06:00 in UTC opens at the last instant itself: the last instant is open, nothing
  // before it is, and no open time is left to add.
  it("a window that opens at the last instant is open there and nowhere before", () => {
    const schedule = { timeZone: "UTC", weekly: daily("00:00", "06:00") };
    const at = "+275760-09-12T23:00:00Z";
    const range = { start: "+275760-09-12T21:00:00Z", end: LAST };

    expect(isOpenAt(LAST, schedule)).toBe(true);
    expect(readings(schedule, at, range, "PT30M")).toEqual({
      isOpenAt: false,
      nextOpenAt: LAST,
      nextCloseAt: at,
      addOperatingTime: "",
      operatingIntervals: [],
      recurringWindows: [],
      operatingTimeBetween: "PT0S",
    });
  });
});
