import { type DutyStep, dutySequence } from "../../test";
import type { DutyRule, RuleOutcome } from "../../types";
import { evaluateDutyLog } from "./evaluateDutyLog";

// Fixtures start on 2024-01-01 (dateYearStart2024Jan01, a Monday); times of day are the scenario
// under test. Every expected value is worked out from the rule's own numbers in the row's reason.
const START = "2024-01-01T00:00:00Z";
const UTC = { timeZone: "UTC" };

function outcome(
  steps: readonly DutyStep[],
  at: string,
  rule: DutyRule,
  options: { timeZone: string; dayStartTime?: string } = UTC,
): RuleOutcome {
  const report = evaluateDutyLog(
    dutySequence(START, steps),
    at,
    [rule],
    options,
  );
  expect(report).not.toBeNull();
  return report?.outcomes[0] as RuleOutcome;
}

const repeat = (times: number, steps: readonly DutyStep[]): DutyStep[] =>
  Array.from({ length: times }, () => steps).flat();

const end = (steps: readonly DutyStep[]) =>
  dutySequence(START, steps).at(-1)?.end as string;

describe("evaluateDutyLog — quota", () => {
  // At most 3 reduced rests (at least 9 hours, under 11) between two rests of 24 hours.
  const reduced: DutyRule = {
    label: "3 reduced",
    kind: "quota",
    event: { statuses: ["off"], minimum: "PT9H", maximum: "PT11H" },
    count: 3,
    reset: { statuses: ["off"], consecutive: "PT24H" },
  };
  const cycle: DutyStep[] = [
    ["driving", "PT13H"],
    ["off", "PT9H"],
  ];

  it.each`
    cycles | satisfied | used | remaining
    ${2}   | ${true}   | ${2} | ${1}
    ${3}   | ${true}   | ${3} | ${0}
    ${4}   | ${false}  | ${4} | ${0}
  `(
    "after a weekly rest, $cycles reduced rests: satisfied $satisfied with $remaining left",
    ({ cycles, satisfied, used, remaining }) => {
      const steps: DutyStep[] = [
        ["off", "PT24H"],
        ...repeat(cycles, cycle),
        ["driving", "PT1H"],
      ];
      expect(outcome(steps, end(steps), reduced)).toMatchObject({
        satisfied,
        used,
        limit: 3,
        remaining,
        resetAt: "2024-01-02T00:00:00Z",
      });
    },
  );

  it.each`
    steps                                                                                                  | used | reason
    ${[["off", "PT24H"], ["driving", "PT13H"], ["off", "PT11H"], ["driving", "PT1H"]]}                     | ${0} | ${"11 hours is a regular rest, not a reduced one"}
    ${[["off", "PT24H"], ["driving", "PT13H"], ["off", "PT8H59M"], ["driving", "PT1H"]]}                   | ${0} | ${"8:59 is too short to count"}
    ${[...repeat(4, cycle), ["off", "PT24H"], ["driving", "PT13H"], ["off", "PT9H"], ["driving", "PT1H"]]} | ${1} | ${"a full rest starts the count again"}
  `("counts only events between the bounds: $reason", ({ steps, used }) => {
    expect(outcome(steps, end(steps), reduced)).toMatchObject({
      used,
      satisfied: true,
    });
  });

  it("does not count a rest the log carries on past at", () => {
    const steps: DutyStep[] = [
      ["off", "PT24H"],
      ...repeat(3, cycle),
      ["driving", "PT13H"],
      ["off", "PT30H"],
    ];
    // At 9 hours into the last rest it is still going, and will end as a full rest.
    const at = "2024-01-05T07:00:00Z";
    expect(outcome(steps, at, reduced)).toMatchObject({
      used: 3,
      satisfied: true,
    });
  });

  // Counted per ISO week instead of between rests: a reduced rest starting on Monday the 8th is in
  // the second week.
  it("counts the events that start inside an every window", () => {
    const steps: DutyStep[] = [
      ["driving", "PT13H"],
      ["off", "PT10H"],
      ["driving", "PT13H"],
      ["off", "PT10H"],
    ];
    expect(
      outcome(steps, "2024-01-03T00:00:00Z", {
        label: "1 a week",
        kind: "quota",
        event: { statuses: ["off"], minimum: "PT9H", maximum: "PT11H" },
        count: 1,
        reset: { every: { isoWeeks: 1 } },
      }),
    ).toMatchObject({
      satisfied: false,
      used: 2,
      window: { start: "2024-01-01T00:00:00Z", end: "2024-01-08T00:00:00Z" },
      periodBasis: "calendar",
    });
  });
});

