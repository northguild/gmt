import { parseRecurrenceRule } from "./parseRecurrenceRule";

const base = { interval: 1, firstDayOfWeek: 1 } as const;

describe("parseRecurrenceRule valid", () => {
  it.each`
    name                                               | input                                                                                                                      | expected
    ${"RFC 5545 3.8.5.3 20th Monday of the year"}      | ${"FREQ=YEARLY;BYDAY=20MO"}                                                                                                | ${{ frequency: "yearly", ...base, byDay: [{ day: 1, nthOfPeriod: 20 }] }}
    ${"RFC 5545 3.8.5.3 Monday of week 20"}            | ${"FREQ=YEARLY;BYWEEKNO=20;BYDAY=MO"}                                                                                      | ${{ frequency: "yearly", ...base, byDay: [{ day: 1 }], byWeekNo: [20] }}
    ${"RFC 5545 3.8.5.3 second-to-last weekday"}       | ${"FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-2"}                                                                         | ${{ frequency: "monthly", ...base, byDay: [{ day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 }], bySetPosition: [-2] }}
    ${"RFC 5545 3.8.5.3 every third year, 10 times"}   | ${"FREQ=YEARLY;INTERVAL=3;COUNT=10;BYYEARDAY=1,100,200"}                                                                   | ${{ frequency: "yearly", interval: 3, firstDayOfWeek: 1, count: 10, byYearDay: [1, 100, 200] }}
    ${"last Friday, FREQ first"}                       | ${"FREQ=MONTHLY;BYDAY=-1FR"}                                                                                               | ${{ frequency: "monthly", ...base, byDay: [{ day: 5, nthOfPeriod: -1 }] }}
    ${"lower-case names and values"}                   | ${"count=10;freq=daily"}                                                                                                   | ${{ frequency: "daily", ...base, count: 10 }}
    ${"mixed-case BYDAY and WKST"}                     | ${"freq=weekly;byday=mo,Tu;wkst=su"}                                                                                       | ${{ frequency: "weekly", interval: 1, firstDayOfWeek: 7, byDay: [{ day: 1 }, { day: 2 }] }}
    ${"upper-case twin of the mixed-case row"}         | ${"FREQ=WEEKLY;BYDAY=MO,TU;WKST=SU"}                                                                                       | ${{ frequency: "weekly", interval: 1, firstDayOfWeek: 7, byDay: [{ day: 1 }, { day: 2 }] }}
    ${"FREQ last is accepted (3.3.10: any order)"}     | ${"BYDAY=MO;FREQ=WEEKLY"}                                                                                                  | ${{ frequency: "weekly", ...base, byDay: [{ day: 1 }] }}
    ${"explicit plus and minus ordinals"}              | ${"FREQ=MONTHLY;BYDAY=+1MO,-1FR"}                                                                                          | ${{ frequency: "monthly", ...base, byDay: [{ day: 1, nthOfPeriod: 1 }, { day: 5, nthOfPeriod: -1 }] }}
    ${"leading zero in BYMONTH"}                       | ${"FREQ=YEARLY;BYMONTH=01"}                                                                                                | ${{ frequency: "yearly", ...base, byMonth: [1] }}
    ${"BYSETPOS -366 is the lower bound"}              | ${"FREQ=YEARLY;BYMONTH=1;BYSETPOS=-366"}                                                                                   | ${{ frequency: "yearly", ...base, byMonth: [1], bySetPosition: [-366] }}
    ${"list is a set: deduplicated and ascending"}     | ${"FREQ=YEARLY;BYMONTH=3,1,3"}                                                                                             | ${{ frequency: "yearly", ...base, byMonth: [1, 3] }}
    ${"BYDAY ordered by day then ordinal, none first"} | ${"FREQ=MONTHLY;BYDAY=2FR,TU,-1FR,FR,MO,TU"}                                                                               | ${{ frequency: "monthly", ...base, byDay: [{ day: 1 }, { day: 2 }, { day: 5 }, { day: 5, nthOfPeriod: -1 }, { day: 5, nthOfPeriod: 2 }] }}
    ${"BYSECOND=60 is valid"}                          | ${"FREQ=MINUTELY;BYSECOND=60"}                                                                                             | ${{ frequency: "minutely", ...base, bySecond: [60] }}
    ${"every BY part, in the emitted order"}           | ${"BYSETPOS=1;BYMONTH=6;BYWEEKNO=3;BYYEARDAY=5;BYMONTHDAY=2;BYDAY=MO;BYHOUR=9;BYMINUTE=30;BYSECOND=0;COUNT=4;FREQ=YEARLY"} | ${{ frequency: "yearly", ...base, count: 4, bySecond: [0], byMinute: [30], byHour: [9], byDay: [{ day: 1 }], byMonthDay: [2], byYearDay: [5], byWeekNo: [3], byMonth: [6], bySetPosition: [1] }}
    ${"all seven frequencies: hourly"}                 | ${"FREQ=HOURLY;INTERVAL=0012"}                                                                                             | ${{ frequency: "hourly", interval: 12, firstDayOfWeek: 1 }}
    ${"secondly"}                                      | ${"FREQ=SECONDLY"}                                                                                                         | ${{ frequency: "secondly", ...base }}
    ${"largest COUNT"}                                 | ${"FREQ=DAILY;COUNT=9007199254740991"}                                                                                     | ${{ frequency: "daily", ...base, count: 9007199254740991 }}
  `("$name: $input", ({ input, expected }) => {
    expect(parseRecurrenceRule(input)).toStrictEqual(expected);
  });

  it("keeps the members in the documented key order", () => {
    const rule = parseRecurrenceRule("BYMONTH=6;COUNT=2;FREQ=YEARLY;WKST=SU");
    expect(Object.keys(rule ?? {})).toStrictEqual([
      "frequency",
      "interval",
      "firstDayOfWeek",
      "count",
      "byMonth",
    ]);
  });

  it("returns a frozen record", () => {
    expect(Object.isFrozen(parseRecurrenceRule("FREQ=DAILY"))).toBe(true);
  });
});

