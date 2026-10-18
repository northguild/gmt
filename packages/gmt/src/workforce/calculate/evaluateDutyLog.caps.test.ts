import { Temporal } from "../../internal/temporal";
import { type DutyStep, dutySequence } from "../../test";
import type { DutyRule, RuleOutcome } from "../../types";
import { evaluateDutyLog } from "./evaluateDutyLog";

// Fixtures start on 2024-01-01 (dateYearStart2024Jan01, a Monday), so ISO weeks start on the 1st,
// 8th, 15th, 22nd and 29th. Times of day are the scenario under test. Every expected value is
// worked out from the rule's own numbers in the row's reason.
const START = "2024-01-01T00:00:00Z";
const UTC = { timeZone: "UTC" };

function outcome(
  steps: readonly DutyStep[],
  at: string,
  rule: DutyRule,
  options: { timeZone: string; dayStartTime?: string } = UTC,
  start = START,
): RuleOutcome {
  const report = evaluateDutyLog(
    dutySequence(start, steps),
    at,
    [rule],
    options,
  );
  expect(report).not.toBeNull();
  return report?.outcomes[0] as RuleOutcome;
}

const repeat = (times: number, steps: readonly DutyStep[]): DutyStep[] =>
  Array.from({ length: times }, () => steps).flat();

describe("evaluateDutyLog — cumulativeCap", () => {
  const rule: DutyRule = {
    label: "11 driving",
    kind: "cumulativeCap",
    statuses: ["driving"],
    cap: "PT11H",
    since: { statuses: ["off"], consecutive: "PT10H" },
  };

  it("reports PT0S remaining at exactly the 11-hour cap, counted from the end of a 10-hour reset", () => {
    expect(
      outcome(
        [
          ["off", "PT10H"],
          ["driving", "PT11H"],
        ],
        "2024-01-01T21:00:00Z",
        rule,
      ),
    ).toEqual({
      label: "11 driving",
      kind: "cumulativeCap",
      severity: "violation",
      satisfied: true,
      used: "PT11H",
      limit: "PT11H",
      remaining: "PT0S",
      window: { start: "2024-01-01T10:00:00Z", end: "2024-01-01T21:00:00Z" },
      periodBasis: null,
      dueBy: null,
      resetAt: "2024-01-01T10:00:00Z",
    });
  });

  // 6 h + 5 h 1 min of driving is 11 h 1 min since the last reset unless the middle rest resets.
  it.each`
    steps                                                                                              | at                        | satisfied | used         | remaining    | resetAt                   | reason
    ${[["off", "PT10H"], ["driving", "PT11H1M"]]}                                                      | ${"2024-01-01T21:01:00Z"} | ${false}  | ${"PT11H1M"} | ${"PT0S"}    | ${"2024-01-01T10:00:00Z"} | ${"one minute over the cap"}
    ${[["off", "PT10H"], ["driving", "PT6H"], ["off", "PT9H59M"], ["driving", "PT5H1M"]]}              | ${"2024-01-02T07:00:00Z"} | ${false}  | ${"PT11H1M"} | ${"PT0S"}    | ${"2024-01-01T10:00:00Z"} | ${"a 9:59 rest does not reset"}
    ${[["off", "PT10H"], ["driving", "PT6H"], ["off", "PT10H"], ["driving", "PT5H1M"]]}                | ${"2024-01-02T07:01:00Z"} | ${true}   | ${"PT5H1M"}  | ${"PT5H59M"} | ${"2024-01-02T02:00:00Z"} | ${"a 10:00 rest resets"}
    ${[["off", "PT10H"], ["driving", "PT6H"], ["off", "PT5H"], [null, "PT5H"], ["driving", "PT5H1M"]]} | ${"2024-01-02T07:01:00Z"} | ${false}  | ${"PT11H1M"} | ${"PT0S"}    | ${"2024-01-01T10:00:00Z"} | ${"an unlogged gap is not rest"}
    ${[["off", "PT10H"], ["driving", "PT4H"], ["onDuty", "PT3H"], ["driving", "PT4H"]]}                | ${"2024-01-01T21:00:00Z"} | ${true}   | ${"PT8H"}    | ${"PT3H"}    | ${"2024-01-01T10:00:00Z"} | ${"a status the rule does not name is not counted"}
    ${[["off", "PT10H"], ["driving", "PT12H"]]}                                                        | ${"2024-01-01T21:00:00Z"} | ${true}   | ${"PT11H"}   | ${"PT0S"}    | ${"2024-01-01T10:00:00Z"} | ${"entries after at are not read"}
    ${[["off", "PT10H"], ["driving", "PT3H"], ["off", "PT10H"]]}                                       | ${"2024-01-01T23:00:00Z"} | ${true}   | ${"PT0S"}    | ${"PT11H"}   | ${"2024-01-01T23:00:00Z"} | ${"a reset still going at at has already reset"}
  `(
    "returns satisfied $satisfied, used $used at $at ($reason)",
    ({ steps, at, satisfied, used, remaining, resetAt }) => {
      expect(outcome(steps, at, rule)).toMatchObject({
        satisfied,
        used,
        remaining,
        resetAt,
      });
    },
  );

  it("counts from the first entry when the log holds no reset", () => {
    expect(
      outcome([["driving", "PT5H"]], "2024-01-01T05:00:00Z", rule),
    ).toMatchObject({
      used: "PT5H",
      window: { start: "2024-01-01T00:00:00Z", end: "2024-01-01T05:00:00Z" },
      resetAt: null,
    });
  });
});

