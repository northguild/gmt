/**
 * `holiday-widgets.ts` against the real gmt modules through
 * `~/test/holiday-lib`. Every library result a test states is the index's
 * expected value; where a test can ask the library instead of stating a value,
 * it does.
 */
import { readFileSync } from "node:fs";
import type { HolidayRule } from "@northguild/gmt";
import { parseRuleLine } from "./holiday-codec";
import {
  MARK_KINDS,
  attributeRules,
  cellKinds,
  legendHtml,
  marksFromAttribution,
  monthGridHtml,
  policyEditorHtml,
  policySummary,
  policyTextFromSelects,
  selectValueOf,
  weekRowsHtml,
  type AttributionSpec,
  type CellMark,
} from "./holiday-widgets";
import { parsePolicyText } from "./holiday-codec";
import { lib } from "~/test/holiday-lib";

const rule = (line: string): HolidayRule => parseRuleLine(line)!;

function spec(rules: HolidayRule[]): AttributionSpec {
  return { timeZone: "UTC", weekend: [6, 7], rules };
}

/** The observed dates of every row that fall in `year`, sorted and unique. */
function observedInYear(
  rows: ReturnType<typeof attributeRules>["rows"],
  year: number,
): string[] {
  return [
    ...new Set(
      rows
        .flatMap((row) => row.pairs.map((pair) => pair.observed))
        .filter((date) => date !== "" && Number.parseInt(date, 10) === year),
    ),
  ].sort();
}

interface Case {
  name: string;
  rules: HolidayRule[];
  year: number;
}

const CASES: Case[] = [
  {
    name: "six fixed and Easter-relative closing days",
    year: 2026,
    rules: [
      rule("Day one;f;01-01"),
      rule("Two before Easter;e;-2"),
      rule("One after Easter;e;1"),
      rule("Spring day;f;05-01"),
      rule("Winter day;f;12-25"),
      rule("Winter day two;f;12-26"),
    ],
  },
  {
    name: "two adjacent holidays, next working day",
    year: 2021,
    rules: [rule("First;f;12-25;6w 7w"), rule("Second;f;12-26;6w 7w")],
  },
  {
    name: "a one-day rule then a list that already closes the target",
    year: 2021,
    rules: [rule("A;f;12-26;7w"), rule("B;d;2021-12-27")],
  },
  {
    name: "the same list in the other order",
    year: 2021,
    rules: [rule("B;d;2021-12-27"), rule("A;f;12-26;7w")],
  },
  {
    name: "a Saturday new year observed in the year before",
    year: 2027,
    rules: [rule("Year start;f;01-01;6<5")],
  },
  {
    name: "one date listed twice, once shifted",
    year: 2026,
    rules: [rule("Mid year;f;06-17"), rule("Mid year observed;f;06-17;3<1")],
  },
  {
    name: "a rule that cannot be read",
    year: 2026,
    rules: [rule("Bad;f;13-01"), rule("Good;f;03-09")],
  },
  {
    name: "a weekday that walks, then a rule that closes the next day",
    year: 2026,
    rules: [rule("A;f;03-10;2w"), rule("B;f;03-11")],
  },
];

