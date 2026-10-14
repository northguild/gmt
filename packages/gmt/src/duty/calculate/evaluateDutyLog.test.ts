import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, dutySequence } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { DutyEntry, DutyReport, DutyRule } from "../../types";
import { evaluateDutyLog } from "./evaluateDutyLog";

// 2024-01-01 (dateYearStart2024Jan01); times of day are the scenario under test.
const START = "2024-01-01T00:00:00Z";
const UTC = { timeZone: "UTC" };
const log = dutySequence(START, [
  ["off", "PT10H"],
  ["driving", "PT12H"],
]);
const elevenDriving: DutyRule = {
  label: "11 driving",
  kind: "cumulativeCap",
  statuses: ["driving"],
  cap: "PT11H",
  since: { statuses: ["off"], consecutive: "PT10H" },
};
const fourteenOnDuty: DutyRule = {
  label: "14 on duty",
  kind: "cumulativeCap",
  statuses: ["driving", "onDuty"],
  cap: "PT14H",
  since: { statuses: ["off"], consecutive: "PT10H" },
};

describe("evaluateDutyLog", () => {
  it("returns an empty report for no rules", () => {
    expect(evaluateDutyLog(log, "2024-01-01T12:00:00Z", [], UTC)).toEqual({
      at: "2024-01-01T12:00:00Z",
      outcomes: [],
      violations: [],
      advisories: [],
    });
  });

  it("writes at as a UTC instant", () => {
    expect(evaluateDutyLog(log, "2024-01-01T17:00:00+05:00", [], UTC)?.at).toBe(
      "2024-01-01T12:00:00Z",
    );
  });

  it("accepts typed logs and rules over a caller's status vocabulary", () => {
    type Status = "off" | "driving";
    const typed: DutyEntry<Status>[] = [
      { status: "off", start: START, end: "2024-01-01T10:00:00Z" },
    ];
    const rules: DutyRule<Status>[] = [
      {
        label: "11",
        kind: "cumulativeCap",
        statuses: ["driving"],
        cap: "PT11H",
        since: { statuses: ["off"], consecutive: "PT10H" },
      },
    ];
    const report: DutyReport | null = evaluateDutyLog(
      typed,
      "2024-01-01T10:00:00Z",
      rules,
      UTC,
    );

    expect(report?.outcomes[0]?.used).toBe("PT0S");
  });

  // At 22:00, 12 hours of driving: the 11-hour cap fails and the 14-hour cap has 2 left. Every
  // rule is reported, in the order given, and only the failure is listed again.
  it("reports every rule in order and lists only failures under violations", () => {
    const report = evaluateDutyLog(
      log,
      "2024-01-01T22:00:00Z",
      [fourteenOnDuty, elevenDriving],
      UTC,
    );

    expect(
      report?.outcomes.map(({ label, satisfied, remaining }) => ({
        label,
        satisfied,
        remaining,
      })),
    ).toEqual([
      { label: "14 on duty", satisfied: true, remaining: "PT2H" },
      { label: "11 driving", satisfied: false, remaining: "PT0S" },
    ]);
    expect(report?.violations.map((failed) => failed.label)).toEqual([
      "11 driving",
    ]);
    expect(report?.advisories).toEqual([]);
  });

  it.each`
    severity       | violations        | advisories        | reason
    ${undefined}   | ${["11 driving"]} | ${[]}             | ${"the default is a violation"}
    ${"violation"} | ${["11 driving"]} | ${[]}             | ${"explicit violation, the same as the default"}
    ${"advisory"}  | ${[]}             | ${["11 driving"]} | ${"an advisory is never a violation"}
  `(
    "lists a failed rule with severity $severity under $reason",
    ({ severity, violations, advisories }) => {
      const report = evaluateDutyLog(
        log,
        "2024-01-01T22:00:00Z",
        [{ ...elevenDriving, severity } as DutyRule],
        UTC,
      );

      expect(report?.outcomes[0]?.severity).toBe(severity ?? "violation");
      expect(report?.violations.map((failed) => failed.label)).toEqual(
        violations,
      );
      expect(report?.advisories.map((failed) => failed.label)).toEqual(
        advisories,
      );
    },
  );

  it("does not list a satisfied advisory anywhere", () => {
    const report = evaluateDutyLog(
      log,
      "2024-01-01T20:00:00Z",
      [{ ...elevenDriving, severity: "advisory" }],
      UTC,
    );

    expect(report?.outcomes[0]?.satisfied).toBe(true);
    expect(report?.advisories).toEqual([]);
  });

  it("reads an explicit undefined dayStartTime as absent", () => {
    expect(
      evaluateDutyLog(log, "2024-01-01T20:00:00Z", [elevenDriving], {
        timeZone: "UTC",
        dayStartTime: undefined,
      }),
    ).not.toBeNull();
  });

  // One local calendar day of on-duty time, evaluated at its end: the window is that day in the
  // reference zone, so the cap counts the day's real length (expected values from Temporal's
  // `startOfDay`, the day bucket `bucketRange` uses).
  it.each`
    timeZone                 | start                     | end                       | used          | reason
    ${"America/New_York"}    | ${"2024-11-03T04:00:00Z"} | ${"2024-11-04T05:00:00Z"} | ${"PT25H"}    | ${"the fall-back day"}
    ${"America/New_York"}    | ${"2024-03-10T05:00:00Z"} | ${"2024-03-11T04:00:00Z"} | ${"PT23H"}    | ${"the spring-forward day"}
    ${"America/Santiago"}    | ${"2024-09-08T04:00:00Z"} | ${"2024-09-09T03:00:00Z"} | ${"PT23H"}    | ${"local midnight skipped: the day starts at 01:00"}
    ${"America/Havana"}      | ${"2024-11-03T04:00:00Z"} | ${"2024-11-04T05:00:00Z"} | ${"PT25H"}    | ${"midnight repeated: one 25-hour day"}
    ${"Australia/Lord_Howe"} | ${"2024-04-06T13:00:00Z"} | ${"2024-04-07T13:30:00Z"} | ${"PT24H30M"} | ${"a 30-minute fall-back"}
    ${"Pacific/Chatham"}     | ${"2024-09-28T11:15:00Z"} | ${"2024-09-29T10:15:00Z"} | ${"PT23H"}    | ${"a +12:45 zone springing forward"}
    ${"Antarctica/Casey"}    | ${"2020-10-03T16:00:00Z"} | ${"2020-10-04T13:00:00Z"} | ${"PT21H"}    | ${"a three-hour jump"}
    ${"Pacific/Apia"}        | ${"2011-12-29T10:00:00Z"} | ${"2011-12-30T10:00:00Z"} | ${"PT24H"}    | ${"the day before the deleted date"}
    ${"Pacific/Apia"}        | ${"2011-12-30T10:00:00Z"} | ${"2011-12-31T10:00:00Z"} | ${"PT24H"}    | ${"the day after it: the deleted date has no day"}
  `(
    "counts a $used calendar day in $timeZone ($reason)",
    ({ timeZone, start, end, used }) => {
      const day = [{ status: "onDuty", start, end }];
      const report = evaluateDutyLog(
        day,
        end,
        [
          {
            label: "a day",
            kind: "rollingCap",
            statuses: ["onDuty"],
            cap: "PT25H",
            window: { calendarDays: 1 },
          },
        ],
        { timeZone },
      );
      const window = report?.outcomes[0]?.window;
      const last = Temporal.Instant.from(end).epochNanoseconds - 1n;

      expect(report?.outcomes[0]).toMatchObject({
        used,
        window: { start, end },
        periodBasis: "calendar",
      });
      expect(
        Temporal.Instant.from(window?.start as string).epochNanoseconds <=
          last &&
          last < Temporal.Instant.from(window?.end as string).epochNanoseconds,
      ).toBe(true);
    },
  );

  // Two hours on duty around local noon on 2024-02-29, read in each zone: the calendar day and
  // the operator day from 04:00 are that zone's own (no battle-test zone changes its clock then).
  it.each(battleTestTimeZones)(
    "reads local days and operator days in %s",
    (timeZone) => {
      const local = (day: number, hour: number) =>
        Temporal.ZonedDateTime.from({
          year: 2024,
          month: 2,
          day,
          hour,
          timeZone,
        })
          .toInstant()
          .toString();
      const noonShift = [
        { status: "onDuty", start: local(29, 11), end: local(29, 13) },
      ];
      const report = evaluateDutyLog(
        noonShift,
        local(29, 13),
        [
          {
            label: "day",
            kind: "rollingCap",
            statuses: ["onDuty"],
            cap: "PT12H",
            window: { calendarDays: 1 },
          },
          {
            label: "operator day",
            kind: "rollingCap",
            statuses: ["onDuty"],
            cap: "PT12H",
            window: { operatorDays: 1 },
          },
        ],
        { timeZone, dayStartTime: "04:00" },
      );
      const nextDay = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 3,
        day: 1,
        timeZone,
      })
        .toInstant()
        .toString();
      const nextOperatorDay = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 3,
        day: 1,
        hour: 4,
        timeZone,
      })
        .toInstant()
        .toString();

      expect(report?.outcomes).toMatchObject([
        { used: "PT2H", window: { start: local(29, 0), end: nextDay } },
        {
          used: "PT2H",
          window: { start: local(29, 4), end: nextOperatorDay },
          periodBasis: "operatorDay",
        },
      ]);
    },
  );

  // A UTC offset is a complete rule for local time: at +05:30, 12:00Z is 17:30 local, so the day
  // began at 18:30Z the evening before; at −00:44:30 (Monrovia's stored offset) the day begins
  // at 00:44:30Z and the operator day at 04:44:30Z.
  it.each`
    timeZone       | at                        | day                                                               | operatorDay
    ${"+05:30"}    | ${"2024-01-01T12:00:00Z"} | ${{ start: "2023-12-31T18:30:00Z", end: "2024-01-01T18:30:00Z" }} | ${{ start: "2023-12-31T22:30:00Z", end: "2024-01-01T22:30:00Z" }}
    ${"+0530"}     | ${"2024-01-01T12:00:00Z"} | ${{ start: "2023-12-31T18:30:00Z", end: "2024-01-01T18:30:00Z" }} | ${{ start: "2023-12-31T22:30:00Z", end: "2024-01-01T22:30:00Z" }}
    ${"-00:44:30"} | ${"1970-01-01T12:00:00Z"} | ${{ start: "1970-01-01T00:44:30Z", end: "1970-01-02T00:44:30Z" }} | ${{ start: "1970-01-01T04:44:30Z", end: "1970-01-02T04:44:30Z" }}
  `(
    "reads $timeZone, a UTC offset, as the reference zone",
    ({ timeZone, at, day, operatorDay }) => {
      const hourBefore = Temporal.Instant.from(at)
        .subtract({ hours: 1 })
        .toString();
      const report = evaluateDutyLog(
        [{ status: "onDuty", start: hourBefore, end: at }],
        at,
        [
          {
            label: "day",
            kind: "rollingCap",
            statuses: ["onDuty"],
            cap: "PT12H",
            window: { calendarDays: 1 },
          },
          {
            label: "operator day",
            kind: "rollingCap",
            statuses: ["onDuty"],
            cap: "PT12H",
            window: { operatorDays: 1 },
          },
        ],
        { timeZone, dayStartTime: "04:00" },
      );

      expect(report?.outcomes).toMatchObject([
        { used: "PT1H", window: day },
        { used: "PT1H", window: operatorDay },
      ]);
    },
  );

  // New York repeats 01:30 on 2024-11-03. An operator day starting then resolves under the call's
  // policy; a calendar day is a real boundary and never consults it (Temporal's resolution of
  // 01:30: first pass 05:30Z, second 06:30Z; the next day's 01:30 is 06:30Z).
  it.each`
    disambiguation  | window
    ${undefined}    | ${{ start: "2024-11-03T05:30:00Z", end: "2024-11-04T06:30:00Z" }}
    ${"compatible"} | ${{ start: "2024-11-03T05:30:00Z", end: "2024-11-04T06:30:00Z" }}
    ${"earlier"}    | ${{ start: "2024-11-03T05:30:00Z", end: "2024-11-04T06:30:00Z" }}
    ${"later"}      | ${{ start: "2024-11-03T06:30:00Z", end: "2024-11-04T06:30:00Z" }}
    ${"reject"}     | ${null}
  `(
    "resolves a repeated operator-day start under $disambiguation",
    ({ disambiguation, window }) => {
      const shift = [
        {
          status: "onDuty",
          start: "2024-11-03T12:00:00Z",
          end: "2024-11-03T14:00:00Z",
        },
      ];
      const rules: DutyRule[] = [
        {
          label: "operator day",
          kind: "rollingCap",
          statuses: ["onDuty"],
          cap: "PT12H",
          window: { operatorDays: 1 },
        },
      ];
      const options = {
        timeZone: "America/New_York",
        dayStartTime: "01:30",
        disambiguation,
      };
      const report = evaluateDutyLog(
        shift,
        "2024-11-03T14:00:00Z",
        rules,
        options,
      );

      expect(report?.outcomes[0]?.window ?? null).toEqual(window);
      expect(
        evaluateDutyLog(
          shift,
          "2024-11-03T14:00:00Z",
          [{ ...rules[0], window: { calendarDays: 1 } } as DutyRule],
          options,
        )?.outcomes[0]?.window,
      ).toEqual({ start: "2024-11-03T04:00:00Z", end: "2024-11-04T05:00:00Z" });
    },
  );

  // Off from 00:00 EDT to 07:00 EST on 2024-11-03 holds the window from the repeated 01:30
  // (first pass, 05:30Z) to 06:00 EST (11:00Z); "reject" refuses a window edge the clock repeats.
  it.each`
    disambiguation  | used
    ${"compatible"} | ${1}
    ${"reject"}     | ${undefined}
  `(
    "resolves a freePeriod's local window under $disambiguation",
    ({ disambiguation, used }) => {
      const report = evaluateDutyLog(
        [
          {
            status: "off",
            start: "2024-11-03T04:00:00Z",
            end: "2024-11-03T12:00:00Z",
          },
        ],
        "2024-11-03T12:00:00Z",
        [
          {
            label: "night",
            kind: "freePeriod",
            restStatuses: ["off"],
            minimum: "PT5H",
            within: { elapsed: "PT48H" },
            containing: { window: { from: "01:30", to: "06:00" }, count: 1 },
          },
        ],
        { timeZone: "America/New_York", disambiguation },
      );

      expect(report?.outcomes[0]?.used).toBe(used);
    },
  );

  // At 16:00Z on Monday 28 October, the week can still be met by resting to its end, which
  // would hold New York's repeated 01:30 on 3 November. That rest is only supposed, so "reject"
  // does not refuse it: no logged rest reaches the repeated time.
  it("does not reject a repeated window edge that only supposed rest reaches", () => {
    const report = evaluateDutyLog(
      [
        {
          status: "work",
          start: "2024-10-28T12:00:00Z",
          end: "2024-10-28T16:00:00Z",
        },
      ],
      "2024-10-28T16:00:00Z",
      [
        {
          label: "night off",
          kind: "freePeriod",
          restStatuses: ["off"],
          minimum: "PT5H",
          within: { isoWeeks: 1 },
          containing: { window: { from: "01:30", to: "06:00" }, count: 1 },
        },
      ],
      { timeZone: "America/New_York", disambiguation: "reject" },
    );

    expect(report?.outcomes[0]).toMatchObject({ satisfied: true, used: 0 });
  });

  it("reads the instant range edge without throwing", () => {
    expect(
      evaluateDutyLog(
        [],
        "-271821-04-20T00:00:00Z",
        [
          {
            label: "sliding",
            kind: "rollingCap",
            statuses: ["onDuty"],
            cap: "PT1H",
            window: { elapsed: "PT24H" },
          },
        ],
        UTC,
      )?.outcomes[0]?.window,
    ).toEqual({
      start: "-271821-04-20T00:00:00Z",
      end: "-271821-04-20T00:00:00Z",
    });
  });

  describe("returns null on invalid input", () => {
    const at = "2024-01-01T20:00:00Z";

    it.each`
      candidate                                                                                                                                       | reason
      ${null}                                                                                                                                         | ${"a log that is not an array"}
      ${[{ status: "on", start: "2024-01-01T02:00:00Z", end: "2024-01-01T01:00:00Z" }]}                                                               | ${"an inverted entry"}
      ${[{ status: "on", start: START, end: "2024-01-01T02:00:00Z" }, { status: "off", start: "2024-01-01T01:00:00Z", end: "2024-01-01T03:00:00Z" }]} | ${"overlapping entries"}
    `("for $reason", ({ candidate }) => {
      expect(evaluateDutyLog(candidate, at, [elevenDriving], UTC)).toBeNull();
    });

    it.each`
      instant
      ${"2024-01-01T20:00:00"}
      ${"2024-01-01"}
      ${123}
      ${undefined}
    `("for at $instant", ({ instant }) => {
      expect(evaluateDutyLog(log, instant, [elevenDriving], UTC)).toBeNull();
    });

    const cap = (fields: Record<string, unknown>) =>
      ({ ...elevenDriving, ...fields }) as unknown as DutyRule;
    const rolling = (window: unknown) =>
      ({
        label: "r",
        kind: "rollingCap",
        statuses: ["onDuty"],
        cap: "PT60H",
        window,
      }) as unknown as DutyRule;

    it.each`
      rules                                                                                                                                                                                                                  | reason
      ${null}                                                                                                                                                                                                                | ${"rules that are not an array"}
      ${[null]}                                                                                                                                                                                                              | ${"a rule that is not an object"}
      ${[cap({ kind: "dailyCap" })]}                                                                                                                                                                                         | ${"an unknown kind"}
      ${[cap({ label: 7 })]}                                                                                                                                                                                                 | ${"a label that is not a string"}
      ${[elevenDriving, { ...fourteenOnDuty, label: "11 driving" }]}                                                                                                                                                         | ${"two rules with one label"}
      ${[cap({ severity: "warning" })]}                                                                                                                                                                                      | ${"an unknown severity"}
      ${[cap({ statuses: [] })]}                                                                                                                                                                                             | ${"an empty status list"}
      ${[cap({ statuses: [1] })]}                                                                                                                                                                                            | ${"a status that is not a string"}
      ${[cap({ cap: "PT0S" })]}                                                                                                                                                                                              | ${"a zero cap"}
      ${[cap({ cap: "-PT11H" })]}                                                                                                                                                                                            | ${"a negative cap"}
      ${[cap({ cap: "P1W" })]}                                                                                                                                                                                               | ${"a cap in weeks, which has no exact length"}
      ${[cap({ cap: "11 hours" })]}                                                                                                                                                                                          | ${"a malformed cap"}
      ${[cap({ since: undefined })]}                                                                                                                                                                                         | ${"a missing reset"}
      ${[cap({ since: { statuses: ["off"], consecutive: "PT0S" } })]}                                                                                                                                                        | ${"a zero-length reset"}
      ${[rolling({})]}                                                                                                                                                                                                       | ${"a period with no key"}
      ${[rolling({ elapsed: "PT24H", calendarDays: 1 })]}                                                                                                                                                                    | ${"a period with two keys"}
      ${[rolling({ calendarDays: 0 })]}                                                                                                                                                                                      | ${"a zero count"}
      ${[rolling({ calendarDays: 1.5 })]}                                                                                                                                                                                    | ${"a fractional count"}
      ${[rolling({ calendarDays: 10_001 })]}                                                                                                                                                                                 | ${"more than 10,000 periods"}
      ${[rolling({ fortnights: 1 })]}                                                                                                                                                                                        | ${"an unknown period"}
      ${[rolling({ elapsed: "P1M" })]}                                                                                                                                                                                       | ${"an elapsed period in months"}
      ${[{ ...rolling({ isoWeeks: 1 }), kind: "fixedPeriodCap", period: { elapsed: "PT168H" } }]}                                                                                                                            | ${"a fixed period that is elapsed time"}
      ${[{ ...rolling({ isoWeeks: 1 }), kind: "fixedPeriodCap", period: { calendarDays: 100 }, adjacent: 101 }]}                                                                                                             | ${"adjacent periods past 10,000"}
      ${[{ label: "o", kind: "occurrenceCap", statuses: ["n"], per: { elapsed: "PT24H" }, lookback: 7, maximum: 2 }]}                                                                                                        | ${"an occurrence period that is elapsed time"}
      ${[{ label: "q", kind: "quota", event: { statuses: ["off"], minimum: "PT11H", maximum: "PT9H" }, count: 3, reset: { statuses: ["off"], consecutive: "PT24H" } }]}                                                      | ${"a quota whose maximum is under its minimum"}
      ${[{ label: "p", kind: "pattern", period: { isoWeeks: 1 }, lookback: 4, classes: [{ label: "a", statuses: ["off"], minimum: "PT24H" }], require: [{ label: "b", atLeast: 1 }] }]}                                      | ${"a pattern requiring a class it does not define"}
      ${[{ label: "p", kind: "pattern", period: { isoWeeks: 1 }, lookback: 4, classes: [], require: [] }]}                                                                                                                   | ${"a pattern with no class"}
      ${[{ label: "u", kind: "usageLookback", uses: ["yesterday"], notWithin: { calendarDays: 7 }, reset: { statuses: ["off"], consecutive: "PT34H" } }]}                                                                    | ${"a use that is not an instant"}
      ${[{ label: "b", kind: "restBeforeDuty", restStatuses: ["off"], minimum: "PT10H", within: "PT24H", orFactor: { k: 0, floor: "PT12H" } }]}                                                                              | ${"a zero factor"}
      ${[{ label: "f", kind: "freePeriod", restStatuses: ["off"], minimum: "PT36H", within: { elapsed: "PT168H" }, containing: { window: { from: "22:00", to: "8am" }, count: 2 } }]}                                        | ${"a malformed local window"}
      ${[{ label: "e", kind: "elapsedWindow", startStatuses: ["d"], length: "PT14H", restrictedStatuses: ["d"], since: { statuses: ["off"], consecutive: "PT10H" }, extension: { by: "PT2H", from: "noon" } }]}              | ${"an extension from no instant"}
      ${[{ label: "e", kind: "elapsedWindow", startStatuses: ["d"], length: "PT14H", restrictedStatuses: ["d"], since: { statuses: ["off"], consecutive: "PT10H" }, exclude: { eachAtLeast: "PT2H", oneAtLeast: "PT7H" } }]} | ${"an incomplete pair"}
      ${[{ label: "i", kind: "requiredInterruption", countedStatuses: ["d"], after: "PT8H", interruption: { minimum: "PT30M", orderedSplit: [] } }]}                                                                         | ${"an empty ordered split"}
    `("for $reason", ({ rules }) => {
      expect(evaluateDutyLog(log, at, rules, UTC)).toBeNull();
    });

    it.each`
      options                                           | reason
      ${null}                                           | ${"null options"}
      ${"UTC"}                                          | ${"options that are not an object"}
      ${{}}                                             | ${"no timeZone"}
      ${{ timeZone: "Invalid/Zone" }}                   | ${"an invalid zone"}
      ${{ timeZone: "UTC", dayStartTime: "4am" }}       | ${"a malformed dayStartTime"}
      ${{ timeZone: "UTC", dayStartTime: null }}        | ${"a null dayStartTime"}
      ${{ timeZone: "UTC", disambiguation: "nearest" }} | ${"an unknown disambiguation"}
    `("for $reason", ({ options }) => {
      expect(evaluateDutyLog(log, at, [elevenDriving], options)).toBeNull();
    });

    it("for a rule counting operator days without dayStartTime", () => {
      expect(
        evaluateDutyLog(log, at, [rolling({ operatorDays: 7 })], UTC),
      ).toBeNull();
      expect(
        evaluateDutyLog(log, at, [rolling({ operatorDays: 7 })], {
          timeZone: "UTC",
          dayStartTime: "04:00",
        }),
      ).not.toBeNull();
    });

    it("when Temporal.Instant.from throws", () => {
      mockTemporalInstantFromThrow();
      expect(evaluateDutyLog(log, at, [elevenDriving], UTC)).toBeNull();
    });
  });
});
