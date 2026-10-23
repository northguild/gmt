import type { IsoWeekday } from "../types/operating-schedule";
import type { RecurrenceRule } from "../types";
import { Temporal } from "./temporal";
import {
  MAX_EPOCH_DAY,
  MIN_EPOCH_DAY,
  epochDayOf,
  isoDateString,
} from "./epochDay";
import {
  RECURRENCE_WORK_CAP,
  expandLocalMoments,
  weekYearWeek,
  type ExpansionStatus,
  type LocalMoment,
} from "./recurrenceExpansion";

/** "1997-09-02T09:00[:ss]" to a LocalMoment. */
function moment(text: string): LocalMoment {
  const [date, time] = text.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min, s] = time.split(":").map(Number);

  return { day: epochDayOf(y, m, d), second: h * 3600 + min * 60 + (s ?? 0) };
}

function text(value: LocalMoment): string {
  const h = Math.floor(value.second / 3600);
  const m = Math.floor((value.second % 3600) / 60);
  const s = value.second % 60;
  const two = (n: number) => String(n).padStart(2, "0");

  return `${isoDateString(value.day)}T${two(h)}:${two(m)}${s ? `:${two(s)}` : ""}`;
}

function rule(
  parts: Partial<RecurrenceRule> & Pick<RecurrenceRule, "frequency">,
): RecurrenceRule {
  return { interval: 1, firstDayOfWeek: 1, ...parts };
}

function firstN(
  r: RecurrenceRule,
  start: string,
  n: number,
): { moments: string[]; status: ExpansionStatus } {
  const moments: string[] = [];
  const from = moment(start);
  const status = expandLocalMoments(r, from, from.day, (m) => {
    moments.push(text(m));
    return moments.length < n;
  });

  return { moments, status };
}

const MO: IsoWeekday = 1;
const TU: IsoWeekday = 2;
const WE: IsoWeekday = 3;
const TH: IsoWeekday = 4;
const FR: IsoWeekday = 5;
const SU: IsoWeekday = 7;
const weekdays = [MO, TU, WE, TH, FR].map((day) => ({ day }));

