/**
 * Typed-member contract: an option or record member the types declare as a string is read only
 * when it is a primitive string, one declared as a boolean only when it is a boolean, and one
 * declared as a number only when it is a number. A boxed `String`, an object with a `toString`,
 * a one-element array or any other value that ECMA-402 GetOption or Temporal GetOption would
 * convert with ToString, ToBoolean or ToNumber returns the function's sentinel instead. The same
 * holds for every entry of a locale list. Each row is the one call, run with a valid value
 * (which must give the literal answer) and with each value the type does not accept (which must
 * give the sentinel).
 */
import {
  addDate,
  addZoned,
  cycleDate,
  cycleDateTime,
  cycleTime,
  cycleZoned,
  cutoffSchedule,
  convertPlainDateTimeToZoned,
  diffDate,
  diffDateAsDuration,
  formatFHIR,
  formatHL7,
  formatTimeZoneName,
  parseDateWithPattern,
  diffTime,
  diffUtc,
  diffZoned,
  evaluateDutyLog,
  getZonedNow,
  parseDuration,
  resolveLocal,
  roundZoned,
  setZoned,
  formatDate,
  formatDuration,
  formatUnix,
  formatUtc,
  formatRelativeTime,
  formatTime,
  formatZonedDateTime,
  getLocaleMonthNames,
  isBetweenDate,
  isBetweenDateTime,
  isBetweenTime,
  isBetweenUnix,
  isBetweenUtc,
  isBetweenZoned,
  isValidDateRange,
  isValidDateTimeRange,
  isValidTimeRange,
  isValidUnixRange,
  isValidUtcRange,
  isValidZonedRange,
  nextWeekday,
  previousWeekday,
  normalizeDuration,
  roundTime,
  scheduleDelivery,
} from "../index";

/** The values a string-typed member must not accept, each one something `ToString` would read. */
function notStrings(text: string): unknown[] {
  return [
    // eslint-disable-next-line no-new-wrappers -- a boxed string is the case under test
    new String(text),
    { toString: () => text },
    [text],
    1,
    true,
    null,
  ];
}