describe("evaluateDutyLog — dueBy", () => {
  // A 45-hour rest due by the end of the sixth operator day after the last one. The last ends at
  // 10:00 on Monday the 1st, inside the operator day that began at 04:00: Monday is day one, so the
  // sixth ends when Sunday's day begins, 04:00 on the 7th, not at midnight.
  const weekly = (
    dayStartTime: string,
  ): [DutyRule, { timeZone: string; dayStartTime: string }] => [
    {
      label: "weekly rest",
      kind: "dueBy",
      event: { statuses: ["off"], minimum: "PT45H" },
      within: { periods: 6, period: { operatorDays: 1 } },
    },
    { timeZone: "UTC", dayStartTime },
  ];
  const lastRest = "2023-12-30T13:00:00Z";
  const fromRest = (steps: readonly DutyStep[]) =>
    dutySequence(lastRest, [["off", "PT45H"], ...steps]);

  it.each`
    dayStartTime | dueBy
    ${"04:00"}   | ${"2024-01-07T04:00:00Z"}
    ${"00:00"}   | ${"2024-01-07T00:00:00Z"}
  `(
    "computes dueBy $dueBy from a $dayStartTime day start",
    ({ dayStartTime, dueBy }) => {
      const [rule, options] = weekly(dayStartTime);
      const report = evaluateDutyLog(
        fromRest(
          repeat(5, [
            ["driving", "PT10H"],
            ["off", "PT14H"],
          ]),
        ),
        "2024-01-06T00:00:00Z",
        [rule],
        options,
      );
      expect(report?.outcomes[0]).toMatchObject({
        satisfied: true,
        dueBy,
        resetAt: "2024-01-01T10:00:00Z",
        window: { start: "2024-01-01T10:00:00Z", end: dueBy },
        periodBasis: "operatorDay",
      });
    },
  );

  it.each`
    steps                                                                                               | at                        | satisfied | remaining  | reason
    ${repeat(5, [["driving", "PT10H"], ["off", "PT14H"]])}                                              | ${"2024-01-06T10:00:00Z"} | ${true}   | ${"PT18H"} | ${"before the deadline"}
    ${[...repeat(5, [["driving", "PT10H"], ["off", "PT14H"]]), ["driving", "PT19H"]]}                   | ${"2024-01-07T05:00:00Z"} | ${false}  | ${"PT0S"}  | ${"an hour past it, still driving"}
    ${[...repeat(5, [["driving", "PT10H"], ["off", "PT14H"]]), ["driving", "PT10H"], ["off", "PT20H"]]} | ${"2024-01-07T06:00:00Z"} | ${true}   | ${"PT0S"}  | ${"a rest that began before it is still going"}
  `(
    "holds until the deadline: $reason",
    ({ steps, at, satisfied, remaining }) => {
      const [rule, options] = weekly("04:00");
      const report = evaluateDutyLog(fromRest(steps), at, [rule], options);
      expect(report?.outcomes[0]).toMatchObject({ satisfied, remaining });
    },
  );

  // The 45-hour rest ends at 21:00 on the 2nd; six 24-hour periods later is 21:00 on the 8th.
  it("counts elapsed periods from the end of the last rest", () => {
    expect(
      outcome(
        [
          ["off", "PT45H"],
          ["driving", "PT10H"],
        ],
        "2024-01-03T07:00:00Z",
        {
          label: "six 24-hour periods",
          kind: "dueBy",
          event: { statuses: ["off"], minimum: "PT45H" },
          within: { periods: 6, period: { elapsed: "PT24H" } },
        },
      ),
    ).toMatchObject({
      satisfied: true,
      dueBy: "2024-01-08T21:00:00Z",
      used: "PT10H",
      limit: "PT144H",
      periodBasis: "elapsed",
    });
  });
});

