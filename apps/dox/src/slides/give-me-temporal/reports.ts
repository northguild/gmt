/**
 * The filing slides' reports. A report's observed and expected lines are written from that
 * filing's own summary and its linked report; the reproduction appears only where the filing
 * carries one. Nothing runs on stage, and no bug is described beyond what its filing says.
 */

export interface Report {
  /** A `filingKey`. */
  filing: string;
  /** The filing's reproduction: its code and, where the filing records them, what it printed and what it should print. */
  repro?: { code: string; output?: readonly string[]; want?: string };
  observed: string;
  expected: string;
}

export const REPORTS = {
  /** Both runs format in `gd`, the BCP 47 language tag for Scottish Gaelic. */
  abort: [
    {
      filing: "nodejs/node#67076",
      repro: {
        code: `node -e "new Intl.DateTimeFormat('gd',{year:'numeric',month:'short',timeZone:'UTC'}).formatToParts(0)"`,
        output: ["#", "# Fatal error in , line 0", "# unreachable code", "#"],
      },
      observed: "Node stops the whole process.",
      expected: "The parts of a formatted date.",
    },
    {
      filing: "CLDR-19873",
      repro: {
        code: `node -p "new Intl.DateTimeFormat('gd',{year:'numeric',month:'short',timeZone:'UTC'}).format(Date.UTC(2024,11,30))"`, // date-ban: the filing's own command, quoted as text; never run
        output: ["Dùbh 2025"],
        want: "Dùbh 2024",
      },
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
        code: `Temporal.PlainDate.from({
  calendar: "persian", year: 1503, monthCode: "M01", day: 1
})`,
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
      repro: {
        code: `Temporal.PlainDate.from("2000-01-01")
  .until("2001-01-01", {
    largestUnit: "years",
    smallestUnit: "months",
    roundingMode: "halfExpand"
  })
  .toString()`,
        output: ['"P1Y1M"'],
        want: '"P1Y"',
      },
      observed:
        "Node 26 adds one smallestUnit when until() or round() gives a whole number of years, months or weeks.",
      expected: "The whole number, with nothing added.",
    },
  ],
} as const satisfies Record<string, readonly Report[]>;