const DUTY = [
  { status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T10:00:00Z" },
  {
    status: "driving",
    start: "2024-01-01T10:00:00Z",
    end: "2024-01-01T21:00:00Z",
  },
];
const DUTY_RULE = {
  label: "11 driving",
  kind: "cumulativeCap",
  statuses: ["driving"],
  cap: "PT11H",
  since: { statuses: ["off"], consecutive: "PT10H" },
};
const dutyLabel = (entries: unknown, rule: unknown): unknown =>
  (
    evaluateDutyLog(entries as never, "2024-01-01T21:00:00Z", [rule] as never, {
      timeZone: "UTC",
    }) as { outcomes: { label: string }[] } | null
  )?.outcomes[0]?.label ?? null;

type Row = {
  family: string;
  member: string;
  valid: unknown;
  expected: unknown;
  sentinel: unknown;
  run: (value: unknown) => unknown;
};

const STRING_ROWS: Row[] = [
  {
    family: "Intl DateTimeFormat option",
    member: "dateStyle",
    valid: "long",
    expected: "15. Juni 2024",
    sentinel: "",
    run: (v) => formatDate("2024-06-15", "de-DE", { dateStyle: v as never }),
  },
  {
    family: "Intl DateTimeFormat option",
    member: "timeStyle",
    valid: "short",
    expected: "10:30",
    sentinel: "",
    run: (v) => formatTime("10:30:00", "de-DE", { timeStyle: v as never }),
  },
  {
    family: "Intl DateTimeFormat option",
    member: "timeZoneName",
    valid: "short",
    expected: "10 CEST",
    sentinel: "",
    run: (v) =>
      formatZonedDateTime("2024-06-15T10:30:00+02:00[Europe/Berlin]", "en-GB", {
        hour: "numeric",
        timeZoneName: v as never,
      }),
  },
  {
    family: "Intl RelativeTimeFormat option",
    member: "numeric",
    valid: "auto",
    expected: "now",
    sentinel: "",
    run: (v) =>
      formatRelativeTime("16:30:00", "en", {
        reference: "16:30:00",
        numeric: v as never,
      }),
  },
  {
    family: "Temporal option",
    member: "overflow",
    valid: "constrain",
    expected: "2024-02-29",
    sentinel: "",
    run: (v) => addDate("2024-01-31", { months: 1 }, { overflow: v as never }),
  },
  {
    family: "Temporal option",
    member: "roundingMode",
    valid: "floor",
    expected: "12:34:00",
    sentinel: "",
    run: (v) =>
      roundTime("12:34:56", {
        smallestUnit: "minute",
        roundingMode: v as never,
      }),
  },
  {
    family: "Temporal option",
    member: "largestUnit",
    valid: "hours",
    expected: "PT1H30M",
    sentinel: "",
    run: (v) => normalizeDuration("PT90M", { largestUnit: v as never }),
  },
  {
    family: "Temporal option",
    member: "smallestUnit",
    valid: "minutes",
    expected: "PT90M",
    sentinel: "",
    run: (v) => normalizeDuration("PT90M", { smallestUnit: v as never }),
  },
  {
    family: "Temporal option",
    member: "disambiguation",
    valid: "earlier",
    expected: "2024-03-10T01:30:00-05:00[America/New_York]",
    sentinel: "",
    run: (v) =>
      addZoned(
        "2024-03-09T02:30:00-05:00[America/New_York]",
        { days: 1 },
        { disambiguation: v as never },
      ),
  },
  {
    family: "transport record",
    member: "ScheduleDeliveryOptions mode (leg)",
    valid: "ship",
    expected: "ship",
    sentinel: null,
    run: (v) =>
      scheduleDelivery([
        {
          departure: "2024-06-15T10:00:00Z",
          duration: "PT1H",
          timeZone: "UTC",
          mode: v as never,
        },
      ])?.legTimes[0]?.mode ?? null,
  },
  {
    family: "transport record",
    member: "Cutoff name",
    valid: "doc",
    expected: "doc",
    sentinel: undefined,
    run: (v) =>
      cutoffSchedule(
        "2024-06-15T10:00:00Z",
        [{ name: v as never, offset: "PT1H" }],
        { timeZone: "UTC" },
      )[0]?.name,
  },
  {
    family: "workforce record",
    member: "DutyEntry status",
    valid: "driving",
    expected: "11 driving",
    sentinel: null,
    run: (v) => dutyLabel([DUTY[0], { ...DUTY[1], status: v }], DUTY_RULE),
  },
  {
    family: "workforce record",
    member: "rule label",
    valid: "11 driving",
    expected: "11 driving",
    sentinel: null,
    run: (v) => dutyLabel(DUTY, { ...DUTY_RULE, label: v }),
  },
  {
    family: "workforce record",
    member: "rule statuses entry",
    valid: "driving",
    expected: "11 driving",
    sentinel: null,
    run: (v) => dutyLabel(DUTY, { ...DUTY_RULE, statuses: [v] }),
  },
  {
    family: "locale list",
    member: "an entry of a locale list",
    valid: "de-DE",
    expected: "15.6.2024",
    sentinel: "",
    run: (v) => formatDate("2024-06-15", [v] as never),
  },
  {
    family: "locale list",
    member: "an entry of a locale list that reads names",
    valid: "de-DE",
    expected: "Januar",
    sentinel: [],
    run: (v) => getLocaleMonthNames([v] as never, "long")[0] ?? [],
  },
];

describe("a member typed as a string", () => {
  it.each(
    STRING_ROWS.map((row) => ({
      ...row,
      label: `${row.family}: ${row.member}`,
    })),
  )("reads a string for $label", ({ run, valid, expected }) => {
    expect(run(valid)).toStrictEqual(expected);
  });

  it.each(
    STRING_ROWS.flatMap((row, rowIndex) =>
      notStrings(row.valid as string).map((value, index) => ({
        ...row,
        value,
        label: `${rowIndex + 1}.${index + 1} ${row.family}: ${row.member}`,
      })),
    ),
  )("returns the sentinel for $label", ({ run, value, sentinel }) => {
    expect(run(value)).toStrictEqual(sentinel);
  });
});

describe("a member typed as a boolean or a number", () => {
  const hour12 = (v: unknown): unknown =>
    formatTime("10:30:00", "en-US", { hour12: v as never });
  const digits = (v: unknown): unknown =>
    formatTime("10:30:00.123", "en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: v as never,
    });
  const increment = (v: unknown): unknown =>
    roundTime("12:34:56", {
      smallestUnit: "minute",
      roundingIncrement: v as never,
    });

  it.each`
    label                                      | run          | valid    | expected          | bad
    ${"Intl hour12, a boolean"}                | ${hour12}    | ${false} | ${"10:30:00"}     | ${["yes", 0, 1, "false", null, {}]}
    ${"Intl fractionalSecondDigits, a number"} | ${digits}    | ${3}     | ${"10:30:00.123"} | ${["3", true, null, {}, [3]]}
    ${"Temporal roundingIncrement, a number"}  | ${increment} | ${5}     | ${"12:35:00"}     | ${["5", true, null, [5], { valueOf: () => 5 }]}
  `("$label is read only as that type", ({ run, valid, expected, bad }) => {
    expect(run(valid)).toBe(expected);
    for (const value of bad as unknown[]) {
      expect(run(value), String(typeof value)).toBe("");
    }
  });
});

