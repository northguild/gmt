import { describe, expect, it } from "vitest";
import { Temporal } from "../../internal/temporal";
import { parseRecurrenceRule } from "../parse/parseRecurrenceRule";
import { expandRecurrence } from "./expandRecurrence";

// RFC 5545 §3.8.5.3, "Recurrence Rule", Example. Every example assumes the Eastern United States
// time zone. The expected lists are the RFC's own, group by group: the RFC labels each group of
// dates EDT (-04:00) or EST (-05:00) and prints 9:00 AM, so the instant is the printed wall time at
// the printed offset. US rules of the time: DST ended 1997-10-26 and began 1998-04-05, 1999-04-04,
// 2000-04-02, 2001-04-01, 2003-04-06, 2006-04-02, 2007-03-11 (the RFC's own EDT/EST labels agree).

const ZONE = "America/New_York";
const MONTHS: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};
const OFFSETS = { EDT: "-04:00", EST: "-05:00" } as const;

type Expected = { local: string; instant: string };

const two = (n: number): string => String(n).padStart(2, "0");

/** "2,4,9-11,2-30/2" to day numbers. */
function days(text: string): number[] {
  return text.split(",").flatMap((item) => {
    const match = /^(\d+)(?:-(\d+)(?:\/(\d+))?)?$/.exec(item.trim());
    if (match === null) throw new Error(`bad day item ${item}`);
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    const step = match[3] === undefined ? 1 : Number(match[3]);
    const out: number[] = [];
    for (let d = from; d <= to; d += step) out.push(d);
    return out;
  });
}

/** "EDT 1997: Sep 2-11; Oct 1-25" to rows at `time`, the RFC's printed groups. */
function groups(lines: string[], time = "09:00:00"): Expected[] {
  return lines.flatMap((line) => {
    const [head, rest] = line.split(":", 2) as [string, string];
    const [label, year] = head.trim().split(" ") as [
      keyof typeof OFFSETS,
      string,
    ];
    return rest.split(";").flatMap((part) => {
      const [month, list] = part.trim().split(" ") as [string, string];
      return days(list).map((day) => {
        const local = `${year}-${two(MONTHS[month]!)}-${two(day)}T${time}`;
        return {
          local,
          instant: Temporal.Instant.from(
            `${local}${OFFSETS[label]}`,
          ).toString(),
        };
      });
    });
  });
}

/** Wall times printed as `HH:MM` on one EDT day. */
function edtTimes(date: string, times: string[]): Expected[] {
  return times.map((time) => {
    const local = `${date}T${time}:00`;
    return {
      local,
      instant: Temporal.Instant.from(`${local}-04:00`).toString(),
    };
  });
}

function run(
  ruleText: string,
  dtstart: string,
  expected: Expected[],
  mode: "finite" | "forever",
  options?: { exdate?: string[] },
): Expected[] {
  const rule = parseRecurrenceRule(ruleText)!;
  const first = Temporal.PlainDateTime.from(dtstart)
    .toZonedDateTime(ZONE)
    .toInstant();
  const window =
    mode === "finite"
      ? { start: first.toString(), end: "2100-01-01T00:00:00Z" }
      : {
          after: first.subtract({ seconds: 1 }).toString(),
          count: expected.length,
        };
  return expandRecurrence(rule, dtstart, ZONE, window, options).map((row) => ({
    local: row.local,
    instant: row.instant,
  }));
}

type Example = {
  name: string;
  dtstart: string;
  rrule: string;
  expected: Expected[];
  mode: "finite" | "forever";
  exdate?: string[];
};

const DAILY = "1997-09-02T09:00:00";