describe("evaluateDutyLog — pattern", () => {
  // In any 4 ISO weeks, at least 4 weekly rests (24 hours or more), at least 2 of them regular
  // (45 hours or more). Each week is five 10-hour shifts with 14 hours off, then its weekend rest.
  const fourWeekly: DutyRule = {
    label: "4 rests, 2 regular",
    kind: "pattern",
    period: { isoWeeks: 1 },
    lookback: 4,
    classes: [
      { label: "weekly", statuses: ["off"], minimum: "PT24H" },
      { label: "regular", statuses: ["off"], minimum: "PT45H" },
    ],
    require: [
      { label: "weekly", atLeast: 4 },
      { label: "regular", atLeast: 2 },
    ],
  };
  // 4 × 24 h + 10 h is 106 hours; the weekend rest and the on-duty time after it fill the
  // remaining 62, so every week is 168 hours and starts on a Monday.
  const week = (weekend: string): DutyStep[] => [
    ...repeat(4, [
      ["driving", "PT10H"],
      ["off", "PT14H"],
    ]),
    ["driving", "PT10H"],
    ["off", weekend],
    ["onDuty", `PT${62 - Number(weekend.slice(2, -1))}H`],
  ];

  it.each`
    weekends                                | satisfied | used | limit | reason
    ${["PT45H", "PT45H", "PT24H", "PT24H"]} | ${true}   | ${4} | ${4}  | ${"4 rests, 2 regular: both have no slack, the first is shown"}
    ${["PT45H", "PT24H", "PT24H", "PT24H"]} | ${false}  | ${1} | ${2}  | ${"4 rests, 1 regular"}
    ${["PT45H", "PT45H", "PT24H", "PT20H"]} | ${false}  | ${3} | ${4}  | ${"3 rests, 2 regular"}
  `("over four weeks: $reason", ({ weekends, satisfied, used, limit }) => {
    const steps = weekends.flatMap((weekend: string) => week(weekend));
    expect(outcome(steps, "2024-01-29T00:00:00Z", fourWeekly)).toMatchObject({
      satisfied,
      used,
      limit,
      window: { start: "2024-01-01T00:00:00Z", end: "2024-01-29T00:00:00Z" },
    });
  });
});

describe("evaluateDutyLog — pattern before its window ends", () => {
  const inAWeek = (atLeast: number): DutyRule => ({
    label: `${atLeast} in a week`,
    kind: "pattern",
    period: { isoWeeks: 1 },
    lookback: 1,
    classes: [{ label: "rest", statuses: ["off"], minimum: "PT24H" }],
    require: [{ label: "rest", atLeast }],
  });

  // Off since Sunday the 31st, in the week before: that rest counts in the week it started. At
  // noon on Wednesday the 3rd, 108 hours are left in the week, room for 5 more 24-hour rests to
  // start, so one is still possible and four are too.
  it.each`
    at                        | atLeast | satisfied | reason
    ${"2024-01-03T12:00:00Z"} | ${1}    | ${true}   | ${"108 hours left: a rest can still start"}
    ${"2024-01-03T12:00:00Z"} | ${4}    | ${true}   | ${"room for 5 one after another"}
    ${"2024-01-06T12:00:00Z"} | ${4}    | ${false}  | ${"36 hours left: room for 2, not 4"}
  `("$reason", ({ at, atLeast, satisfied }) => {
    const report = evaluateDutyLog(
      [{ status: "off", start: "2023-12-31T00:00:00Z", end: at }],
      at,
      [inAWeek(atLeast)],
      UTC,
    );
    expect(report?.outcomes[0]).toMatchObject({
      satisfied,
      used: 0,
      window: { start: "2024-01-01T00:00:00Z", end: "2024-01-08T00:00:00Z" },
    });
  });

  // Off since 00:00 on Saturday the 6th, inside the week: at noon it is 12 hours long, and going on
  // to 00:00 on Sunday makes it a 24-hour rest, the one required.
  it("lets a rest still going at at qualify by going on", () => {
    const report = evaluateDutyLog(
      [
        {
          status: "off",
          start: "2024-01-06T00:00:00Z",
          end: "2024-01-06T12:00:00Z",
        },
      ],
      "2024-01-06T12:00:00Z",
      [inAWeek(2)],
      UTC,
    );
    expect(report?.outcomes[0]).toMatchObject({
      satisfied: true,
      used: 0,
      remaining: 2,
    });
  });
});

