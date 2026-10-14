import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, type DutyStep, dutySequence } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { DutyRule } from "../../types";
import { dutyViolations } from "./dutyViolations";

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

  // On duty for whole local days across a clock change, under a cap of 24 hours a day: the
  // 25-hour fall-back day fails, a 23-hour or 24-hour day does not, and the date Samoa deleted is
  // no day at all (expected days from Temporal's `startOfDay`).
  it.each`
    timeZone              | start                     | end                       | failed
    ${"America/New_York"} | ${"2024-11-02T04:00:00Z"} | ${"2024-11-05T05:00:00Z"} | ${[["2024-11-03T04:00:00Z", "2024-11-04T05:00:00Z", "PT25H"]]}
    ${"America/New_York"} | ${"2024-03-09T05:00:00Z"} | ${"2024-03-12T04:00:00Z"} | ${[]}
    ${"Pacific/Apia"}     | ${"2011-12-28T10:00:00Z"} | ${"2012-01-01T10:00:00Z"} | ${[]}
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
    range                                                             | rules                                                                                                   | options                         | reason
    ${{ start: "2024-02-01T00:00:00Z", end: START }}                  | ${[elevenDriving]}                                                                                      | ${UTC}                          | ${"an inverted range"}
    ${"January"}                                                      | ${[elevenDriving]}                                                                                      | ${UTC}                          | ${"a range that is not an Interval"}
    ${{ start: START, end: "2024-02-01T00:00:00Z" }}                  | ${[{ ...elevenDriving, cap: "PT0S" }]}                                                                  | ${UTC}                          | ${"a zero cap"}
    ${{ start: START, end: "2024-02-01T00:00:00Z" }}                  | ${[elevenDriving]}                                                                                      | ${{ timeZone: "Mars/Olympus" }} | ${"an invalid zone"}
    ${{ start: START, end: "2024-02-01T00:00:00Z" }}                  | ${[{ label: "d", kind: "rollingCap", statuses: ["d"], cap: "PT60H", window: { operatorDays: 7 } }]}     | ${UTC}                          | ${"operator days without dayStartTime"}
    ${{ start: "2000-01-01T00:00:00Z", end: "2040-01-01T00:00:00Z" }} | ${[{ label: "d", kind: "fixedPeriodCap", statuses: ["d"], cap: "PT12H", period: { calendarDays: 1 } }]} | ${UTC}                          | ${"more than 10,000 days in the range"}
  `("returns null for $reason", ({ range, rules, options }) => {
    expect(
      dutyViolations(dutySequence(START, week1), range, rules, options),
    ).toBeNull();
  });

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
