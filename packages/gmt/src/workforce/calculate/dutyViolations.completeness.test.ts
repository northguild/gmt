import { Temporal } from "../../internal/temporal";
import { type DutyStep, dutySequence } from "../../test";
import type { DutyEntry, DutyRule } from "../../types";
import { dutyViolations } from "./dutyViolations";
import { evaluateDutyLog } from "./evaluateDutyLog";

// dutyViolations must find every failed window, not only those ending on an entry bound. Fixtures
// start on 2024-01-01 (dateYearStart2024Jan01); hour offsets are the scenario under test.
const START = "2024-01-01T00:00:00Z";
const UTC = { timeZone: "UTC" };
const hour = (hours: number) =>
  Temporal.Instant.from(START)
    .add({ minutes: Math.round(hours * 60) })
    .toString();
const range = (from: number, to: number) => ({
  start: hour(from),
  end: hour(to),
});

/** The log with one entry cut in two at `at`, the same time in the same statuses. */
function splitAt(log: readonly DutyEntry[], at: string): DutyEntry[] {
  const cut = Temporal.Instant.from(at).epochNanoseconds;
  return log.flatMap((entry) => {
    const start = Temporal.Instant.from(entry.start).epochNanoseconds;
    const end = Temporal.Instant.from(entry.end).epochNanoseconds;
    return start < cut && cut < end
      ? [
          { ...entry, end: at },
          { ...entry, start: at },
        ]
      : [entry];
  });
}