describe("evaluateDutyLog — occurrenceCap", () => {
  // Night duty from 22:00 to 07:00, no more often than every third night: over 28 days the nights
  // starting on the 1st, 4th, … 25th are nine; one more on the 28th is ten.
  const nights = (dates: readonly number[]): DutyStep[] => {
    const steps: DutyStep[] = [];
    let cursor = 0;
    for (const date of dates) {
      const startHour = (date - 1) * 24 + 22;
      steps.push(["off", `PT${startHour - cursor}H`], ["nightDuty", "PT9H"]);
      cursor = startHour + 9;
    }
    steps.push(["off", `PT${28 * 24 - cursor}H`]);
    return steps;
  };
  const everyThird = (byInitiationDate: boolean): DutyRule => ({
    label: "every third night",
    kind: "occurrenceCap",
    statuses: ["nightDuty"],
    per: { calendarDays: 1 },
    lookback: 28,
    maximum: 9,
    byInitiationDate,
  });

  it.each`
    dates                                    | byInitiationDate | satisfied | used  | reason
    ${[1, 4, 7, 10, 13, 16, 19, 22, 25]}     | ${true}          | ${true}   | ${9}  | ${"nine nights, counted by the date each began"}
    ${[1, 4, 7, 10, 13, 16, 19, 22, 25, 27]} | ${true}          | ${false}  | ${10} | ${"ten"}
    ${[1, 4, 7, 10, 13]}                     | ${false}         | ${false}  | ${10} | ${"five nights touch ten dates"}
  `(
    "night duty every third night over 28 days: $reason",
    ({ dates, byInitiationDate, satisfied, used }) => {
      const steps = nights(dates);
      expect(
        outcome(steps, "2024-01-29T00:00:00Z", everyThird(byInitiationDate)),
      ).toMatchObject({
        satisfied,
        used,
        limit: 9,
        window: { start: "2024-01-01T00:00:00Z", end: "2024-01-29T00:00:00Z" },
      });
    },
  );

  it("counts two tours that start on one local date once by initiation date", () => {
    const steps: DutyStep[] = [
      ["onDuty", "PT6H"],
      ["off", "PT4H"],
      ["onDuty", "PT6H"],
      ["off", "PT8H"],
    ];
    expect(
      outcome(steps, "2024-01-02T00:00:00Z", {
        label: "6 of 7",
        kind: "occurrenceCap",
        statuses: ["onDuty"],
        per: { calendarDays: 1 },
        lookback: 7,
        maximum: 6,
        byInitiationDate: true,
      }),
    ).toMatchObject({ used: 1, satisfied: true });
  });

  // Duty started on six consecutive dates, then a seventh: the cap of 6 initiation dates in 7 fails,
  // and the 48 hours off due within six operator days of the last 48-hour rest is late.
  it("triggers the 48-hour rest after the sixth initiation date", () => {
    const sixDays = repeat(6, [
      ["onDuty", "PT10H"],
      ["off", "PT14H"],
    ]);
    const rules: DutyRule[] = [
      {
        label: "6 of 7",
        kind: "occurrenceCap",
        statuses: ["onDuty"],
        per: { calendarDays: 1 },
        lookback: 7,
        maximum: 6,
        byInitiationDate: true,
      },
      {
        label: "48 after 6",
        kind: "dueBy",
        event: { statuses: ["off"], minimum: "PT48H" },
        within: { periods: 6, period: { operatorDays: 1 } },
      },
    ];
    const options = { timeZone: "UTC", dayStartTime: "00:00" };
    const log = dutySequence("2023-12-30T08:00:00Z", [
      ["off", "PT48H"],
      ...sixDays,
      ["onDuty", "PT1H"],
    ]);
    const sixth = evaluateDutyLog(log, "2024-01-06T18:00:00Z", rules, options);
    const seventh = evaluateDutyLog(
      log,
      "2024-01-07T09:00:00Z",
      rules,
      options,
    );

    expect(sixth?.violations).toEqual([]);
    expect(sixth?.outcomes[1]).toMatchObject({ dueBy: "2024-01-07T00:00:00Z" });
    expect(
      seventh?.violations.map((failed) => [failed.label, failed.used]),
    ).toEqual([
      ["6 of 7", 7],
      ["48 after 6", "PT145H"],
    ]);
  });
});