describe("attributeRules", () => {
  it.each(CASES.filter((c) => c.name !== "a rule that cannot be read"))(
    "its rows' observed dates equal the full calendar: $name",
    ({ rules, year }) => {
      const { full, rows } = attributeRules(lib, spec(rules), year);
      expect(full).not.toBeNull();
      expect(rows).toHaveLength(rules.length);
      expect(observedInYear(rows, year)).toEqual(
        [...new Set(full!.holidays)].sort(),
      );
    },
  );

  it("gives the same days in either order", () => {
    const [ab, ba] = [CASES[2]!, CASES[3]!];
    expect(attributeRules(lib, spec(ab.rules), 2021).full!.holidays).toEqual([
      "2021-12-27",
      "2021-12-28",
    ]);
    expect(attributeRules(lib, spec(ba.rules), 2021).full!.holidays).toEqual([
      "2021-12-27",
      "2021-12-28",
    ]);
  });

  it("walks past a later rule's day, as the library does", () => {
    const { rows } = attributeRules(lib, spec(CASES[2]!.rules), 2021);
    expect(rows[0]!.pairs).toEqual([
      { unshifted: "2021-12-26", observed: "2021-12-28", walks: true },
    ]);
    const weekday = attributeRules(lib, spec(CASES[7]!.rules), 2026);
    expect(weekday.rows[0]!.pairs).toEqual([
      { unshifted: "2026-03-10", observed: "2026-03-12", walks: true },
    ]);
  });

  it("names the date a holiday moved from, and keeps the pair from the next year", () => {
    const { rows } = attributeRules(
      lib,
      spec([rule("Year start;f;01-01;6<5")]),
      2027,
    );
    expect(rows[0]!.pairs).toEqual([
      { unshifted: "2027-01-01", observed: "2027-01-01", walks: false },
      { unshifted: "2028-01-01", observed: "2027-12-31", walks: false },
    ]);
  });

  it("shows Christmas moved by the chain: both ghosts, both targets", () => {
    const { rows } = attributeRules(lib, spec(CASES[1]!.rules), 2021);
    expect(rows[0]!.pairs).toEqual([
      { unshifted: "2021-12-25", observed: "2021-12-27", walks: true },
    ]);
    expect(rows[1]!.pairs).toEqual([
      { unshifted: "2021-12-26", observed: "2021-12-28", walks: true },
    ]);
  });

  it("a date listed twice closes both, the second rule alone only its shift", () => {
    const [both, shiftedOnly] = [
      CASES[5]!.rules,
      [rule("Mid year observed;f;06-17;3<1")],
    ];
    expect(attributeRules(lib, spec(both), 2026).full!.holidays).toEqual([
      "2026-06-15",
      "2026-06-17",
    ]);
    expect(attributeRules(lib, spec(shiftedOnly), 2026).full!.holidays).toEqual(
      ["2026-06-15"],
    );
  });

  it("reports validity per row and leaves a bad rule with no pairs", () => {
    const { rows } = attributeRules(lib, spec(CASES[6]!.rules), 2026);
    expect(rows[0]).toEqual({ valid: false, pairs: [] });
    expect(rows[1]!.valid).toBe(true);
    expect(rows[1]!.pairs).toEqual([
      { unshifted: "2026-03-09", observed: "2026-03-09", walks: false },
    ]);
  });

  it("gives a null full calendar when the span fails, and rows still", () => {
    const { full, rows } = attributeRules(
      lib,
      { timeZone: "Not/AZone", weekend: [6, 7], rules: [rule("A;f;03-09")] },
      2026,
    );
    expect(full).toBeNull();
    expect(rows).toHaveLength(1);
  });

  it("marks a pair with no observed date when the library cannot place it", () => {
    // `nextWorkingDay` with every day closed has no answer: the sentinel.
    const { rows } = attributeRules(
      lib,
      {
        timeZone: "UTC",
        weekend: [1, 2, 3, 4, 5, 6, 7],
        rules: [rule("A;f;03-09;1w")],
      },
      2026,
    );
    expect(rows[0]!.pairs).toEqual([
      { unshifted: "2026-03-09", observed: "", walks: true },
    ]);
  });
});

