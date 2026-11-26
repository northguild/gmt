/**
 * What Deck 0's slides share beyond the filing reports (`reports.ts`): the cited sources, the
 * visuals and the gmt calls (the route itself is read from the slides' places by the stage).
 */

import { addDate, diffDateTime } from "@northguild/gmt/plain/calculate";
import { formatDate } from "@northguild/gmt/plain/format";
import { convertUtcToZoned } from "@northguild/gmt/utc/convert";
import type { GmtCall } from "~/components/slides/types";
import type { Fault } from "~/data/date-faults";
import { codeText } from "~/lib/slides/gmt-call";
import chineseMonth from "./chinese-month.json";
import newMoon from "./new-moon.json";
import { REPORTS } from "./reports";

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

export const VISUALS = {
  /** Recorded runs (`CodeRun`): each filing's reproduction, its result, and the value expected. */
  runs: {
    /** `nodejs/node#67076`: the command, and the process stopping. */
    crash: {
      runtime: "Node",
      prompt: "$",
      steps: [
        {
          code: REPORTS.abort[0].repro.code,
          out: REPORTS.abort[0].repro.output,
          outcome: "wrong",
          want: REPORTS.abort[0].expected,
        },
      ],
    },
    /** `CLDR-19873`: 30 December 2024 in Scottish Gaelic, printed in the next year. */
    weekYear: {
      runtime: "Node",
      prompt: "$",
      steps: [
        {
          code: REPORTS.abort[1].repro.code,
          out: REPORTS.abort[1].repro.output,
          outcome: "wrong",
          want: REPORTS.abort[1].repro.want,
        },
      ],
    },
    /** `nodejs/node#67457`: a whole year, rounded to months, gains one. */
    engines: {
      runtime: "Node 26",
      prompt: ">",
      steps: [
        {
          code: REPORTS.engines[0].repro.code,
          out: REPORTS.engines[0].repro.output,
          outcome: "wrong",
          want: REPORTS.engines[0].repro.want,
        },
      ],
    },
  },
  /** A split-flap board per build, its rows landing on the expected and the observed value. */
  counters: {
    /** `fullcalendar/temporal-polyfill#127`, the Persian date. */
    tehran: {
      runtime: "fullcalendar temporal-polyfill",
      input: REPORTS.years[1].repro.code,
      expected: { label: "native Temporal", value: "2124-03-20" },
      observed: { label: "the polyfill", value: "2124-03-21" },
    },
    /** `js-temporal/temporal-polyfill#368`, the Japanese era. */
    tokyo: {
      runtime: "@js-temporal/polyfill",
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
      expected: { day: 1 },
      observed: { day: 2 },
      caption: "one day late",
    },
    /** `fullcalendar/temporal-polyfill#128`: Chinese New Year 2027 (MonthPage). */
    shanghai: {
      month: "2027-02",
      expected: { day: 6 },
      observed: { day: 7 },
      caption: "Chinese New Year",
    },
  },
} as const;

/**
 * The Gaelic run's options: the date in the Unicode ticket's run, in `gd` (Scottish Gaelic), as a
 * year and a short month.
 */
const gaelic = [
  "2024-12-30",
  "gd",
  { year: "numeric", month: "short" },
] as const;

/**
 * The first row of the `date` slide: the agents' own question (03:30 in Helsinki on 28 March 2027)
 * asked of the built-in tool, which knows only the machine's clock. The home page's rows follow it.
 */
export const AGENTS_FAULT: Fault = {
  input: 'new Date("2027-03-28T03:30")', // date-ban: the agents' question, quoted as text; never run
  output: "04:30 on a Helsinki machine — no error",
  why: "Date cannot be told Helsinki: it reads the time on the machine's clock. That 03:30 never happens in Helsinki, so a machine set there quietly moves it to 04:30, and any other machine gives another answer.",
};

/**
 * What each bug slide's GMT step runs, on the same input as the filing, and the value each call
 * should give: the filing's own expected value where it states one, else the cited rule (tzdb for
 * Manila). The `want` marks GMT's result right or wrong, and `bug` is what the filed bug gives for
 * the same input, printed in red beside it, in its filing's own value or words. `content.test.ts`
 * holds each `want` and each `bug` to its report, and each result to its `want`.
 */
export const GMT_CALLS = {
  abort: [
    {
      module: "plain/format",
      name: "formatDate",
      args: gaelic,
      want: REPORTS.abort[1].repro.want,
      bug: { by: "Intl", gives: codeText(REPORTS.abort[1].repro.output[0]) },
    },
    {
      module: "plain/format",
      name: "formatDateToParts",
      args: gaelic,
      want: [
        { type: "month", value: "Dùbh" },
        { type: "literal", value: " " },
        { type: "year", value: "2024" },
      ],
      bug: { by: "Intl", gives: REPORTS.abort[0].observed },
    },
  ],
  years: [
    {
      module: "plain/format",
      name: "formatDate",
      args: [
        "2124-03-20",
        "en-u-ca-persian",
        { year: "numeric", month: "long", day: "numeric" },
      ],
      want: "Farvardin 1, 1503 AP",
      bug: {
        by: "temporal-polyfill",
        gives: "Farvardin 1, 1503 AP is 2124-03-21.",
      },
    },
    {
      module: "plain/format",
      name: "formatDate",
      args: [
        "1870-03-01",
        "en-u-ca-japanese",
        { era: "short", year: "numeric" },
      ],
      want: "1870 AD",
      bug: { by: "Temporal", gives: REPORTS.years[3].observed },
    },
  ],
  dayOff: [
    {
      module: "calendar/rules",
      name: "holidayDates",
      args: [
        {
          name: "Spring Festival",
          kind: "calendarFixed",
          calendar: "chinese",
          monthCode: "M01",
          day: 1,
        },
        2027,
      ],
      want: ["2027-02-06"],
      bug: { by: "temporal-polyfill", gives: REPORTS.dayOff[1].observed },
    },
  ],
  manila: [
    {
      module: "instant/convert",
      name: "resolveLocal",
      args: [
        "1844-12-30T12:00:00",
        "Asia/Manila",
        { disambiguation: "reject" },
      ],
      want: "1844-12-31T03:56:08Z",
    },
    {
      module: "instant/convert",
      name: "classifyLocal",
      args: ["1844-12-31T12:00:00", "Asia/Manila"],
      want: "nonexistent",
      bug: {
        by: "Temporal",
        gives: "Lookups before 1847 miss this skipped day.",
      },
    },
    {
      module: "instant/convert",
      name: "resolveLocal",
      args: [
        "1845-01-01T12:00:00",
        "Asia/Manila",
        { disambiguation: "reject" },
      ],
      want: "1845-01-01T03:56:08Z",
    },
  ],
  engines: [
    {
      module: "plain/calculate",
      name: "diffDateAsDuration",
      args: [
        "2000-01-01",
        "2001-01-01",
        "years",
        { smallestUnit: "months", roundingMode: "halfExpand" },
      ],
      want: "P1Y",
      bug: { by: "Node 26", gives: REPORTS.engines[0].repro.output[0] },
    },
  ],
  // The kinds slide's day after 27 March 2027, the date the grid's calls name; `bug` is the value
  // `nextDay` gave for a local time east of UTC (`date-kinds-run.json`).
  kinds: [
    {
      module: "plain/calculate",
      name: "addDate",
      args: ["2027-03-27", { days: 1 }],
      want: "2027-03-28",
      bug: { by: "Date", gives: "2027-03-27" },
    },
  ],
} as const satisfies Record<string, readonly GmtCall[]>;