describe("parseRecurrenceRule UNTIL", () => {
  it.each`
    name                      | input                                  | expected
    ${"UTC date-time"}        | ${"FREQ=DAILY;UNTIL=19971224T000000Z"} | ${"1997-12-24T00:00:00Z"}
    ${"floating date-time"}   | ${"FREQ=DAILY;UNTIL=19971224T000000"}  | ${"1997-12-24T00:00:00"}
    ${"date"}                 | ${"FREQ=DAILY;UNTIL=19971224"}         | ${"1997-12-24"}
    ${"leap day"}             | ${"FREQ=DAILY;UNTIL=20240229"}         | ${"2024-02-29"}
    ${"last second of a day"} | ${"FREQ=DAILY;UNTIL=20241231T235959Z"} | ${"2024-12-31T23:59:59Z"}
  `("$name: $input", ({ input, expected }) => {
    expect(parseRecurrenceRule(input)?.until).toBe(expected);
  });

  it("matches the issue example in full", () => {
    expect(
      parseRecurrenceRule(
        "FREQ=WEEKLY;UNTIL=19971224T000000Z;WKST=SU;BYDAY=TU,TH",
      ),
    ).toStrictEqual({
      frequency: "weekly",
      interval: 1,
      firstDayOfWeek: 7,
      until: "1997-12-24T00:00:00Z",
      byDay: [{ day: 2 }, { day: 4 }],
    });
  });

  it.each`
    name                                | input
    ${"February 30"}                    | ${"FREQ=DAILY;UNTIL=20240230"}
    ${"non-leap February 29"}           | ${"FREQ=DAILY;UNTIL=20230229"}
    ${"extended date"}                  | ${"FREQ=DAILY;UNTIL=2024-01-01"}
    ${"no seconds"}                     | ${"FREQ=DAILY;UNTIL=20240101T1200"}
    ${"numeric offset"}                 | ${"FREQ=DAILY;UNTIL=20240101T120000+0100"}
    ${"month 13"}                       | ${"FREQ=DAILY;UNTIL=20241301"}
    ${"hour 24"}                        | ${"FREQ=DAILY;UNTIL=20240101T240000Z"}
    ${"empty"}                          | ${"FREQ=DAILY;UNTIL="}
    ${"two-digit year"}                 | ${"FREQ=DAILY;UNTIL=240101"}
    ${"Z without time"}                 | ${"FREQ=DAILY;UNTIL=20240101Z"}
    ${"minute 60"}                      | ${"FREQ=DAILY;UNTIL=20240101T006000Z"}
    ${"second 61"}                      | ${"FREQ=DAILY;UNTIL=20240101T000061Z"}
    ${"month 00"}                       | ${"FREQ=DAILY;UNTIL=20240001"}
    ${"day 00"}                         | ${"FREQ=DAILY;UNTIL=20240100"}
    ${"April 31"}                       | ${"FREQ=DAILY;UNTIL=20240431"}
    ${"fractional seconds"}             | ${"FREQ=DAILY;UNTIL=20240101T000000.5Z"}
    ${"trailing space"}                 | ${"FREQ=DAILY;UNTIL=20240101 "}
    ${"UNTIL twice"}                    | ${"FREQ=DAILY;UNTIL=20240101;UNTIL=20240102"}
    ${"second 60, UTC"}                 | ${"FREQ=DAILY;UNTIL=20240101T000060Z"}
    ${"second 60, floating"}            | ${"FREQ=DAILY;UNTIL=20240101T000060"}
    ${"RFC 5545 leap second, UTC"}      | ${"FREQ=DAILY;UNTIL=19970630T235960Z"}
    ${"RFC 5545 leap second, floating"} | ${"FREQ=DAILY;UNTIL=19970630T235960"}
    ${"lower-case t and z"}             | ${"FREQ=DAILY;UNTIL=20240101t120000z"}
    ${"lower-case t"}                   | ${"FREQ=DAILY;UNTIL=20240101t120000"}
    ${"lower-case z"}                   | ${"FREQ=DAILY;UNTIL=20240101T120000z"}
  `("returns null for $name: '$input'", ({ input }) => {
    expect(parseRecurrenceRule(input)).toBeNull();
  });
});