describe("evaluateDutyLog — elapsedWindow", () => {
  const rule = (
    extra: Partial<Extract<DutyRule, { kind: "elapsedWindow" }>> = {},
  ): DutyRule => ({
    label: "14 window",
    kind: "elapsedWindow",
    startStatuses: ["driving", "onDuty"],
    length: "PT14H",
    restrictedStatuses: ["driving"],
    since: { statuses: ["off", "sleeper"], consecutive: "PT10H" },
    ...extra,
  });

  // Opens at 10:00 with the first driving after the 10-hour reset; closes 14 h later at 24:00,
  // and the 2-hour break at 14:00 does not move it.
  it("is not extended by a 2-hour break inside it", () => {
    expect(
      outcome(
        [
          ["off", "PT10H"],
          ["driving", "PT4H"],
          ["off", "PT2H"],
          ["driving", "PT8H"],
        ],
        "2024-01-02T00:00:00Z",
        rule(),
      ),
    ).toEqual({
      label: "14 window",
      kind: "elapsedWindow",
      severity: "violation",
      satisfied: true,
      used: "PT14H",
      limit: "PT14H",
      remaining: "PT0S",
      window: { start: "2024-01-01T10:00:00Z", end: "2024-01-02T00:00:00Z" },
      periodBasis: "elapsed",
      dueBy: "2024-01-02T00:00:00Z",
      resetAt: "2024-01-01T10:00:00Z",
    });
  });

  it.each`
    steps                                                                                                | at                        | satisfied | used          | reason
    ${[["off", "PT10H"], ["driving", "PT4H"], ["off", "PT2H"], ["driving", "PT8H30M"]]}                  | ${"2024-01-02T00:30:00Z"} | ${false}  | ${"PT14H30M"} | ${"30 minutes of driving after the close"}
    ${[["off", "PT10H"], ["driving", "PT4H"], ["off", "PT2H"], ["driving", "PT8H"], ["onDuty", "PT1H"]]} | ${"2024-01-02T01:00:00Z"} | ${true}   | ${"PT15H"}    | ${"on duty after the close is not restricted"}
    ${[["off", "PT10H"], ["off", "PT2H"]]}                                                               | ${"2024-01-01T12:00:00Z"} | ${true}   | ${"PT0S"}     | ${"no work since the reset: the window has not opened"}
  `(
    "returns satisfied $satisfied, used $used at $at ($reason)",
    ({ steps, at, satisfied, used }) => {
      expect(outcome(steps, at, rule())).toMatchObject({ satisfied, used });
    },
  );

  const pair = {
    eachAtLeast: "PT2H",
    oneAtLeast: "PT7H",
    combinedAtLeast: "PT10H",
  };

  // 7.5 + 2.5 and 8 + 2 meet all three floors: the window is counted again from the end of the
  // first rest (21:30, 22:00) and the second does not count, so it closes at 21:30 + 14 h + 2.5 h
  // or 22:00 + 14 h + 2 h, 14:00 the next day either way. 6 + 4 fails "one at least 7", so the
  // window still closes at 24:00 and the driving after it is late.
  it.each`
    steps                                                                                                                            | at                        | satisfied | used         | remaining    | window                                                            | reason
    ${[["off", "PT10H"], ["driving", "PT4H"], ["sleeper", "PT7H30M"], ["driving", "PT3H"], ["off", "PT2H30M"], ["driving", "PT5H"]]} | ${"2024-01-02T08:00:00Z"} | ${true}   | ${"PT8H"}    | ${"PT6H"}    | ${{ start: "2024-01-01T21:30:00Z", end: "2024-01-02T14:00:00Z" }} | ${"7.5 + 2.5 qualifies"}
    ${[["off", "PT10H"], ["driving", "PT4H"], ["sleeper", "PT8H"], ["driving", "PT2H30M"], ["off", "PT2H"], ["driving", "PT5H"]]}    | ${"2024-01-02T07:30:00Z"} | ${true}   | ${"PT7H30M"} | ${"PT6H30M"} | ${{ start: "2024-01-01T22:00:00Z", end: "2024-01-02T14:00:00Z" }} | ${"8 + 2 qualifies"}
    ${[["off", "PT10H"], ["driving", "PT4H"], ["sleeper", "PT6H"], ["driving", "PT4H30M"], ["off", "PT4H"], ["driving", "PT3H30M"]]} | ${"2024-01-02T08:00:00Z"} | ${false}  | ${"PT22H"}   | ${"PT0S"}    | ${{ start: "2024-01-01T10:00:00Z", end: "2024-01-02T00:00:00Z" }} | ${"6 + 4 does not"}
  `(
    "recalculates from a qualifying paired rest: $reason",
    ({ steps, at, satisfied, used, remaining, window }) => {
      expect(outcome(steps, at, rule({ exclude: pair }))).toMatchObject({
        satisfied,
        used,
        remaining,
        window,
      });
    },
  );

  // After 10 hours off the window opens at 10:00. The 8 hours off from 15:00 and a 3-hour sleeper
  // break pair up, so the window is counted again from 23:00, the end of the first, and its 14
  // hours end at 13:00 the next day. The break does not count against the window only if it starts
  // inside it. From 11:00 it does, so the window closes 3 hours later, at 16:00. From 15:00 it does
  // not, so the window closed at 13:00, and the driving from 13:00 to 15:00 came after the close.
  it.each`
    steps                                                                                                                       | at                        | satisfied | used       | window                                                            | reason
    ${[["off", "PT10H"], ["driving", "PT5H"], ["off", "PT8H"], ["driving", "PT12H"], ["sleeper", "PT3H"], ["driving", "PT2H"]]} | ${"2024-01-02T16:00:00Z"} | ${true}   | ${"PT14H"} | ${{ start: "2024-01-01T23:00:00Z", end: "2024-01-02T16:00:00Z" }} | ${"a break that starts inside the window"}
    ${[["off", "PT10H"], ["driving", "PT5H"], ["off", "PT8H"], ["driving", "PT16H"], ["sleeper", "PT3H"]]}                      | ${"2024-01-02T18:00:00Z"} | ${false}  | ${"PT19H"} | ${{ start: "2024-01-01T23:00:00Z", end: "2024-01-02T13:00:00Z" }} | ${"a break that starts after it closed"}
  `(
    "excludes the second rest of a pair only if it starts in the window: $reason",
    ({ steps, at, satisfied, used, window }) => {
      expect(outcome(steps, at, rule({ exclude: pair }))).toMatchObject({
        satisfied,
        used,
        window,
        dueBy: window.end,
      });
    },
  );

  it("does not move the window for a qualifying pair when the rule has no exclude", () => {
    expect(
      outcome(
        [
          ["off", "PT10H"],
          ["driving", "PT4H"],
          ["sleeper", "PT7H30M"],
          ["driving", "PT3H"],
          ["off", "PT2H30M"],
          ["driving", "PT5H"],
        ],
        "2024-01-02T08:00:00Z",
        rule(),
      ),
    ).toMatchObject({ satisfied: false, dueBy: "2024-01-02T00:00:00Z" });
  });

  // The window opens at 10:00 and closes at 24:00. An extension declared inside it moves the close
  // two hours to 02:00; one declared before it opens or after it closes changes nothing.
  it.each`
    from                      | satisfied | limit      | dueBy                     | reason
    ${"2024-01-01T15:00:00Z"} | ${true}   | ${"PT16H"} | ${"2024-01-02T02:00:00Z"} | ${"declared inside the window"}
    ${"2024-01-01T10:00:00Z"} | ${true}   | ${"PT16H"} | ${"2024-01-02T02:00:00Z"} | ${"declared as it opens"}
    ${"2024-01-01T09:00:00Z"} | ${false}  | ${"PT14H"} | ${"2024-01-02T00:00:00Z"} | ${"declared before it opens"}
    ${"2024-01-02T00:00:00Z"} | ${false}  | ${"PT14H"} | ${"2024-01-02T00:00:00Z"} | ${"declared as it closes"}
  `(
    "applies an extension from $from only to the window open then ($reason)",
    ({ from, satisfied, limit, dueBy }) => {
      expect(
        outcome(
          [
            ["off", "PT10H"],
            ["driving", "PT4H"],
            ["off", "PT2H"],
            ["driving", "PT9H"],
          ],
          "2024-01-02T01:00:00Z",
          rule({ extension: { by: "PT2H", from } }),
        ),
      ).toMatchObject({ satisfied, limit, dueBy, used: "PT15H" });
    },
  );
});

