/**
 * The holiday codecs: every `parse` to `format` round trip, the rejections, and
 * the library's expected values read through a parsed rule line.
 */
import type {
  CalendarSystem,
  HolidayRule,
  IsoWeekday,
  ObservancePolicy,
} from "@northguild/gmt";
import {
  MAX_RULES,
  cleanRuleName,
  formatPolicyText,
  formatRuleLine,
  formatRuleLines,
  parsePolicyText,
  parseRuleLine,
  parseRuleLines,
} from "./holiday-codec";
import { lib } from "~/test/holiday-lib";

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

describe("policy text", () => {
  it("reads the three tokens", () => {
    expect(parsePolicyText("6<5")).toEqual({ 6: { previous: 5 } });
    expect(parsePolicyText("7>1")).toEqual({ 7: { next: 1 } });
    expect(parsePolicyText("7w")).toEqual({ 7: "nextWorkingDay" });
  });

  it("reads a blank as no shift at all", () => {
    expect(parsePolicyText("")).toEqual({});
    expect(parsePolicyText("   ")).toEqual({});
  });

  it("writes tokens in ascending weekday order, whatever order they were read in", () => {
    expect(parsePolicyText("7>1 6<5")).toEqual({
      6: { previous: 5 },
      7: { next: 1 },
    });
    expect(formatPolicyText(parsePolicyText("7>1 6<5")!)).toBe("6<5 7>1");
    expect(formatPolicyText({})).toBe("");
  });

  it("round-trips every single-weekday policy the editor can offer", () => {
    let checked = 0;
    for (const weekday of WEEKDAYS) {
      const texts = [`${weekday}w`];
      for (const other of WEEKDAYS) {
        texts.push(`${weekday}<${other}`, `${weekday}>${other}`);
      }
      for (const text of texts) {
        const policy = parsePolicyText(text);
        expect(policy, text).not.toBeNull();
        expect(formatPolicyText(policy!), text).toBe(text);
        expect(parsePolicyText(formatPolicyText(policy!)), text).toEqual(
          policy,
        );
        checked++;
      }
    }
    expect(checked).toBe(WEEKDAYS.length * (1 + 2 * WEEKDAYS.length));
  });

  it("round-trips a policy that shifts several weekdays", () => {
    const policy: ObservancePolicy = {
      1: "nextWorkingDay",
      6: { previous: 5 },
      7: { next: 1 },
    };
    expect(parsePolicyText(formatPolicyText(policy))).toEqual(policy);
  });

  it("rejects text it cannot read", () => {
    for (const text of [
      "6",
      "6<",
      "<5",
      "8<1",
      "6<8",
      "0w",
      "6x",
      "6 <5",
      "six",
      "6<5,7>1",
      "6w5",
      "6<5 6>1",
      "6<5 6<5",
    ]) {
      expect(parsePolicyText(text), text).toBeNull();
    }
  });

  it("does not judge meaning: a shift onto its own weekday still parses", () => {
    const policy = parsePolicyText("6<6");
    expect(policy).toEqual({ 6: { previous: 6 } });
    // The library judges it, and its sentinel is what the widget shows.
    expect(lib.observedDate("2027-12-25", policy!)).toBe("");
  });
});