describe("parseRecurrenceRule sentinel", () => {
  it.each`
    name                            | input
    ${"empty"}                      | ${""}
    ${"RRULE: prefix"}              | ${"RRULE:FREQ=DAILY"}
    ${"leading space"}              | ${" FREQ=DAILY"}
    ${"trailing semicolon"}         | ${"FREQ=DAILY;"}
    ${"empty part"}                 | ${"FREQ=DAILY;;COUNT=1"}
    ${"space after semicolon"}      | ${"FREQ=DAILY; COUNT=1"}
    ${"empty value"}                | ${"FREQ=DAILY;BYMONTH="}
    ${"empty list item"}            | ${"FREQ=DAILY;BYMONTH=1,,2"}
    ${"name without ="}             | ${"FREQ"}
    ${"no FREQ"}                    | ${"COUNT=5"}
    ${"FREQ twice"}                 | ${"FREQ=DAILY;FREQ=WEEKLY"}
    ${"unknown FREQ value"}         | ${"FREQ=FORTNIGHTLY"}
    ${"EXRULE"}                     | ${"FREQ=DAILY;EXRULE=FREQ=DAILY"}
    ${"RSCALE"}                     | ${"FREQ=DAILY;RSCALE=GREGORIAN"}
    ${"SKIP"}                       | ${"FREQ=DAILY;SKIP=OMIT"}
    ${"X- name"}                    | ${"FREQ=DAILY;X-NAME=1"}
    ${"COUNT with UNTIL"}           | ${"FREQ=DAILY;COUNT=5;UNTIL=20240101"}
    ${"INTERVAL=0"}                 | ${"FREQ=DAILY;INTERVAL=0"}
    ${"INTERVAL signed"}            | ${"FREQ=DAILY;INTERVAL=+1"}
    ${"COUNT=0"}                    | ${"FREQ=DAILY;COUNT=0"}
    ${"COUNT past safe integer"}    | ${"FREQ=DAILY;COUNT=9007199254740992"}
    ${"COUNT huge"}                 | ${"FREQ=DAILY;COUNT=99999999999999999999999"}
    ${"COUNT fraction"}             | ${"FREQ=DAILY;COUNT=1.5"}
    ${"BYMONTHDAY=0"}               | ${"FREQ=MONTHLY;BYMONTHDAY=0"}
    ${"BYMONTHDAY=32"}              | ${"FREQ=MONTHLY;BYMONTHDAY=32"}
    ${"BYMONTHDAY=-32"}             | ${"FREQ=MONTHLY;BYMONTHDAY=-32"}
    ${"BYMONTHDAY=031"}             | ${"FREQ=MONTHLY;BYMONTHDAY=031"}
    ${"BYYEARDAY=367"}              | ${"FREQ=YEARLY;BYYEARDAY=367"}
    ${"BYWEEKNO=54"}                | ${"FREQ=YEARLY;BYWEEKNO=54"}
    ${"BYMONTH=13"}                 | ${"FREQ=YEARLY;BYMONTH=13"}
    ${"BYMONTH=0"}                  | ${"FREQ=YEARLY;BYMONTH=0"}
    ${"BYMONTH=+1"}                 | ${"FREQ=YEARLY;BYMONTH=+1"}
    ${"BYHOUR=24"}                  | ${"FREQ=DAILY;BYHOUR=24"}
    ${"BYHOUR=-1"}                  | ${"FREQ=DAILY;BYHOUR=-1"}
    ${"BYMINUTE=60"}                | ${"FREQ=DAILY;BYMINUTE=60"}
    ${"BYSECOND=61"}                | ${"FREQ=DAILY;BYSECOND=61"}
    ${"BYSETPOS=367"}               | ${"FREQ=YEARLY;BYMONTH=1;BYSETPOS=367"}
    ${"BYSETPOS=0"}                 | ${"FREQ=YEARLY;BYMONTH=1;BYSETPOS=0"}
    ${"BYDAY=0MO"}                  | ${"FREQ=MONTHLY;BYDAY=0MO"}
    ${"BYDAY=54MO"}                 | ${"FREQ=MONTHLY;BYDAY=54MO"}
    ${"BYDAY=-54MO"}                | ${"FREQ=MONTHLY;BYDAY=-54MO"}
    ${"BYDAY=MON"}                  | ${"FREQ=WEEKLY;BYDAY=MON"}
    ${"BYDAY 3-digit ordinal"}      | ${"FREQ=MONTHLY;BYDAY=001MO"}
    ${"WKST=XX"}                    | ${"FREQ=WEEKLY;WKST=XX"}
    ${"WKST with ordinal"}          | ${"FREQ=WEEKLY;WKST=1MO"}
    ${"value with extra ="}         | ${"FREQ=DAILY=1"}
    ${"long s in a name"}           | ${"FREQ=DAILY;BYſECOND=1"}
    ${"Kelvin sign in a value"}     | ${"FREQ=DAILY;WKST=KO"}
    ${"non-ASCII digit"}            | ${"FREQ=DAILY;COUNT=٥"}
    ${"trailing space"}             | ${"FREQ=DAILY "}
    ${"trailing newline"}           | ${"FREQ=DAILY\n"}
    ${"tab in a list"}              | ${"FREQ=DAILY;BYMONTH=1,\t2"}
    ${"space around ="}             | ${"FREQ = DAILY"}
    ${"empty name"}                 | ${"=DAILY"}
    ${"only semicolon"}             | ${";"}
    ${"INTERVAL past safe integer"} | ${"FREQ=DAILY;INTERVAL=9007199254740992"}
    ${"INTERVAL empty"}             | ${"FREQ=DAILY;INTERVAL="}
    ${"COUNT negative"}             | ${"FREQ=DAILY;COUNT=-1"}
    ${"COUNT plus"}                 | ${"FREQ=DAILY;COUNT=+1"}
    ${"COUNT twice"}                | ${"FREQ=DAILY;COUNT=1;COUNT=2"}
    ${"INTERVAL twice"}             | ${"FREQ=DAILY;INTERVAL=1;INTERVAL=2"}
    ${"WKST twice"}                 | ${"FREQ=WEEKLY;WKST=MO;WKST=SU"}
    ${"BYDAY twice"}                | ${"FREQ=WEEKLY;BYDAY=MO;BYDAY=TU"}
    ${"BYDAY twice, mixed case"}    | ${"FREQ=WEEKLY;BYDAY=MO;byday=TU"}
    ${"BYMONTHDAY=-0"}              | ${"FREQ=MONTHLY;BYMONTHDAY=-0"}
    ${"BYMONTHDAY=+32"}             | ${"FREQ=MONTHLY;BYMONTHDAY=+32"}
    ${"BYYEARDAY=0"}                | ${"FREQ=YEARLY;BYYEARDAY=0"}
    ${"BYYEARDAY=-367"}             | ${"FREQ=YEARLY;BYYEARDAY=-367"}
    ${"BYYEARDAY 4 digits"}         | ${"FREQ=YEARLY;BYYEARDAY=0001"}
    ${"BYWEEKNO=0"}                 | ${"FREQ=YEARLY;BYWEEKNO=0"}
    ${"BYWEEKNO=-54"}               | ${"FREQ=YEARLY;BYWEEKNO=-54"}
    ${"BYWEEKNO 3 digits"}          | ${"FREQ=YEARLY;BYWEEKNO=020"}
    ${"BYSETPOS 4 digits"}          | ${"FREQ=YEARLY;BYMONTH=1;BYSETPOS=0001"}
    ${"BYSETPOS=-367"}              | ${"FREQ=YEARLY;BYMONTH=1;BYSETPOS=-367"}
    ${"BYSECOND signed"}            | ${"FREQ=MINUTELY;BYSECOND=+1"}
    ${"BYMINUTE signed"}            | ${"FREQ=HOURLY;BYMINUTE=-1"}
    ${"BYHOUR 3 digits"}            | ${"FREQ=DAILY;BYHOUR=009"}
    ${"BYMONTH 3 digits"}           | ${"FREQ=YEARLY;BYMONTH=001"}
    ${"BYMONTH fraction"}           | ${"FREQ=YEARLY;BYMONTH=1.5"}
    ${"BYDAY empty item"}           | ${"FREQ=WEEKLY;BYDAY=MO,"}
    ${"BYDAY lone sign"}            | ${"FREQ=MONTHLY;BYDAY=+MO"}
    ${"BYDAY +0"}                   | ${"FREQ=MONTHLY;BYDAY=+0MO"}
    ${"BYDAY ordinal after day"}    | ${"FREQ=MONTHLY;BYDAY=MO1"}
    ${"BYDAY digits only"}          | ${"FREQ=MONTHLY;BYDAY=1"}
    ${"WKST empty"}                 | ${"FREQ=WEEKLY;WKST="}
    ${"WKST list"}                  | ${"FREQ=WEEKLY;WKST=MO,TU"}
    ${"FREQ list"}                  | ${"FREQ=DAILY,WEEKLY"}
    ${"FREQ empty"}                 | ${"FREQ="}
    ${"FREQ plural"}                | ${"FREQ=DAYS"}
    ${"name prefix"}                | ${"FREQ=DAILY;BYMONTHS=1"}
    ${"name with sign"}             | ${"FREQ=DAILY;+COUNT=1"}
    ${"inherited property name"}    | ${"FREQ=DAILY;constructor=1"}
    ${"__proto__ name"}             | ${"FREQ=DAILY;__proto__=1"}
  `("returns null for $name: '$input'", ({ input }) => {
    expect(parseRecurrenceRule(input)).toBeNull();
  });

  it.each`
    name        | input
    ${"null"}   | ${null}
    ${"number"} | ${42}
    ${"object"} | ${{}}
    ${"array"}  | ${["FREQ=DAILY"]}
  `("returns null for a non-string: $name", ({ input }) => {
    expect(parseRecurrenceRule(input as string)).toBeNull();
  });
});