describe("dutyViolations — every failed window is found", () => {
  // Off 0–24 h, work 24–150 h, off 150–200 h. A window of 168 hours ending at 170 h holds the first
  // rest only from 2 h, 22 hours, and the last rest's 20: no 24-hour free period.
  it("finds a free period that is short only between entry bounds", () => {
    const steps: DutyStep[] = [
      ["off", "PT24H"],
      ["work", "PT126H"],
      ["off", "PT50H"],
    ];
    const rule: DutyRule = {
      label: "24 in 168",
      kind: "freePeriod",
      restStatuses: ["off"],
      minimum: "PT24H",
      within: { elapsed: "PT168H" },
    };
    const log = dutySequence(START, steps);

    expect(
      evaluateDutyLog(log, hour(170), [rule], UTC)?.outcomes[0]?.satisfied,
    ).toBe(false);
    expect(dutyViolations(log, range(0, 300), [rule], UTC)?.length).toBe(1);
    expect(
      dutyViolations(splitAt(log, hour(170)), range(0, 300), [rule], UTC),
    ).toEqual(dutyViolations(log, range(0, 300), [rule], UTC));
  });

  // Off 0–8 h, work 8–22 h, off 22–40 h. The window ending at 27 h holds 5 hours of each rest: the
  // longest is 5, under 6, where the shrinking rest and the growing one cross.
  it("finds the window where two rests cross as the longest", () => {
    const rule: DutyRule = {
      label: "10 in 24",
      kind: "restRequirement",
      restStatuses: ["off"],
      per: { elapsed: "PT24H" },
      minimum: "PT10H",
      composition: { maxPeriods: 2, longestAtLeast: "PT6H" },
    };
    const log = dutySequence(START, [
      ["off", "PT8H"],
      ["work", "PT14H"],
      ["off", "PT18H"],
    ]);

    expect(
      evaluateDutyLog(log, hour(27), [rule], UTC)?.outcomes[0],
    ).toMatchObject({
      satisfied: false,
      used: "PT5H",
    });
    expect(
      dutyViolations(log, range(25, 100), [rule], UTC)?.length,
    ).toBeGreaterThan(0);
  });

  // Off 10 h, driving 8, off 7:45, driving 10:15, sleeper 0:30, driving 8:30, sleeper 10. The 7:45
  // and the last sleeper pair up once the sleeper reaches 2:15, at 23:15 on the 2nd: the 30 minutes
  // between them are too short to be half of a pair. The window counted again from 01:45 closes at
  // 15:45, before that sleeper starts, so the driving to 21:00 is late. That window is found first
  // at 23:15, whether or not the sleeper entry is cut at midnight.
  it("finds the moment a pair qualifies across a break too short to be half of one", () => {
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
    const log = dutySequence(START, [
      ["off", "PT10H"],
      ["driving", "PT8H"],
      ["off", "PT7H45M"],
      ["driving", "PT10H15M"],
      ["sleeper", "PT30M"],
      ["driving", "PT8H30M"],
      ["sleeper", "PT10H"],
    ]);
    const record = dutyViolations(log, range(0, 55), [rule], UTC);

    expect(
      evaluateDutyLog(log, hour(48), [rule], UTC)?.outcomes[0],
    ).toMatchObject({
      satisfied: false,
      window: { start: hour(25.75), end: hour(39.75) },
    });
    expect(record).toEqual([
      {
        label: "14 window",
        window: { start: hour(10), end: hour(24) },
        used: "PT35H",
        limit: "PT14H",
      },
      {
        label: "14 window",
        window: { start: hour(25.75), end: hour(39.75) },
        used: "PT21H30M",
        limit: "PT14H",
      },
    ]);
    expect(
      dutyViolations(splitAt(log, hour(48)), range(0, 55), [rule], UTC),
    ).toEqual(record);
  });

  // Off 0–5 h, work 5–40 h, off 40–60 h. Every window ending before 50 h holds under 10 hours of
  // rest, from the log's first instant: one violation, which began at the log's start. Its worst
  // window holds none at all, first at 29 h, [5 h, 29 h). A range opening at 45 h finds it still
  // failing, so it belongs to the range it began in, and that range reports it.
  it("lists a violation in the range it began in, by its worst window", () => {
    const rule: DutyRule = {
      label: "10 in 24",
      kind: "restRequirement",
      restStatuses: ["off"],
      per: { elapsed: "PT24H" },
      minimum: "PT10H",
    };
    const log = dutySequence(START, [
      ["off", "PT5H"],
      ["work", "PT35H"],
      ["off", "PT20H"],
    ]);

    expect(dutyViolations(log, range(45, 59), [rule], UTC)).toEqual([]);
    expect(dutyViolations(log, range(-1, 59), [rule], UTC)).toEqual([
      {
        label: "10 in 24",
        window: { start: hour(5), end: hour(29) },
        used: "PT0S",
        limit: "PT10H",
      },
    ]);
  });
});

describe("dutyViolations — time the log does not cover is not judged", () => {
  // Three compliant days, 12 hours off then 12 at work, ending at 00:00 on the 4th. A range to the
  // month's end runs 28 days past the log; nothing after the last entry is judged, so the record
  // equals the one for a range ending with the log.
  const log = dutySequence(START, [
    ["off", "PT12H"],
    ["work", "PT12H"],
    ["off", "PT12H"],
    ["work", "PT12H"],
    ["off", "PT12H"],
    ["work", "PT12H"],
  ]);
  const rules: DutyRule[] = [
    {
      label: "10 a day",
      kind: "restRequirement",
      restStatuses: ["off"],
      per: { calendarDays: 1 },
      minimum: "PT10H",
    },
    {
      label: "10 in 24",
      kind: "restRequirement",
      restStatuses: ["off"],
      per: { elapsed: "PT24H" },
      minimum: "PT10H",
    },
    {
      label: "11 in 72",
      kind: "freePeriod",
      restStatuses: ["off"],
      minimum: "PT11H",
      within: { elapsed: "PT72H" },
    },
    {
      label: "12 within 2 days",
      kind: "dueBy",
      event: { statuses: ["off"], minimum: "PT12H" },
      within: { periods: 2, period: { elapsed: "PT24H" } },
    },
  ];

  it.each(rules.map((rule) => ({ rule, label: rule.label })))(
    "lists nothing for $label over a month the log covers three days of",
    ({ rule }) => {
      expect(dutyViolations(log, range(0, 31 * 24), [rule], UTC)).toEqual([]);
      expect(dutyViolations(log, range(0, 72), [rule], UTC)).toEqual([]);
    },
  );
});