describe("rule lines", () => {
  const rules: HolidayRule[] = [
    { name: "Fixed", kind: "fixed", month: 3, day: 9 },
    {
      name: "Fixed shifted",
      kind: "fixed",
      month: 12,
      day: 25,
      observed: { 6: { previous: 5 }, 7: "nextWorkingDay" },
    },
    {
      name: "Other calendar",
      kind: "calendarFixed",
      calendar: "islamic-umalqura",
      monthCode: "M10",
      day: 1,
    },
    {
      name: "Other calendar shifted",
      kind: "calendarFixed",
      calendar: "hebrew",
      monthCode: "M07",
      day: 15,
      observed: { 7: { next: 1 } },
    },
    { name: "Third Wednesday", kind: "nthWeekday", month: 3, weekday: 3, n: 3 },
    {
      name: "Last Sunday",
      kind: "nthWeekday",
      month: 10,
      weekday: 7,
      n: "last",
    },
    { name: "Second to last", kind: "nthWeekday", month: 5, weekday: 1, n: -2 },
    { name: "Easter minus two", kind: "easterRelative", offsetDays: -2 },
    {
      name: "Julian plus one",
      kind: "easterRelative",
      offsetDays: 1,
      computus: "julian",
    },
    { name: "Easter itself", kind: "easterRelative", offsetDays: 0 },
    {
      name: "One-off",
      kind: "dates",
      dates: ["2026-03-20", "2026-04-02"],
    },
    { name: "No dates", kind: "dates", dates: [] },
  ];

  it("round-trips each kind", () => {
    for (const rule of rules) {
      const line = formatRuleLine(rule);
      expect(parseRuleLine(line), line).toEqual(rule);
    }
  });

  it("writes the documented shapes", () => {
    expect(formatRuleLine(rules[0]!)).toBe("Fixed;f;03-09");
    expect(formatRuleLine(rules[1]!)).toBe("Fixed shifted;f;12-25;6<5 7w");
    expect(formatRuleLine(rules[2]!)).toBe(
      "Other calendar;c;islamic-umalqura;M10;1",
    );
    expect(formatRuleLine(rules[5]!)).toBe("Last Sunday;n;10;7;last");
    expect(formatRuleLine(rules[8]!)).toBe("Julian plus one;e;1;j");
    expect(formatRuleLine(rules[10]!)).toBe("One-off;d;2026-03-20,2026-04-02");
  });

  it("keeps every ordinal the type allows", () => {
    for (const n of [1, 2, 3, 4, 5, -1, -2, -3, -4, -5, "last"] as const) {
      const rule: HolidayRule = {
        name: "n",
        kind: "nthWeekday",
        month: 1,
        weekday: 1,
        n,
      };
      expect(parseRuleLine(formatRuleLine(rule)), String(n)).toEqual(rule);
    }
  });

  it("leaves a blank policy out of the rule, never fills it in", () => {
    for (const line of ["A;f;01-01", "A;f;01-01;", "A;f;01-01;  "]) {
      const rule = parseRuleLine(line);
      expect(rule, line).not.toBeNull();
      expect("observed" in rule!, line).toBe(false);
    }
    const calendar = parseRuleLine("A;c;hebrew;M07;15;");
    expect("observed" in calendar!).toBe(false);
  });

  it("writes no policy for an empty one", () => {
    const rule: HolidayRule = {
      name: "A",
      kind: "fixed",
      month: 1,
      day: 1,
      observed: {},
    };
    expect(formatRuleLine(rule)).toBe("A;f;01-01");
  });

  it("strips separators from a name", () => {
    expect(cleanRuleName("  A;B,\nC ")).toBe("ABC");
    expect(
      formatRuleLine({ name: "A;B,C", kind: "fixed", month: 1, day: 1 }),
    ).toBe("ABC;f;01-01");
  });

  it("rejects a line it cannot read", () => {
    for (const line of [
      "",
      "A",
      "A;x;01-01",
      "A;f",
      "A;f;1/1",
      "A;f;01-01;6<",
      "A;f;01-01;6<5;extra",
      "A;c;hebrew;M07",
      "A;c;hebrew;M07;x",
      "A;n;3;3",
      "A;n;3;8;3",
      "A;n;3;3;6",
      "A;n;3;3;0",
      "A;n;3;3;first",
      "A;n;x;3;3",
      "A;e",
      "A;e;1.5",
      "A;e;1;x",
      "A;e;1;j;extra",
      "A;d",
      "A;d;2026-01-01;extra",
    ]) {
      expect(parseRuleLine(line), line).toBeNull();
    }
  });

  it("keeps a half-filled row: a blank number is NaN, a blank calendar or month code empty", () => {
    const blanks: HolidayRule[] = [
      { name: "", kind: "fixed", month: Number.NaN, day: Number.NaN },
      { name: "A", kind: "fixed", month: 5, day: Number.NaN },
      {
        name: "A",
        kind: "calendarFixed",
        calendar: "" as CalendarSystem,
        monthCode: "",
        day: Number.NaN,
      },
      { name: "A", kind: "nthWeekday", month: Number.NaN, weekday: 1, n: 1 },
      { name: "A", kind: "easterRelative", offsetDays: Number.NaN },
    ];
    for (const rule of blanks) {
      const line = formatRuleLine(rule);
      expect(line).not.toContain("NaN");
      expect(parseRuleLine(line), line).toEqual(rule);
      expect(lib.isValidHolidayRule(parseRuleLine(line)), line).toBe(false);
    }
    expect(formatRuleLine(blanks[1]!)).toBe("A;f;05-");
  });

  it("does not judge validity: the library does", () => {
    const month13 = parseRuleLine("A;f;13-01");
    expect(month13).toEqual({ name: "A", kind: "fixed", month: 13, day: 1 });
    expect(lib.isValidHolidayRule(month13)).toBe(false);
    const noDates = parseRuleLine("A;d;not-a-date");
    expect(lib.isValidHolidayRule(noDates)).toBe(false);
    expect(lib.isValidHolidayRule(parseRuleLine("A;f;01-01"))).toBe(true);
  });

  it("makes only rules the library accepts from what the editor writes", () => {
    for (const rule of rules) {
      expect(lib.isValidHolidayRule(parseRuleLine(formatRuleLine(rule)))).toBe(
        lib.isValidHolidayRule(rule),
      );
    }
  });

  it("cuts a list of lines at MAX_RULES, in both directions", () => {
    const text = Array.from(
      { length: MAX_RULES + 3 },
      (_, i) => `Day ${i + 1};f;01-${String(i + 1).padStart(2, "0")}`,
    ).join("\n");
    expect(parseRuleLines(text)).toHaveLength(MAX_RULES);
    const parsed = parseRuleLines(text) as HolidayRule[];
    expect(formatRuleLines(parsed).split("\n")).toHaveLength(MAX_RULES);
    expect(formatRuleLines([...parsed, ...parsed]).split("\n")).toHaveLength(
      MAX_RULES,
    );
  });

  it("keeps an unreadable line as a null slot and skips blank lines", () => {
    expect(parseRuleLines("A;f;01-01\n\nnonsense\nB;f;02-01")).toEqual([
      { name: "A", kind: "fixed", month: 1, day: 1 },
      null,
      { name: "B", kind: "fixed", month: 2, day: 1 },
    ]);
  });
});