describe("expandLocalMoments", () => {
  // Start values from RFC 5545 §3.8.5.3 unless marked GMT; every expected moment derived by hand.
  it.each`
    description                                                                     | rule                                                                                                  | start                    | n     | expected
    ${"yearly keeps the start's month, day and time"}                               | ${rule({ frequency: "yearly" })}                                                                      | ${"1997-09-02T09:00"}    | ${3}  | ${["1997-09-02T09:00", "1998-09-02T09:00", "1999-09-02T09:00"]}
    ${"WKST=MO: Tue 5 and Sun 10 share a week"}                                     | ${rule({ frequency: "weekly", interval: 2, byDay: [{ day: TU }, { day: SU }] })}                      | ${"1997-08-05T09:00"}    | ${4}  | ${["1997-08-05T09:00", "1997-08-10T09:00", "1997-08-19T09:00", "1997-08-24T09:00"]}
    ${"WKST=SU: Sun 17 opens the week of Tue 19"}                                   | ${rule({ frequency: "weekly", interval: 2, firstDayOfWeek: SU, byDay: [{ day: TU }, { day: SU }] })}  | ${"1997-08-05T09:00"}    | ${4}  | ${["1997-08-05T09:00", "1997-08-17T09:00", "1997-08-19T09:00", "1997-08-31T09:00"]}
    ${"GMT: WKST=MO weeks run Mon-Sun, so Mon 1 and Sun 7 pair up"}                 | ${rule({ frequency: "weekly", interval: 2, byDay: [{ day: MO }, { day: SU }] })}                      | ${"2024-01-01T09:00"}    | ${4}  | ${["2024-01-01T09:00", "2024-01-07T09:00", "2024-01-15T09:00", "2024-01-21T09:00"]}
    ${"GMT: monthly on the 31st skips 30-day months"}                               | ${rule({ frequency: "monthly" })}                                                                     | ${"2024-01-31T09:00"}    | ${4}  | ${["2024-01-31T09:00", "2024-03-31T09:00", "2024-05-31T09:00", "2024-07-31T09:00"]}
    ${"GMT: the 30th does not exist in February"}                                   | ${rule({ frequency: "monthly", byMonthDay: [15, 30] })}                                               | ${"2025-01-15T09:00"}    | ${5}  | ${["2025-01-15T09:00", "2025-01-30T09:00", "2025-02-15T09:00", "2025-03-15T09:00", "2025-03-30T09:00"]}
    ${"20MO is the 20th Monday of the year"}                                        | ${rule({ frequency: "yearly", byDay: [{ day: MO, nthOfPeriod: 20 }] })}                               | ${"1997-05-19T09:00"}    | ${3}  | ${["1997-05-19T09:00", "1998-05-18T09:00", "1999-05-17T09:00"]}
    ${"GMT: BYMONTH=3 scopes -1SU to the month"}                                    | ${rule({ frequency: "yearly", byMonth: [3], byDay: [{ day: SU, nthOfPeriod: -1 }] })}                 | ${"2024-03-31T01:00"}    | ${3}  | ${["2024-03-31T01:00", "2025-03-30T01:00", "2026-03-29T01:00"]}
    ${"week 20 Monday (week 1 holds Jan 4)"}                                        | ${rule({ frequency: "yearly", byWeekNo: [20], byDay: [{ day: MO }] })}                                | ${"1997-05-12T09:00"}    | ${3}  | ${["1997-05-12T09:00", "1998-05-11T09:00", "1999-05-17T09:00"]}
    ${"GMT: week 1 Monday of 2025 is in December"}                                  | ${rule({ frequency: "yearly", byWeekNo: [1], byDay: [{ day: MO }] })}                                 | ${"2024-01-01T09:00"}    | ${3}  | ${["2024-01-01T09:00", "2024-12-30T09:00", "2025-12-29T09:00"]}
    ${"GMT: last week Thursday, 53 weeks in 2020"}                                  | ${rule({ frequency: "yearly", byWeekNo: [-1], byDay: [{ day: TH }] })}                                | ${"2020-12-31T09:00"}    | ${3}  | ${["2020-12-31T09:00", "2021-12-30T09:00", "2022-12-29T09:00"]}
    ${"last weekday of the month"}                                                  | ${rule({ frequency: "monthly", byDay: weekdays, bySetPosition: [-1] })}                               | ${"1997-09-30T09:00"}    | ${7}  | ${["1997-09-30T09:00", "1997-10-31T09:00", "1997-11-28T09:00", "1997-12-31T09:00", "1998-01-30T09:00", "1998-02-27T09:00", "1998-03-31T09:00"]}
    ${"third of Tue, Wed, Thu in the month"}                                        | ${rule({ frequency: "monthly", byDay: [{ day: TU }, { day: WE }, { day: TH }], bySetPosition: [3] })} | ${"1997-09-04T09:00"}    | ${3}  | ${["1997-09-04T09:00", "1997-10-07T09:00", "1997-11-06T09:00"]}
    ${"GMT: set positions 2 and -1 of the day's times"}                             | ${rule({ frequency: "daily", byHour: [9, 17], byMinute: [0, 30], bySetPosition: [2, -1] })}           | ${"2024-01-01T09:30"}    | ${3}  | ${["2024-01-01T09:30", "2024-01-01T17:30", "2024-01-02T09:30"]}
    ${"GMT: -1 picks the last time of the last Monday"}                             | ${rule({ frequency: "monthly", byDay: [{ day: MO }], byHour: [9, 17], bySetPosition: [-1] })}         | ${"2024-01-29T17:00"}    | ${3}  | ${["2024-01-29T17:00", "2024-02-26T17:00", "2024-03-25T17:00"]}
    ${"every 90 minutes"}                                                           | ${rule({ frequency: "minutely", interval: 90 })}                                                      | ${"1997-09-02T09:00"}    | ${4}  | ${["1997-09-02T09:00", "1997-09-02T10:30", "1997-09-02T12:00", "1997-09-02T13:30"]}
    ${"GMT: hourly /5 skips to the aligned hour"}                                   | ${rule({ frequency: "hourly", interval: 5, byDay: [{ day: MO }] })}                                   | ${"2024-01-01T00:00"}    | ${6}  | ${["2024-01-01T00:00", "2024-01-01T05:00", "2024-01-01T10:00", "2024-01-01T15:00", "2024-01-01T20:00", "2024-01-08T02:00"]}
    ${"GMT: second 60 is dropped"}                                                  | ${rule({ frequency: "minutely", bySecond: [59, 60] })}                                                | ${"2024-01-01T00:00:59"} | ${2}  | ${["2024-01-01T00:00:59", "2024-01-01T00:01:59"]}
    ${"yearly BYMONTH alone keeps the start's day of month"}                        | ${rule({ frequency: "yearly", byMonth: [3] })}                                                        | ${"2024-03-15T09:00"}    | ${3}  | ${["2024-03-15T09:00", "2025-03-15T09:00", "2026-03-15T09:00"]}
    ${"yearly BYMONTHDAY alone keeps the start's month"}                            | ${rule({ frequency: "yearly", byMonthDay: [15] })}                                                    | ${"2024-03-15T09:00"}    | ${3}  | ${["2024-03-15T09:00", "2025-03-15T09:00", "2026-03-15T09:00"]}
    ${"yearly BYDAY alone is every such weekday of the year"}                       | ${rule({ frequency: "yearly", byDay: [{ day: MO }] })}                                                | ${"2024-12-23T09:00"}    | ${3}  | ${["2024-12-23T09:00", "2024-12-30T09:00", "2025-01-06T09:00"]}
    ${"yearly BYWEEKNO alone keeps the start's weekday"}                            | ${rule({ frequency: "yearly", byWeekNo: [20] })}                                                      | ${"1997-05-12T09:00"}    | ${3}  | ${["1997-05-12T09:00", "1998-05-11T09:00", "1999-05-17T09:00"]}
    ${"BYYEARDAY=60 is Mar 1 in a common year"}                                     | ${rule({ frequency: "yearly", byYearDay: [60] })}                                                     | ${"2024-02-29T09:00"}    | ${3}  | ${["2024-02-29T09:00", "2025-03-01T09:00", "2026-03-01T09:00"]}
    ${"BYYEARDAY=-1 is Dec 31 in leap and common"}                                  | ${rule({ frequency: "yearly", byYearDay: [-1] })}                                                     | ${"2023-12-31T09:00"}    | ${3}  | ${["2023-12-31T09:00", "2024-12-31T09:00", "2025-12-31T09:00"]}
    ${"BYMONTHDAY=-1 is the last day of each month"}                                | ${rule({ frequency: "monthly", byMonthDay: [-1] })}                                                   | ${"2024-01-31T09:00"}    | ${3}  | ${["2024-01-31T09:00", "2024-02-29T09:00", "2024-03-31T09:00"]}
    ${"2TU is the second Tuesday of each month"}                                    | ${rule({ frequency: "monthly", byDay: [{ day: TU, nthOfPeriod: 2 }] })}                               | ${"2024-01-09T09:00"}    | ${3}  | ${["2024-01-09T09:00", "2024-02-13T09:00", "2024-03-12T09:00"]}
    ${"weekly keeps the start's weekday"}                                           | ${rule({ frequency: "weekly" })}                                                                      | ${"2024-01-03T09:00"}    | ${3}  | ${["2024-01-03T09:00", "2024-01-10T09:00", "2024-01-17T09:00"]}
    ${"daily interval 3"}                                                           | ${rule({ frequency: "daily", interval: 3 })}                                                          | ${"2024-01-01T09:00"}    | ${3}  | ${["2024-01-01T09:00", "2024-01-04T09:00", "2024-01-07T09:00"]}
    ${"hourly keeps the start's minute"}                                            | ${rule({ frequency: "hourly" })}                                                                      | ${"2024-01-01T10:15"}    | ${3}  | ${["2024-01-01T10:15", "2024-01-01T11:15", "2024-01-01T12:15"]}
    ${"secondly interval 40"}                                                       | ${rule({ frequency: "secondly", interval: 40 })}                                                      | ${"2024-01-01T00:00"}    | ${4}  | ${["2024-01-01T00:00", "2024-01-01T00:00:40", "2024-01-01T00:01:20", "2024-01-01T00:02"]}
    ${"secondly jumps to the next minute and hour"}                                 | ${rule({ frequency: "secondly", byMinute: [1], bySecond: [0, 30] })}                                  | ${"2024-01-01T00:01"}    | ${4}  | ${["2024-01-01T00:01", "2024-01-01T00:01:30", "2024-01-01T01:01", "2024-01-01T01:01:30"]}
    ${"minutely with byHour jumps to the next hour"}                                | ${rule({ frequency: "minutely", interval: 30, byHour: [10] })}                                        | ${"2024-01-01T10:00"}    | ${4}  | ${["2024-01-01T10:00", "2024-01-01T10:30", "2024-01-02T10:00", "2024-01-02T10:30"]}
    ${"an unsynchronised start is still the first"}                                 | ${rule({ frequency: "monthly", byDay: [{ day: FR }], byMonthDay: [13] })}                             | ${"1997-09-02T09:00"}    | ${3}  | ${["1997-09-02T09:00", "1998-02-13T09:00", "1998-03-13T09:00"]}
    ${"WKST=SU: week 1 of 2021 opens on Sun Jan 3, so Sunday of week 1 is Jan 3"}   | ${rule({ frequency: "yearly", firstDayOfWeek: SU, byWeekNo: [1], byDay: [{ day: SU }] })}             | ${"2021-01-03T09:00"}    | ${3}  | ${["2021-01-03T09:00", "2022-01-02T09:00", "2023-01-01T09:00"]}
    ${"WKST=MO: Jan 3 2021 is week 53 of 2020, so Sunday of week 1 is Jan 10"}      | ${rule({ frequency: "yearly", byWeekNo: [1], byDay: [{ day: SU }] })}                                 | ${"2021-01-03T09:00"}    | ${3}  | ${["2021-01-03T09:00", "2021-01-10T09:00", "2022-01-09T09:00"]}
    ${"GMT: week 53 exists only in long years (2020, then 2026)"}                   | ${rule({ frequency: "yearly", byWeekNo: [53], byDay: [{ day: TH }] })}                                | ${"2020-12-31T09:00"}    | ${2}  | ${["2020-12-31T09:00", "2026-12-31T09:00"]}
    ${"GMT: WKST=WE weeks run Wed-Tue, so Sun 14 and Tue 16 pair up"}               | ${rule({ frequency: "weekly", interval: 2, firstDayOfWeek: WE, byDay: [{ day: TU }, { day: SU }] })}  | ${"2024-01-02T09:00"}    | ${5}  | ${["2024-01-02T09:00", "2024-01-14T09:00", "2024-01-16T09:00", "2024-01-28T09:00", "2024-01-30T09:00"]}
    ${"GMT: -1SU without BYMONTH is the last Sunday of the year"}                   | ${rule({ frequency: "yearly", byDay: [{ day: SU, nthOfPeriod: -1 }] })}                               | ${"2024-12-29T09:00"}    | ${3}  | ${["2024-12-29T09:00", "2025-12-28T09:00", "2026-12-27T09:00"]}
    ${"GMT: BYMONTH=3,10 scopes -1SU to each listed month"}                         | ${rule({ frequency: "yearly", byMonth: [3, 10], byDay: [{ day: SU, nthOfPeriod: -1 }] })}             | ${"2024-03-31T01:00"}    | ${4}  | ${["2024-03-31T01:00", "2024-10-27T01:00", "2025-03-30T01:00", "2025-10-26T01:00"]}
    ${"second to last Monday of each month"}                                        | ${rule({ frequency: "monthly", byDay: [{ day: MO, nthOfPeriod: -2 }] })}                              | ${"1997-09-22T09:00"}    | ${6}  | ${["1997-09-22T09:00", "1997-10-20T09:00", "1997-11-17T09:00", "1997-12-22T09:00", "1998-01-19T09:00", "1998-02-16T09:00"]}
    ${"BYYEARDAY=1,100,200 every 3 years (leap 2000 shifts days 100 and 200)"}      | ${rule({ frequency: "yearly", interval: 3, byYearDay: [1, 100, 200] })}                               | ${"1997-01-01T09:00"}    | ${7}  | ${["1997-01-01T09:00", "1997-04-10T09:00", "1997-07-19T09:00", "2000-01-01T09:00", "2000-04-09T09:00", "2000-07-18T09:00", "2003-01-01T09:00"]}
    ${"GMT: BYYEARDAY=-366 exists only in leap years"}                              | ${rule({ frequency: "yearly", byYearDay: [-366] })}                                                   | ${"2024-01-01T09:00"}    | ${2}  | ${["2024-01-01T09:00", "2028-01-01T09:00"]}
    ${"second to last day of the month, 28-day February included"}                  | ${rule({ frequency: "monthly", byMonthDay: [-2] })}                                                   | ${"1997-09-29T09:00"}    | ${6}  | ${["1997-09-29T09:00", "1997-10-30T09:00", "1997-11-29T09:00", "1997-12-30T09:00", "1998-01-30T09:00", "1998-02-27T09:00"]}
    ${"every other year in January, February and March"}                            | ${rule({ frequency: "yearly", interval: 2, byMonth: [1, 2, 3] })}                                     | ${"1997-03-10T09:00"}    | ${5}  | ${["1997-03-10T09:00", "1999-01-10T09:00", "1999-02-10T09:00", "1999-03-10T09:00", "2001-01-10T09:00"]}
    ${"GMT: Feb 29 every 3 years waits for the aligned leap years"}                 | ${rule({ frequency: "yearly", interval: 3 })}                                                         | ${"2024-02-29T09:00"}    | ${3}  | ${["2024-02-29T09:00", "2036-02-29T09:00", "2048-02-29T09:00"]}
    ${"GMT: monthly interval 2"}                                                    | ${rule({ frequency: "monthly", interval: 2 })}                                                        | ${"2024-01-15T09:00"}    | ${3}  | ${["2024-01-15T09:00", "2024-03-15T09:00", "2024-05-15T09:00"]}
    ${"GMT: weekly BYMONTH=1 limits the weeks to January"}                          | ${rule({ frequency: "weekly", byMonth: [1] })}                                                        | ${"2024-01-22T09:00"}    | ${4}  | ${["2024-01-22T09:00", "2024-01-29T09:00", "2025-01-06T09:00", "2025-01-13T09:00"]}
    ${"GMT: weekly -1 picks the last listed weekday of each week"}                  | ${rule({ frequency: "weekly", byDay: [{ day: MO }, { day: WE }, { day: FR }], bySetPosition: [-1] })} | ${"2024-01-05T09:00"}    | ${3}  | ${["2024-01-05T09:00", "2024-01-12T09:00", "2024-01-19T09:00"]}
    ${"GMT: position 5 is dropped in a four-Monday month, then 1 is kept"}          | ${rule({ frequency: "monthly", byDay: [{ day: MO }], bySetPosition: [5, 1] })}                        | ${"1997-09-01T09:00"}    | ${4}  | ${["1997-09-01T09:00", "1997-09-29T09:00", "1997-10-06T09:00", "1997-11-03T09:00"]}
    ${"GMT: positions 1, -4 and -1 of four Mondays give one candidate per Monday"}  | ${rule({ frequency: "monthly", byDay: [{ day: MO }], bySetPosition: [1, -4, -1] })}                   | ${"2021-01-01T09:00"}    | ${5}  | ${["2021-01-01T09:00", "2021-01-04T09:00", "2021-01-25T09:00", "2021-02-01T09:00", "2021-02-22T09:00"]}
    ${"GMT: hourly position 2 of three minutes"}                                    | ${rule({ frequency: "hourly", byMinute: [0, 20, 40], bySetPosition: [2] })}                           | ${"2024-01-01T10:20"}    | ${3}  | ${["2024-01-01T10:20", "2024-01-01T11:20", "2024-01-01T12:20"]}
    ${"GMT: candidates run day by day, each day through its times"}                 | ${rule({ frequency: "weekly", byDay: [{ day: MO }, { day: WE }], byHour: [17, 9] })}                  | ${"2024-01-01T09:00"}    | ${4}  | ${["2024-01-01T09:00", "2024-01-01T17:00", "2024-01-03T09:00", "2024-01-03T17:00"]}
    ${"GMT: unsorted BYHOUR and BYMINUTE give ascending times"}                     | ${rule({ frequency: "daily", byHour: [17, 9], byMinute: [30, 0] })}                                   | ${"2024-01-01T09:00"}    | ${4}  | ${["2024-01-01T09:00", "2024-01-01T09:30", "2024-01-01T17:00", "2024-01-01T17:30"]}
    ${"GMT: a start before the first BYHOUR still comes first, then the matches"}   | ${rule({ frequency: "daily", byHour: [9, 17] })}                                                      | ${"2024-01-01T10:00"}    | ${3}  | ${["2024-01-01T10:00", "2024-01-01T17:00", "2024-01-02T09:00"]}
    ${"GMT: daily keeps the start's seconds"}                                       | ${rule({ frequency: "daily" })}                                                                       | ${"2024-01-01T09:15:30"} | ${2}  | ${["2024-01-01T09:15:30", "2024-01-02T09:15:30"]}
    ${"GMT: hourly keeps the start's minute and second"}                            | ${rule({ frequency: "hourly" })}                                                                      | ${"2024-01-01T10:15:20"} | ${2}  | ${["2024-01-01T10:15:20", "2024-01-01T11:15:20"]}
    ${"GMT: hourly BYHOUR=9,17 skips the hours between"}                            | ${rule({ frequency: "hourly", byHour: [9, 17] })}                                                     | ${"2024-01-01T09:00"}    | ${3}  | ${["2024-01-01T09:00", "2024-01-01T17:00", "2024-01-02T09:00"]}
    ${"GMT: hourly BYMINUTE expands each hour"}                                     | ${rule({ frequency: "hourly", byMinute: [0, 30] })}                                                   | ${"2024-01-01T10:00"}    | ${3}  | ${["2024-01-01T10:00", "2024-01-01T10:30", "2024-01-01T11:00"]}
    ${"every 20 minutes in hours 9 and 10"}                                         | ${rule({ frequency: "minutely", interval: 20, byHour: [9, 10] })}                                     | ${"2024-01-01T09:00"}    | ${7}  | ${["2024-01-01T09:00", "2024-01-01T09:20", "2024-01-01T09:40", "2024-01-01T10:00", "2024-01-01T10:20", "2024-01-01T10:40", "2024-01-02T09:00"]}
    ${"GMT: minutely /7 in hour 9 restarts at 9:02 next day (1442 min is 206 x 7)"} | ${rule({ frequency: "minutely", interval: 7, byHour: [9] })}                                          | ${"2024-01-01T09:00"}    | ${10} | ${["2024-01-01T09:00", "2024-01-01T09:07", "2024-01-01T09:14", "2024-01-01T09:21", "2024-01-01T09:28", "2024-01-01T09:35", "2024-01-01T09:42", "2024-01-01T09:49", "2024-01-01T09:56", "2024-01-02T09:02"]}
  `("$description", ({ rule: r, start, n, expected }) => {
    expect(firstN(r, start, n)).toEqual({
      moments: expected,
      status: "stopped",
    });
  });
});