describe("marksFromAttribution", () => {
  it("closes exactly the full calendar's dates, and no weekend day on its own", () => {
    const { full, rows } = attributeRules(lib, spec(CASES[0]!.rules), 2026);
    const marks = marksFromAttribution(lib, { full, rows }, 2026);
    const closed = Object.entries(marks)
      .filter(([, mark]) => mark.closed === true)
      .map(([date]) => date)
      .sort();
    expect(closed).toEqual(full!.holidays);
    expect(marks["2026-01-03"]?.closed).toBeUndefined(); // a Saturday
  });

  it("still closes a holiday that falls on a weekend day", () => {
    const attribution = attributeRules(lib, spec([rule("A;f;01-03")]), 2026);
    const marks = marksFromAttribution(lib, attribution, 2026);
    expect(marks["2026-01-03"]?.closed).toBe(true);
  });

  it("draws a moved holiday as a ghost and an arrow chip on the weekday it left", () => {
    const attribution = attributeRules(lib, spec(CASES[1]!.rules), 2021);
    const marks = marksFromAttribution(lib, attribution, 2021);
    expect(marks["2021-12-25"]).toMatchObject({ movedFrom: true });
    expect(marks["2021-12-26"]).toMatchObject({ movedFrom: true });
    expect(marks["2021-12-27"]).toMatchObject({
      closed: true,
      movedTo: 6,
      rules: [1],
    });
    expect(marks["2021-12-28"]).toMatchObject({
      closed: true,
      movedTo: 7,
      rules: [2],
    });
  });

  it("leaves the ghost off a date another rule closes", () => {
    const attribution = attributeRules(lib, spec(CASES[5]!.rules), 2026);
    const marks = marksFromAttribution(lib, attribution, 2026);
    // 17 Jun is listed unshifted too, so it stays closed and is no ghost.
    expect(marks["2026-06-17"]?.closed).toBe(true);
    expect(marks["2026-06-17"]?.movedFrom).toBeUndefined();
    expect(marks["2026-06-15"]).toMatchObject({ closed: true, movedTo: 3 });
  });

  it("draws the next year's holiday that moved into this one", () => {
    const attribution = attributeRules(lib, spec(CASES[4]!.rules), 2027);
    const marks = marksFromAttribution(lib, attribution, 2027);
    expect(marks["2027-12-31"]).toMatchObject({ closed: true, movedTo: 6 });
  });

  it("closes nothing and keeps the rows' marks when the full calendar is null", () => {
    const rows = attributeRules(lib, spec(CASES[0]!.rules), 2026).rows;
    const marks = marksFromAttribution(lib, { full: null, rows }, 2026);
    expect(Object.values(marks).filter((mark) => mark.closed === true)).toEqual(
      [],
    );
    expect(marks["2026-01-01"]?.rules).toEqual([1]);
  });
});

describe("cellKinds", () => {
  it("lists a cell's kinds in legend order, and a bare cell has none", () => {
    expect(cellKinds(undefined, false)).toEqual([]);
    expect(cellKinds({ closed: true, movedTo: 6 }, true)).toEqual([
      "closed",
      "weekend",
      "moved-to",
    ]);
    expect(cellKinds({ pick: 2 }, false)).toEqual(["pick"]);
    const every: CellMark = {
      closed: true,
      movedFrom: true,
      movedTo: 1,
      pick: 1,
    };
    expect(cellKinds(every, true)).toEqual(MARK_KINDS);
  });
});