describe("evaluateDutyLog — usageLookback", () => {
  // An allowance not used within the previous 7 calendar days unless 34 hours off came between.
  const rule = (uses: string[]): DutyRule => ({
    label: "16-hour allowance",
    kind: "usageLookback",
    uses,
    notWithin: { calendarDays: 7 },
    reset: { statuses: ["off"], consecutive: "PT34H" },
  });
  const days = repeat(6, [
    ["onDuty", "PT12H"],
    ["off", "PT12H"],
  ]);

  it.each`
    steps                                                                                             | uses                                                | at                        | satisfied | used | remaining | resetAt                   | reason
    ${days}                                                                                           | ${["2024-01-01T10:00:00Z"]}                         | ${"2024-01-06T12:00:00Z"} | ${true}   | ${1} | ${0}      | ${null}                   | ${"one use, and none is left to take"}
    ${days}                                                                                           | ${["2024-01-01T10:00:00Z", "2024-01-06T10:00:00Z"]} | ${"2024-01-06T12:00:00Z"} | ${false}  | ${2} | ${0}      | ${null}                   | ${"a second use on the sixth day"}
    ${[["onDuty", "PT12H"], ["off", "PT34H"], ...repeat(4, [["onDuty", "PT12H"], ["off", "PT12H"]])]} | ${["2024-01-01T10:00:00Z", "2024-01-06T10:00:00Z"]} | ${"2024-01-06T12:00:00Z"} | ${true}   | ${1} | ${0}      | ${"2024-01-02T22:00:00Z"} | ${"a 34-hour reset came between"}
    ${repeat(8, [["onDuty", "PT12H"], ["off", "PT12H"]])}                                             | ${["2024-01-01T10:00:00Z", "2024-01-08T10:00:00Z"]} | ${"2024-01-08T12:00:00Z"} | ${true}   | ${1} | ${0}      | ${null}                   | ${"the first use is outside the 7 days"}
    ${days}                                                                                           | ${[]}                                               | ${"2024-01-06T12:00:00Z"} | ${true}   | ${0} | ${1}      | ${null}                   | ${"never used: free to use"}
  `("$reason", ({ steps, uses, at, satisfied, used, remaining, resetAt }) => {
    expect(outcome(steps, at, rule(uses))).toMatchObject({
      satisfied,
      used,
      limit: 1,
      remaining,
      resetAt,
      periodBasis: "calendar",
    });
  });

  // At 00:00 on the 8th the 7 days judged are the 1st to the 7th, which hold only the first use; a
  // use at the instant the window ends belongs to the next window. Over 7 elapsed days, the window
  // is the 7 days up to and including `at`: a use at `at` counts, and one exactly 7 days earlier is
  // outside it, so each use is in one window only.
  it.each`
    notWithin              | used | satisfied | reason
    ${{ calendarDays: 7 }} | ${1} | ${true}   | ${"the second use falls on the 8th day, outside the 7"}
    ${{ elapsed: "P7D" }}  | ${1} | ${true}   | ${"exactly 7 days apart: the first is just outside the window"}
  `(
    "counts a use on a boundary in one window only: $reason",
    ({ notWithin, used, satisfied }) => {
      expect(
        outcome(
          repeat(7, [
            ["onDuty", "PT12H"],
            ["off", "PT12H"],
          ]),
          "2024-01-08T00:00:00Z",
          {
            label: "allowance",
            kind: "usageLookback",
            uses: ["2024-01-01T00:00:00Z", "2024-01-08T00:00:00Z"],
            notWithin,
            reset: { statuses: ["off"], consecutive: "PT34H" },
          },
        ),
      ).toMatchObject({ satisfied, used });
    },
  );
});
