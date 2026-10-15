import { type DutyStep, dutySequence } from "../../test";
import type { DutyRule } from "../../types";
import { dutyViolations } from "./dutyViolations";
import { evaluateDutyLog } from "./evaluateDutyLog";

// Five example regimes, each an array of rules labelled by its numbers only: GMT names no
// regulator, and every number is the caller's. Fixtures start on 2024-01-01
// (dateYearStart2024Jan01, a Monday); every expected value is worked out in the comment above it.
const START = "2024-01-01T00:00:00Z";
const repeat = (times: number, steps: readonly DutyStep[]): DutyStep[] =>
  Array.from({ length: times }, () => steps).flat();
const summary = (report: ReturnType<typeof evaluateDutyLog>) =>
  report?.outcomes.map(({ label, satisfied, used, remaining }) => ({
    label,
    satisfied,
    used,
    remaining,
  }));

describe("evaluateDutyLog — example regimes", () => {
  // An 11-hour driving cap inside a 14-hour window, a 30-minute break after 8 hours of driving,
  // and 60 hours on duty in 7 operator days starting at 04:00, restarted by 34 hours off.
  const driver: DutyRule[] = [
    {
      label: "11 driving",
      kind: "cumulativeCap",
      statuses: ["driving"],
      cap: "PT11H",
      since: { statuses: ["off", "sleeper"], consecutive: "PT10H" },
    },
    {
      label: "14 window",
      kind: "elapsedWindow",
      startStatuses: ["driving", "onDuty"],
      length: "PT14H",
      restrictedStatuses: ["driving"],
      since: { statuses: ["off", "sleeper"], consecutive: "PT10H" },
    },
    {
      label: "30 after 8",
      kind: "requiredInterruption",
      countedStatuses: ["driving"],
      after: "PT8H",
      interruption: { minimum: "PT30M" },
    },
    {
      label: "60 in 7",
      kind: "rollingCap",
      statuses: ["driving", "onDuty"],
      cap: "PT60H",
      window: { operatorDays: 7 },
      reset: { statuses: ["off", "sleeper"], consecutive: "PT34H" },
    },
  ];
  const driverDay: DutyStep[] = [
    ["off", "PT10H"],
    ["driving", "PT5H"],
    ["off", "PT30M"],
    ["driving", "PT4H"],
    ["onDuty", "PT1H"],
    ["driving", "PT1H30M"],
    ["driving", "PT1H"],
  ];
  const driverOptions = { timeZone: "UTC", dayStartTime: "04:00" };

  // At 22:00: 10.5 h driving since 10:00 (30 min left); the window opened at 10:00 and closes at
  // 24:00 (2 h left); the 1-hour on-duty spell from 19:30 interrupted driving, so 1.5 h since
  // (6.5 left); 11.5 h on duty in the 7 operator days (48.5 left).
  it("a driver at 22:00 is inside every limit", () => {
    expect(
      summary(
        evaluateDutyLog(
          dutySequence(START, driverDay),
          "2024-01-01T22:00:00Z",
          driver,
          driverOptions,
        ),
      ),
    ).toEqual([
      {
        label: "11 driving",
        satisfied: true,
        used: "PT10H30M",
        remaining: "PT30M",
      },
      { label: "14 window", satisfied: true, used: "PT12H", remaining: "PT2H" },
      {
        label: "30 after 8",
        satisfied: true,
        used: "PT1H30M",
        remaining: "PT6H30M",
      },
      {
        label: "60 in 7",
        satisfied: true,
        used: "PT11H30M",
        remaining: "PT48H30M",
      },
    ]);
  });

  // At 23:00, one more hour: 11.5 h of driving breaks the 11-hour cap, while the window has an
  // hour left and the break rule 5.5 hours.
  it("a driver at 23:00 has broken the 11-hour cap and nothing else", () => {
    const report = evaluateDutyLog(
      dutySequence(START, driverDay),
      "2024-01-01T23:00:00Z",
      driver,
      driverOptions,
    );
    expect(report?.violations.map(({ label, used }) => [label, used])).toEqual([
      ["11 driving", "PT11H30M"],
    ]);
  });

  // 10 hours of rest in every 24 in at most two periods, one at least 6, no more than 14 hours
  // between rests, and 77 hours of rest in every 168. Six days of 4-on, 8-off watches, then a
  // 12-hour working day from 00:00 on the 7th.
  const seafarer: DutyRule[] = [
    {
      label: "10 in 24",
      kind: "restRequirement",
      restStatuses: ["rest"],
      per: { elapsed: "PT24H" },
      minimum: "PT10H",
      composition: { maxPeriods: 2, longestAtLeast: "PT6H" },
      maxGap: "PT14H",
    },
    {
      label: "77 in 168",
      kind: "restRequirement",
      restStatuses: ["rest"],
      per: { elapsed: "PT168H" },
      minimum: "PT77H",
    },
  ];
  const watches = dutySequence(START, [
    ...repeat(12, [
      ["work", "PT4H"],
      ["rest", "PT8H"],
    ]),
    ["work", "PT12H"],
    ["rest", "PT4H"],
  ]);

  // The window ending at 12:00 on the 7th holds only the 8 hours of rest from 16:00 on the 6th.
  // The 168 hours ending then reach back before the log, so they hold all twelve 8-hour rests:
  // 96 hours, well over 77.
  it("a seafarer after a 12-hour working day is 2 hours short in the sliding 24", () => {
    expect(
      summary(
        evaluateDutyLog(watches, "2024-01-07T12:00:00Z", seafarer, {
          timeZone: "UTC",
        }),
      ),
    ).toEqual([
      { label: "10 in 24", satisfied: false, used: "PT8H", remaining: "PT2H" },
      { label: "77 in 168", satisfied: true, used: "PT96H", remaining: "PT0S" },
    ]);
  });

  // 12 consecutive hours on duty, 10 hours off in the 24 before a duty, 276 hours a calendar
  // month, duty started on at most 6 of any 7 days, and 48 hours off within 6 operator days of
  // the last 48 hours off.
  const railCrew: DutyRule[] = [
    {
      label: "12 on duty",
      kind: "cumulativeCap",
      statuses: ["onDuty"],
      cap: "PT12H",
      since: { statuses: ["off"], consecutive: "PT10H" },
    },
    {
      label: "10 before duty",
      kind: "restBeforeDuty",
      restStatuses: ["off"],
      minimum: "PT10H",
      within: "PT24H",
    },
    {
      label: "276 a month",
      kind: "fixedPeriodCap",
      statuses: ["onDuty", "limbo"],
      cap: "PT276H",
      period: { calendarMonths: 1 },
    },
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
  const railLog = dutySequence("2023-12-30T08:00:00Z", [
    ["off", "PT48H"],
    ...repeat(6, [
      ["onDuty", "PT11H"],
      ["off", "PT13H"],
    ]),
    ["onDuty", "PT11H"],
  ]);
  const railOptions = { timeZone: "UTC", dayStartTime: "00:00" };

  // Six duties from 08:00 on the 1st to the 6th, each 11 hours with 13 off between: within every
  // limit on the 6th; the 48 hours off are due by the end of the 6th operator day, 00:00 on the 7th.
  it("a rail crew on the sixth day is within every limit", () => {
    const report = evaluateDutyLog(
      railLog,
      "2024-01-06T19:00:00Z",
      railCrew,
      railOptions,
    );
    expect(report?.violations).toEqual([]);
    expect(
      report?.outcomes.find((rule) => rule.label === "48 after 6")?.dueBy,
    ).toBe("2024-01-07T00:00:00Z");
    expect(
      report?.outcomes.find((rule) => rule.label === "276 a month")?.used,
    ).toBe("PT66H");
  });

  // A seventh duty from 08:00 on the 7th starts on a seventh date in seven, after the 48 hours
  // off were due.
  it("a rail crew on a seventh day breaks 6 of 7 and 48 after 6", () => {
    expect(
      dutyViolations(
        railLog,
        { start: "2024-01-01T00:00:00Z", end: "2024-01-08T00:00:00Z" },
        railCrew,
        railOptions,
      )?.map(({ label }) => label),
    ).toEqual(["6 of 7", "48 after 6"]);
  });

  // 100 hours of flight in any 672, 1,000 in any 365 calendar days, and 30 consecutive hours off
  // in every 168. Four weeks of five 5-hour flights with 3 hours on duty, 16 off, and a weekend.
  const flightCrew: DutyRule[] = [
    {
      label: "100 in 672",
      kind: "rollingCap",
      statuses: ["flight"],
      cap: "PT100H",
      window: { elapsed: "PT672H" },
    },
    {
      label: "1000 in 365",
      kind: "rollingCap",
      statuses: ["flight"],
      cap: "PT1000H",
      window: { calendarDays: 365 },
    },
    {
      label: "30 in 168",
      kind: "freePeriod",
      restStatuses: ["off"],
      minimum: "PT30H",
      within: { elapsed: "PT168H" },
    },
  ];
  const flightWeek: DutyStep[] = [
    ...repeat(5, [
      ["flight", "PT5H"],
      ["onDuty", "PT3H"],
      ["off", "PT16H"],
    ]),
    ["off", "PT48H"],
  ];

  // 4 × 25 = 100 hours in exactly 672: no hour left. Friday's 16 hours off and the weekend run
  // into one 64-hour rest, two free periods of 30. One more hour of flight on the fourth Saturday
  // makes 101. (A flight in a fifth week would not: the first week's flights slide out of the 672
  // hours as fast as new ones come in.)
  it("a flight crew at 100 hours in 672 has none left, and an hour more breaks it", () => {
    const fourWeeks = dutySequence(START, repeat(4, flightWeek));
    expect(
      summary(
        evaluateDutyLog(fourWeeks, "2024-01-29T00:00:00Z", flightCrew, {
          timeZone: "UTC",
        }),
      ),
    ).toEqual([
      {
        label: "100 in 672",
        satisfied: true,
        used: "PT100H",
        remaining: "PT0S",
      },
      {
        label: "1000 in 365",
        satisfied: true,
        used: "PT100H",
        remaining: "PT900H",
      },
      { label: "30 in 168", satisfied: true, used: 2, remaining: 0 },
    ]);

    const oneMore = dutySequence(START, [
      ...repeat(3, flightWeek),
      ...repeat(5, [
        ["flight", "PT5H"],
        ["onDuty", "PT3H"],
        ["off", "PT16H"],
      ]),
      ["off", "PT24H"],
      ["flight", "PT1H"],
      ["off", "PT23H"],
    ]);
    expect(
      evaluateDutyLog(oneMore, "2024-01-29T00:00:00Z", flightCrew, {
        timeZone: "UTC",
      })?.violations.map(({ label, used }) => [label, used]),
    ).toEqual([["100 in 672", "PT101H"]]);
  });

  // 80 hours a week averaged over four, one 24-hour free period in every seven averaged over 28
  // calendar days, and, as an advisory, 8 hours off before a shift. Six 13-hour shifts a week and
  // a free day: 78 hours a week, four free days in four weeks.
  const resident: DutyRule[] = [
    {
      label: "80 averaged over 4",
      kind: "fixedPeriodCap",
      statuses: ["onDuty", "homeCall"],
      cap: "PT80H",
      period: { isoWeeks: 1 },
      adjacent: 4,
      average: true,
    },
    {
      label: "1 in 7 over 28",
      kind: "freePeriod",
      restStatuses: ["off"],
      minimum: "PT24H",
      within: { calendarDays: 28 },
      atLeast: 4,
    },
    {
      label: "8 before a shift",
      kind: "restBeforeDuty",
      restStatuses: ["off"],
      minimum: "PT8H",
      within: "PT24H",
      severity: "advisory",
    },
  ];
  const residentWeek: DutyStep[] = [
    ...repeat(6, [
      ["onDuty", "PT13H"],
      ["off", "PT11H"],
    ]),
    ["off", "PT24H"],
  ];

  it("a resident over four weeks is within both limits", () => {
    expect(
      summary(
        evaluateDutyLog(
          dutySequence(START, repeat(4, residentWeek)),
          "2024-01-29T00:00:00Z",
          resident,
          {
            timeZone: "UTC",
          },
        ),
      ),
    ).toEqual([
      {
        label: "80 averaged over 4",
        satisfied: true,
        used: "PT78H",
        remaining: "PT8H",
      },
      { label: "1 in 7 over 28", satisfied: true, used: 4, remaining: 0 },
      {
        label: "8 before a shift",
        satisfied: true,
        used: "PT24H",
        remaining: "PT0S",
      },
    ]);
  });

  // After the four weeks, a 6-hour turnaround before a shift is an advisory only: no violation.
  it("a resident's short turnaround is an advisory, never a violation", () => {
    const steps: DutyStep[] = [
      ...repeat(4, residentWeek),
      ["onDuty", "PT13H"],
      ["off", "PT6H"],
      ["onDuty", "PT2H"],
    ];
    const report = evaluateDutyLog(
      dutySequence(START, steps),
      "2024-01-29T21:00:00Z",
      resident,
      {
        timeZone: "UTC",
      },
    );
    expect(report?.violations).toEqual([]);
    expect(report?.advisories.map(({ label, used }) => [label, used])).toEqual([
      ["8 before a shift", "PT6H"],
    ]);
  });
});