describe("parseRecurrenceRule MUST NOT combinations (RFC 5545 3.3.10)", () => {
  it.each`
    name                                             | input
    ${"ordinal BYDAY with WEEKLY"}                   | ${"FREQ=WEEKLY;BYDAY=1MO"}
    ${"ordinal BYDAY with DAILY"}                    | ${"FREQ=DAILY;BYDAY=-1MO"}
    ${"ordinal BYDAY, YEARLY, BYWEEKNO"}             | ${"FREQ=YEARLY;BYWEEKNO=1;BYDAY=1MO"}
    ${"BYMONTHDAY with WEEKLY"}                      | ${"FREQ=WEEKLY;BYMONTHDAY=1"}
    ${"BYYEARDAY with MONTHLY"}                      | ${"FREQ=MONTHLY;BYYEARDAY=1"}
    ${"BYYEARDAY with WEEKLY"}                       | ${"FREQ=WEEKLY;BYYEARDAY=1"}
    ${"BYYEARDAY with DAILY"}                        | ${"FREQ=DAILY;BYYEARDAY=1"}
    ${"BYWEEKNO with MONTHLY"}                       | ${"FREQ=MONTHLY;BYWEEKNO=1"}
    ${"BYWEEKNO with DAILY"}                         | ${"FREQ=DAILY;BYWEEKNO=1"}
    ${"BYSETPOS alone"}                              | ${"FREQ=DAILY;BYSETPOS=1"}
    ${"BYSETPOS with only WKST"}                     | ${"FREQ=WEEKLY;WKST=SU;BYSETPOS=1"}
    ${"BYSETPOS with only COUNT and INTERVAL"}       | ${"FREQ=DAILY;COUNT=5;INTERVAL=2;BYSETPOS=1"}
    ${"ordinal BYDAY with HOURLY"}                   | ${"FREQ=HOURLY;BYDAY=1MO"}
    ${"ordinal BYDAY with SECONDLY"}                 | ${"FREQ=SECONDLY;BYDAY=1MO"}
    ${"ordinal BYDAY among plain, WEEKLY"}           | ${"FREQ=WEEKLY;BYDAY=MO,TU,-1FR"}
    ${"ordinal BYDAY among plain, YEARLY, BYWEEKNO"} | ${"FREQ=YEARLY;BYWEEKNO=1;BYDAY=MO,-1FR"}
    ${"BYWEEKNO with WEEKLY"}                        | ${"FREQ=WEEKLY;BYWEEKNO=1"}
    ${"BYWEEKNO with HOURLY"}                        | ${"FREQ=HOURLY;BYWEEKNO=1"}
    ${"BYWEEKNO with SECONDLY"}                      | ${"FREQ=SECONDLY;BYWEEKNO=1"}
    ${"BYMONTHDAY with WEEKLY, negative"}            | ${"FREQ=WEEKLY;BYMONTHDAY=-1"}
  `("returns null for $name: '$input'", ({ input }) => {
    expect(parseRecurrenceRule(input)).toBeNull();
  });

  it.each`
    name                                    | input
    ${"ordinal BYDAY with MONTHLY"}         | ${"FREQ=MONTHLY;BYDAY=1MO"}
    ${"ordinal BYDAY with YEARLY"}          | ${"FREQ=YEARLY;BYDAY=-1MO"}
    ${"plain BYDAY, YEARLY, BYWEEKNO"}      | ${"FREQ=YEARLY;BYWEEKNO=1;BYDAY=MO"}
    ${"BYMONTHDAY with DAILY"}              | ${"FREQ=DAILY;BYMONTHDAY=1"}
    ${"BYYEARDAY with HOURLY"}              | ${"FREQ=HOURLY;BYYEARDAY=1"}
    ${"BYYEARDAY with YEARLY"}              | ${"FREQ=YEARLY;BYYEARDAY=1"}
    ${"BYSETPOS with BYHOUR"}               | ${"FREQ=DAILY;BYHOUR=9,17;BYSETPOS=1"}
    ${"BYSETPOS with BYDAY only"}           | ${"FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1"}
    ${"BYSETPOS with BYSECOND only"}        | ${"FREQ=MINUTELY;BYSECOND=0,30;BYSETPOS=-1"}
    ${"BYMONTHDAY with MONTHLY"}            | ${"FREQ=MONTHLY;BYMONTHDAY=-1"}
    ${"BYMONTHDAY with YEARLY"}             | ${"FREQ=YEARLY;BYMONTHDAY=1"}
    ${"BYMONTHDAY with SECONDLY"}           | ${"FREQ=SECONDLY;BYMONTHDAY=1"}
    ${"BYYEARDAY with MINUTELY"}            | ${"FREQ=MINUTELY;BYYEARDAY=1"}
    ${"BYYEARDAY with SECONDLY"}            | ${"FREQ=SECONDLY;BYYEARDAY=1"}
    ${"BYWEEKNO with YEARLY"}               | ${"FREQ=YEARLY;BYWEEKNO=-1"}
    ${"plain BYDAY with WEEKLY"}            | ${"FREQ=WEEKLY;BYDAY=MO"}
    ${"plain BYDAY with HOURLY"}            | ${"FREQ=HOURLY;BYDAY=MO"}
    ${"ordinal BYDAY, MONTHLY, BYMONTHDAY"} | ${"FREQ=MONTHLY;BYDAY=1MO;BYMONTHDAY=1"}
  `("accepts $name: $input", ({ input }) => {
    expect(parseRecurrenceRule(input)).not.toBeNull();
  });
});