const examples: Example[] = [
  {
    name: "daily for 10 occurrences",
    dtstart: DAILY,
    rrule: "FREQ=DAILY;COUNT=10",
    mode: "finite",
    expected: groups(["EDT 1997: Sep 2-11"]),
  },
  {
    name: "daily until December 24, 1997",
    dtstart: DAILY,
    rrule: "FREQ=DAILY;UNTIL=19971224T000000Z",
    mode: "finite",
    expected: groups([
      "EDT 1997: Sep 2-30; Oct 1-25",
      "EST 1997: Oct 26-31; Nov 1-30; Dec 1-23",
    ]),
  },
  {
    name: "every other day, forever (printed through December 3)",
    dtstart: DAILY,
    rrule: "FREQ=DAILY;INTERVAL=2",
    mode: "forever",
    expected: groups([
      "EDT 1997: Sep 2-30/2; Oct 2-24/2",
      "EST 1997: Oct 26-30/2; Nov 1-29/2; Dec 1-3/2",
    ]),
  },
  {
    name: "every 10 days, 5 occurrences",
    dtstart: DAILY,
    rrule: "FREQ=DAILY;INTERVAL=10;COUNT=5",
    mode: "finite",
    expected: groups(["EDT 1997: Sep 2,12,22; Oct 2,12"]),
  },
  {
    name: "every day in January for 3 years, YEARLY form",
    dtstart: "1998-01-01T09:00:00",
    rrule:
      "FREQ=YEARLY;UNTIL=20000131T140000Z;BYMONTH=1;BYDAY=SU,MO,TU,WE,TH,FR,SA",
    mode: "finite",
    expected: groups([
      "EST 1998: Jan 1-31",
      "EST 1999: Jan 1-31",
      "EST 2000: Jan 1-31",
    ]),
  },
  {
    name: "every day in January for 3 years, DAILY form",
    dtstart: "1998-01-01T09:00:00",
    rrule: "FREQ=DAILY;UNTIL=20000131T140000Z;BYMONTH=1",
    mode: "finite",
    expected: groups([
      "EST 1998: Jan 1-31",
      "EST 1999: Jan 1-31",
      "EST 2000: Jan 1-31",
    ]),
  },
  {
    name: "weekly for 10 occurrences",
    dtstart: DAILY,
    rrule: "FREQ=WEEKLY;COUNT=10",
    mode: "finite",
    expected: groups([
      "EDT 1997: Sep 2,9,16,23,30; Oct 7,14,21",
      "EST 1997: Oct 28; Nov 4",
    ]),
  },
  {
    name: "weekly until December 24, 1997",
    dtstart: DAILY,
    rrule: "FREQ=WEEKLY;UNTIL=19971224T000000Z",
    mode: "finite",
    expected: groups([
      "EDT 1997: Sep 2,9,16,23,30; Oct 7,14,21",
      "EST 1997: Oct 28; Nov 4,11,18,25; Dec 2,9,16,23",
    ]),
  },
  {
    name: "every other week, forever (printed through February 17)",
    dtstart: DAILY,
    rrule: "FREQ=WEEKLY;INTERVAL=2;WKST=SU",
    mode: "forever",
    expected: groups([
      "EDT 1997: Sep 2,16,30; Oct 14",
      "EST 1997: Oct 28; Nov 11,25; Dec 9,23",
      "EST 1998: Jan 6,20; Feb 3,17",
    ]),
  },
  {
    name: "weekly on Tuesday and Thursday for five weeks, UNTIL form",
    dtstart: DAILY,
    rrule: "FREQ=WEEKLY;UNTIL=19971007T000000Z;WKST=SU;BYDAY=TU,TH",
    mode: "finite",
    expected: groups(["EDT 1997: Sep 2,4,9,11,16,18,23,25,30; Oct 2"]),
  },
  {
    name: "weekly on Tuesday and Thursday for five weeks, COUNT form",
    dtstart: DAILY,
    rrule: "FREQ=WEEKLY;COUNT=10;WKST=SU;BYDAY=TU,TH",
    mode: "finite",
    expected: groups(["EDT 1997: Sep 2,4,9,11,16,18,23,25,30; Oct 2"]),
  },
  {
    name: "every other week on Monday, Wednesday and Friday until December 24, 1997",
    dtstart: "1997-09-01T09:00:00",
    rrule:
      "FREQ=WEEKLY;INTERVAL=2;UNTIL=19971224T000000Z;WKST=SU;BYDAY=MO,WE,FR",
    mode: "finite",
    expected: groups([
      "EDT 1997: Sep 1,3,5,15,17,19,29; Oct 1,3,13,15,17",
      "EST 1997: Oct 27,29,31; Nov 10,12,14,24,26,28; Dec 8,10,12,22",
    ]),
  },
  {
    name: "every other week on Tuesday and Thursday, 8 occurrences",
    dtstart: DAILY,
    rrule: "FREQ=WEEKLY;INTERVAL=2;COUNT=8;WKST=SU;BYDAY=TU,TH",
    mode: "finite",
    expected: groups(["EDT 1997: Sep 2,4,16,18,30; Oct 2,14,16"]),
  },
  {
    name: "monthly on the first Friday, 10 occurrences",
    dtstart: "1997-09-05T09:00:00",
    rrule: "FREQ=MONTHLY;COUNT=10;BYDAY=1FR",
    mode: "finite",
    expected: groups([
      "EDT 1997: Sep 5; Oct 3",
      "EST 1997: Nov 7; Dec 5",
      "EST 1998: Jan 2; Feb 6; Mar 6; Apr 3",
      "EDT 1998: May 1; Jun 5",
    ]),
  },
  {
    name: "monthly on the first Friday until December 24, 1997",
    dtstart: "1997-09-05T09:00:00",
    rrule: "FREQ=MONTHLY;UNTIL=19971224T000000Z;BYDAY=1FR",
    mode: "finite",
    expected: groups(["EDT 1997: Sep 5; Oct 3", "EST 1997: Nov 7; Dec 5"]),
  },
  {
    name: "every other month on the first and last Sunday, 10 occurrences",
    dtstart: "1997-09-07T09:00:00",
    rrule: "FREQ=MONTHLY;INTERVAL=2;COUNT=10;BYDAY=1SU,-1SU",
    mode: "finite",
    expected: groups([
      "EDT 1997: Sep 7,28",
      "EST 1997: Nov 2,30",
      "EST 1998: Jan 4,25; Mar 1,29",
      "EDT 1998: May 3,31",
    ]),
  },
  {
    name: "monthly on the second-to-last Monday, 6 months",
    dtstart: "1997-09-22T09:00:00",
    rrule: "FREQ=MONTHLY;COUNT=6;BYDAY=-2MO",
    mode: "finite",
    expected: groups([
      "EDT 1997: Sep 22; Oct 20",
      "EST 1997: Nov 17; Dec 22",
      "EST 1998: Jan 19; Feb 16",
    ]),
  },
  {
    name: "monthly on the third-to-last day, forever (printed through February 26)",
    dtstart: "1997-09-28T09:00:00",
    rrule: "FREQ=MONTHLY;BYMONTHDAY=-3",
    mode: "forever",
    expected: groups([
      "EDT 1997: Sep 28",
      "EST 1997: Oct 29; Nov 28; Dec 29",
      "EST 1998: Jan 29; Feb 26",
    ]),
  },
  {
    name: "monthly on the 2nd and 15th, 10 occurrences",
    dtstart: DAILY,
    rrule: "FREQ=MONTHLY;COUNT=10;BYMONTHDAY=2,15",
    mode: "finite",
    expected: groups([
      "EDT 1997: Sep 2,15; Oct 2,15",
      "EST 1997: Nov 2,15; Dec 2,15",
      "EST 1998: Jan 2,15",
    ]),
  },
  {
    name: "monthly on the first and last day, 10 occurrences",
    dtstart: "1997-09-30T09:00:00",
    rrule: "FREQ=MONTHLY;COUNT=10;BYMONTHDAY=1,-1",
    mode: "finite",
    expected: groups([
      "EDT 1997: Sep 30; Oct 1",
      "EST 1997: Oct 31; Nov 1,30; Dec 1,31",
      "EST 1998: Jan 1,31; Feb 1",
    ]),
  },
  {
    name: "every 18 months on the 10th thru 15th, 10 occurrences",
    dtstart: "1997-09-10T09:00:00",
    rrule: "FREQ=MONTHLY;INTERVAL=18;COUNT=10;BYMONTHDAY=10,11,12,13,14,15",
    mode: "finite",
    expected: groups(["EDT 1997: Sep 10-15", "EST 1999: Mar 10-13"]),
  },
  {
    name: "every Tuesday, every other month (printed through March 31)",
    dtstart: DAILY,
    rrule: "FREQ=MONTHLY;INTERVAL=2;BYDAY=TU",
    mode: "forever",
    expected: groups([
      "EDT 1997: Sep 2,9,16,23,30",
      "EST 1997: Nov 4,11,18,25",
      "EST 1998: Jan 6,13,20,27; Mar 3,10,17,24,31",
    ]),
  },
  {
    name: "yearly in June and July, 10 occurrences",
    dtstart: "1997-06-10T09:00:00",
    rrule: "FREQ=YEARLY;COUNT=10;BYMONTH=6,7",
    mode: "finite",
    expected: groups([
      "EDT 1997: Jun 10; Jul 10",
      "EDT 1998: Jun 10; Jul 10",
      "EDT 1999: Jun 10; Jul 10",
      "EDT 2000: Jun 10; Jul 10",
      "EDT 2001: Jun 10; Jul 10",
    ]),
  },
  {
    name: "every other year on January, February and March, 10 occurrences",
    dtstart: "1997-03-10T09:00:00",
    rrule: "FREQ=YEARLY;INTERVAL=2;COUNT=10;BYMONTH=1,2,3",
    mode: "finite",
    expected: groups([
      "EST 1997: Mar 10",
      "EST 1999: Jan 10; Feb 10; Mar 10",
      "EST 2001: Jan 10; Feb 10; Mar 10",
      "EST 2003: Jan 10; Feb 10; Mar 10",
    ]),
  },
  {
    name: "every third year on the 1st, 100th and 200th day, 10 occurrences",
    dtstart: "1997-01-01T09:00:00",
    rrule: "FREQ=YEARLY;INTERVAL=3;COUNT=10;BYYEARDAY=1,100,200",
    mode: "finite",
    expected: groups([
      "EST 1997: Jan 1",
      "EDT 1997: Apr 10; Jul 19",
      "EST 2000: Jan 1",
      "EDT 2000: Apr 9; Jul 18",
      "EST 2003: Jan 1",
      "EDT 2003: Apr 10; Jul 19",
      "EST 2006: Jan 1",
    ]),
  },
  {
    name: "every 20th Monday of the year, forever (printed through 1999)",
    dtstart: "1997-05-19T09:00:00",
    rrule: "FREQ=YEARLY;BYDAY=20MO",
    mode: "forever",
    expected: groups([
      "EDT 1997: May 19",
      "EDT 1998: May 18",
      "EDT 1999: May 17",
    ]),
  },
  {
    name: "Monday of week number 20, forever (printed through 1999)",
    dtstart: "1997-05-12T09:00:00",
    rrule: "FREQ=YEARLY;BYWEEKNO=20;BYDAY=MO",
    mode: "forever",
    expected: groups([
      "EDT 1997: May 12",
      "EDT 1998: May 11",
      "EDT 1999: May 17",
    ]),
  },
  {
    name: "every Thursday in March, forever (printed through 1999)",
    dtstart: "1997-03-13T09:00:00",
    rrule: "FREQ=YEARLY;BYMONTH=3;BYDAY=TH",
    mode: "forever",
    expected: groups([
      "EST 1997: Mar 13,20,27",
      "EST 1998: Mar 5,12,19,26",
      "EST 1999: Mar 4,11,18,25",
    ]),
  },
  {
    name: "every Thursday during June, July and August, forever (printed through 1999)",
    dtstart: "1997-06-05T09:00:00",
    rrule: "FREQ=YEARLY;BYDAY=TH;BYMONTH=6,7,8",
    mode: "forever",
    expected: groups([
      "EDT 1997: Jun 5,12,19,26; Jul 3,10,17,24,31; Aug 7,14,21,28",
      "EDT 1998: Jun 4,11,18,25; Jul 2,9,16,23,30; Aug 6,13,20,27",
      "EDT 1999: Jun 3,10,17,24; Jul 1,8,15,22,29; Aug 5,12,19,26",
    ]),
  },
  {
    // The EXDATE removes DTSTART, which counts as the first instance but is not a Friday the 13th.
    // Erratum 5920 is Rejected, so the example stands as printed.
    name: "every Friday the 13th, forever, with DTSTART excluded",
    dtstart: DAILY,
    rrule: "FREQ=MONTHLY;BYDAY=FR;BYMONTHDAY=13",
    mode: "forever",
    exdate: ["1997-09-02T09:00:00"],
    expected: groups([
      "EST 1998: Feb 13; Mar 13; Nov 13",
      "EDT 1999: Aug 13",
      "EDT 2000: Oct 13",
    ]),
  },
  {
    name: "the first Saturday that follows the first Sunday, forever (printed through June 13, 1998)",
    dtstart: "1997-09-13T09:00:00",
    rrule: "FREQ=MONTHLY;BYDAY=SA;BYMONTHDAY=7,8,9,10,11,12,13",
    mode: "forever",
    expected: groups([
      "EDT 1997: Sep 13; Oct 11",
      "EST 1997: Nov 8; Dec 13",
      "EST 1998: Jan 10; Feb 7; Mar 7",
      "EDT 1998: Apr 11; May 9; Jun 13",
    ]),
  },
  {
    name: "U.S. Presidential Election day, every 4 years, forever (printed through 2004)",
    dtstart: "1996-11-05T09:00:00",
    rrule:
      "FREQ=YEARLY;INTERVAL=4;BYMONTH=11;BYDAY=TU;BYMONTHDAY=2,3,4,5,6,7,8",
    mode: "forever",
    expected: groups(["EST 1996: Nov 5", "EST 2000: Nov 7", "EST 2004: Nov 2"]),
  },
  {
    name: "the third instance into the month of Tuesday, Wednesday or Thursday, 3 months",
    dtstart: "1997-09-04T09:00:00",
    rrule: "FREQ=MONTHLY;COUNT=3;BYDAY=TU,WE,TH;BYSETPOS=3",
    mode: "finite",
    expected: groups(["EDT 1997: Sep 4; Oct 7", "EST 1997: Nov 6"]),
  },
  {
    name: "the second-to-last weekday of the month, forever (printed through March 30)",
    dtstart: "1997-09-29T09:00:00",
    rrule: "FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-2",
    mode: "forever",
    expected: groups([
      "EDT 1997: Sep 29",
      "EST 1997: Oct 30; Nov 27; Dec 30",
      "EST 1998: Jan 29; Feb 26; Mar 30",
    ]),
  },
  {
    // Erratum 3883 (Verified): the printed UNTIL=19970902T170000Z is 13:00 EDT, which is not the
    // 5:00 PM EDT the text says. 21:00Z is 17:00 EDT: 09:00, 12:00 and 15:00 (18:00 is after it).
    name: "every 3 hours from 9:00 AM to 5:00 PM, UNTIL corrected by Erratum 3883",
    dtstart: DAILY,
    rrule: "FREQ=HOURLY;INTERVAL=3;UNTIL=19970902T210000Z",
    mode: "finite",
    expected: edtTimes("1997-09-02", ["09:00", "12:00", "15:00"]),
  },
  {
    // As printed: 17:00Z is 13:00 EDT, so 09:00 (13:00Z) and 12:00 (16:00Z) are in, 15:00 (19:00Z) is not.
    name: "every 3 hours, UNTIL as printed (170000Z is 13:00 EDT)",
    dtstart: DAILY,
    rrule: "FREQ=HOURLY;INTERVAL=3;UNTIL=19970902T170000Z",
    mode: "finite",
    expected: edtTimes("1997-09-02", ["09:00", "12:00"]),
  },
  {
    name: "every 15 minutes for 6 occurrences",
    dtstart: DAILY,
    rrule: "FREQ=MINUTELY;INTERVAL=15;COUNT=6",
    mode: "finite",
    expected: edtTimes("1997-09-02", [
      "09:00",
      "09:15",
      "09:30",
      "09:45",
      "10:00",
      "10:15",
    ]),
  },
  {
    name: "every hour and a half for 4 occurrences",
    dtstart: DAILY,
    rrule: "FREQ=MINUTELY;INTERVAL=90;COUNT=4",
    mode: "finite",
    expected: edtTimes("1997-09-02", ["09:00", "10:30", "12:00", "13:30"]),
  },
  {
    name: "WKST=MO makes the days generated Aug 5, 10, 19, 24",
    dtstart: "1997-08-05T09:00:00",
    rrule: "FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=MO",
    mode: "finite",
    expected: groups(["EDT 1997: Aug 5,10,19,24"]),
  },
  {
    name: "WKST=SU makes the days generated Aug 5, 17, 19, 31",
    dtstart: "1997-08-05T09:00:00",
    rrule: "FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=SU",
    mode: "finite",
    expected: groups(["EDT 1997: Aug 5,17,19,31"]),
  },
  {
    // The invalid date (February 30) is ignored and not counted; March 11, 2007 is the spring gap day.
    name: "an invalid date (February 30) is ignored",
    dtstart: "2007-01-15T09:00:00",
    rrule: "FREQ=MONTHLY;BYMONTHDAY=15,30;COUNT=5",
    mode: "finite",
    expected: groups(["EST 2007: Jan 15,30; Feb 15", "EDT 2007: Mar 15,30"]),
  },
];