function firstSubDaily(
  r: RecurrenceRule,
  start: LocalMoment,
  lastDay: number,
): { status: ExpansionStatus; moments: string[] } {
  const moments: string[] = [];
  const status = expandLocalMoments(
    r,
    start,
    start.day,
    (m) => {
      moments.push(text(m));

      return true;
    },
    1000,
    lastDay,
  );

  return { status, moments };
}

describe("expandLocalMoments contract", () => {
  const daily = rule({ frequency: "daily" });

  it("visits the start first and returns stopped when that visit says stop", () => {
    const seen: LocalMoment[] = [];
    const status = expandLocalMoments(
      daily,
      moment("2024-01-01T09:00"),
      0,
      (m) => {
        seen.push(m);
        return false;
      },
    );

    expect({ status, seen }).toEqual({
      status: "stopped",
      seen: [moment("2024-01-01T09:00")],
    });
  });

  it("visits a start that does not match the rule, then only matches after it", () => {
    // 2024-01-01 is a Monday; the rule wants Fridays at 09:00, the next is 2024-01-05.
    const r = rule({ frequency: "weekly", byDay: [{ day: FR }] });

    expect(firstN(r, "2024-01-01T09:00", 2).moments).toEqual([
      "2024-01-01T09:00",
      "2024-01-05T09:00",
    ]);
  });

  it("a fast-forward floor skips whole periods but still visits the start", () => {
    const start = moment("2024-01-01T09:00");
    const seen: LocalMoment[] = [];
    expandLocalMoments(daily, start, start.day + 100, (m) => {
      seen.push(m);
      return seen.length < 3;
    });

    expect(seen.map(text)).toEqual([
      "2024-01-01T09:00",
      "2024-04-10T09:00",
      "2024-04-11T09:00",
    ]);
  });

  // The first period visited is the smallest aligned one whose last day is on or after fromDay, so
  // its moments before fromDay are still visited (the caller filters them).
  // daily /3: periods 0, 3, ..., 99, 102; day 102 after 2024-01-01 is Apr 12 (Jan 31 + Feb 29 + Mar 31 = 91 -> Apr 1).
  // monthly: June holds Jun 20, so June's Jun 15 is visited. yearly /2 from 2024: 2026 ends Dec 31 2026, before 2027-01-01, so 2028.
  // weekly (Wed): Mar 1 2024 is a Friday in the week Mon Feb 26 - Sun Mar 3, whose Wednesday is Feb 28.
  it.each`
    description                                              | rule                                          | start                 | fromDay                         | expected
    ${"daily /3 jumps to the aligned period at the floor"}   | ${rule({ frequency: "daily", interval: 3 })}  | ${"2024-01-01T09:00"} | ${epochDayOf(2024, 1, 1) + 100} | ${["2024-01-01T09:00", "2024-04-12T09:00", "2024-04-15T09:00"]}
    ${"monthly starts in the month that holds the floor"}    | ${rule({ frequency: "monthly" })}             | ${"2024-01-15T09:00"} | ${epochDayOf(2024, 6, 20)}      | ${["2024-01-15T09:00", "2024-06-15T09:00", "2024-07-15T09:00"]}
    ${"yearly /2 skips a period that ends before the floor"} | ${rule({ frequency: "yearly", interval: 2 })} | ${"2024-03-15T09:00"} | ${epochDayOf(2027, 1, 1)}       | ${["2024-03-15T09:00", "2028-03-15T09:00", "2030-03-15T09:00"]}
    ${"weekly starts in the week that holds the floor"}      | ${rule({ frequency: "weekly" })}              | ${"2024-01-03T09:00"} | ${epochDayOf(2024, 3, 1)}       | ${["2024-01-03T09:00", "2024-02-28T09:00", "2024-03-06T09:00"]}
  `("fast-forward: $description", ({ rule: r, start, fromDay, expected }) => {
    const from = moment(start);
    const seen: string[] = [];
    expandLocalMoments(r, from, fromDay, (m) => {
      seen.push(text(m));
      return seen.length < 3;
    });

    expect(seen).toEqual(expected);
  });

  it("a rule whose only second is 60 has no candidates (no leap second), so only the start is visited", () => {
    const seen: LocalMoment[] = [];
    const status = expandLocalMoments(
      rule({ frequency: "daily", bySecond: [60] }),
      moment("2024-01-01T09:00"),
      0,
      (m) => {
        seen.push(m);
        return true;
      },
      500,
    );

    expect({ status, count: seen.length }).toEqual({
      status: "capped",
      count: 1,
    });
  });

  it("a matching rule is capped too when its budget is small", () => {
    let count = 0;
    const status = expandLocalMoments(
      daily,
      moment("2024-01-01T09:00"),
      0,
      () => {
        count++;

        return true;
      },
      10,
    );

    expect({ status, someButNotAll: count > 1 && count < 10 }).toEqual({
      status: "capped",
      someButNotAll: true,
    });
  });

  // The last Temporal date is 275760-09-13, a Saturday, so the weekly start (7 days before) is a Saturday too.
  it.each`
    description  | rule                              | start                         | expected
    ${"yearly"}  | ${rule({ frequency: "yearly" })}  | ${epochDayOf(275_759, 9, 13)} | ${[epochDayOf(275_759, 9, 13), MAX_EPOCH_DAY]}
    ${"monthly"} | ${rule({ frequency: "monthly" })} | ${epochDayOf(275_760, 8, 13)} | ${[epochDayOf(275_760, 8, 13), MAX_EPOCH_DAY]}
    ${"weekly"}  | ${rule({ frequency: "weekly" })}  | ${MAX_EPOCH_DAY - 7}          | ${[MAX_EPOCH_DAY - 7, MAX_EPOCH_DAY]}
  `(
    "returns end after the last Temporal date, $description",
    ({ rule: r, start, expected }) => {
      const days: number[] = [];
      const status = expandLocalMoments(
        r,
        { day: start, second: 0 },
        0,
        (m) => {
          days.push(m.day);

          return true;
        },
      );

      expect({ status, days }).toEqual({ status: "end", days: expected });
    },
  );

  it("returns capped, having visited only the start, for February 30", () => {
    const seen: LocalMoment[] = [];
    const r = rule({ frequency: "daily", byMonth: [2], byMonthDay: [30] });
    const status = expandLocalMoments(
      r,
      moment("2024-01-01T09:00"),
      0,
      (m) => {
        seen.push(m);
        return true;
      },
      1000,
    );

    expect({ status, count: seen.length }).toEqual({
      status: "capped",
      count: 1,
    });
  });

  it("the default budget is the 2,000,000 work cap and a never-matching rule ends in it", () => {
    const r = rule({ frequency: "daily", byMonth: [2], byMonthDay: [30] });

    expect(RECURRENCE_WORK_CAP).toBe(2_000_000);
    expect(
      expandLocalMoments(r, moment("2024-01-01T09:00"), 0, () => true),
    ).toBe("capped");
  });

  it("returns end when the next period passes the last Temporal date", () => {
    const seen: LocalMoment[] = [];
    const status = expandLocalMoments(
      daily,
      moment("275760-09-12T00:00"),
      0,
      (m) => {
        seen.push(m);
        return true;
      },
    );

    expect({ status, days: seen.map((m) => m.day) }).toEqual({
      status: "end",
      days: [MAX_EPOCH_DAY - 1, MAX_EPOCH_DAY],
    });
  });

  it("returns end for a sub-daily rule on the last day", () => {
    const start = { day: MAX_EPOCH_DAY, second: 86_399 };

    expect(
      expandLocalMoments(rule({ frequency: "secondly" }), start, 0, () => true),
    ).toBe("end");
  });

  // lastDay ends the expansion at the first pick after it; a rule that never matches never
  // reaches a pick, so the period side ends it. 2024-01-01 is epoch day 19723.
  it.each`
    description                                | frequency   | lastOffset | extra                                 | expectedDays
    ${"yearly Feb 30, last day 5 after start"} | ${"yearly"} | ${5}       | ${{ byMonth: [2], byMonthDay: [30] }} | ${[0]}
    ${"daily Feb 30, last day 5 after start"}  | ${"daily"}  | ${5}       | ${{ byMonth: [2], byMonthDay: [30] }} | ${[0]}
    ${"daily, last day 2 after start"}         | ${"daily"}  | ${2}       | ${{}}                                 | ${[0, 1, 2]}
    ${"daily, last day is the start day"}      | ${"daily"}  | ${0}       | ${{}}                                 | ${[0]}
    ${"weekly Feb 30, last day 5 after start"} | ${"weekly"} | ${5}       | ${{ byMonth: [2], byMonthDay: [30] }} | ${[0]}
    ${"hourly Feb 30, last day 5 after start"} | ${"hourly"} | ${5}       | ${{ byMonth: [2], byMonthDay: [30] }} | ${[0]}
  `(
    "lastDay ends the expansion as end: $description",
    ({ frequency, lastOffset, extra, expectedDays }) => {
      const start = moment("2024-01-01T09:00");
      const days: number[] = [];
      const status = expandLocalMoments(
        rule({ frequency, ...extra }),
        start,
        start.day,
        (m) => {
          days.push(m.day - start.day);

          return true;
        },
        1000,
        start.day + lastOffset,
      );

      expect({ status, days }).toEqual({ status: "end", days: expectedDays });
    },
  );

  it("lastDay ends a sub-daily rule at the first hour after it", () => {
    const start = moment("2024-01-01T22:00");

    expect(
      firstSubDaily(rule({ frequency: "hourly" }), start, start.day),
    ).toEqual({
      status: "end",
      moments: ["2024-01-01T22:00", "2024-01-01T23:00"],
    });
  });

  it.each`
    description                  | lastDay
    ${"MAX_EPOCH_DAY"}           | ${MAX_EPOCH_DAY}
    ${"above MAX_EPOCH_DAY"}     | ${MAX_EPOCH_DAY + 10}
    ${"Number.MAX_SAFE_INTEGER"} | ${Number.MAX_SAFE_INTEGER}
  `(
    "lastDay $description behaves like the default at the max edge",
    ({ lastDay }) => {
      const days: number[] = [];
      const status = expandLocalMoments(
        daily,
        moment("275760-09-12T00:00"),
        0,
        (m) => {
          days.push(m.day);

          return true;
        },
        RECURRENCE_WORK_CAP,
        lastDay,
      );

      expect({ status, days }).toEqual({
        status: "end",
        days: [MAX_EPOCH_DAY - 1, MAX_EPOCH_DAY],
      });
    },
  );
});

