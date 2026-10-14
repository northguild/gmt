import { type DutyStep, dutySequence } from "../../test";
import type { DutyRule, RuleOutcome } from "../../types";
import { evaluateDutyLog } from "./evaluateDutyLog";

// Fixtures start on 2024-01-01 (dateYearStart2024Jan01); times of day are the scenario under
// test. Every expected value is worked out from the rule's own numbers in the row's reason.
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

describe("evaluateDutyLog — restRequirement", () => {
  const tenInTwentyFour = (
    extra: Partial<Extract<DutyRule, { kind: "restRequirement" }>> = {},
  ): DutyRule => ({
    label: "10 in 24",
    kind: "restRequirement",
    restStatuses: ["rest"],
    per: { elapsed: "PT24H" },
    minimum: "PT10H",
    ...extra,
  });
  const twoPeriods = { maxPeriods: 2, longestAtLeast: "PT6H" };

  // Each log is 24 hours, evaluated at its end, so the sliding window is the whole log.
  it.each`
    steps                                                                                                           | satisfied | used       | limit      | reason
    ${[["rest", "PT6H"], ["work", "PT7H"], ["rest", "PT4H"], ["work", "PT7H"]]}                                     | ${true}   | ${"PT10H"} | ${"PT10H"} | ${"6 + 4: two periods, the longest 6"}
    ${[["rest", "PT5H"], ["work", "PT7H"], ["rest", "PT5H"], ["work", "PT7H"]]}                                     | ${false}  | ${"PT5H"}  | ${"PT6H"}  | ${"5 + 5: the longest is under 6"}
    ${[["rest", "PT6H"], ["work", "PT4H"], ["rest", "PT2H"], ["work", "PT5H"], ["rest", "PT2H"], ["work", "PT5H"]]} | ${false}  | ${"PT8H"}  | ${"PT10H"} | ${"6 + 2 + 2: two periods hold only 8"}
  `(
    "10 hours in every 24 in at most two periods: $reason",
    ({ steps, satisfied, used, limit }) => {
      expect(
        outcome(
          steps,
          "2024-01-02T00:00:00Z",
          tenInTwentyFour({ composition: twoPeriods }),
        ),
      ).toMatchObject({
        satisfied,
        used,
        limit,
        window: { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" },
        periodBasis: "elapsed",
      });
    },
  );

  it("counts every period of rest without a composition: 6 + 2 + 2 is 10", () => {
    expect(
      outcome(
        [
          ["rest", "PT6H"],
          ["work", "PT4H"],
          ["rest", "PT2H"],
          ["work", "PT5H"],
          ["rest", "PT2H"],
          ["work", "PT5H"],
        ],
        "2024-01-02T00:00:00Z",
        tenInTwentyFour(),
      ),
    ).toMatchObject({ satisfied: true, used: "PT10H", remaining: "PT0S" });
  });

  // 10 hours of rest on each calendar day, but 20 hours of work from 10:00 to 06:00 the next day:
  // the window from 10:00 to 10:00 holds only the 4 hours from 06:00.
  it("fails a sliding window that a calendar day would pass", () => {
    const steps: DutyStep[] = [
      ["rest", "PT10H"],
      ["work", "PT20H"],
      ["rest", "PT10H"],
      ["work", "PT8H"],
    ];

    expect(
      outcome(steps, "2024-01-02T10:00:00Z", tenInTwentyFour()),
    ).toMatchObject({
      satisfied: false,
      used: "PT4H",
      remaining: "PT6H",
    });
    expect(
      outcome(
        steps,
        "2024-01-03T00:00:00Z",
        tenInTwentyFour({ per: { calendarDays: 1 } }),
      ),
    ).toMatchObject({
      satisfied: true,
      used: "PT10H",
      periodBasis: "calendar",
    });
  });

  // 10 hours off in an operator day, 8 of them consecutive and 2 more in blocks of 30 minutes.
  const composite: DutyRule = {
    label: "8 + 2",
    kind: "restRequirement",
    restStatuses: ["off"],
    per: { operatorDays: 1 },
    minimum: "PT10H",
    composite: {
      consecutive: "PT8H",
      additional: "PT2H",
      blockMinimum: "PT30M",
    },
  };
  const operator = { timeZone: "UTC", dayStartTime: "00:00" };

  it.each`
    steps                                                                         | at                        | satisfied | used       | limit      | remaining | reason
    ${[["off", "PT8H"], ...repeat(4, [["onDuty", "PT3H30M"], ["off", "PT30M"]])]} | ${"2024-01-02T00:00:00Z"} | ${true}   | ${"PT10H"} | ${"PT10H"} | ${"PT0S"} | ${"8 + four 30-minute blocks"}
    ${[["off", "PT8H"], ...repeat(6, [["onDuty", "PT2H20M"], ["off", "PT20M"]])]} | ${"2024-01-02T00:00:00Z"} | ${false}  | ${"PT0S"}  | ${"PT2H"}  | ${"PT2H"} | ${"8 + six 20-minute blocks: none counts"}
    ${[["off", "PT10H"], ["onDuty", "PT14H"]]}                                    | ${"2024-01-02T00:00:00Z"} | ${true}   | ${"PT10H"} | ${"PT10H"} | ${"PT0S"} | ${"one run of 10"}
    ${[["off", "PT8H"], ["onDuty", "PT4H"]]}                                      | ${"2024-01-01T12:00:00Z"} | ${true}   | ${"PT8H"}  | ${"PT10H"} | ${"PT2H"} | ${"the day is not over: rest can still be taken"}
    ${[["onDuty", "PT8H"], ["off", "PT7H"], ["onDuty", "PT9H"]]}                  | ${"2024-01-01T23:00:00Z"} | ${false}  | ${"PT7H"}  | ${"PT8H"}  | ${"PT1H"} | ${"one hour left cannot make 8 consecutive"}
  `(
    "8 consecutive plus 2 in blocks: $reason",
    ({ steps, at, satisfied, used, limit, remaining }) => {
      expect(outcome(steps, at, composite, operator)).toMatchObject({
        satisfied,
        used,
        limit,
        remaining,
        periodBasis: "operatorDay",
      });
    },
  );

  // No more than 14 hours from the end of one rest to the start of the next.
  it.each`
    steps                                                       | at                        | satisfied | used       | limit      | dueBy                     | reason
    ${[["rest", "PT10H"], ["work", "PT15H"], ["rest", "PT1H"]]} | ${"2024-01-02T02:00:00Z"} | ${false}  | ${"PT15H"} | ${"PT14H"} | ${null}                   | ${"15 hours between rests"}
    ${[["rest", "PT10H"], ["work", "PT14H"], ["rest", "PT1H"]]} | ${"2024-01-02T01:00:00Z"} | ${true}   | ${"PT10H"} | ${"PT10H"} | ${null}                   | ${"14 hours between rests"}
    ${[["rest", "PT10H"], ["work", "PT5H"]]}                    | ${"2024-01-01T15:00:00Z"} | ${true}   | ${"PT10H"} | ${"PT10H"} | ${"2024-01-02T00:00:00Z"} | ${"working: the next rest is due 14 hours after the last"}
    ${[["rest", "PT10H"], ["work", "PT15H"]]}                   | ${"2024-01-02T01:00:00Z"} | ${false}  | ${"PT15H"} | ${"PT14H"} | ${"2024-01-02T00:00:00Z"} | ${"still working, an hour past it"}
  `("maxGap PT14H: $reason", ({ steps, at, satisfied, used, limit, dueBy }) => {
    expect(
      outcome(steps, at, tenInTwentyFour({ maxGap: "PT14H" })),
    ).toMatchObject({
      satisfied,
      used,
      limit,
      dueBy,
    });
  });
});

describe("evaluateDutyLog — freePeriod", () => {
  // 30 consecutive hours off in every 168: the run ending 06:00 on the 2nd stays inside a window
  // ending at T while T − 168 h ≤ 00:00 on the 1st, so the next one is due by 00:00 on the 8th.
  it("reports dueBy as the instant the window closes", () => {
    expect(
      outcome(
        [
          ["off", "PT30H"],
          ["onDuty", "PT18H"],
        ],
        "2024-01-03T00:00:00Z",
        {
          label: "30 in 168",
          kind: "freePeriod",
          restStatuses: ["off"],
          minimum: "PT30H",
          within: { elapsed: "PT168H" },
        },
      ),
    ).toEqual({
      label: "30 in 168",
      kind: "freePeriod",
      severity: "violation",
      satisfied: true,
      used: 1,
      limit: 1,
      remaining: 0,
      window: { start: "2023-12-27T00:00:00Z", end: "2024-01-03T00:00:00Z" },
      periodBasis: "elapsed",
      dueBy: "2024-01-08T00:00:00Z",
      resetAt: null,
    });
  });

  // 36 hours off holding two whole nights from 22:00 to 08:00: 20:00 on the 1st to 08:00 on the
  // 3rd holds the nights of the 1st and 2nd; 10:00 on the 1st to 22:00 on the 2nd holds one.
  it.each`
    steps                                                          | at                        | satisfied | used | reason
    ${[["onDuty", "PT20H"], ["off", "PT36H"], ["onDuty", "PT4H"]]} | ${"2024-01-03T12:00:00Z"} | ${true}   | ${1} | ${"two nights"}
    ${[["onDuty", "PT10H"], ["off", "PT36H"], ["onDuty", "PT4H"]]} | ${"2024-01-03T02:00:00Z"} | ${false}  | ${0} | ${"one night"}
  `(
    "36 hours off containing two local nights: $reason",
    ({ steps, at, satisfied, used }) => {
      expect(
        outcome(steps, at, {
          label: "36 with 2 nights",
          kind: "freePeriod",
          restStatuses: ["off"],
          minimum: "PT36H",
          within: { elapsed: "PT168H" },
          containing: { window: { from: "22:00", to: "08:00" }, count: 2 },
        }),
      ).toMatchObject({ satisfied, used });
    },
  );

  // A working day is off 00:00–08:00, on duty 08:00–18:00, off 18:00–24:00; a free day is off
  // all day. The run around a free day is 6 + 24 + 8 = 38 hours, one free period of 24.
  const working: DutyStep[] = [
    ["off", "PT8H"],
    ["onDuty", "PT10H"],
    ["off", "PT6H"],
  ];
  const free: DutyStep[] = [["off", "PT24H"]];
  const fourWeeks = (
    freeDays: readonly number[],
    day28: readonly DutyStep[] = free,
  ) =>
    Array.from({ length: 28 }, (_, index) => {
      const day = index + 1;
      if (day === 28 && freeDays.includes(28)) {
        return day28;
      }
      return freeDays.includes(day) ? free : working;
    }).flat();
  const oneInSeven: DutyRule = {
    label: "1 in 7 over 28",
    kind: "freePeriod",
    restStatuses: ["off"],
    minimum: "PT24H",
    within: { calendarDays: 28 },
    atLeast: 4,
  };

  it.each`
    freeDays           | day28                                                         | satisfied | used | reason
    ${[7, 14, 21, 28]} | ${free}                                                       | ${true}   | ${4} | ${"four free days"}
    ${[7, 14, 21]}     | ${free}                                                       | ${false}  | ${3} | ${"three"}
    ${[7, 14, 21, 28]} | ${[["off", "PT10H"], ["homeCall", "PT1H"], ["off", "PT13H"]]} | ${false}  | ${3} | ${"a one-hour homeCall breaks the 28th"}
  `(
    "one 24-hour free period in seven over 28 calendar days: $reason",
    ({ freeDays, day28, satisfied, used }) => {
      expect(
        outcome(fourWeeks(freeDays, day28), "2024-01-29T00:00:00Z", oneInSeven),
      ).toMatchObject({
        satisfied,
        used,
        limit: 4,
        window: { start: "2024-01-01T00:00:00Z", end: "2024-01-29T00:00:00Z" },
        periodBasis: "calendar",
      });
    },
  );

  // With no more rest after the 28th, the 28-day window ending on 4 February still holds the
  // run around the 7th from 00:00 on the 7th (32 hours); the one ending on the 5th holds 8.
  it("reports dueBy as the end of the first later window that would fall short", () => {
    expect(
      outcome(fourWeeks([7, 14, 21, 28]), "2024-01-29T00:00:00Z", oneInSeven),
    ).toMatchObject({ dueBy: "2024-02-05T00:00:00Z" });
  });

  // At 06:00 on the 28th, off since 18:00 on the 27th: the window ending with the 28th holds 3
  // free days, and staying off to the end of the 28th would make the run 30 hours, a fourth.
  it("reports dueBy as the window's end while it can still be met", () => {
    expect(
      outcome(
        [...fourWeeks([7, 14, 21]).slice(0, -3), ["off", "PT6H"]],
        "2024-01-28T06:00:00Z",
        oneInSeven,
      ),
    ).toMatchObject({
      satisfied: true,
      used: 3,
      remaining: 1,
      window: { start: "2024-01-01T00:00:00Z", end: "2024-01-29T00:00:00Z" },
      dueBy: "2024-01-29T00:00:00Z",
    });
  });

  it("fails a window that rest to its end could no longer meet", () => {
    expect(
      outcome(
        [...fourWeeks([7, 14, 21]).slice(0, -3), ["onDuty", "PT6H"]],
        "2024-01-28T06:00:00Z",
        oneInSeven,
      ),
    ).toMatchObject({ satisfied: false, used: 3, dueBy: null });
  });

  it("counts a run twice the minimum as two free periods", () => {
    expect(
      outcome([["off", "PT48H"]], "2024-01-03T00:00:00Z", {
        ...oneInSeven,
        within: { elapsed: "PT168H" },
        atLeast: 2,
      } as DutyRule),
    ).toMatchObject({ satisfied: true, used: 2 });
  });
});

describe("evaluateDutyLog — restBeforeDuty", () => {
  const tenBefore: DutyRule = {
    label: "10 before duty",
    kind: "restBeforeDuty",
    restStatuses: ["off"],
    minimum: "PT10H",
    within: "PT24H",
  };

  it.each`
    steps                                                           | at                        | satisfied | used         | remaining | window                                                            | reason
    ${[["onDuty", "PT8H"], ["off", "PT9H59M"], ["onDuty", "PT1H"]]} | ${"2024-01-01T18:59:00Z"} | ${false}  | ${"PT9H59M"} | ${"PT1M"} | ${{ start: "2023-12-31T17:59:00Z", end: "2024-01-01T17:59:00Z" }} | ${"9:59 before the duty"}
    ${[["onDuty", "PT8H"], ["off", "PT10H"], ["onDuty", "PT1H"]]}   | ${"2024-01-01T19:00:00Z"} | ${true}   | ${"PT10H"}   | ${"PT0S"} | ${{ start: "2023-12-31T18:00:00Z", end: "2024-01-01T18:00:00Z" }} | ${"10:00 before the duty"}
    ${[["onDuty", "PT8H"], ["off", "PT6H"]]}                        | ${"2024-01-01T14:00:00Z"} | ${true}   | ${"PT6H"}    | ${"PT4H"} | ${{ start: "2023-12-31T14:00:00Z", end: "2024-01-01T14:00:00Z" }} | ${"resting: 4 more hours before a duty may start"}
  `(
    "10 hours off in the 24 before a duty: $reason",
    ({ steps, at, satisfied, used, remaining, window }) => {
      expect(outcome(steps, at, tenBefore)).toMatchObject({
        satisfied,
        used,
        limit: "PT10H",
        remaining,
        window,
        periodBasis: "elapsed",
      });
    },
  );

  // A 30-minute break between two stints is not the rest before a duty: the 12 hours off before
  // the first stint are still inside the 24 hours before the second, so the rule holds.
  it("reads the longest rest in the 24 hours, not a break just before", () => {
    const steps: DutyStep[] = [
      ["off", "PT12H"],
      ["onDuty", "PT4H"],
      ["off", "PT30M"],
      ["onDuty", "PT4H"],
    ];
    expect(outcome(steps, "2024-01-01T20:30:00Z", tenBefore)).toMatchObject({
      satisfied: true,
      used: "PT12H",
    });
  });

  // A break logged as rest starts a new duty, measured from where it starts: with 14 hours of
  // lookback, the 12 hours off before the first stint are cut to 9.5 before the second. Logged as
  // "break", outside the rest statuses, it is part of the duty, and the rule holds.
  it.each`
    breakStatus | satisfied | used
    ${"off"}    | ${false}  | ${"PT9H30M"}
    ${"break"}  | ${true}   | ${"PT12H"}
  `(
    "reads a 30-minute break logged as $breakStatus",
    ({ breakStatus, satisfied, used }) => {
      const steps: DutyStep[] = [
        ["off", "PT12H"],
        ["onDuty", "PT4H"],
        [breakStatus, "PT30M"],
        ["onDuty", "PT3H30M"],
      ];
      expect(
        outcome(steps, "2024-01-01T20:00:00Z", {
          ...tenBefore,
          within: "PT14H",
        } as DutyRule),
      ).toMatchObject({ satisfied, used });
    },
  );

  // Overnight off 12 hours, then a 13-hour duty with a 20-minute break in it, 12.5 hours off and a
  // new duty. The duty before the rest runs from the end of the overnight rest, the last of at
  // least 10 hours, to the rest's start: 13 hours, break included, so 13 hours of rest are due.
  it("measures the duty before the rest from the last full rest, breaks included", () => {
    const steps: DutyStep[] = [
      ["off", "PT12H"],
      ["onDuty", "PT6H40M"],
      ["off", "PT20M"],
      ["onDuty", "PT6H"],
      ["off", "PT12H30M"],
      ["onDuty", "PT1H"],
    ];
    expect(
      outcome(steps, "2024-01-02T14:30:00Z", {
        ...tenBefore,
        orFactor: { k: 1, floor: "PT12H" },
      } as DutyRule),
    ).toMatchObject({ satisfied: false, used: "PT12H30M", limit: "PT13H" });
  });

  // The larger of 1 × the previous duty and 12 hours: 12 after a 10-hour duty, 13 after 13.
  it.each`
    duty       | rest          | satisfied | limit
    ${"PT10H"} | ${"PT12H"}    | ${true}   | ${"PT12H"}
    ${"PT10H"} | ${"PT11H59M"} | ${false}  | ${"PT12H"}
    ${"PT13H"} | ${"PT12H"}    | ${false}  | ${"PT13H"}
    ${"PT13H"} | ${"PT13H"}    | ${true}   | ${"PT13H"}
  `(
    "requires $limit after a $duty duty: $rest is satisfied $satisfied",
    ({ duty, rest, satisfied, limit }) => {
      const steps: DutyStep[] = [
        ["onDuty", duty],
        ["off", rest],
        ["onDuty", "PT1H"],
      ];
      const log = dutySequence(START, steps);
      expect(
        outcome(
          steps,
          log[2]?.end as string,
          {
            ...tenBefore,
            orFactor: { k: 1, floor: "PT12H" },
          } as DutyRule,
        ),
      ).toMatchObject({ satisfied, used: rest, limit });
    },
  );
});
