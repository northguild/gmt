/**
 * `holiday-widgets.ts` against the real gmt modules through
 * `~/test/holiday-lib`. Every library result a test states is the index's
 * expected value; where a test can ask the library instead of stating a value,
 * it does.
 */
import type { HolidayRule } from "@northguild/gmt";
import { parseRuleLine } from "./holiday-codec";
import {
  MARK_KINDS,
  attributeRules,
  cellKinds,
  marksFromAttribution,
  policySummary,
  policyTextFromSelects,
  selectValueOf,
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

describe("policy select values", () => {
  it("read back to the same policy through the codec", () => {
    const policy = parsePolicyText("1w 6<5 7>1")!;
    expect(selectValueOf(policy, 1)).toBe("w");
    expect(selectValueOf(policy, 6)).toBe("<5");
    expect(selectValueOf(policy, 7)).toBe(">1");
    const values = {
      1: selectValueOf(policy, 1),
      6: selectValueOf(policy, 6),
      7: selectValueOf(policy, 7),
    };
    expect(parsePolicyText(policyTextFromSelects(values))).toEqual(policy);
  });

  it("folds into a summary line", () => {
    expect(policySummary(parsePolicyText("6<5 7>1")!)).toBe(
      "Sat → Fri, Sun → Mon",
    );
    expect(policySummary(parsePolicyText("7w")!)).toBe(
      "Sun → next working day",
    );
    expect(policySummary({})).toBe("No shift");
  });

  it("builds policy text in ascending weekday order from select values", () => {
    expect(policyTextFromSelects({ 7: ">1", 1: "w", 3: "" })).toBe("1w 7>1");
    expect(policyTextFromSelects({})).toBe("");
  });
});