describe("weekYearWeek", () => {
  it("equals Temporal's weekOfYear and yearOfWeek for every day of 1999-2030 when weeks start on Monday", () => {
    const mismatches: string[] = [];
    let date = Temporal.PlainDate.from("1999-01-01");

    while (date.year < 2031) {
      const result = weekYearWeek(
        epochDayOf(date.year, date.month, date.day),
        MO,
      );
      const oracle = {
        weekYear: date.yearOfWeek,
        week: date.weekOfYear,
        weeks: Temporal.PlainDate.from({
          year: date.yearOfWeek!,
          month: 12,
          day: 28,
        }).weekOfYear,
      };
      if (
        result.weekYear !== oracle.weekYear ||
        result.week !== oracle.week ||
        result.weeks !== oracle.weeks
      ) {
        mismatches.push(date.toString());
      }
      date = date.add({ days: 1 });
    }

    expect(mismatches).toEqual([]);
  });

  // WKST=SU: Jan 4 2021 is a Monday, so week 1 of 2021 is Sun Jan 3 - Sat Jan 9 and 2021-01-01 (a
  // Friday) closes 2020. Week 1 of 2020 starts Sun Dec 29 2019, so 2020 has 371 / 7 = 53 weeks and
  // Sun Dec 27 2020 opens week 364 / 7 + 1 = 53. 2021 has (Jan 2 2022 - Jan 3 2021) / 7 = 52 weeks.
  it.each`
    date            | firstDayOfWeek | expected
    ${[2021, 1, 1]} | ${SU}          | ${{ weekYear: 2020, week: 53, weeks: 53 }}
    ${[2021, 1, 3]} | ${SU}          | ${{ weekYear: 2021, week: 1, weeks: 52 }}
  `(
    "WKST=$firstDayOfWeek puts $date in $expected",
    ({ date, firstDayOfWeek, expected }) => {
      expect(
        weekYearWeek(epochDayOf(date[0], date[1], date[2]), firstDayOfWeek),
      ).toEqual(expected);
    },
  );
});