describe("parseRecurrenceRule range edges (RFC 5545 3.3.10 value ranges)", () => {
  it.each`
    name                                              | input                                        | expected
    ${"BYSECOND 0 and 60"}                            | ${"FREQ=MINUTELY;BYSECOND=0,60"}             | ${{ bySecond: [0, 60] }}
    ${"BYMINUTE 0 and 59"}                            | ${"FREQ=HOURLY;BYMINUTE=59,0"}               | ${{ byMinute: [0, 59] }}
    ${"BYHOUR 0 and 23"}                              | ${"FREQ=DAILY;BYHOUR=23,0"}                  | ${{ byHour: [0, 23] }}
    ${"BYMONTHDAY -31 and 31"}                        | ${"FREQ=MONTHLY;BYMONTHDAY=31,-31"}          | ${{ byMonthDay: [-31, 31] }}
    ${"BYMONTHDAY +1"}                                | ${"FREQ=MONTHLY;BYMONTHDAY=+1,-1"}           | ${{ byMonthDay: [-1, 1] }}
    ${"BYYEARDAY -366 and 366"}                       | ${"FREQ=YEARLY;BYYEARDAY=366,-366"}          | ${{ byYearDay: [-366, 366] }}
    ${"BYWEEKNO -53 and 53"}                          | ${"FREQ=YEARLY;BYWEEKNO=53,-53"}             | ${{ byWeekNo: [-53, 53] }}
    ${"BYMONTH 1 and 12"}                             | ${"FREQ=YEARLY;BYMONTH=12,1"}                | ${{ byMonth: [1, 12] }}
    ${"BYSETPOS -366 and 366"}                        | ${"FREQ=YEARLY;BYMONTH=1;BYSETPOS=366,-366"} | ${{ byMonth: [1], bySetPosition: [-366, 366] }}
    ${"BYSETPOS 1"}                                   | ${"FREQ=YEARLY;BYMONTH=1;BYSETPOS=+1"}       | ${{ byMonth: [1], bySetPosition: [1] }}
    ${"BYDAY ordinal 53 and -53"}                     | ${"FREQ=YEARLY;BYDAY=-53MO,53MO"}            | ${{ byDay: [{ day: 1, nthOfPeriod: -53 }, { day: 1, nthOfPeriod: 53 }] }}
    ${"BYDAY one-digit ordinal"}                      | ${"FREQ=MONTHLY;BYDAY=2SA"}                  | ${{ byDay: [{ day: 6, nthOfPeriod: 2 }] }}
    ${"BYDAY two-digit zero-led ordinal"}             | ${"FREQ=MONTHLY;BYDAY=01SU"}                 | ${{ byDay: [{ day: 7, nthOfPeriod: 1 }] }}
    ${"BYDAY all seven weekdays"}                     | ${"FREQ=WEEKLY;BYDAY=SU,SA,FR,TH,WE,TU,MO"}  | ${{ byDay: [{ day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 }, { day: 6 }, { day: 7 }] }}
    ${"ordinal BYDAY, YEARLY, BYMONTH"}               | ${"FREQ=YEARLY;BYMONTH=11;BYDAY=4TH"}        | ${{ byMonth: [11], byDay: [{ day: 4, nthOfPeriod: 4 }] }}
    ${"BYMONTHDAY with a leading zero in two digits"} | ${"FREQ=MONTHLY;BYMONTHDAY=05"}              | ${{ byMonthDay: [5] }}
    ${"duplicates across signs collapse"}             | ${"FREQ=MONTHLY;BYMONTHDAY=+5,5"}            | ${{ byMonthDay: [5] }}
  `("$name: $input", ({ input, expected }) => {
    expect(parseRecurrenceRule(input)).toMatchObject(expected);
  });

  it.each`
    name                      | input                                     | expected
    ${"COUNT=1"}              | ${"FREQ=DAILY;COUNT=1"}                   | ${{ count: 1 }}
    ${"COUNT zero-led"}       | ${"FREQ=DAILY;COUNT=007"}                 | ${{ count: 7 }}
    ${"largest INTERVAL"}     | ${"FREQ=DAILY;INTERVAL=9007199254740991"} | ${{ interval: 9007199254740991 }}
    ${"WKST=SA"}              | ${"FREQ=WEEKLY;WKST=SA"}                  | ${{ firstDayOfWeek: 6 }}
    ${"WKST=MO explicit"}     | ${"FREQ=WEEKLY;WKST=MO"}                  | ${{ firstDayOfWeek: 1 }}
    ${"WKST lower case"}      | ${"FREQ=WEEKLY;wkst=th"}                  | ${{ firstDayOfWeek: 4 }}
    ${"frequency lower case"} | ${"freq=Minutely"}                        | ${{ frequency: "minutely" }}
  `("$name: $input", ({ input, expected }) => {
    expect(parseRecurrenceRule(input)).toMatchObject(expected);
  });

  it("gives the same record whether INTERVAL=1 is written or defaulted", () => {
    expect(parseRecurrenceRule("FREQ=DAILY;INTERVAL=1;WKST=MO")).toStrictEqual(
      parseRecurrenceRule("FREQ=DAILY"),
    );
  });
});

