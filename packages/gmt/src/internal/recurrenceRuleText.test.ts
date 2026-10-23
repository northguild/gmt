import { checkRecurrenceRule } from "./recurrenceRuleText";

const base = { frequency: "daily", interval: 1, firstDayOfWeek: 1 } as const;

describe("checkRecurrenceRule", () => {
  it.each`
    name                              | input
    ${"empty array"}                  | ${{ ...base, byMonth: [] }}
    ${"fractional count"}             | ${{ ...base, count: 1.5 }}
    ${"count 0"}                      | ${{ ...base, count: 0 }}
    ${"count past safe integer"}      | ${{ ...base, count: 2 ** 53 }}
    ${"interval 0"}                   | ${{ ...base, interval: 0 }}
    ${"interval missing"}             | ${{ frequency: "daily", firstDayOfWeek: 1 }}
    ${"firstDayOfWeek 0"}             | ${{ ...base, firstDayOfWeek: 0 }}
    ${"firstDayOfWeek 8"}             | ${{ ...base, firstDayOfWeek: 8 }}
    ${"firstDayOfWeek missing"}       | ${{ frequency: "daily", interval: 1 }}
    ${"frequency upper case"}         | ${{ ...base, frequency: "DAILY" }}
    ${"frequency missing"}            | ${{ interval: 1, firstDayOfWeek: 1 }}
    ${"until and count"}              | ${{ ...base, count: 2, until: "2024-01-01" }}
    ${"until not canonical (basic)"}  | ${{ ...base, until: "20240101" }}
    ${"until with second 60"}         | ${{ ...base, until: "2024-01-01T00:00:60Z" }}
    ${"until Feb 30"}                 | ${{ ...base, until: "2024-02-30" }}
    ${"until with offset"}            | ${{ ...base, until: "2024-01-01T00:00:00+01:00" }}
    ${"byDay nth 0"}                  | ${{ ...base, frequency: "monthly", byDay: [{ day: 1, nthOfPeriod: 0 }] }}
    ${"byDay nth 54"}                 | ${{ ...base, frequency: "monthly", byDay: [{ day: 1, nthOfPeriod: 54 }] }}
    ${"byDay day 8"}                  | ${{ ...base, byDay: [{ day: 8 }] }}
    ${"byDay nth with daily"}         | ${{ ...base, byDay: [{ day: 1, nthOfPeriod: 1 }] }}
    ${"byDay empty"}                  | ${{ ...base, byDay: [] }}
    ${"byMonth 0"}                    | ${{ ...base, byMonth: [0] }}
    ${"byMonth fractional"}           | ${{ ...base, byMonth: [1.5] }}
    ${"byMonth NaN"}                  | ${{ ...base, byMonth: [Number.NaN] }}
    ${"byMonth string"}               | ${{ ...base, byMonth: ["1"] }}
    ${"byMonthDay 0"}                 | ${{ ...base, byMonthDay: [0] }}
    ${"byMonthDay not an array"}      | ${{ ...base, byMonthDay: 1 }}
    ${"bySetPosition alone"}          | ${{ ...base, bySetPosition: [1] }}
    ${"bySetPosition 0"}              | ${{ ...base, byMonth: [1], bySetPosition: [0] }}
    ${"bySetPosition 367"}            | ${{ ...base, byMonth: [1], bySetPosition: [367] }}
    ${"count string"}                 | ${{ ...base, count: "3" }}
    ${"count NaN"}                    | ${{ ...base, count: Number.NaN }}
    ${"count Infinity"}               | ${{ ...base, count: Number.POSITIVE_INFINITY }}
    ${"count negative"}               | ${{ ...base, count: -1 }}
    ${"interval fractional"}          | ${{ ...base, interval: 1.5 }}
    ${"interval string"}              | ${{ ...base, interval: "1" }}
    ${"interval past safe integer"}   | ${{ ...base, interval: 2 ** 53 }}
    ${"firstDayOfWeek fractional"}    | ${{ ...base, firstDayOfWeek: 1.5 }}
    ${"firstDayOfWeek string"}        | ${{ ...base, firstDayOfWeek: "MO" }}
    ${"frequency not a string"}       | ${{ ...base, frequency: 1 }}
    ${"frequency unknown"}            | ${{ ...base, frequency: "fortnightly" }}
    ${"until not a string"}           | ${{ ...base, until: 20240101 }}
    ${"until empty"}                  | ${{ ...base, until: "" }}
    ${"until fractional seconds"}     | ${{ ...base, until: "2024-01-01T00:00:00.5Z" }}
    ${"until lower-case z"}           | ${{ ...base, until: "2024-01-01T00:00:00z" }}
    ${"until space separator"}        | ${{ ...base, until: "2024-01-01 00:00:00" }}
    ${"until second 60, floating"}    | ${{ ...base, until: "2024-01-01T00:00:60" }}
    ${"until month 13"}               | ${{ ...base, until: "2024-13-01" }}
    ${"until without seconds"}        | ${{ ...base, until: "2024-01-01T00:00Z" }}
    ${"until null"}                   | ${{ ...base, until: null }}
    ${"count null"}                   | ${{ ...base, count: null }}
    ${"byDay entry not an object"}    | ${{ ...base, byDay: ["MO"] }}
    ${"byDay entry without day"}      | ${{ ...base, byDay: [{}] }}
    ${"byDay day 0"}                  | ${{ ...base, byDay: [{ day: 0 }] }}
    ${"byDay day fractional"}         | ${{ ...base, byDay: [{ day: 1.5 }] }}
    ${"byDay nth fractional"}         | ${{ ...base, frequency: "monthly", byDay: [{ day: 1, nthOfPeriod: 1.5 }] }}
    ${"byDay nth string"}             | ${{ ...base, frequency: "monthly", byDay: [{ day: 1, nthOfPeriod: "1" }] }}
    ${"byDay nth -54"}                | ${{ ...base, frequency: "monthly", byDay: [{ day: 1, nthOfPeriod: -54 }] }}
    ${"byDay nth null"}               | ${{ ...base, frequency: "monthly", byDay: [{ day: 1, nthOfPeriod: null }] }}
    ${"byDay not an array"}           | ${{ ...base, byDay: { day: 1 } }}
    ${"byDay nth with weekly"}        | ${{ ...base, frequency: "weekly", byDay: [{ day: 1, nthOfPeriod: -1 }] }}
    ${"byDay nth, yearly, byWeekNo"}  | ${{ ...base, frequency: "yearly", byWeekNo: [1], byDay: [{ day: 1, nthOfPeriod: 1 }] }}
    ${"byMonthDay with weekly"}       | ${{ ...base, frequency: "weekly", byMonthDay: [1] }}
    ${"byYearDay with daily"}         | ${{ ...base, byYearDay: [1] }}
    ${"byYearDay with weekly"}        | ${{ ...base, frequency: "weekly", byYearDay: [1] }}
    ${"byYearDay with monthly"}       | ${{ ...base, frequency: "monthly", byYearDay: [1] }}
    ${"byWeekNo with monthly"}        | ${{ ...base, frequency: "monthly", byWeekNo: [1] }}
    ${"byWeekNo with daily"}          | ${{ ...base, byWeekNo: [1] }}
    ${"byWeekNo 54"}                  | ${{ ...base, frequency: "yearly", byWeekNo: [54] }}
    ${"byWeekNo 0"}                   | ${{ ...base, frequency: "yearly", byWeekNo: [0] }}
    ${"byYearDay 367"}                | ${{ ...base, frequency: "yearly", byYearDay: [367] }}
    ${"byMonthDay -32"}               | ${{ ...base, byMonthDay: [-32] }}
    ${"byMonth 13"}                   | ${{ ...base, byMonth: [13] }}
    ${"byMonth -1"}                   | ${{ ...base, byMonth: [-1] }}
    ${"byHour 24"}                    | ${{ ...base, byHour: [24] }}
    ${"byHour -1"}                    | ${{ ...base, byHour: [-1] }}
    ${"byMinute 60"}                  | ${{ ...base, byMinute: [60] }}
    ${"bySecond 61"}                  | ${{ ...base, bySecond: [61] }}
    ${"bySecond Infinity"}            | ${{ ...base, bySecond: [Number.POSITIVE_INFINITY] }}
    ${"one bad item among good ones"} | ${{ ...base, byHour: [1, 2, 24] }}
    ${"sparse array"}                 | ${{ ...base, byHour: Object.assign([], { 1: 1 }) }}
    ${"array-like object"}            | ${{ ...base, byHour: { 0: 1, length: 1 } }}
    ${"undefined"}                    | ${undefined}
    ${"a number"}                     | ${1}
    ${"a function"}                   | ${() => base}
    ${"null"}                         | ${null}
    ${"a string"}                     | ${"FREQ=DAILY"}
    ${"an array"}                     | ${[]}
  `("returns null for $name", ({ input }) => {
    expect(checkRecurrenceRule(input)).toBeNull();
  });

  it("sorts an unsorted list into a fresh frozen record and leaves the input alone", () => {
    const input = { ...base, frequency: "yearly", byMonth: [3, 1] };
    const result = checkRecurrenceRule(input);
    expect(result).toStrictEqual({
      frequency: "yearly",
      interval: 1,
      firstDayOfWeek: 1,
      byMonth: [1, 3],
    });
    expect(input.byMonth).toStrictEqual([3, 1]);
    expect(result).not.toBe(input);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.byMonth)).toBe(true);
  });

  it("deduplicates and sorts byDay entries", () => {
    const result = checkRecurrenceRule({
      ...base,
      frequency: "monthly",
      byDay: [{ day: 5, nthOfPeriod: 2 }, { day: 5 }, { day: 5 }, { day: 1 }],
    });
    expect(result?.byDay).toStrictEqual([
      { day: 1 },
      { day: 5 },
      { day: 5, nthOfPeriod: 2 },
    ]);
  });

  it("treats an explicit undefined member as absent", () => {
    expect(
      checkRecurrenceRule({ ...base, until: undefined, count: 3 }),
    ).toStrictEqual({
      ...base,
      count: 3,
    });
  });

  it("ignores unknown members", () => {
    expect(checkRecurrenceRule({ ...base, extra: 1 })).toStrictEqual(base);
  });

  it("returns null instead of throwing on a hostile getter", () => {
    const hostile = {
      ...base,
      get byMonth(): never {
        throw new Error("boom");
      },
    };
    expect(checkRecurrenceRule(hostile)).toBeNull();
  });

  it.each`
    name                                | input                                                                                                   | expected
    ${"UTC date-time until"}            | ${{ ...base, until: "2024-01-01T12:00:00Z" }}                                                           | ${{ ...base, until: "2024-01-01T12:00:00Z" }}
    ${"floating date-time until"}       | ${{ ...base, until: "2024-01-01T12:00:00" }}                                                            | ${{ ...base, until: "2024-01-01T12:00:00" }}
    ${"date until"}                     | ${{ ...base, until: "2024-02-29" }}                                                                     | ${{ ...base, until: "2024-02-29" }}
    ${"count 1"}                        | ${{ ...base, count: 1 }}                                                                                | ${{ ...base, count: 1 }}
    ${"largest count and interval"}     | ${{ ...base, count: 9007199254740991, interval: 9007199254740991 }}                                     | ${{ ...base, count: 9007199254740991, interval: 9007199254740991 }}
    ${"firstDayOfWeek 7"}               | ${{ ...base, firstDayOfWeek: 7 }}                                                                       | ${{ ...base, firstDayOfWeek: 7 }}
    ${"signed lists at the limits"}     | ${{ ...base, frequency: "yearly", byMonthDay: [31, -31], byYearDay: [-366, 366], byWeekNo: [53, -53] }} | ${{ ...base, frequency: "yearly", byMonthDay: [-31, 31], byYearDay: [-366, 366], byWeekNo: [-53, 53] }}
    ${"unsigned lists at the limits"}   | ${{ ...base, bySecond: [60, 0], byMinute: [59, 0], byHour: [23, 0], byMonth: [12, 1] }}                 | ${{ ...base, bySecond: [0, 60], byMinute: [0, 59], byHour: [0, 23], byMonth: [1, 12] }}
    ${"signed zero reads as 0"}         | ${{ ...base, byHour: [-0] }}                                                                            | ${{ ...base, byHour: [0] }}
    ${"duplicates collapse"}            | ${{ ...base, byHour: [5, 5, 5] }}                                                                       | ${{ ...base, byHour: [5] }}
    ${"bySetPosition with byDay"}       | ${{ ...base, frequency: "monthly", byDay: [{ day: 1 }], bySetPosition: [-1] }}                          | ${{ ...base, frequency: "monthly", byDay: [{ day: 1 }], bySetPosition: [-1] }}
    ${"ordinal byDay, monthly"}         | ${{ ...base, frequency: "monthly", byDay: [{ day: 7, nthOfPeriod: -53 }] }}                             | ${{ ...base, frequency: "monthly", byDay: [{ day: 7, nthOfPeriod: -53 }] }}
    ${"ordinal byDay, yearly, byMonth"} | ${{ ...base, frequency: "yearly", byMonth: [1], byDay: [{ day: 1, nthOfPeriod: 53 }] }}                 | ${{ ...base, frequency: "yearly", byMonth: [1], byDay: [{ day: 1, nthOfPeriod: 53 }] }}
    ${"plain byDay, yearly, byWeekNo"}  | ${{ ...base, frequency: "yearly", byWeekNo: [20], byDay: [{ day: 1 }] }}                                | ${{ ...base, frequency: "yearly", byWeekNo: [20], byDay: [{ day: 1 }] }}
    ${"each frequency: yearly"}         | ${{ ...base, frequency: "yearly" }}                                                                     | ${{ ...base, frequency: "yearly" }}
    ${"each frequency: secondly"}       | ${{ ...base, frequency: "secondly" }}                                                                   | ${{ ...base, frequency: "secondly" }}
  `("accepts $name", ({ input, expected }) => {
    expect(checkRecurrenceRule(input)).toStrictEqual(expected);
  });

  it("emits members in the documented key order whatever order the caller used", () => {
    const result = checkRecurrenceRule({
      bySetPosition: [1],
      byMonth: [1],
      count: 2,
      firstDayOfWeek: 1,
      interval: 1,
      frequency: "yearly",
    });
    expect(Object.keys(result ?? {})).toStrictEqual([
      "frequency",
      "interval",
      "firstDayOfWeek",
      "count",
      "byMonth",
      "bySetPosition",
    ]);
  });

  it("freezes every byDay entry and does not alias the caller's entries", () => {
    const entry = { day: 1, nthOfPeriod: 1 };
    const result = checkRecurrenceRule({
      ...base,
      frequency: "monthly",
      byDay: [entry],
    });
    expect(Object.isFrozen(result?.byDay?.[0])).toBe(true);
    expect(result?.byDay?.[0]).not.toBe(entry);
    expect(Object.isFrozen(entry)).toBe(false);
  });

  it("returns an equal record when a frozen result is checked again", () => {
    const first = checkRecurrenceRule({
      ...base,
      frequency: "monthly",
      byDay: [{ day: 5, nthOfPeriod: -1 }],
    });
    expect(checkRecurrenceRule(first)).toStrictEqual(first);
  });
});