/** mulberry32: a small seeded generator, so the random rules are the same on every run. */
function seeded(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("expandLocalMoments fast-forward", () => {
  const frequencies = [
    "yearly",
    "monthly",
    "weekly",
    "daily",
    "hourly",
    "minutely",
    "secondly",
  ] as const;

  // fallow-ignore-next-line complexity -- seeded generator, one branch per rule part
  function randomRule(random: () => number): RecurrenceRule {
    const pick = <T>(values: readonly T[]): T =>
      values[Math.floor(random() * values.length)];
    const some = (low: number, high: number, count: number): number[] =>
      Array.from(
        { length: count },
        () => low + Math.floor(random() * (high - low + 1)),
      );
    const frequency = pick(frequencies);
    const parts: RecurrenceRule = {
      frequency,
      interval: 1 + Math.floor(random() * 7),
      firstDayOfWeek: pick([1, 2, 3, 4, 5, 6, 7] as const),
    };
    const sub =
      frequency === "hourly" ||
      frequency === "minutely" ||
      frequency === "secondly";

    if (random() < 0.5)
      parts.byMonth = some(1, 12, 1 + Math.floor(random() * 3));
    if (random() < 0.5 || sub)
      parts.byDay = some(1, 7, 1 + Math.floor(random() * 3)).map((day) => ({
        day: day as IsoWeekday,
      }));
    if (frequency === "monthly" && random() < 0.3)
      parts.byDay = [
        {
          day: pick([1, 2, 3, 4, 5, 6, 7] as const),
          nthOfPeriod: pick([1, 2, 3, -1, -2]),
        },
      ];
    if (frequency === "yearly" && random() < 0.3)
      parts.byWeekNo = some(1, 53, 2);
    if (frequency === "yearly" && random() < 0.3)
      parts.byYearDay = some(-366, 366, 2).filter((k) => k !== 0);
    if (
      (frequency === "monthly" ||
        frequency === "yearly" ||
        frequency === "daily" ||
        sub) &&
      random() < 0.4
    )
      parts.byMonthDay = some(1, 31, 2);
    if (sub || random() < 0.4) parts.byHour = some(0, 23, 2);
    if (frequency === "secondly" || frequency === "minutely" || random() < 0.4)
      parts.byMinute = some(0, 59, 2);
    if (frequency === "secondly" || random() < 0.4)
      parts.bySecond = some(0, 59, 2);
    if (frequency !== "secondly" && random() < 0.25)
      parts.bySetPosition = [pick([1, 2, -1])];

    return parts;
  }

  it("agrees with a run from DTSTART on every moment on or after the floor, for 200 seeded rules", () => {
    const random = seeded(84);
    const disagreements: string[] = [];
    let compared = 0;

    for (let row = 0; row < 200; row++) {
      const r = randomRule(random);
      const start = {
        day: epochDayOf(
          2000 + Math.floor(random() * 20),
          1 + Math.floor(random() * 12),
          1 + Math.floor(random() * 28),
        ),
        second: Math.floor(random() * 86_400),
      };
      const floor = start.day + 4000;
      const ceiling = floor + 800;
      const collect = (
        from: number,
      ): { moments: string[]; status: ExpansionStatus } => {
        const moments: string[] = [];
        const status = expandLocalMoments(
          r,
          start,
          from,
          (m) => {
            if (m.day > ceiling) return false;
            if (m.day >= floor) moments.push(text(m));
            return true;
          },
          60_000,
        );

        return { moments, status };
      };

      const full = collect(start.day);
      const fast = collect(floor);

      if (full.status === "capped" || fast.status === "capped") continue;
      compared++;
      if (JSON.stringify(full.moments) !== JSON.stringify(fast.moments)) {
        disagreements.push(JSON.stringify(r));
      }
    }

    expect(disagreements).toEqual([]);
    expect(compared).toBeGreaterThan(100);
  }, 30_000);
});

describe("expandLocalMoments BYSETPOS counts the whole period", () => {
  // RFC 5545 §3.3.10 (BYSETPOS) and RFC 8984 §4.3.3.1 step 3 count positions over the whole period;
  // a pick that a PlainDate cannot hold is dropped, never replaced by a neighbour.
  // The last Temporal date, +275760-09-13, is a Saturday: Sep 8 is a Monday, Sep 14 the Sunday after,
  // Sep 30 a Tuesday, Aug 29 a Friday. The first, -271821-04-19, is a Monday: Apr 5, 12, 19, 26.
  it.each`
    description                                                            | rule                                                                                                                           | start                   | expected
    ${"monthly last weekday: Sep 30 is out of range, so no September row"} | ${rule({ frequency: "monthly", byDay: weekdays, bySetPosition: [-1] })}                                                        | ${"275760-08-01T09:00"} | ${["+275760-08-01T09:00", "+275760-08-29T09:00"]}
    ${"weekly last of seven days: Sun Sep 14 is out of range"}             | ${rule({ frequency: "weekly", byDay: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day: day as IsoWeekday })), bySetPosition: [-1] })} | ${"275760-09-01T09:00"} | ${["+275760-09-01T09:00", "+275760-09-07T09:00"]}
    ${"yearly last of twelve 1sts: Dec 1 is out of range"}                 | ${rule({ frequency: "yearly", byMonth: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], byMonthDay: [1], bySetPosition: [-1] })}       | ${"275759-12-01T09:00"} | ${["+275759-12-01T09:00"]}
  `("$description", ({ rule: r, start, expected }) => {
    expect(firstN(r, start, 10)).toEqual({ moments: expected, status: "end" });
  });

  it("the 4th of 1MO..4MO counts the Mondays before the minimum: Apr 26", () => {
    const days: number[] = [];
    const r = rule({
      frequency: "monthly",
      byDay: [1, 2, 3, 4].map((n) => ({ day: MO, nthOfPeriod: n as 1 })),
      bySetPosition: [4],
    });
    const status = expandLocalMoments(
      r,
      { day: MIN_EPOCH_DAY, second: 32_400 },
      MIN_EPOCH_DAY,
      (m) => days.push(m.day) < 3,
    );

    // May -271821 starts on a Saturday after Apr 26 (Mon), so its Mondays are May 3, 10, 17, 24, 31 and 4MO is May 24.
    expect({ status, days }).toEqual({
      status: "stopped",
      days: [MIN_EPOCH_DAY, MIN_EPOCH_DAY + 7, epochDayOf(-271_821, 5, 24)],
    });
  });

  it.each`
    description                                                                                   | rule                                                                                                    | start                 | expected
    ${"GMT: weekly position 2 is Wed Jan 3 (before DTSTART, dropped), then each later Wednesday"} | ${rule({ frequency: "weekly", byDay: [{ day: MO }, { day: WE }, { day: FR }], bySetPosition: [2] })}    | ${"2024-01-04T09:00"} | ${["2024-01-04T09:00", "2024-01-10T09:00", "2024-01-17T09:00"]}
    ${"GMT: weekly positions 2 and 3 count Mon Jan 1 and Wed Jan 3, so Fri Jan 5 is position 3"}  | ${rule({ frequency: "weekly", byDay: [{ day: MO }, { day: WE }, { day: FR }], bySetPosition: [2, 3] })} | ${"2024-01-04T09:00"} | ${["2024-01-04T09:00", "2024-01-05T09:00", "2024-01-10T09:00"]}
    ${"GMT: position -5 is dropped in a four-Monday month"}                                       | ${rule({ frequency: "monthly", byDay: [{ day: MO }], bySetPosition: [-5, 1] })}                         | ${"2021-01-04T09:00"} | ${["2021-01-04T09:00", "2021-02-01T09:00", "2021-03-01T09:00"]}
  `("$description", ({ rule: r, start, expected }) => {
    expect(firstN(r, start, 3)).toEqual({
      moments: expected,
      status: "stopped",
    });
  });
});

describe("expandLocalMoments ordinals and week numbers", () => {
  // Mondays of 2021: Mar 1 (five in March), May 3 (five), Aug 2 (five), Nov 1 (five); other months have four.
  // Week-years: 2008, 2010, 2011, 2012, 2013 and 2014 have 52 weeks, 2009 has 53, so -52 is week 1,
  // except in 2009 where it is week 2 (Mon 2009-01-05). Week 1 of 2008 opens Mon 2007-12-31;
  // week 1 of 2013 opens Mon 2012-12-31, which still lies in the Gregorian year 2012.
  it.each`
    description                                                                          | rule                                                                                                      | start                 | n    | expected
    ${"-5MO exists only in months with five Mondays"}                                    | ${rule({ frequency: "monthly", byDay: [{ day: MO, nthOfPeriod: -5 }] })}                                  | ${"2021-03-01T09:00"} | ${4} | ${["2021-03-01T09:00", "2021-05-03T09:00", "2021-08-02T09:00", "2021-11-01T09:00"]}
    ${"GMT: BYMONTHDAY=1..7 with 1SU adds the start's month, scoping 1SU to it"}         | ${rule({ frequency: "yearly", byMonthDay: [1, 2, 3, 4, 5, 6, 7], byDay: [{ day: SU, nthOfPeriod: 1 }] })} | ${"2024-03-03T09:00"} | ${4} | ${["2024-03-03T09:00", "2025-03-02T09:00", "2026-03-01T09:00", "2027-03-07T09:00"]}
    ${"GMT: BYWEEKNO=-52 counts from the end of the week-year across the year boundary"} | ${rule({ frequency: "yearly", byWeekNo: [-52], byDay: [{ day: MO }] })}                                   | ${"2007-12-31T09:00"} | ${7} | ${["2007-12-31T09:00", "2009-01-05T09:00", "2010-01-04T09:00", "2011-01-03T09:00", "2012-01-02T09:00", "2012-12-31T09:00", "2013-12-30T09:00"]}
  `("$description", ({ rule: r, start, n, expected }) => {
    expect(firstN(r, start, n)).toEqual({
      moments: expected,
      status: "stopped",
    });
  });
});

describe("expandLocalMoments budget", () => {
  /** An array that counts how many days the day filter evaluates it against. */
  class CountingList extends Array<number> {
    static calls = 0;

    override some(
      ...args: Parameters<Array<number>["some"]>
    ): ReturnType<Array<number>["some"]> {
      CountingList.calls++;

      return super.some(...args);
    }
  }

  function countingList(): number[] {
    const list = new CountingList();
    list.push(1, 2, 3);

    return list;
  }

  beforeEach(() => {
    CountingList.calls = 0;
  });

  it.each`
    description                                             | frequency     | budget | calls
    ${"a yearly period never scans past the budget"}        | ${"yearly"}   | ${100} | ${null}
    ${"a yearly period with a budget of 1 scans none"}      | ${"yearly"}   | ${1}   | ${0}
    ${"a secondly day check with a budget of 1 scans none"} | ${"secondly"} | ${1}   | ${0}
  `("$description", ({ frequency, budget, calls }) => {
    const r = rule({
      frequency,
      byMonth: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      byMonthDay: countingList(),
    });
    const status = expandLocalMoments(
      r,
      moment("2024-01-01T09:00"),
      moment("2024-01-01T09:00").day,
      () => true,
      budget,
    );

    // A budget of 1 is spent on the period, so a day check that charged before testing the
    // budget would still end "capped" but would have scanned once: pin the exact count.
    expect({
      status,
      calls: calls === null ? CountingList.calls <= budget : CountingList.calls,
    }).toEqual({ status: "capped", calls: calls === null ? true : calls });
  });
});