/** The template-literal form of `it.each`, for a table whose rows are built in code. */
function table(header: string): TemplateStringsArray {
  return Object.assign([header], { raw: [header] }) as TemplateStringsArray;
}

describe("expandRecurrence, RFC 5545 §3.8.5.3 examples", () => {
  it.each(
    table("name | dtstart | rrule | mode | exdate | expected"),
    ...examples.flatMap((e) => [
      e.name,
      e.dtstart,
      e.rrule,
      e.mode,
      e.exdate,
      e.expected,
    ]),
  )(
    "$name ($rrule from $dtstart)",
    ({ dtstart, rrule, expected, mode, exdate }) => {
      expect(
        run(rrule, dtstart, expected, mode, exdate ? { exdate } : undefined),
      ).toEqual(expected);
    },
  );

  // "Every 20 minutes from 9:00 AM to 4:40 PM every day": the first day, both forms.
  const everyTwentyMinutes = edtTimes(
    "1997-09-02",
    Array.from({ length: 8 }, (_, h) =>
      [0, 20, 40].map((m) => `${two(9 + h)}:${two(m)}`),
    ).flat(),
  );

  it.each`
    form                      | rrule
    ${"DAILY with BYMINUTE"}  | ${"FREQ=DAILY;BYHOUR=9,10,11,12,13,14,15,16;BYMINUTE=0,20,40"}
    ${"MINUTELY with BYHOUR"} | ${"FREQ=MINUTELY;INTERVAL=20;BYHOUR=9,10,11,12,13,14,15,16"}
  `(
    "every 20 minutes from 9:00 AM to 4:40 PM, first day, $form",
    ({ rrule }) => {
      const window = {
        start: "1997-09-02T13:00:00Z",
        end: "1997-09-03T04:00:00Z",
      };
      const rows = expandRecurrence(
        parseRecurrenceRule(rrule)!,
        DAILY,
        ZONE,
        window,
      ).map((row) => ({
        local: row.local,
        instant: row.instant,
      }));

      expect(rows).toEqual(everyTwentyMinutes);
      expect(rows).toHaveLength(24);
    },
  );
});