describe("a flag member typed as a boolean in a function's own option bag", () => {
  const Z = "2024-06-15T12:00:00+09:00[Asia/Tokyo]";
  const range =
    (fn: (a: never) => unknown, v1: unknown, v2: unknown) =>
    (flag: unknown): unknown =>
      fn({ value1: v1, value2: v2, options: { allowEqual: flag } } as never);
  const between =
    (fn: (...a: never[]) => unknown, args: unknown[], key: string) =>
    (flag: unknown): unknown =>
      fn(...(args as never[]), { [key]: flag } as never);

  it.each`
    label                                | run                                                                                                                           | expected
    ${"isValidDateRange allowEqual"}     | ${range(isValidDateRange as never, "2024-02-29", "2024-02-29")}                                                               | ${true}
    ${"isValidTimeRange allowEqual"}     | ${range(isValidTimeRange as never, "12:00:00", "12:00:00")}                                                                   | ${true}
    ${"isValidDateTimeRange allowEqual"} | ${range(isValidDateTimeRange as never, "2024-01-01T10:00:00", "2024-01-01T10:00:00")}                                         | ${true}
    ${"isValidUnixRange allowEqual"}     | ${range(isValidUnixRange as never, 1000, 1000)}                                                                               | ${true}
    ${"isValidUtcRange allowEqual"}      | ${range(isValidUtcRange as never, "2024-01-01T10:00:00Z", "2024-01-01T10:00:00Z")}                                            | ${true}
    ${"isValidZonedRange allowEqual"}    | ${range(isValidZonedRange as never, Z, Z)}                                                                                    | ${true}
    ${"isBetweenDate inclusiveStart"}    | ${between(isBetweenDate as never, ["2024-02-01", "2024-02-01", "2024-02-28"], "inclusiveStart")}                              | ${true}
    ${"isBetweenDate inclusiveEnd"}      | ${between(isBetweenDate as never, ["2024-02-28", "2024-02-01", "2024-02-28"], "inclusiveEnd")}                                | ${true}
    ${"isBetweenTime inclusiveStart"}    | ${between(isBetweenTime as never, ["12:00:00", "12:00:00", "13:00:00"], "inclusiveStart")}                                    | ${true}
    ${"isBetweenDateTime inclusiveEnd"}  | ${between(isBetweenDateTime as never, ["2024-02-28T10:00:00", "2024-02-01T00:00:00", "2024-02-28T10:00:00"], "inclusiveEnd")} | ${true}
    ${"isBetweenUnix inclusiveStart"}    | ${between(isBetweenUnix as never, [1000, 1000, 2000], "inclusiveStart")}                                                      | ${true}
    ${"isBetweenUtc inclusiveEnd"}       | ${between(isBetweenUtc as never, ["2024-01-02T00:00:00Z", "2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z"], "inclusiveEnd")}   | ${true}
    ${"isBetweenZoned inclusiveStart"}   | ${between(isBetweenZoned as never, [Z, Z, "2024-06-16T12:00:00+09:00[Asia/Tokyo]"], "inclusiveStart")}                        | ${true}
  `("$label is read only as a boolean", ({ run, expected }) => {
    expect(run(true)).toBe(expected);
    for (const value of ["yes", 1, 0, null, "false", {}, [true]]) {
      expect(run(value), String(typeof value)).toBe(false);
    }
  });

  it.each`
    label                               | run                                                                                                                           | expected
    ${"cycleDate round"}                | ${between(cycleDate as never, ["2022-02-03", "year", 5], "round")}                                                            | ${"2025-02-03"}
    ${"cycleTime round"}                | ${between(cycleTime as never, ["09:22:00", "minute", 15], "round")}                                                           | ${"09:30:00"}
    ${"cycleDateTime round"}            | ${between(cycleDateTime as never, ["2024-06-15T09:22:00", "minute", 15], "round")}                                            | ${"2024-06-15T09:30:00"}
    ${"cycleZoned round"}               | ${between(cycleZoned as never, ["2024-06-15T09:22:00+09:00[Asia/Tokyo]", "minute", 15], "round")}                             | ${"2024-06-15T09:30:00+09:00[Asia/Tokyo]"}
    ${"nextWeekday inclusive"}          | ${between(nextWeekday as never, ["2024-03-15", 5], "inclusive")}                                                              | ${"2024-03-15"}
    ${"previousWeekday inclusive"}      | ${between(previousWeekday as never, ["2024-03-15", 5], "inclusive")}                                                          | ${"2024-03-15"}
    ${"formatUnix includeTimeZoneName"} | ${(flag: unknown) => formatUnix("1710685845000", "en-GB", { epochUnit: "milliseconds", includeTimeZoneName: flag as never })} | ${"17/03/2024, 14:30:45 UTC"}
    ${"formatUtc includeTimeZoneName"}  | ${between(formatUtc as never, ["2024-02-03T14:30:45Z", "en-GB"], "includeTimeZoneName")}                                      | ${"03/02/2024, 14:30:45 UTC"}
    ${"formatDuration zero"}            | ${between(formatDuration as never, ["P1DT0H30M", "en-GB"], "zero")}                                                           | ${"0 years, 0 months, 0 weeks, 1 day, 0 hours, 30 minutes and 0 seconds"}
  `("$label is read only as a boolean", ({ run, expected }) => {
    expect(run(true)).toBe(expected);
    for (const value of ["yes", 1, 0, null, "false", {}, [true]]) {
      expect(run(value), String(typeof value)).toBe("");
    }
  });
});