describe("the library's expected values, through the codec", () => {
  it("six fixed and Easter-relative closing days, 2026, weekend Saturday and Sunday", () => {
    const rules = [
      "Day one;f;01-01",
      "Two before Easter;e;-2",
      "One after Easter;e;1",
      "Spring day;f;05-01",
      "Winter day;f;12-25",
      "Winter day two;f;12-26",
    ].map((line) => parseRuleLine(line)!);
    const calendar = lib.buildBusinessCalendar({
      timeZone: "UTC",
      weekend: [6, 7],
      rules,
      years: { from: 2026, to: 2026 },
    });
    expect(calendar?.holidays).toEqual([
      "2026-01-01",
      "2026-04-03",
      "2026-04-06",
      "2026-05-01",
      "2026-12-25",
      "2026-12-26",
    ]);
  });

  it("two adjacent holidays that move to the next working day, 2021", () => {
    const rules = [
      parseRuleLine("First;f;12-25;6w 7w")!,
      parseRuleLine("Second;f;12-26;6w 7w")!,
    ];
    const calendar = lib.buildBusinessCalendar({
      timeZone: "UTC",
      weekend: [6, 7],
      rules,
      years: { from: 2021, to: 2021 },
    });
    expect(calendar?.holidays).toEqual(["2021-12-27", "2021-12-28"]);
  });

  it("a Saturday new year observed on the Friday before, read in 2027", () => {
    const rule = parseRuleLine("Year start;f;01-01;6<5")!;
    const calendar = lib.buildBusinessCalendar({
      timeZone: "UTC",
      weekend: [6, 7],
      rules: [rule],
      years: { from: 2027, to: 2027 },
    });
    expect(calendar?.holidays).toEqual(["2027-01-01", "2027-12-31"]);
  });

  it("another calendar's month and day, by its own rules", () => {
    const first = parseRuleLine("Month start;c;islamic-umalqura;M10;1")!;
    expect(lib.holidayDates(first, 2026)).toEqual(["2026-03-20"]);
    const mid = parseRuleLine("Month middle;c;hebrew;M07;15")!;
    expect(lib.holidayDates(mid, 2026)).toEqual(["2026-04-02"]);
  });
});
