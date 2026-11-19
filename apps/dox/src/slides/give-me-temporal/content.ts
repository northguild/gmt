/**
 * What Deck 0's slides share: the filing slides' reports (the route itself is read from the slides' places by the stage). A report's observed and expected lines are written from that
 * filing's own summary and its linked report; the reproduction appears only where the filing
 * carries one. Nothing runs on stage, and no bug is described beyond what its filing says.
 */

import { addDate, diffDateTime } from "@northguild/gmt/plain/calculate";
import { formatDate } from "@northguild/gmt/plain/format";
import { convertUtcToZoned } from "@northguild/gmt/utc/convert";
import chineseMonth from "./chinese-month.json";
import newMoon from "./new-moon.json";

export interface Report {
  /** A `filingKey`. */
  filing: string;
  repro?: { code: string };
  observed: string;
  expected: string;
}

export const REPORTS = {
  abort: [
    {
      filing: "nodejs/node#67076",
      repro: {
        code: `node -e "new Intl.DateTimeFormat('gd',{year:'numeric',month:'short',timeZone:'UTC'}).formatToParts(0)"`,
      },
      observed: "Node stops the whole process.",
      expected: "The parts of a formatted date.",
    },
    {
      filing: "CLDR-19873",
      observed:
        "Some languages' date patterns print the week-of-year year where the calendar year belongs.",
      expected: "The calendar year.",
    },
  ],
  years: [
    {
      filing: "ICU-23609",
      observed:
        "ICU4C 75 and later counts every Persian year before year 0 as a leap year.",
      expected: "Leap years by the Persian rule.",
    },
    {
      filing: "fullcalendar/temporal-polyfill#127",
      repro: {
        code: `Temporal.PlainDate.from({ calendar: "persian", year: 1503, monthCode: "M01", day: 1 })`,
      },
      observed: "2124-03-21 in the polyfill.",
      expected: "2124-03-20, as native Temporal gives.",
    },
    {
      filing: "ICU-23619",
      observed: "Meiji 1 to 5 for 1868-10-23 to 1872-12-31.",
      expected: "The Gregorian era up to the end of 1872.",
    },
    {
      filing: "js-temporal/temporal-polyfill#368",
      repro: {
        code: `Temporal.PlainDate.from("1870-03-01").withCalendar("japanese")`,
      },
      observed: "Era meiji, year 3.",
      expected: "Era ce, year 1870.",
    },
  ],
  dayOff: [
    {
      filing: "ICU-23627",
      observed:
        "Every Indian-calendar month before Julian Day 0 starts one day late.",
      expected: "Months that start on the right day.",
    },
    {
      filing: "fullcalendar/temporal-polyfill#128",
      observed: "Chinese New Year 2027 on 7 February.",
      expected: "6 February, as native Temporal gives.",
    },
  ],
  manila: [
    {
      filing: "tc39/proposal-temporal#3330",
      observed:
        "Time zone lookups before 1847 miss the transition on 1844-12-31 in Asia/Manila and four Pacific zones.",
      expected: "The 1844-12-31 transition is found.",
    },
  ],
  engines: [
    {
      filing: "nodejs/node#67457",
      observed:
        "Node 26 adds one smallestUnit when until() or round() gives a whole number of years, months or weeks.",
      expected: "The whole number, with nothing added.",
    },
  ],
} as const satisfies Record<string, readonly Report[]>;

/**
 * Cited primary sources. A figure on a slide comes from its filing or from a record here;
 * `content.test.ts` holds each cited value to the filing's text or to the record's field.
 */
export const SOURCES = {
  /** What the U.S. Naval Observatory's API returned for the 2027 phases of the Moon. */
  newMoon2027: newMoon,
  /** The Hong Kong Observatory on how a Chinese calendar month starts, and on which clock. */
  chineseMonth,
} as const;

/** What the new-moon panel says, worked out by gmt from the source records. */
export function newMoonFacts() {
  const record = SOURCES.newMoon2027;
  const zone = "Asia/Shanghai";
  const zoned = convertUtcToZoned(record.utc, zone);
  const local = zoned.slice(0, 16);
  const date = local.slice(0, 10);
  const midnight = `${addDate(date, { days: 1 })}T00:00:00`;
  const minutes = diffDateTime(`${local}:00`, midnight, "minutes");
  const { year, month, day, time } = record.phase;
  const utcDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    zone,
    utcDay: formatDate(utcDate, "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    utcTime: time,
    localTime: local.slice(11),
    localDay: formatDate(date, "en-GB", { day: "numeric", month: "long" }),
    minutesToMidnight: minutes,
    source: record.source,
    url: record.url,
    timeScale: record.timeScale,
    /** Shanghai's UTC offset at the new moon, as gmt gives it. */
    zoneOffset: zoned.slice(19, 25),
    /** The calendar's clock, as the Observatory states it ("UTC plus eight hours"). */
    calendarClock: `UTC+${Number(SOURCES.chineseMonth.offset.slice(1, 3))}`,
    calendarSource: SOURCES.chineseMonth.source,
    calendarUrl: SOURCES.chineseMonth.url,
  };
}

/**
 * What each bug slide draws, written from its report's own observed and expected lines and from
 * nothing else: `content.test.ts` holds every value here to the text it came from, so a figure that
 * drifts from its report fails a test. A slide never runs the code it shows.
 */

/** A split-flap row's end value: who gave it (or the words before the number), and the number as the report writes it. */
export interface CounterEnd {
  label: string;
  value: string;
}

export const VISUALS = {
  /** `nodejs/node#67076`: the recorded command and what the process did. */
  terminal: {
    command: REPORTS.abort[0].repro.code,
    output: REPORTS.abort[0].observed,
    expected: REPORTS.abort[0].expected,
  },
  /** A split-flap board per build, its rows landing on the expected and the observed value. */
  counters: {
    /** `fullcalendar/temporal-polyfill#127`, the Persian date. */
    tehran: {
      input: REPORTS.years[1].repro.code,
      expected: { label: "native Temporal", value: "2124-03-20" },
      observed: { label: "the polyfill", value: "2124-03-21" },
    },
    /** `js-temporal/temporal-polyfill#368`, the Japanese era. */
    tokyo: {
      input: REPORTS.years[3].repro.code,
      expected: { label: "Era ce, year", value: "1870" },
      observed: { label: "Era meiji, year", value: "3" },
    },
  },
  /** Calendar figures a day apart: a week shifted one day late, and a month page with two marks. */
  calendars: {
    /** `ICU-23627`: a month that starts one day late (MonthShift). */
    kolkata: {
      heading: "First day of an Indian-calendar month",
      expected: { label: "Expected", day: 1 },
      observed: { label: "Observed", day: 2 },
      caption: "one day late",
    },
    /** `fullcalendar/temporal-polyfill#128`: Chinese New Year 2027 (MonthPage). */
    shanghai: {
      month: "2027-02",
      expected: { label: "Expected", day: 6 },
      observed: { label: "Observed", day: 7 },
      caption: "Chinese New Year",
    },
  },
  /** `nodejs/node#67457`: the one call both engines are asked. */
  engines: {
    call: "until() or round()",
    observedLabel: "Node 26",
  },
} as const;