describe("dutyViolations — one fixed period is reported by its complete check", () => {
  // 10 hours of rest a calendar day, and no more than 16 hours between rests. Off 0–4 h, work
  // 4–30:45 h, off 30:45–34 h. By the end of the 1st the gap is 20 hours; the 2nd holds the
  // whole 26:45 gap. The record is the same whether or not the range is cut at 19:00 on the 1st.
  const rule: DutyRule = {
    label: "10 a day, gap 16",
    kind: "restRequirement",
    restStatuses: ["off"],
    per: { calendarDays: 1 },
    minimum: "PT10H",
    maxGap: "PT16H",
  };
  const log = dutySequence(START, [
    ["off", "PT4H"],
    ["work", "PT26H45M"],
    ["off", "PT3H15M"],
  ]);
  const expected = [
    {
      label: "10 a day, gap 16",
      window: { start: hour(0), end: hour(24) },
      used: "PT20H",
      limit: "PT16H",
    },
    {
      label: "10 a day, gap 16",
      window: { start: hour(24), end: hour(48) },
      used: "PT26H45M",
      limit: "PT16H",
    },
  ];

  it("reports each day by its last check, wherever the range is cut", () => {
    expect(dutyViolations(log, range(0, 34), [rule], UTC)).toEqual(expected);
    expect([
      ...(dutyViolations(log, range(0, 19), [rule], UTC) ?? []),
      ...(dutyViolations(log, range(19, 34), [rule], UTC) ?? []),
    ]).toEqual(expected);
  });
});