describe("evaluateDutyLog — requiredInterruption", () => {
  const rule = (
    interruption: Extract<
      DutyRule,
      { kind: "requiredInterruption" }
    >["interruption"] = {
      minimum: "PT30M",
    },
    after = "PT8H",
  ): DutyRule => ({
    label: "break",
    kind: "requiredInterruption",
    countedStatuses: ["driving"],
    after,
    interruption,
  });

  it.each`
    steps                                                                                | interruption                                      | satisfied | used        | resetAt                   | reason
    ${[["driving", "PT8H"]]}                                                             | ${{ minimum: "PT30M" }}                           | ${true}   | ${"PT8H"}   | ${null}                   | ${"exactly 8 hours, nothing remaining"}
    ${[["driving", "PT8H"], ["onDuty", "PT30M"], ["driving", "PT3H"]]}                   | ${{ minimum: "PT30M" }}                           | ${true}   | ${"PT3H"}   | ${"2024-01-01T08:30:00Z"} | ${"30 minutes in any status outside driving interrupts"}
    ${[["driving", "PT8H"], ["onDuty", "PT29M"], ["driving", "PT1M"]]}                   | ${{ minimum: "PT30M" }}                           | ${false}  | ${"PT8H1M"} | ${null}                   | ${"29 minutes does not"}
    ${[["driving", "PT8H"], ["onDuty", "PT30M"], ["driving", "PT1M"]]}                   | ${{ minimum: "PT30M", outsideStatuses: ["off"] }} | ${false}  | ${"PT8H1M"} | ${null}                   | ${"on duty is not one of outsideStatuses"}
    ${[["driving", "PT8H"], ["off", "PT30M"], ["driving", "PT1M"]]}                      | ${{ minimum: "PT30M", outsideStatuses: ["off"] }} | ${true}   | ${"PT1M"}   | ${"2024-01-01T08:30:00Z"} | ${"off is"}
    ${[["driving", "PT8H"], ["onDuty", "PT15M"], ["off", "PT15M"], ["driving", "PT1M"]]} | ${{ minimum: "PT30M" }}                           | ${true}   | ${"PT1M"}   | ${"2024-01-01T08:30:00Z"} | ${"touching entries outside driving form one interruption"}
  `(
    "returns satisfied $satisfied, used $used ($reason)",
    ({ steps, interruption, satisfied, used, resetAt }) => {
      const log = dutySequence(START, steps);
      const at = log[log.length - 1]?.end as string;
      expect(outcome(steps, at, rule(interruption))).toMatchObject({
        satisfied,
        used,
        resetAt,
      });
    },
  );

  // 4.5 h of driving allowed before 45 minutes, or 15 minutes then 30, in that order.
  const split = { minimum: "PT45M", orderedSplit: ["PT15M", "PT30M"] };

  it.each`
    steps                                                                                                      | satisfied | used      | resetAt                   | reason
    ${[["driving", "PT2H"], ["break", "PT15M"], ["driving", "PT2H"], ["break", "PT30M"], ["driving", "PT4H"]]} | ${true}   | ${"PT4H"} | ${"2024-01-01T04:45:00Z"} | ${"15 then 30 completes the split"}
    ${[["driving", "PT2H"], ["break", "PT30M"], ["driving", "PT2H"], ["break", "PT15M"], ["driving", "PT1H"]]} | ${false}  | ${"PT5H"} | ${null}                   | ${"30 then 15 does not"}
    ${[["driving", "PT4H"], ["break", "PT45M"], ["driving", "PT4H"]]}                                          | ${true}   | ${"PT4H"} | ${"2024-01-01T04:45:00Z"} | ${"one 45-minute break"}
    ${[["driving", "PT2H"], ["break", "PT30M"], ["driving", "PT1H"], ["break", "PT30M"], ["driving", "PT1H"]]} | ${true}   | ${"PT1H"} | ${"2024-01-01T04:00:00Z"} | ${"a 30 counts as the first part; the second 30 completes it at 04:00"}
  `(
    "reads orderedSplit [PT15M, PT30M] in order: $reason",
    ({ steps, satisfied, used, resetAt }) => {
      const log = dutySequence(START, steps);
      const at = log[log.length - 1]?.end as string;
      expect(outcome(steps, at, rule(split, "PT4H30M"))).toMatchObject({
        satisfied,
        used,
        resetAt,
      });
    },
  );
});