/**
 * A getter-valued option. The reader of an options object must take each member once, as the type
 * it is declared with, and hand Temporal that one value: a getter that answers with a boxed
 * `String` or a number, or with a valid string the first time and garbage after, must neither be
 * converted nor read again. Each row is the one call; `member` is the option the getter stands in
 * for, `valid` the value it should hold and `expected` the literal result for that value.
 */
type GetterRow = {
  label: string;
  member: string;
  valid: unknown;
  expected: unknown;
  sentinel: unknown;
  run: (options: Record<string, unknown>) => unknown;
};

const NOW_FIELDS = /^\d{4}-\d\d-\d\dT\d\d:\d\d/;
const NY_GAP = "2024-03-10T02:30:00";

const GETTER_ROWS: GetterRow[] = [
  {
    label: "addDate overflow",
    member: "overflow",
    valid: "constrain",
    expected: "2024-02-29",
    sentinel: "",
    run: (o) => addDate("2024-01-31", { months: 1 }, o as never),
  },
  {
    label: "roundTime roundingMode",
    member: "roundingMode",
    valid: "floor",
    expected: "12:34:00",
    sentinel: "",
    run: (o) =>
      roundTime("12:34:56", { smallestUnit: "minute", ...o } as never),
  },
  {
    label: "roundTime smallestUnit",
    member: "smallestUnit",
    valid: "minute",
    expected: "12:34:00",
    sentinel: "",
    run: (o) => roundTime("12:34:56", { roundingMode: "floor", ...o } as never),
  },
  {
    label: "roundZoned roundingMode",
    member: "roundingMode",
    valid: "floor",
    expected: "2024-06-15T12:34:00+02:00[Europe/Berlin]",
    sentinel: "",
    run: (o) =>
      roundZoned("2024-06-15T12:34:56+02:00[Europe/Berlin]", {
        smallestUnit: "minute",
        ...o,
      } as never),
  },
  {
    label: "normalizeDuration largestUnit",
    member: "largestUnit",
    valid: "hours",
    expected: "PT1H30M",
    sentinel: "",
    run: (o) => normalizeDuration("PT90M", o as never),
  },
  {
    label: "normalizeDuration smallestUnit",
    member: "smallestUnit",
    valid: "hours",
    expected: "PT1H",
    sentinel: "",
    run: (o) =>
      normalizeDuration("PT90M", { roundingMode: "floor", ...o } as never),
  },
  {
    label: "normalizeDuration roundingMode",
    member: "roundingMode",
    valid: "floor",
    expected: "PT1H",
    sentinel: "",
    run: (o) =>
      normalizeDuration("PT90M", { smallestUnit: "hours", ...o } as never),
  },
  {
    label: "parseDuration roundingMode",
    member: "roundingMode",
    valid: "ceil",
    expected: "PT2S",
    sentinel: "",
    run: (o) =>
      parseDuration("PT1.567S", { smallestUnit: "second", ...o } as never),
  },
  {
    label: "parseDuration smallestUnit",
    member: "smallestUnit",
    valid: "second",
    expected: "PT2S",
    sentinel: "",
    run: (o) =>
      parseDuration("PT1.567S", { roundingMode: "ceil", ...o } as never),
  },
  {
    label: "diffTime roundingMode",
    member: "roundingMode",
    valid: "ceil",
    expected: 3,
    sentinel: null,
    run: (o) =>
      diffTime("10:00:00", "12:30:00", "hours", {
        smallestUnit: "hours",
        ...o,
      } as never),
  },
  {
    label: "diffTime smallestUnit",
    member: "smallestUnit",
    valid: "hours",
    expected: 3,
    sentinel: null,
    run: (o) =>
      diffTime("10:00:00", "12:30:00", "hours", {
        roundingMode: "ceil",
        ...o,
      } as never),
  },
  {
    label: "diffDate roundingMode",
    member: "roundingMode",
    valid: "ceil",
    expected: 3,
    sentinel: null,
    run: (o) =>
      diffDate("2024-01-01", "2024-01-20", "weeks", {
        smallestUnit: "weeks",
        ...o,
      } as never),
  },
  {
    label: "diffUtc roundingMode",
    member: "roundingMode",
    valid: "ceil",
    expected: 3,
    sentinel: null,
    run: (o) =>
      diffUtc("2024-01-01T00:00:00Z", "2024-01-01T02:30:00Z", "hours", {
        smallestUnit: "hours",
        ...o,
      } as never),
  },
  {
    label: "diffZoned roundingMode",
    member: "roundingMode",
    valid: "ceil",
    expected: 3,
    sentinel: null,
    run: (o) =>
      diffZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-01T02:30:00+00:00[UTC]",
        "hours",
        { smallestUnit: "hours", ...o } as never,
      ),
  },
  {
    label: "setZoned disambiguation",
    member: "disambiguation",
    valid: "earlier",
    expected: "2024-03-10T01:30:00-05:00[America/New_York]",
    sentinel: "",
    run: (o) =>
      setZoned(
        "2024-03-09T02:30:00-05:00[America/New_York]",
        { day: 10 },
        o as never,
      ),
  },
  {
    label: "setZoned offset",
    member: "offset",
    valid: "ignore",
    expected: "2024-11-03T01:45:00-04:00[America/New_York]",
    sentinel: "",
    run: (o) =>
      setZoned(
        "2024-11-03T01:30:00-05:00[America/New_York]",
        { minute: 45 },
        o as never,
      ),
  },
  {
    label: "addZoned disambiguation",
    member: "disambiguation",
    valid: "earlier",
    expected: "2024-03-10T01:30:00-05:00[America/New_York]",
    sentinel: "",
    run: (o) =>
      addZoned(
        "2024-03-09T02:30:00-05:00[America/New_York]",
        { days: 1 },
        o as never,
      ),
  },
  {
    label: "convertPlainDateTimeToZoned disambiguation",
    member: "disambiguation",
    valid: "earlier",
    expected: "2024-03-10T01:30:00.000-05:00[America/New_York]",
    sentinel: "",
    run: (o) =>
      convertPlainDateTimeToZoned(NY_GAP, "America/New_York", o as never),
  },
  {
    label: "convertPlainDateTimeToZoned smallestUnit",
    member: "smallestUnit",
    valid: "second",
    expected: "2024-06-15T10:30:45-04:00[America/New_York]",
    sentinel: "",
    run: (o) =>
      convertPlainDateTimeToZoned(
        "2024-06-15T10:30:45.123",
        "America/New_York",
        o as never,
      ),
  },
  {
    label: "resolveLocal disambiguation",
    member: "disambiguation",
    valid: "earlier",
    expected: "2024-03-10T06:30:00Z",
    sentinel: "",
    run: (o) => resolveLocal(NY_GAP, "America/New_York", o as never),
  },
  {
    label: "getZonedNow smallestUnit",
    member: "smallestUnit",
    valid: "minute",
    expected: "X+00:00[UTC]",
    sentinel: "",
    run: (o) => getZonedNow("UTC", o as never).replace(NOW_FIELDS, "X"),
  },
];