// RFC 5545 §3.8.5.1 (EXDATE) and §3.8.5.2 (RDATE) examples. The RFC prints only the property lines,
// with no rule, so each is paired with a rule whose rows the property changes. The values are the
// RFC's own, written in ISO 8601 extended form (the form the options take). The 1996 and 1997 dates
// are in the Eastern zone: EDT -04:00 on 1997-07-14. Erratum 3883 concerns the HOURLY example of
// §3.8.5.3 (above); no erratum touches these two sections.
describe("expandRecurrence, RFC 5545 §3.8.5.1 and §3.8.5.2 examples", () => {
  const at = (local: string) => ({ local, instant: `${local}Z` });
  const pick = (rows: ReturnType<typeof expandRecurrence>) =>
    rows.map(({ local, instant }) => ({ local, instant }));
  const WIDE = { start: "1990-01-01T00:00:00Z", end: "2100-01-01T00:00:00Z" };

  it("EXDATE:19960402T010000Z,19960403T010000Z,19960404T010000Z removes those three days", () => {
    expect(
      pick(
        expandRecurrence(
          parseRecurrenceRule("FREQ=DAILY;COUNT=5")!,
          "1996-04-01T01:00:00",
          "UTC",
          WIDE,
          {
            exdate: [
              "1996-04-02T01:00:00Z",
              "1996-04-03T01:00:00Z",
              "1996-04-04T01:00:00Z",
            ],
          },
        ),
      ),
    ).toEqual([at("1996-04-01T01:00:00"), at("1996-04-05T01:00:00")]);
  });

  it("the same EXDATE removes the same instants from a rule in the Eastern zone", () => {
    // 01:00Z on 1996-04-02 is 20:00 EST on 04-01 (DST began 1996-04-07), so a rule at 20:00 local
    // has its first three rows at the three EXDATE instants, and the 04-04 and 04-05 rows stay.
    expect(
      pick(
        expandRecurrence(
          parseRecurrenceRule("FREQ=DAILY;COUNT=5")!,
          "1996-04-01T20:00:00",
          ZONE,
          WIDE,
          {
            exdate: [
              "1996-04-02T01:00:00Z",
              "1996-04-03T01:00:00Z",
              "1996-04-04T01:00:00Z",
            ],
          },
        ),
      ),
    ).toEqual([
      { local: "1996-04-04T20:00:00", instant: "1996-04-05T01:00:00Z" },
      { local: "1996-04-05T20:00:00", instant: "1996-04-06T01:00:00Z" },
    ]);
  });

  it.each`
    form                                             | rdate                     | expected
    ${"RDATE:19970714T123000Z"}                      | ${"1997-07-14T12:30:00Z"} | ${[{ local: "1997-07-14T08:30:00", instant: "1997-07-14T12:30:00Z" }]}
    ${"RDATE;TZID=America/New_York:19970714T083000"} | ${"1997-07-14T08:30:00"}  | ${[{ local: "1997-07-14T08:30:00", instant: "1997-07-14T12:30:00Z" }]}
  `("$form adds one occurrence, 08:30 EDT", ({ rdate, expected }) => {
    expect(
      pick(
        expandRecurrence(
          parseRecurrenceRule("FREQ=DAILY;COUNT=1")!,
          "1997-07-01T08:30:00",
          ZONE,
          WIDE,
          { rdate: [rdate] },
        ),
      ).slice(1),
    ).toEqual(expected);
  });

  it("both forms of the same moment are one occurrence", () => {
    expect(
      expandRecurrence(
        parseRecurrenceRule("FREQ=DAILY;COUNT=1")!,
        "1997-07-01T08:30:00",
        ZONE,
        WIDE,
        { rdate: ["1997-07-14T12:30:00Z", "1997-07-14T08:30:00"] },
      ),
    ).toHaveLength(2);
  });

  it.each`
    form                                                      | rdate
    ${"RDATE;VALUE=PERIOD:19960403T020000Z/19960403T040000Z"} | ${"1996-04-03T02:00:00Z/1996-04-03T04:00:00Z"}
    ${"RDATE;VALUE=PERIOD:19960404T010000Z/PT3H"}             | ${"1996-04-04T01:00:00Z/PT3H"}
    ${"RDATE;VALUE=DATE:19970101,19970120,..."}               | ${"1997-01-01"}
  `("$form is out of scope and returns []", ({ rdate }) => {
    expect(
      expandRecurrence(
        parseRecurrenceRule("FREQ=DAILY;COUNT=1")!,
        "1997-07-01T08:30:00",
        ZONE,
        WIDE,
        { rdate: [rdate] },
      ),
    ).toEqual([]);
  });
});