describe("parseRecurrenceRule RFC 5545 3.8.5.3 example lines", () => {
  it.each`
    name                                       | input                                                                        | expected
    ${"daily for 10 occurrences"}              | ${"FREQ=DAILY;COUNT=10"}                                                     | ${{ frequency: "daily", ...base, count: 10 }}
    ${"daily until"}                           | ${"FREQ=DAILY;UNTIL=19971224T000000Z"}                                       | ${{ frequency: "daily", ...base, until: "1997-12-24T00:00:00Z" }}
    ${"every other day"}                       | ${"FREQ=DAILY;INTERVAL=2"}                                                   | ${{ frequency: "daily", interval: 2, firstDayOfWeek: 1 }}
    ${"every 10 days, 5 occurrences"}          | ${"FREQ=DAILY;INTERVAL=10;COUNT=5"}                                          | ${{ frequency: "daily", interval: 10, firstDayOfWeek: 1, count: 5 }}
    ${"every day in January"}                  | ${"FREQ=YEARLY;UNTIL=20000131T140000Z;BYMONTH=1;BYDAY=SU,MO,TU,WE,TH,FR,SA"} | ${{ frequency: "yearly", ...base, until: "2000-01-31T14:00:00Z", byDay: [{ day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 }, { day: 6 }, { day: 7 }], byMonth: [1] }}
    ${"every other week, WKST=SU"}             | ${"FREQ=WEEKLY;INTERVAL=2;WKST=SU"}                                          | ${{ frequency: "weekly", interval: 2, firstDayOfWeek: 7 }}
    ${"first Friday, 10 occurrences"}          | ${"FREQ=MONTHLY;COUNT=10;BYDAY=1FR"}                                         | ${{ frequency: "monthly", ...base, count: 10, byDay: [{ day: 5, nthOfPeriod: 1 }] }}
    ${"first and last Sunday, every 2 months"} | ${"FREQ=MONTHLY;INTERVAL=2;COUNT=10;BYDAY=1SU,-1SU"}                         | ${{ frequency: "monthly", interval: 2, firstDayOfWeek: 1, count: 10, byDay: [{ day: 7, nthOfPeriod: -1 }, { day: 7, nthOfPeriod: 1 }] }}
    ${"second-to-last Monday"}                 | ${"FREQ=MONTHLY;BYDAY=-2MO"}                                                 | ${{ frequency: "monthly", ...base, byDay: [{ day: 1, nthOfPeriod: -2 }] }}
    ${"third-to-last day of the month"}        | ${"FREQ=MONTHLY;BYMONTHDAY=-3"}                                              | ${{ frequency: "monthly", ...base, byMonthDay: [-3] }}
    ${"2nd and 15th"}                          | ${"FREQ=MONTHLY;COUNT=10;BYMONTHDAY=2,15"}                                   | ${{ frequency: "monthly", ...base, count: 10, byMonthDay: [2, 15] }}
    ${"Friday the 13th"}                       | ${"FREQ=MONTHLY;BYDAY=FR;BYMONTHDAY=13"}                                     | ${{ frequency: "monthly", ...base, byDay: [{ day: 5 }], byMonthDay: [13] }}
    ${"first Saturday after the first Sunday"} | ${"FREQ=MONTHLY;BYDAY=SA;BYMONTHDAY=7,8,9,10,11,12,13"}                      | ${{ frequency: "monthly", ...base, byDay: [{ day: 6 }], byMonthDay: [7, 8, 9, 10, 11, 12, 13] }}
    ${"US presidential election day"}          | ${"FREQ=YEARLY;INTERVAL=4;BYMONTH=11;BYDAY=TU;BYMONTHDAY=2,3,4,5,6,7,8"}     | ${{ frequency: "yearly", interval: 4, firstDayOfWeek: 1, byDay: [{ day: 2 }], byMonthDay: [2, 3, 4, 5, 6, 7, 8], byMonth: [11] }}
    ${"every 15 minutes, 6 occurrences"}       | ${"FREQ=MINUTELY;INTERVAL=15;COUNT=6"}                                       | ${{ frequency: "minutely", interval: 15, firstDayOfWeek: 1, count: 6 }}
    ${"every 3 hours until (Erratum 3883)"}    | ${"FREQ=HOURLY;INTERVAL=3;UNTIL=19970902T210000Z"}                           | ${{ frequency: "hourly", interval: 3, firstDayOfWeek: 1, until: "1997-09-02T21:00:00Z" }}
    ${"every 20 minutes 9-16"}                 | ${"FREQ=DAILY;BYHOUR=9,10,11,12,13,14,15,16;BYMINUTE=0,20,40"}               | ${{ frequency: "daily", ...base, byHour: [9, 10, 11, 12, 13, 14, 15, 16], byMinute: [0, 20, 40] }}
    ${"last weekday of the month"}             | ${"FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1"}                           | ${{ frequency: "monthly", ...base, byDay: [{ day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 }], bySetPosition: [-1] }}
  `("$name: $input", ({ input, expected }) => {
    expect(parseRecurrenceRule(input)).toStrictEqual(expected);
  });
});