describe("evaluateDutyLog — rollingCap", () => {
  // Operator days start at 04:00 UTC; each holds 8 hours on duty from 06:00 to 14:00.
  const days = repeat(8, [
    ["off", "PT2H"],
    ["onDuty", "PT8H"],
    ["off", "PT14H"],
  ]);
  const operator = { timeZone: "UTC", dayStartTime: "04:00" };
  const cycle = (cap: string, operatorDays: number): DutyRule => ({
    label: `${cap} in ${operatorDays}`,
    kind: "rollingCap",
    statuses: ["onDuty"],
    cap,
    window: { operatorDays },
  });

  // At 14:00 on day 8: 7 days hold 56 h (4 left of 60), 8 days hold 64 h (6 left of 70).
  it.each`
    cap        | operatorDays | used       | remaining | window
    ${"PT60H"} | ${7}         | ${"PT56H"} | ${"PT4H"} | ${{ start: "2024-01-02T04:00:00Z", end: "2024-01-09T04:00:00Z" }}
    ${"PT70H"} | ${8}         | ${"PT64H"} | ${"PT6H"} | ${{ start: "2024-01-01T04:00:00Z", end: "2024-01-09T04:00:00Z" }}
  `(
    "reports $remaining remaining of $cap over $operatorDays operator days",
    ({ cap, operatorDays, used, remaining, window }) => {
      expect(
        outcome(
          days,
          "2024-01-08T14:00:00Z",
          cycle(cap, operatorDays),
          operator,
          "2024-01-01T04:00:00Z",
        ),
      ).toMatchObject({
        satisfied: true,
        used,
        remaining,
        window,
        periodBasis: "operatorDay",
      });
    },
  );

  // Five 10-hour duties end at 14:00 on day 5, then the rest: 34 h zeroes the count, 33:59 does not.
  const restart: DutyRule = {
    ...cycle("PT70H", 8),
    reset: { statuses: ["off"], consecutive: "PT34H" },
  } as DutyRule;

  it.each`
    rest          | at                        | used       | remaining  | resetAt
    ${"PT34H"}    | ${"2024-01-07T00:00:00Z"} | ${"PT0S"}  | ${"PT70H"} | ${"2024-01-07T00:00:00Z"}
    ${"PT33H59M"} | ${"2024-01-06T23:59:00Z"} | ${"PT50H"} | ${"PT20H"} | ${null}
  `(
    "a $rest rest leaves $used counted",
    ({ rest, at, used, remaining, resetAt }) => {
      const steps: DutyStep[] = [
        ...repeat(4, [
          ["onDuty", "PT10H"],
          ["off", "PT14H"],
        ]),
        ["onDuty", "PT10H"],
        ["off", rest],
      ];
      expect(
        outcome(steps, at, restart, operator, "2024-01-01T04:00:00Z"),
      ).toMatchObject({
        used,
        remaining,
        resetAt,
      });
    },
  );

  // 672 elapsed hours are 672 hours whatever the clock does. 28 New York calendar days ending on
  // 10 November hold the 25-hour 3 November (673 h); 28 ending on 15 March hold the 23-hour
  // 10 March (671 h).
  it.each`
    at                        | window                   | start                     | end                       | hours  | periodBasis
    ${"2024-11-10T12:00:00Z"} | ${{ elapsed: "PT672H" }} | ${"2024-10-13T12:00:00Z"} | ${"2024-11-10T12:00:00Z"} | ${672} | ${"elapsed"}
    ${"2024-11-10T12:00:00Z"} | ${{ calendarDays: 28 }}  | ${"2024-10-14T04:00:00Z"} | ${"2024-11-11T05:00:00Z"} | ${673} | ${"calendar"}
    ${"2024-03-15T12:00:00Z"} | ${{ elapsed: "PT672H" }} | ${"2024-02-16T12:00:00Z"} | ${"2024-03-15T12:00:00Z"} | ${672} | ${"elapsed"}
    ${"2024-03-15T12:00:00Z"} | ${{ calendarDays: 28 }}  | ${"2024-02-17T05:00:00Z"} | ${"2024-03-16T04:00:00Z"} | ${671} | ${"calendar"}
  `(
    "a 100-hour cap over $window at $at spans $hours hours ($periodBasis)",
    ({ at, window, start, end, hours, periodBasis }) => {
      const result = outcome(
        [],
        at,
        {
          label: "100",
          kind: "rollingCap",
          statuses: ["flight"],
          cap: "PT100H",
          window,
        },
        { timeZone: "America/New_York" },
      );

      expect(result).toMatchObject({
        window: { start, end },
        periodBasis,
        used: "PT0S",
      });
      expect(
        Temporal.Instant.from(start).until(Temporal.Instant.from(end), {
          largestUnit: "hour",
        }).hours,
      ).toBe(hours);
    },
  );

  // A cycle of 120 h in 14 days, with 70 h at most before a 24-hour rest inside it.
  const preconditioned: DutyRule = {
    label: "120 in 14",
    kind: "rollingCap",
    statuses: ["onDuty"],
    cap: "PT120H",
    window: { calendarDays: 14 },
    precondition: {
      restStatuses: ["off"],
      minimum: "PT24H",
      beforeHours: "PT70H",
    },
  };

  it.each`
    steps                                                                                             | at                        | satisfied | used       | limit       | reason
    ${repeat(5, [["onDuty", "PT14H"], ["off", "PT10H"]])}                                             | ${"2024-01-05T14:00:00Z"} | ${true}   | ${"PT70H"} | ${"PT70H"}  | ${"70 h with no 24-hour rest yet: the limit is 70"}
    ${[...repeat(5, [["onDuty", "PT14H"], ["off", "PT10H"]]), ["onDuty", "PT1H"]]}                    | ${"2024-01-06T01:00:00Z"} | ${false}  | ${"PT71H"} | ${"PT70H"}  | ${"71 h with no 24-hour rest"}
    ${[...repeat(4, [["onDuty", "PT14H"], ["off", "PT10H"]]), ["off", "PT24H"], ["onDuty", "PT20H"]]} | ${"2024-01-06T20:00:00Z"} | ${true}   | ${"PT76H"} | ${"PT120H"} | ${"56 h, a 34-hour rest, then 20 more: the cap is 120"}
  `(
    "applies the cap only after the rest: $reason",
    ({ steps, at, satisfied, used, limit }) => {
      expect(outcome(steps, at, preconditioned)).toMatchObject({
        satisfied,
        used,
        limit,
      });
    },
  );
});