describe("a getter-valued Temporal option is read once, as its declared type", () => {
  const GARBAGE = "not-an-option";

  it.each(GETTER_ROWS)(
    "returns the sentinel for $label when the getter answers a boxed String",
    ({ member, valid, run, sentinel }) => {
      let reads = 0;
      const options = {
        get [member]() {
          reads += 1;
          // eslint-disable-next-line no-new-wrappers -- a boxed string is the case under test
          return new String(valid as string);
        },
      };
      expect(run(options)).toStrictEqual(sentinel);
      expect(reads).toBeLessThanOrEqual(1);
    },
  );

  it.each(GETTER_ROWS)(
    "returns the sentinel for $label when the getter answers a number",
    ({ member, run, sentinel }) => {
      const options = {
        get [member]() {
          return 1;
        },
      };
      expect(run(options)).toStrictEqual(sentinel);
    },
  );

  it.each(GETTER_ROWS)(
    "returns the answer for $label when the getter is valid once and garbage after",
    ({ member, valid, run, expected }) => {
      let reads = 0;
      const options = {
        get [member]() {
          reads += 1;
          return reads === 1 ? valid : GARBAGE;
        },
      };
      expect(run(options)).toStrictEqual(expected);
      expect(reads).toBeLessThanOrEqual(1);
    },
  );

  it.each(GETTER_ROWS)(
    "returns the answer for $label when the getter holds the valid string",
    ({ member, valid, run, expected }) => {
      const options = {
        get [member]() {
          return valid;
        },
      };
      expect(run(options)).toStrictEqual(expected);
    },
  );
});

