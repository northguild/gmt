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
  cutoffSchedule,
  evaluateDutyLog,
  formatDate,
  formatRelativeTime,
  formatTime,
  formatZonedDateTime,
  getLocaleMonthNames,
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
    STRING_ROWS.flatMap((row) =>
      notStrings(row.valid as string).map((value, index) => ({
        ...row,
        value,
        label: `${row.family}: ${row.member}, bad value #${index + 1}`,
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