describe("monthGridHtml", () => {
  const WEEKEND = [6, 7];
  const monthHtml = (html: string, month: number): string => {
    const start = html.indexOf(`data-month="${month}"`);
    const end = html.indexOf("</section>", start);
    return html.slice(start, end);
  };
  const count = (html: string, needle: string) => html.split(needle).length - 1;

  it("draws six week rows for February 2026 and for August 2026", () => {
    const html = monthGridHtml({
      year: 2026,
      months: { from: 2, to: 2 },
      marks: {},
      weekend: WEEKEND,
    });
    expect(count(html, 'class="gmt-holiday-week"')).toBe(6);
    const august = monthGridHtml({
      year: 2026,
      months: { from: 8, to: 8 },
      marks: {},
      weekend: WEEKEND,
    });
    expect(count(august, 'class="gmt-holiday-week"')).toBe(6);
  });

  it("an unmarked month keeps its header and six week rows beside its empty-month line", () => {
    const html = monthGridHtml({
      year: 2026,
      months: { from: 2, to: 2 },
      marks: {},
      weekend: WEEKEND,
    });
    const feb = monthHtml(html, 2);
    expect(feb).toContain('data-empty="true"');
    expect(count(feb, 'class="gmt-holiday-week"')).toBe(6);
    expect(feb).toContain("gmt-holiday-weekdays");
    expect(feb).toContain("No holidays in February");
  });

  it("the sheet never hides a month's rows, only reserves its empty line", () => {
    const css = readFileSync(
      new URL("../styles/gmt-holiday-widgets.css", import.meta.url),
      "utf8",
    );
    expect(css).not.toMatch(
      /\[data-empty="true"\]\s*>\s*\.gmt-holiday-week[^{]*\{[^}]*display:\s*none/u,
    );
    expect(css).toMatch(/visibility:\s*hidden/u);
  });

  it("draws six week rows in every month of a year, so no month changes height", () => {
    const html = monthGridHtml({
      year: 2026,
      months: { from: 1, to: 12 },
      marks: {},
      weekend: WEEKEND,
    });
    expect(count(html, "<section")).toBe(12);
    expect(count(html, 'class="gmt-holiday-week"')).toBe(12 * 6);
    expect(count(html, 'class="gmt-holiday-cell"')).toBe(12 * 6 * 7);
  });

  it("puts the first day of a month under its ISO weekday, Monday first", () => {
    // 1 Feb 2026 is a Sunday: six blank cells, then the 1st.
    const html = monthHtml(
      monthGridHtml({
        year: 2026,
        months: { from: 2, to: 2 },
        marks: {},
        weekend: WEEKEND,
      }),
      2,
    );
    const firstWeek = html.slice(html.indexOf('class="gmt-holiday-week"'));
    const cells = firstWeek.split('class="gmt-holiday-cell"').slice(1, 8);
    expect(cells.slice(0, 6).every((cell) => cell.includes("data-blank"))).toBe(
      true,
    );
    expect(cells[6]).toContain('data-date="2026-02-01"');
  });

  it("draws exactly the days of each month", () => {
    const html = monthGridHtml({
      year: 2028,
      months: { from: 2, to: 2 },
      marks: {},
      weekend: WEEKEND,
    });
    expect(count(html, "data-date=")).toBe(29);
  });

  it("hatches the weekend from the weekend it is given", () => {
    const html = monthGridHtml({
      year: 2026,
      months: { from: 3, to: 3 },
      marks: {},
      weekend: [5, 6],
    });
    expect(html).toMatch(/data-date="2026-03-06"[^>]*data-weekend/);
    expect(html).toMatch(/data-date="2026-03-07"[^>]*data-weekend/);
    expect(html).not.toMatch(/data-date="2026-03-08"[^>]*data-weekend/);
  });

  it("collapses an unmarked month to one line, and says it by name", () => {
    const attribution = attributeRules(lib, spec([rule("A;f;03-09")]), 2026);
    const marks = marksFromAttribution(lib, attribution, 2026);
    const html = monthGridHtml({
      year: 2026,
      months: { from: 1, to: 12 },
      marks,
      weekend: WEEKEND,
    });
    const july = monthHtml(html, 7);
    expect(july).toContain('data-empty="true"');
    expect(july).toContain("No holidays in July");
    const march = monthHtml(html, 3);
    expect(march).not.toContain("data-empty");
    expect(march).toContain("No holidays in March");
    expect(count(html, 'data-empty="true"')).toBe(11);
  });

  it("never lets a weekend alone make a month marked", () => {
    const html = monthGridHtml({
      year: 2026,
      months: { from: 7, to: 7 },
      marks: {},
      weekend: WEEKEND,
    });
    expect(html).toContain('data-empty="true"');
  });

  it("draws all five kinds, each as data the sheet turns into a pattern", () => {
    const marks: Record<string, CellMark> = {
      "2026-03-02": { closed: true, rules: [1] },
      "2026-03-03": { movedFrom: true },
      "2026-03-04": { closed: true, movedTo: 6, rules: [2, 3] },
      "2026-03-05": { pick: 2 },
    };
    const html = monthGridHtml({
      year: 2026,
      months: { from: 3, to: 3 },
      marks,
      weekend: WEEKEND,
    });
    expect(html).toMatch(/data-date="2026-03-02" data-kinds="closed"/);
    expect(html).toMatch(/data-date="2026-03-03" data-kinds="moved-from"/);
    expect(html).toMatch(/data-date="2026-03-04" data-kinds="closed moved-to"/);
    expect(html).toMatch(
      /data-date="2026-03-05" data-kinds="pick" data-series="2"/,
    );
    expect(html).toMatch(/data-date="2026-03-07" data-kinds="weekend"/);
    // Chips: the rule numbers, and an arrow chip that names the weekday.
    expect(html).toContain('gmt-holiday-chip--rule">2<');
    expect(html).toContain('gmt-holiday-chip--rule">3<');
    expect(html).toContain("↩ Sat");
  });

  it("is an image with a label and a list that names every marked date and its kind", () => {
    const marks: Record<string, CellMark> = {
      "2026-03-04": { closed: true, movedTo: 6, rules: [2] },
      "2026-03-05": { movedFrom: true },
    };
    const html = monthGridHtml({
      year: 2026,
      months: { from: 3, to: 3 },
      marks,
      weekend: WEEKEND,
    });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Calendar, March 2026.');
    expect(html).toContain("Weekend: Saturday, Sunday");
    const list = html.slice(html.indexOf("<ul"));
    expect(list).toContain(
      "Wednesday 4 March 2026: closed; a holiday moved here from Saturday; rule 2",
    );
    expect(list).toContain("Thursday 5 March 2026: a holiday moved from here");
    expect(count(list, "<li>")).toBe(2);
  });

  it("gives the cells a short and a long weekday header, for the narrow layout", () => {
    const html = monthGridHtml({
      year: 2026,
      months: { from: 3, to: 3 },
      marks: {},
      weekend: WEEKEND,
    });
    expect(count(html, "gmt-holiday-wd-long")).toBe(7);
    expect(count(html, "gmt-holiday-wd-short")).toBe(7);
  });

  it("escapes what it is given", () => {
    const html = monthGridHtml({
      year: 2026,
      months: { from: 3, to: 3 },
      marks: {},
      weekend: WEEKEND,
      today: '2026-03-04"><script>',
    });
    expect(html).not.toContain("<script>");
  });

  it("marks today, and clamps a months range into 1 to 12", () => {
    const html = monthGridHtml({
      year: 2026,
      months: { from: 0, to: 40 },
      marks: {},
      weekend: WEEKEND,
      today: "2026-03-04",
    });
    expect(count(html, "<section")).toBe(12);
    expect(html).toMatch(/data-date="2026-03-04"[^>]*data-today/);
  });
});

describe("weekRowsHtml", () => {
  it("draws whole ISO weeks from the Monday of the first to the Sunday of the last", () => {
    // 2026-04-01 is a Wednesday and 2026-04-09 a Thursday: two weeks.
    const html = weekRowsHtml("2026-04-01", "2026-04-09", {}, [6, 7]);
    expect(html.split('class="gmt-holiday-week"').length - 1).toBe(2);
    expect(html).toContain('data-date="2026-03-30"');
    expect(html).toContain('data-date="2026-04-12"');
    expect(html).not.toContain('data-date="2026-03-29"');
    expect(html).not.toContain('data-date="2026-04-13"');
  });

  it("dims the days outside the range it was asked for", () => {
    const html = weekRowsHtml("2026-04-01", "2026-04-09", {});
    expect(html).toMatch(/data-date="2026-03-30"[^>]*data-outside/);
    expect(html).not.toMatch(/data-date="2026-04-01"[^>]*data-outside/);
    expect(html).toMatch(/data-date="2026-04-10"[^>]*data-outside/);
  });

  it("carries the month on each day label and the same marks", () => {
    const html = weekRowsHtml("2026-04-01", "2026-04-09", {
      "2026-04-03": { closed: true, rules: [2] },
    });
    expect(html).toContain(">3 Apr<");
    expect(html).toMatch(/data-date="2026-04-03" data-kinds="closed"/);
    expect(html).toContain('role="img"');
    expect(html).toContain("Friday 3 April 2026: closed; rule 2");
  });
});

describe("legendHtml", () => {
  it("has a word and a swatch for every kind, in the legend's order", () => {
    const html = legendHtml();
    for (const kind of MARK_KINDS) {
      expect(html).toContain(`data-kind="${kind}"`);
    }
    expect(html.split("<li").length - 1).toBe(MARK_KINDS.length);
    expect(html).toContain("Moved from (not closed)");
  });

  it("can name a subset", () => {
    expect(legendHtml(["closed", "pick"]).split("<li").length - 1).toBe(2);
  });
});

describe("policy editor", () => {
  const options = (html: string, weekday: number): string[] => {
    const start = html.indexOf(`data-weekday="${weekday}"`);
    const end = html.indexOf("</select>", start);
    return [...html.slice(start, end).matchAll(/value="([^"]*)"/g)].map((m) =>
      m[1]!.replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
    );
  };

  it("draws seven native selects, one per weekday, and no div control", () => {
    const html = policyEditorHtml({ idPrefix: "p", policy: {} });
    expect(html.split("<select").length - 1).toBe(7);
    expect(html).toContain("<details");
    expect(html).not.toMatch(/role="(listbox|combobox|slider)"/);
    for (let weekday = 1; weekday <= 7; weekday++) {
      expect(html).toContain(`id="p-${weekday}"`);
    }
  });

  it("leaves a weekday's own day out of its previous and next options", () => {
    const html = policyEditorHtml({ idPrefix: "p", policy: {} });
    for (let weekday = 1; weekday <= 7; weekday++) {
      const values = options(html, weekday);
      expect(values).not.toContain(`<${weekday}`);
      expect(values).not.toContain(`>${weekday}`);
      expect(values).toContain("");
      expect(values).toContain("w");
      expect(values).toHaveLength(2 + 2 * 6);
    }
  });

  it("selects what the policy says, and reads back to the same policy through the codec", () => {
    const policy = parsePolicyText("1w 6<5 7>1")!;
    const html = policyEditorHtml({ idPrefix: "p", policy });
    const selected = [
      ...html.matchAll(
        /data-weekday="(\d)">(?:(?!<\/select>)[\s\S])*?<option value="([^"]*)" selected/g,
      ),
    ].map((m) => [
      Number(m[1]),
      m[2]!.replace("&lt;", "<").replace("&gt;", ">"),
    ]);
    expect(selected).toContainEqual([1, "w"]);
    expect(selected).toContainEqual([6, "<5"]);
    expect(selected).toContainEqual([7, ">1"]);
    const values = {
      1: selectValueOf(policy, 1),
      6: selectValueOf(policy, 6),
      7: selectValueOf(policy, 7),
    };
    expect(parsePolicyText(policyTextFromSelects(values))).toEqual(policy);
  });

  it("never shows no shift for a policy that has one", () => {
    const policy = parsePolicyText("6<6")!;
    const html = policyEditorHtml({ idPrefix: "p", policy });
    expect(options(html, 6)).toContain("<6");
    expect(html).toMatch(/value="&lt;6" selected|value="<6" selected/);
  });

  it("folds into a summary line, closed when asked", () => {
    expect(policySummary(parsePolicyText("6<5 7>1")!)).toBe(
      "Sat → Fri, Sun → Mon",
    );
    expect(policySummary(parsePolicyText("7w")!)).toBe(
      "Sun → next working day",
    );
    expect(policySummary({})).toBe("No shift");
    const open = policyEditorHtml({ idPrefix: "p", policy: {} });
    const folded = policyEditorHtml({
      idPrefix: "p",
      policy: {},
      folded: true,
    });
    expect(open).toContain('<details class="gmt-holiday-policy" open>');
    expect(folded).not.toContain(" open>");
  });

  it("builds policy text in ascending weekday order from select values", () => {
    expect(policyTextFromSelects({ 7: ">1", 1: "w", 3: "" })).toBe("1w 7>1");
    expect(policyTextFromSelects({})).toBe("");
  });
});