describe("a getter-valued number option is read once, as a number", () => {
  const NUMBER_ROWS = [
    {
      label: "roundTime roundingIncrement",
      member: "roundingIncrement",
      valid: 5,
      expected: "12:35:00",
      sentinel: "",
      run: (o: Record<string, unknown>): unknown =>
        roundTime("12:34:56", { smallestUnit: "minute", ...o } as never),
    },
    {
      label: "diffUtc roundingIncrement",
      member: "roundingIncrement",
      valid: 2,
      expected: 4,
      sentinel: null,
      run: (o: Record<string, unknown>): unknown =>
        diffUtc("2024-01-01T00:00:00Z", "2024-01-01T02:30:00Z", "hours", {
          smallestUnit: "hours",
          roundingMode: "ceil",
          ...o,
        } as never),
    },
    {
      label: "parseDuration fractionalSecondDigits",
      member: "fractionalSecondDigits",
      valid: 1,
      expected: "PT1.5S",
      sentinel: "",
      run: (o: Record<string, unknown>): unknown =>
        parseDuration("PT1.567S", o as never),
    },
  ];

  it.each(NUMBER_ROWS)(
    "returns the empty result for $label when the getter answers the number as text",
    ({ member, valid, run, sentinel }) => {
      const options = {
        get [member]() {
          return String(valid);
        },
      };
      expect(run(options)).toBe(sentinel);
    },
  );

  it.each(NUMBER_ROWS)(
    "returns the answer for $label when the getter is valid once and garbage after",
    ({ member, valid, expected, run }) => {
      let reads = 0;
      const options = {
        get [member]() {
          reads += 1;
          return reads === 1 ? valid : "garbage";
        },
      };
      expect(run(options)).toStrictEqual(expected);
      expect(reads).toBeLessThanOrEqual(1);
    },
  );

  it.each`
    getterAnswer    | label
    ${() => "auto"} | ${"the string auto"}
    ${() => 3}      | ${"the number 3"}
  `(
    "reads $label from a fractionalSecondDigits getter as the digits asked for",
    ({ getterAnswer }) => {
      const options = {
        get fractionalSecondDigits() {
          return (getterAnswer as () => unknown)();
        },
      };
      expect(parseDuration("PT1.567S", options as never)).toBe("PT1.567S");
    },
  );
});