describe("evaluateDutyLog — fixedPeriodCap", () => {
  // Monday to Friday, then the weekend off: five shifts a week.
  const week = (shift: string, rest: string): DutyStep[] => [
    ...repeat(5, [
      ["driving", shift],
      ["off", rest],
    ]),
    ["off", "PT48H"],
  ];
  const weekly: DutyRule = {
    label: "56 a week",
    kind: "fixedPeriodCap",
    statuses: ["driving"],
    cap: "PT56H",
    period: { isoWeeks: 1 },
  };
  const fortnight: DutyRule = {
    label: "90 a fortnight",
    kind: "fixedPeriodCap",
    statuses: ["driving"],
    cap: "PT90H",
    period: { isoWeeks: 1 },
    adjacent: 2,
  };

  // 45 h (5 × 9) then 46 h (5 × 9:12): each week is under 56, the two adjacent weeks hold 91.
  it("fails 90 over two adjacent weeks that hold 91 while each week passes 56", () => {
    const steps = [...week("PT9H", "PT15H"), ...week("PT9H12M", "PT14H48M")];
    const report = evaluateDutyLog(
      dutySequence(START, steps),
      "2024-01-15T00:00:00Z",
      [weekly, fortnight],
      UTC,
    );

    expect(report?.outcomes).toMatchObject([
      {
        label: "56 a week",
        satisfied: true,
        used: "PT46H",
        remaining: "PT10H",
        window: { start: "2024-01-08T00:00:00Z", end: "2024-01-15T00:00:00Z" },
        periodBasis: "calendar",
      },
      {
        label: "90 a fortnight",
        satisfied: false,
        used: "PT91H",
        window: { start: "2024-01-01T00:00:00Z", end: "2024-01-15T00:00:00Z" },
      },
    ]);
    expect(report?.violations.map((failed) => failed.label)).toEqual([
      "90 a fortnight",
    ]);
  });

  // 30, 31 and 30 h over three weeks: the same 91 hours, but no two adjacent weeks pass 90.
  it.each`
    at                        | used
    ${"2024-01-15T00:00:00Z"} | ${"PT61H"}
    ${"2024-01-22T00:00:00Z"} | ${"PT61H"}
  `(
    "passes the same hours straddling three weeks: $used at $at",
    ({ at, used }) => {
      const steps = [
        ...week("PT6H", "PT18H"),
        ...week("PT6H12M", "PT17H48M"),
        ...week("PT6H", "PT18H"),
      ];
      expect(outcome(steps, at, fortnight)).toMatchObject({
        satisfied: true,
        used,
      });
    },
  );

  // 80 h a week averaged over 4: 100 + 60 + 80 + 80 = 320 = 4 × 80 passes, and the 100-hour week
  // is counted in full; 81 in the last week makes 321, a mean of 80 h 15 min.
  const averaged: DutyRule = {
    label: "80 averaged",
    kind: "fixedPeriodCap",
    statuses: ["onDuty"],
    cap: "PT80H",
    period: { isoWeeks: 1 },
    adjacent: 4,
    average: true,
  };
  const shiftWeek = (shift: string, rest: string): DutyStep[] => [
    ...repeat(5, [
      ["onDuty", shift],
      ["off", rest],
    ]),
    ["off", "PT48H"],
  ];

  it.each`
    last                       | satisfied | used          | remaining
    ${["PT16H", "PT8H"]}       | ${true}   | ${"PT80H"}    | ${"PT0S"}
    ${["PT16H12M", "PT7H48M"]} | ${false}  | ${"PT80H15M"} | ${"PT0S"}
    ${["PT15H", "PT9H"]}       | ${true}   | ${"PT78H45M"} | ${"PT5H"}
  `(
    "averages 100, 60, 80 and a last week of 5 × $last.0",
    ({ last, satisfied, used, remaining }) => {
      const steps = [
        ...shiftWeek("PT20H", "PT4H"),
        ...shiftWeek("PT12H", "PT12H"),
        ...shiftWeek("PT16H", "PT8H"),
        ...shiftWeek(last[0], last[1]),
      ];
      expect(outcome(steps, "2024-01-29T00:00:00Z", averaged)).toMatchObject({
        satisfied,
        used,
        limit: "PT80H",
        remaining,
        window: { start: "2024-01-01T00:00:00Z", end: "2024-01-29T00:00:00Z" },
      });
    },
  );

  // A tour from 20:00 on 31 January to 04:00 on 1 February in New York (01:00Z to 09:00Z): four
  // hours fall in each month, and each month counts only its own.
  it.each`
    at                        | used      | window
    ${"2024-02-01T05:00:00Z"} | ${"PT4H"} | ${{ start: "2024-01-01T05:00:00Z", end: "2024-02-01T05:00:00Z" }}
    ${"2024-02-01T09:00:00Z"} | ${"PT4H"} | ${{ start: "2024-02-01T05:00:00Z", end: "2024-03-01T05:00:00Z" }}
  `(
    "splits a tour at the month boundary: $used in the month ending $window.end",
    ({ at, used, window }) => {
      expect(
        outcome(
          [["onDuty", "PT8H"]],
          at,
          {
            label: "monthly",
            kind: "fixedPeriodCap",
            statuses: ["onDuty"],
            cap: "PT276H",
            period: { calendarMonths: 1 },
          },
          { timeZone: "America/New_York" },
          "2024-02-01T01:00:00Z",
        ),
      ).toMatchObject({ used, window });
    },
  );
});