describe("dutyViolations — the record does not depend on how a status is split into entries", () => {
  /** A small deterministic generator (mulberry32), so the property runs the same every time. */
  function random(seed: number) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const statuses = ["off", "off", "driving", "onDuty", "sleeper"];
  /** A length in 15-minute steps, from `low` to `high` steps. */
  const quarters = (next: () => number, low: number, high: number) =>
    15 * (low + Math.floor(next() * (high - low + 1)));
  /**
   * About twelve days of entries, each 15 minutes to 14 hours, in 15-minute steps. One time in
   * five the next steps are a split rest with a break between its halves: a rest of 2 to 10 hours,
   * driving, a sleeper break under 2 hours, driving, and a sleeper rest of 2 to 10 hours.
   */
  function randomLog(next: () => number): DutyStep[] {
    const steps: DutyStep[] = [];
    let total = 0;
    let previous = "";
    for (let index = 0; total < 288 * 60; index++) {
      if (previous !== "off" && next() < 0.2) {
        const motif: DutyStep[] = [
          ["off", `PT${quarters(next, 8, 40)}M`],
          ["driving", `PT${quarters(next, 4, 40)}M`],
          ["sleeper", `PT${quarters(next, 1, 7)}M`],
          ["driving", `PT${quarters(next, 4, 40)}M`],
          ["sleeper", `PT${quarters(next, 8, 40)}M`],
        ];
        steps.push(...motif);
        total += motif.reduce(
          (sum, [, length]) => sum + Number(length.slice(2, -1)),
          0,
        );
        previous = "sleeper";
        continue;
      }
      const status = statuses[Math.floor(next() * statuses.length)] as string;
      if (status === previous) continue;
      const minutes = quarters(next, 1, 56);
      steps.push([status, `PT${minutes}M`]);
      total += minutes;
      previous = status;
    }
    return steps;
  }

  const rules: DutyRule[] = [
    {
      label: "cumulativeCap",
      kind: "cumulativeCap",
      statuses: ["driving"],
      cap: "PT11H",
      since: { statuses: ["off", "sleeper"], consecutive: "PT10H" },
    },
    {
      label: "elapsedWindow",
      kind: "elapsedWindow",
      startStatuses: ["driving", "onDuty"],
      length: "PT14H",
      restrictedStatuses: ["driving"],
      since: { statuses: ["off", "sleeper"], consecutive: "PT10H" },
      exclude: {
        eachAtLeast: "PT2H",
        oneAtLeast: "PT7H",
        combinedAtLeast: "PT10H",
      },
    },
    {
      label: "requiredInterruption",
      kind: "requiredInterruption",
      countedStatuses: ["driving"],
      after: "PT4H30M",
      interruption: { minimum: "PT45M", orderedSplit: ["PT15M", "PT30M"] },
    },
    {
      label: "rollingCap",
      kind: "rollingCap",
      statuses: ["driving", "onDuty"],
      cap: "PT60H",
      window: { elapsed: "PT168H" },
      reset: { statuses: ["off"], consecutive: "PT34H" },
      precondition: {
        restStatuses: ["off"],
        minimum: "PT24H",
        beforeHours: "PT40H",
      },
    },
    {
      label: "restRequirement",
      kind: "restRequirement",
      restStatuses: ["off", "sleeper"],
      per: { elapsed: "PT24H" },
      minimum: "PT10H",
      composition: { maxPeriods: 2, longestAtLeast: "PT6H" },
      maxGap: "PT14H",
    },
    {
      label: "composite",
      kind: "restRequirement",
      restStatuses: ["off"],
      per: { elapsed: "PT24H" },
      minimum: "PT10H",
      composite: {
        consecutive: "PT8H",
        additional: "PT2H",
        blockMinimum: "PT30M",
      },
    },
    {
      label: "freePeriod",
      kind: "freePeriod",
      restStatuses: ["off", "sleeper"],
      minimum: "PT24H",
      within: { elapsed: "PT168H" },
      atLeast: 2,
    },
    {
      label: "restBeforeDuty",
      kind: "restBeforeDuty",
      restStatuses: ["off", "sleeper"],
      minimum: "PT10H",
      within: "PT24H",
      orFactor: { k: 1, floor: "PT11H" },
    },
    {
      label: "quota",
      kind: "quota",
      event: { statuses: ["off"], minimum: "PT9H", maximum: "PT11H" },
      count: 2,
      reset: { every: { elapsed: "PT72H" } },
    },
    {
      label: "dueBy",
      kind: "dueBy",
      event: { statuses: ["off"], minimum: "PT24H" },
      within: { periods: 3, period: { elapsed: "PT24H" } },
    },
    {
      label: "pattern",
      kind: "pattern",
      period: { elapsed: "PT24H" },
      lookback: 4,
      classes: [{ label: "rest", statuses: ["off"], minimum: "PT10H" }],
      require: [{ label: "rest", atLeast: 3 }],
    },
    {
      label: "rollingCap days",
      kind: "rollingCap",
      statuses: ["driving", "onDuty"],
      cap: "PT50H",
      window: { operatorDays: 5 },
    },
    {
      label: "fixedPeriodCap",
      kind: "fixedPeriodCap",
      statuses: ["driving"],
      cap: "PT9H",
      period: { calendarDays: 1 },
    },
    {
      label: "restRequirement day",
      kind: "restRequirement",
      restStatuses: ["off", "sleeper"],
      per: { operatorDays: 1 },
      minimum: "PT10H",
      composite: {
        consecutive: "PT8H",
        additional: "PT2H",
        blockMinimum: "PT30M",
      },
    },
    {
      label: "freePeriod nights",
      kind: "freePeriod",
      restStatuses: ["off", "sleeper"],
      minimum: "PT20H",
      within: { elapsed: "PT96H" },
      containing: { window: { from: "22:00", to: "06:00" }, count: 1 },
    },
    {
      label: "freePeriod days",
      kind: "freePeriod",
      restStatuses: ["off"],
      minimum: "PT12H",
      within: { calendarDays: 4 },
      atLeast: 2,
    },
    {
      label: "occurrenceCap",
      kind: "occurrenceCap",
      statuses: ["driving"],
      per: { calendarDays: 1 },
      lookback: 3,
      maximum: 2,
      byInitiationDate: true,
    },
    {
      label: "quota reset",
      kind: "quota",
      event: {
        statuses: ["off", "sleeper"],
        minimum: "PT8H",
        maximum: "PT11H",
      },
      count: 1,
      reset: { statuses: ["off", "sleeper"], consecutive: "PT24H" },
    },
    {
      label: "pattern days",
      kind: "pattern",
      period: { calendarDays: 1 },
      lookback: 3,
      classes: [{ label: "rest", statuses: ["off"], minimum: "PT9H" }],
      require: [{ label: "rest", atLeast: 2 }],
    },
  ];
  const options = { timeZone: "America/Chicago", dayStartTime: "04:00" };

  it.each(Array.from({ length: 40 }, (_, seed) => ({ seed })))(
    "gives the same record with an entry split, seed $seed",
    ({ seed }) => {
      const next = random(seed + 1);
      const log = dutySequence(START, randomLog(next));
      const span = {
        start: log[0]?.start as string,
        end: log.at(-1)?.end as string,
      };
      const entry = log[Math.floor(next() * log.length)] as DutyEntry;
      const from = Temporal.Instant.from(entry.start).epochMilliseconds;
      const to = Temporal.Instant.from(entry.end).epochMilliseconds;
      const cut = Temporal.Instant.fromEpochMilliseconds(
        from +
          60_000 * Math.max(1, Math.floor((next() * (to - from)) / 60_000)),
      ).toString();
      const split = splitAt(log, cut);

      for (const rule of rules) {
        expect(
          dutyViolations(split, span, [rule], options),
          rule.label,
        ).toEqual(dutyViolations(log, span, [rule], options));
      }
    },
  );

  // One cut finds a missed instant only when it lands near it. Over four days, every entry is cut
  // at a random quarter-hour inside it, so a failure that starts part-way through an entry is
  // checked from both sides. Seeds 214, 248 and 273 each found a paired rest whose qualifying
  // instant was not checked, when the partner was taken to be the run just before.
  it.each(
    [...Array.from({ length: 40 }, (_, seed) => seed), 214, 248, 273].map(
      (seed) => ({ seed }),
    ),
  )(
    "gives the same record with every entry of a short log split, seed $seed",
    ({ seed }) => {
      const next = random(1000 + seed);
      const steps = randomLog(next);
      const log: DutyEntry[] = [];
      let total = 0;

      for (const step of dutySequence(START, steps)) {
        if (total >= 96 * 60) {
          break;
        }
        log.push(step);
        total +=
          (Temporal.Instant.from(step.end).epochMilliseconds -
            Temporal.Instant.from(step.start).epochMilliseconds) /
          60_000;
      }

      const split = log.flatMap((entry) => {
        const from = Temporal.Instant.from(entry.start).epochMilliseconds;
        const quartersInside =
          (Temporal.Instant.from(entry.end).epochMilliseconds - from) / 900_000;
        if (quartersInside < 2) {
          return [entry];
        }
        const cut = Temporal.Instant.fromEpochMilliseconds(
          from + 900_000 * (1 + Math.floor(next() * (quartersInside - 1))),
        ).toString();
        return splitAt([entry], cut);
      });
      const span = {
        start: log[0]?.start as string,
        end: log.at(-1)?.end as string,
      };

      for (const rule of rules) {
        expect(
          dutyViolations(split, span, [rule], options),
          rule.label,
        ).toEqual(dutyViolations(log, span, [rule], options));
      }
    },
  );
});