describe("an option on the formatter and parser seams is read as its declared type", () => {
  const BOXED = {
    // eslint-disable-next-line no-new-wrappers -- a boxed string is the case under test
    string: () => new String("minute"),
    // eslint-disable-next-line no-new-wrappers -- a boxed number is the case under test
    number: () => new Number(2000),
  };

  it.each`
    label                                      | run
    ${"formatHL7 precision boxed String"}      | ${() => formatHL7("2024-06-15T10:30:45", { precision: BOXED.string() } as never)}
    ${"formatFHIR precision boxed String"}     | ${() => formatFHIR("2024-06-15T10:30:45", "dateTime", { precision: BOXED.string() } as never)}
    ${"formatHL7 precision number"}            | ${() => formatHL7("2024-06-15T10:30:45", { precision: 1 } as never)}
    ${"formatFHIR precision number"}           | ${() => formatFHIR("2024-06-15T10:30:45", "dateTime", { precision: 1 } as never)}
    ${"formatTimeZoneName style boxed String"} | ${() => formatTimeZoneName("Europe/Berlin", "en", { style: new String("short") } as never)}
    ${"formatTimeZoneName style number"}       | ${() => formatTimeZoneName("Europe/Berlin", "en", { style: 1 } as never)}
    ${"diffDateAsDuration rounding boxed"}     | ${() => diffDateAsDuration("2024-01-01", "2024-03-15", "months", { toStringRoundingMode: new String("floor") } as never)}
    ${"diffDateAsDuration rounding number"}    | ${() => diffDateAsDuration("2024-01-01", "2024-03-15", "months", { toStringRoundingMode: 1 } as never)}
    ${"parseDateWithPattern yearWindow boxed"} | ${() => parseDateWithPattern("15.03.24", "dd.MM.yy", undefined, { yearWindow: BOXED.number() } as never)}
    ${"parseDateWithPattern yearWindow text"}  | ${() => parseDateWithPattern("15.03.24", "dd.MM.yy", undefined, { yearWindow: "2000" } as never)}
  `("returns the sentinel for $label", ({ run }) => {
    expect(run()).toBe("");
  });

  it.each`
    label           | member          | value
    ${"precision"}  | ${"precision"}  | ${"minute"}
    ${"yearWindow"} | ${"yearWindow"} | ${2000}
  `(
    "reads the $label getter once for formatHL7 and parseDateWithPattern",
    ({ member, value }) => {
      let reads = 0;
      const options = {
        get [member]() {
          reads += 1;
          return reads === 1 ? value : "garbage";
        },
      };
      const out =
        member === "precision"
          ? formatHL7("2024-06-15T10:30:45", options as never)
          : parseDateWithPattern(
              "15.03.24",
              "dd.MM.yy",
              undefined,
              options as never,
            );
      expect(out).toBe(member === "precision" ? "202406151030" : "2024-03-15");
      expect(reads).toBeLessThanOrEqual(1);
    },
  );
});
