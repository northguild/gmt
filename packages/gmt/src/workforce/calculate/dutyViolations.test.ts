import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, type DutyStep, dutySequence } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { DutyRule } from "../../types";
import { dutyViolations } from "./dutyViolations";
import { evaluateDutyLog } from "./evaluateDutyLog";

// Fixtures start on 2024-01-01 (dateYearStart2024Jan01, a Monday); times of day are the scenario
// under test. Every expected value is worked out from the rule's own numbers in the row's reason.
const START = "2024-01-01T00:00:00Z";
const UTC = { timeZone: "UTC" };
const repeat = (times: number, steps: readonly DutyStep[]): DutyStep[] =>
  Array.from({ length: times }, () => steps).flat();
const week = (shift: string, rest: string): DutyStep[] => [
  ...repeat(5, [
    ["driving", shift],
    ["off", rest],
  ]),
  ["off", "PT48H"],
];
const elevenDriving: DutyRule = {
  label: "11 driving",
  kind: "cumulativeCap",
  statuses: ["driving"],
  cap: "PT11H",
  since: { statuses: ["off"], consecutive: "PT10H" },
};

describe("dutyViolations", () => {
  // Each day: 10 hours off, then X of driving, then off to midnight, so every day starts with a
  // reset at 10:00. 12 hours on the 1st and 13 on the 5th break the 11-hour cap; 11 does not.
  const days = (driving: readonly string[]): DutyStep[] =>
    driving.flatMap((hours) => [
      ["off", "PT10H"],
      ["driving", hours],
      ["off", `PT${14 - Number(hours.slice(2, -1))}H`],
    ]);
  const week1 = days([
    "PT12H",
    "PT10H",
    "PT11H",
    "PT9H",
    "PT13H",
    "PT8H",
    "PT8H",
  ]);

  it("lists one entry per stretch between resets, each by its worst window", () => {
    expect(
      dutyViolations(
        dutySequence(START, week1),
        { start: START, end: "2024-01-08T00:00:00Z" },
        [elevenDriving],
        UTC,
      ),
    ).toEqual([
      {
        label: "11 driving",
        window: { start: "2024-01-01T10:00:00Z", end: "2024-01-01T22:00:00Z" },
        used: "PT12H",
        limit: "PT11H",
      },
      {
        label: "11 driving",
        window: { start: "2024-01-05T10:00:00Z", end: "2024-01-05T23:00:00Z" },
        used: "PT13H",
        limit: "PT11H",
      },
    ]);
  });

  it.each`
    start                     | end                       | labels                                              | reason
    ${"2024-01-02T00:00:00Z"} | ${"2024-01-08T00:00:00Z"} | ${["2024-01-05T23:00:00Z"]}                         | ${"a window ending before the range is left out"}
    ${START}                  | ${"2024-01-05T23:00:00Z"} | ${["2024-01-01T22:00:00Z", "2024-01-05T23:00:00Z"]} | ${"a window ending on the range's end is in"}
    ${START}                  | ${"2024-01-05T22:59:00Z"} | ${["2024-01-01T22:00:00Z", "2024-01-05T23:00:00Z"]} | ${"a violation still going at the range's end is reported by its worst window, after it"}
    ${START}                  | ${"2024-01-01T21:00:00Z"} | ${[]}                                               | ${"a range that ends before the cap is passed"}
  `(
    "reads the range by where each violation began: $reason",
    ({ start, end, labels }) => {
      expect(
        dutyViolations(
          dutySequence(START, week1),
          { start, end },
          [elevenDriving],
          UTC,
        )?.map((violation) => violation.window.end),
      ).toEqual(labels);
    },
  );

  // 60, 50 and 58 hours over three ISO weeks: weeks one and three fail 56, each once.
  it("lists one entry per failed fixed week", () => {
    const steps = [
      ...week("PT12H", "PT12H"),
      ...week("PT10H", "PT14H"),
      ...week("PT11H36M", "PT12H24M"),
    ];
    expect(
      dutyViolations(
        dutySequence(START, steps),
        { start: START, end: "2024-01-22T00:00:00Z" },
        [
          {
            label: "56 a week",
            kind: "fixedPeriodCap",
            statuses: ["driving"],
            cap: "PT56H",
            period: { isoWeeks: 1 },
          },
        ],
        UTC,
      ),
    ).toEqual([
      {
        label: "56 a week",
        window: { start: "2024-01-01T00:00:00Z", end: "2024-01-08T00:00:00Z" },
        used: "PT60H",
        limit: "PT56H",
      },
      {
        label: "56 a week",
        window: { start: "2024-01-15T00:00:00Z", end: "2024-01-22T00:00:00Z" },
        used: "PT58H",
        limit: "PT56H",
      },
    ]);
  });

  // 45, 46 and 45 hours: both pairs of adjacent weeks hold 91, two failed windows.
  it("lists each failed pair of adjacent weeks", () => {
    const steps = [
      ...week("PT9H", "PT15H"),
      ...week("PT9H12M", "PT14H48M"),
      ...week("PT9H", "PT15H"),
    ];
    expect(
      dutyViolations(
        dutySequence(START, steps),
        { start: START, end: "2024-01-22T00:00:00Z" },
        [
          {
            label: "90 a fortnight",
            kind: "fixedPeriodCap",
            statuses: ["driving"],
            cap: "PT90H",
            period: { isoWeeks: 1 },
            adjacent: 2,
          },
        ],
        UTC,
      )?.map(({ window, used }) => [window.start, window.end, used]),
    ).toEqual([
      ["2024-01-01T00:00:00Z", "2024-01-15T00:00:00Z", "PT91H"],
      ["2024-01-08T00:00:00Z", "2024-01-22T00:00:00Z", "PT91H"],
    ]);
  });

  // Rest 00–10, work 10–06, rest 06–16, work 16–24: each calendar day holds 10 hours of rest, but
  // the windows ending at 06:00 and starting at 10:00 hold 4. They overlap, so they are one
  // violation, reported by the earlier.
  it("lists one entry for overlapping failed sliding windows, and none per calendar day", () => {
    const steps: DutyStep[] = [
      ["rest", "PT10H"],
      ["work", "PT20H"],
      ["rest", "PT10H"],
      ["work", "PT8H"],
    ];
    const rule = (per: object): DutyRule =>
      ({
        label: "10 in 24",
        kind: "restRequirement",
        restStatuses: ["rest"],
        per,
        minimum: "PT10H",
      }) as DutyRule;
    const range = { start: START, end: "2024-01-03T00:00:00Z" };

    expect(
      dutyViolations(
        dutySequence(START, steps),
        range,
        [rule({ elapsed: "PT24H" })],
        UTC,
      ),
    ).toEqual([
      {
        label: "10 in 24",
        window: { start: "2024-01-01T06:00:00Z", end: "2024-01-02T06:00:00Z" },
        used: "PT4H",
        limit: "PT10H",
      },
    ]);
    expect(
      dutyViolations(
        dutySequence(START, steps),
        range,
        [rule({ calendarDays: 1 })],
        UTC,
      ),
    ).toEqual([]);
  });

  // 20 hours in any 3 calendar days. Days 1 to 3 hold 8 hours each, 24 in all; day 4 none, so the
  // windows ending on it hold 16 and pass; day 5 holds 14, so days 3 to 5 hold 22. A count of
  // local days moves with the instant, and a window that fails again after one that passed is a
  // new violation, as any moving window is.
  it("lists a rolling count of days again when it fails again after a pass", () => {
    const steps: DutyStep[] = [
      ...repeat(3, [
        ["work", "PT8H"],
        ["off", "PT16H"],
      ]),
      ["off", "PT24H"],
      ["work", "PT14H"],
      ["off", "PT10H"],
    ];

    expect(
      dutyViolations(
        dutySequence(START, steps),
        { start: START, end: "2024-01-06T00:00:00Z" },
        [
          {
            label: "20 in 3 days",
            kind: "rollingCap",
            statuses: ["work"],
            cap: "PT20H",
            window: { calendarDays: 3 },
          },
        ],
        UTC,
      ),
    ).toEqual([
      {
        label: "20 in 3 days",
        window: { start: START, end: "2024-01-04T00:00:00Z" },
        used: "PT24H",
        limit: "PT20H",
      },
      {
        label: "20 in 3 days",
        window: { start: "2024-01-03T00:00:00Z", end: "2024-01-06T00:00:00Z" },
        used: "PT22H",
        limit: "PT20H",
      },
    ]);
  });

  // Off 10 hours, driving 4, sleeper 7, driving 4, off 3. The window opens at 10:00 and closes at
  // 24:00, so the driving from 24:00 to 01:00 is late. At 04:00 the 3 hours off complete a pair
  // with the 7 in the sleeper, and the window counted again from 21:00 holds all of it. The record
  // keeps the earlier failure: it lists what a check at each moment would have said, so a record
  // only grows as the log does.
  it("keeps a failure that a rest pair completed later would have excused", () => {
    const log = dutySequence(START, [
      ["off", "PT10H"],
      ["driving", "PT4H"],
      ["sleeper", "PT7H"],
      ["driving", "PT4H"],
      ["off", "PT3H"],
    ]);
    const rule: DutyRule = {
      label: "14 window",
      kind: "elapsedWindow",
      startStatuses: ["driving"],
      length: "PT14H",
      restrictedStatuses: ["driving"],
      since: { statuses: ["off", "sleeper"], consecutive: "PT10H" },
      exclude: {
        eachAtLeast: "PT2H",
        oneAtLeast: "PT7H",
        combinedAtLeast: "PT10H",
      },
    };

    expect(
      evaluateDutyLog(log, "2024-01-02T04:00:00Z", [rule], UTC)?.outcomes[0],
    ).toMatchObject({
      satisfied: true,
      window: { start: "2024-01-01T21:00:00Z", end: "2024-01-02T14:00:00Z" },
    });
    expect(
      dutyViolations(
        log,
        { start: START, end: "2024-01-02T04:00:00Z" },
        [rule],
        UTC,
      ),
    ).toEqual([
      {
        label: "14 window",
        window: { start: "2024-01-01T10:00:00Z", end: "2024-01-02T00:00:00Z" },
        used: "PT15H",
        limit: "PT14H",
      },
    ]);
  });

  // A tour from 20:00 on 31 January to 04:00 on 1 February in New York: 4 hours in each month,
  // and a cap of 3 a month fails both, once each.
  it("splits a tour at the month boundary and fails each month on its own", () => {
    expect(
      dutyViolations(
        [
          {
            status: "onDuty",
            start: "2024-02-01T01:00:00Z",
            end: "2024-02-01T09:00:00Z",
          },
        ],
        { start: "2024-01-15T00:00:00Z", end: "2024-02-15T00:00:00Z" },
        [
          {
            label: "3 a month",
            kind: "fixedPeriodCap",
            statuses: ["onDuty"],
            cap: "PT3H",
            period: { calendarMonths: 1 },
          },
        ],
        { timeZone: "America/New_York" },
      ),
    ).toEqual([
      {
        label: "3 a month",
        window: { start: "2024-01-01T05:00:00Z", end: "2024-02-01T05:00:00Z" },
        used: "PT4H",
        limit: "PT3H",
      },
      {
        label: "3 a month",
        window: { start: "2024-02-01T05:00:00Z", end: "2024-03-01T05:00:00Z" },
        used: "PT4H",
        limit: "PT3H",
      },
    ]);
  });

  it("does not list advisories, and orders by window start, then by rule", () => {
    const weekly: DutyRule = {
      label: "56 a week",
      kind: "fixedPeriodCap",
      statuses: ["driving"],
      cap: "PT56H",
      period: { isoWeeks: 1 },
    };
    const result = dutyViolations(
      dutySequence(START, [
        ...days(["PT12H", "PT12H", "PT12H", "PT12H", "PT12H"]),
        ["off", "PT48H"],
      ]),
      { start: START, end: "2024-01-08T00:00:00Z" },
      [
        weekly,
        { ...elevenDriving, label: "11 advisory", severity: "advisory" },
        elevenDriving,
      ],
      UTC,
    );

    expect(result?.map(({ label, window }) => [label, window.start])).toEqual([
      ["56 a week", "2024-01-01T00:00:00Z"],
      ["11 driving", "2024-01-01T10:00:00Z"],
      ["11 driving", "2024-01-02T10:00:00Z"],
      ["11 driving", "2024-01-03T10:00:00Z"],
      ["11 driving", "2024-01-04T10:00:00Z"],
      ["11 driving", "2024-01-05T10:00:00Z"],
    ]);
  });

  // Thirteen hours on duty from 06:00 to 19:00 local on 2024-02-29: a 12-hour daily cap fails on
  // that local day, wherever the zone is (no battle-test zone changes its clock then).
  it.each(battleTestTimeZones)(
    "reads the failed local day in %s",
    (timeZone) => {
      const local = (month: number, day: number, hour: number) =>
        Temporal.ZonedDateTime.from({ year: 2024, month, day, hour, timeZone })
          .toInstant()
          .toString();

      expect(
        dutyViolations(
          [{ status: "onDuty", start: local(2, 29, 6), end: local(2, 29, 19) }],
          { start: local(2, 28, 0), end: local(3, 2, 0) },
          [
            {
              label: "12 a day",
              kind: "fixedPeriodCap",
              statuses: ["onDuty"],
              cap: "PT12H",
              period: { calendarDays: 1 },
            },
          ],
          { timeZone },
        ),
      ).toEqual([
        {
          label: "12 a day",
          window: { start: local(2, 29, 0), end: local(3, 1, 0) },
          used: "PT13H",
          limit: "PT12H",
        },
      ]);
    },
  );

  // On duty for whole local days across a clock change, under a cap of 24 hours a day: a day
  // longer than 24 hours fails (New York's and Havana's 25, Lord Howe's 24.5), a shorter one does
  // not (Chatham's and Santiago's 23, Casey's 21), the date Samoa deleted is no day at all, and
  // Goose Bay's 59 minutes back in 6 November are a day of their own (expected days from
  // Temporal's `startOfDay` and the zone walker `bucketRange` uses).
  it.each`
    timeZone                 | start                     | end                       | failed
    ${"America/New_York"}    | ${"2024-11-02T04:00:00Z"} | ${"2024-11-05T05:00:00Z"} | ${[["2024-11-03T04:00:00Z", "2024-11-04T05:00:00Z", "PT25H"]]}
    ${"America/New_York"}    | ${"2024-03-09T05:00:00Z"} | ${"2024-03-12T04:00:00Z"} | ${[]}
    ${"America/Havana"}      | ${"2024-11-02T04:00:00Z"} | ${"2024-11-05T05:00:00Z"} | ${[["2024-11-03T04:00:00Z", "2024-11-04T05:00:00Z", "PT25H"]]}
    ${"Australia/Lord_Howe"} | ${"2024-04-05T13:00:00Z"} | ${"2024-04-08T13:30:00Z"} | ${[["2024-04-06T13:00:00Z", "2024-04-07T13:30:00Z", "PT24H30M"]]}
    ${"Pacific/Chatham"}     | ${"2024-09-27T11:15:00Z"} | ${"2024-09-30T10:15:00Z"} | ${[]}
    ${"America/Santiago"}    | ${"2024-09-07T04:00:00Z"} | ${"2024-09-10T03:00:00Z"} | ${[]}
    ${"Antarctica/Casey"}    | ${"2020-10-02T16:00:00Z"} | ${"2020-10-05T13:00:00Z"} | ${[]}
    ${"Pacific/Apia"}        | ${"2011-12-28T10:00:00Z"} | ${"2012-01-01T10:00:00Z"} | ${[]}
    ${"America/Goose_Bay"}   | ${"2010-11-06T03:00:00Z"} | ${"2010-11-08T04:00:00Z"} | ${[]}
  `(
    "fails only a day longer than 24 hours in $timeZone from $start",
    ({ timeZone, start, end, failed }) => {
      expect(
        dutyViolations(
          [{ status: "onDuty", start, end }],
          { start, end },
          [
            {
              label: "24 a day",
              kind: "fixedPeriodCap",
              statuses: ["onDuty"],
              cap: "PT24H",
              period: { calendarDays: 1 },
            },
          ],
          { timeZone },
        )?.map(({ window, used }) => [window.start, window.end, used]),
      ).toEqual(failed);
    },
  );

  it("returns [] for an empty log or no rules", () => {
    const range = { start: START, end: "2024-02-01T00:00:00Z" };
    expect(dutyViolations([], range, [elevenDriving], UTC)).toEqual([]);
    expect(dutyViolations(dutySequence(START, week1), range, [], UTC)).toEqual(
      [],
    );
  });

  it.each`
    range                                            | rules                                                                                               | options                         | reason
    ${{ start: "2024-02-01T00:00:00Z", end: START }} | ${[elevenDriving]}                                                                                  | ${UTC}                          | ${"an inverted range"}
    ${"January"}                                     | ${[elevenDriving]}                                                                                  | ${UTC}                          | ${"a range that is not an Interval"}
    ${{ start: START, end: "2024-02-01T00:00:00Z" }} | ${[{ ...elevenDriving, cap: "PT0S" }]}                                                              | ${UTC}                          | ${"a zero cap"}
    ${{ start: START, end: "2024-02-01T00:00:00Z" }} | ${[elevenDriving]}                                                                                  | ${{ timeZone: "Mars/Olympus" }} | ${"an invalid zone"}
    ${{ start: START, end: "2024-02-01T00:00:00Z" }} | ${[{ label: "d", kind: "rollingCap", statuses: ["d"], cap: "PT60H", window: { operatorDays: 7 } }]} | ${UTC}                          | ${"operator days without dayStartTime"}
  `("returns null for $reason", ({ range, rules, options }) => {
    expect(
      dutyViolations(dutySequence(START, week1), range, rules, options),
    ).toBeNull();
  });

  const daily: DutyRule = {
    label: "12 a day",
    kind: "fixedPeriodCap",
    statuses: ["driving"],
    cap: "PT12H",
    period: { calendarDays: 1 },
  };

  // The log covers one week. A 40-year range reads as that week: the 14,610 days around it are not
  // walked, so the walk stays under 10,000 days and the record is the week's alone.
  it("reads a range far longer than the log as the time the log covers", () => {
    const log = dutySequence(START, week1);

    expect(
      dutyViolations(
        log,
        { start: "2000-01-01T00:00:00Z", end: "2040-01-01T00:00:00Z" },
        [daily],
        UTC,
      ),
    ).toEqual(
      dutyViolations(
        log,
        { start: START, end: log.at(-1)?.end as string },
        [daily],
        UTC,
      ),
    );
  });

  // One entry from 1800 to 2040 covers 87,658 local days, more than the 10,000 a walk may visit.
  it("returns null for a log covering more than 10,000 local days", () => {
    expect(
      dutyViolations(
        [
          {
            status: "driving",
            start: "1800-01-01T00:00:00Z",
            end: "2040-01-01T00:00:00Z",
          },
        ],
        { start: "1800-01-01T00:00:00Z", end: "2040-01-01T00:00:00Z" },
        [daily],
        UTC,
      ),
    ).toBeNull();
  });

  // A free period of 14 hours containing a night from 23:00 to 05:00, in any 3 calendar days. The
  // log covers three days of March 2024; a range from 1969 reads as those three days, so the night
  // windows are found only around the log, never for the 55 years before it.
  const nights: DutyRule = {
    label: "a night off in 3 days",
    kind: "freePeriod",
    restStatuses: ["off"],
    minimum: "PT14H",
    within: { calendarDays: 3 },
    containing: { window: { from: "23:00", to: "05:00" }, count: 1 },
  };
  const march: DutyStep[] = [
    ["driving", "PT10H"],
    ["off", "PT14H"],
    ["driving", "PT10H"],
    ["off", "PT9H"],
    ["driving", "PT10H"],
  ];

  it("reads a range from decades before the log as the time the log covers", () => {
    const log = dutySequence("2024-03-04T08:00:00Z", march);
    const record = dutyViolations(
      log,
      { start: log[0]?.start as string, end: "2024-03-07T00:00:00Z" },
      [nights],
      UTC,
    );

    expect(record).not.toBeNull();
    expect(
      dutyViolations(
        log,
        { start: "1969-01-01T00:00:00Z", end: "2024-03-07T00:00:00Z" },
        [nights],
        UTC,
      ),
    ).toEqual(record);
  });

  // The same three days after a night off in 1968 and 20,497 days of driving: a range of the last
  // week finds the night windows around that week only, not along the 56 years before it.
  it("reads the last week of a log that covers 20,500 days", () => {
    const log = dutySequence("1968-01-01T08:00:00Z", [
      ["off", "PT14H"],
      ["driving", "PT491914H"],
      ["off", "PT14H"],
      ["driving", "PT10H"],
      ...march,
    ]);
    const end = log.at(-1)?.end as string;
    const lastWeek = {
      start: Temporal.Instant.from(end).subtract({ hours: 168 }).toString(),
      end,
    };

    expect(dutyViolations(log, lastWeek, [nights], UTC)).not.toBeNull();
  });

  // A night off from 20:00 once every 365 days for 60 years, and a free period containing a night
  // in any 72 hours. Each year fails from three days after its rest to the next, 60 violations.
  // The record finds the night windows around each rest as it reaches it, never the 21,900 nights
  // between, so it is not refused.
  it("reads 60 years of a night off a year", () => {
    const year: DutyStep[] = [
      ["off", "PT14H"],
      ["driving", "PT8746H"],
    ];
    const log = dutySequence(
      "1964-01-01T20:00:00Z",
      Array.from({ length: 60 }, () => year).flat(),
    );
    const record = dutyViolations(
      log,
      { start: log[0]?.start as string, end: log.at(-1)?.end as string },
      [{ ...nights, within: { elapsed: "PT72H" } } as DutyRule],
      UTC,
    );

    expect(record).toHaveLength(60);
  });

  // A million free periods of one second in any 24 hours: each 14-hour rest holds 50,400, so a
  // count can cross a million anywhere in it. Thirty days need more than 1,000,000 instants
  // checked, and the record is refused rather than checked one by one.
  // About 0.5 s here and up to five times that on a slow runner; the timeout is three times that.
  it("returns null when one rule needs more than 1,000,000 instants checked", () => {
    expect(
      dutyViolations(
        dutySequence(
          START,
          repeat(30, [
            ["work", "PT10H"],
            ["off", "PT14H"],
          ]),
        ),
        { start: START, end: "2024-01-31T00:00:00Z" },
        [
          {
            label: "a million seconds",
            kind: "freePeriod",
            restStatuses: ["off"],
            minimum: "PT1S",
            within: { elapsed: "PT24H" },
            atLeast: 1_000_000,
          },
        ],
        UTC,
      ),
    ).toBeNull();
  }, 15_000);

  it("returns null when Temporal.Instant.from throws", () => {
    const log = dutySequence(START, week1);
    mockTemporalInstantFromThrow();
    expect(
      dutyViolations(
        log,
        { start: START, end: "2024-01-08T00:00:00Z" },
        [elevenDriving],
        UTC,
      ),
    ).toBeNull();
  });
});
