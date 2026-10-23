/**
 * The Holiday Rule Builder's pure module against the real library. Expected
 * dates are the library spec's; counts are derived, never literal.
 */
import { MAX_RULES, parseRuleLine } from "./holiday-codec";
import {
  BUILDER_PRESETS,
  CUSTOM_PRESET_ID,
  HANDOFF_NO_CALENDAR,
  HANDOFF_TOO_LONG,
  HOLIDAYS_LINK_CAP,
  NO_SIGNAL_TEXT,
  RULE_KINDS,
  blankRow,
  callSource,
  easterLabel,
  isSeeded,
  ledgerHandoff,
  literal,
  matchPreset,
  movedCount,
  permalinkOf,
  presetState,
  readArgs,
  rowOfRule,
  rowResult,
  ruleCallLines,
  ruleCallSizerText,
  ruleOfRow,
  rulesOf,
  weekendNames,
  yearOf,
} from "./holiday-rule-builder";
import { attributeRules } from "./holiday-widgets";
import { lib } from "~/test/holiday-lib";

const YEAR_LOW = 1900;
const YEAR_HIGH = 2100;
const preset = (id: string) => BUILDER_PRESETS.find((p) => p.id === id)!;
const fullOf = (id: string) => {
  const p = preset(id);
  return attributeRules(
    lib,
    { timeZone: p.zone, weekend: [...p.weekend], rules: [...p.rules] },
    p.year,
  );
};

describe("presets", () => {
  it("opens on the adjacent-holidays chain", () => {
    expect(BUILDER_PRESETS[0]!.id).toBe("chain");
  });

  it("gives every preset a calendar, within MAX_RULES", () => {
    for (const p of BUILDER_PRESETS) {
      expect(p.rules.length, p.id).toBeLessThanOrEqual(MAX_RULES);
      expect(fullOf(p.id).full, p.id).not.toBeNull();
    }
  });

  it("matches the library spec where it lists a result", () => {
    expect(fullOf("chain").full!.holidays).toEqual([
      "2021-12-27",
      "2021-12-28",
    ]);
    expect(fullOf("closing").full!.holidays).toEqual([
      "2026-01-01",
      "2026-04-03",
      "2026-04-06",
      "2026-05-01",
      "2026-12-25",
      "2026-12-26",
    ]);
    expect(fullOf("midweek").full!.holidays).toEqual([
      "2026-06-15",
      "2026-06-17",
    ]);
    expect(fullOf("friday-monday").full!.holidays).toContain("2027-12-31");
  });

  it("labels each preset by what it computes, with a literal zone", () => {
    for (const p of BUILDER_PRESETS) {
      expect(p.label, p.id).not.toBe("");
      expect(p.description, p.id).not.toBe("");
      expect(p.zone, p.id).toMatch(/^[A-Za-z_]+(\/[A-Za-z_]+)*$/);
    }
  });

  it("round-trips a preset through its state", () => {
    for (const p of BUILDER_PRESETS) {
      expect(matchPreset(presetState(p)), p.id).toBe(p.id);
    }
  });

  it("gives a new row no policy", () => {
    expect(blankRow().policy).toBe("");
    const rule = ruleOfRow({ ...blankRow(), month: "5", day: "1" });
    expect("observed" in rule).toBe(false);
  });
});

describe("rows and rules", () => {
  it("round-trips every preset rule through a row", () => {
    for (const p of BUILDER_PRESETS) {
      for (const rule of p.rules) {
        const row = rowOfRule(rule)!;
        expect(ruleOfRow(row), p.id).toEqual(rule);
      }
    }
  });

  it("covers every kind", () => {
    const kinds = new Set(
      BUILDER_PRESETS.flatMap((p) => p.rules.map((r) => r.kind)),
    );
    for (const kind of RULE_KINDS) {
      expect(typeof ruleOfRow(blankRow(kind)).kind).toBe("string");
    }
    expect(kinds.size).toBeGreaterThan(1);
  });

  it("turns a blank number into NaN, which the library calls invalid", () => {
    const rule = ruleOfRow({ ...blankRow(), month: "13", day: "1" });
    expect(lib.isValidHolidayRule(rule)).toBe(false);
  });

  it("rejects what is not a rule", () => {
    expect(rowOfRule(null as never)).toBeNull();
    expect(rowOfRule({ kind: "nope" } as never)).toBeNull();
  });
});

describe("arguments and permalink", () => {
  it("is unseeded with no args", () => {
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ year: 2026 })).toBe(true);
  });

  it("reads a preset id", () => {
    const state = readArgs({ preset: "closing" });
    expect(matchPreset(state)).toBe("closing");
  });

  it("reads typed rules from the chat and a missing weekend means 6,7", () => {
    const state = readArgs({
      rules: [{ name: "A", kind: "fixed", month: 5, day: 1 }],
      year: 2026,
      timeZone: "UTC",
    });
    expect(state.weekend).toEqual([6, 7]);
    expect(state.year).toBe("2026");
    expect(state.zone).toBe("UTC");
    expect(rulesOf(state)).toEqual([
      { name: "A", kind: "fixed", month: 5, day: 1 },
    ]);
  });

  it("carries the permalink through the codec and back", () => {
    const state = presetState(preset("midweek"));
    const link = permalinkOf(state);
    expect(link["preset"]).toBe("midweek");
    const back = readArgs(link as never);
    expect(rulesOf(back)).toEqual(rulesOf(state));
    expect(back.weekend).toEqual(state.weekend);
    expect(back.zone).toBe(state.zone);
    expect(back.year).toBe(state.year);
  });

  it("keeps a half-filled row in its link", () => {
    const state = presetState(preset("chain"));
    state.rows = [
      blankRow(),
      { ...blankRow(), name: "May Day", month: "5" },
      { ...blankRow("calendarFixed"), day: "1" },
      blankRow("nthWeekday"),
      blankRow("easterRelative"),
      blankRow("dates"),
    ];
    const back = readArgs(permalinkOf(state) as never);
    expect(back.rows).toEqual(state.rows);
  });

  it("leaves the preset out for a custom state", () => {
    const state = presetState(preset("chain"));
    state.rows.pop();
    expect(matchPreset(state)).toBe(CUSTOM_PRESET_ID);
    expect(permalinkOf(state)["preset"]).toBeUndefined();
  });

  it("keeps a year outside the link range off the state", () => {
    expect(readArgs({ year: 3000 }).year).toBe(
      String(BUILDER_PRESETS[0]!.year),
    );
    expect(yearOf({ ...presetState(preset("chain")), year: "abc" })).toBeNull();
    expect(yearOf({ ...presetState(preset("chain")), year: "2026" })).toBe(
      2026,
    );
  });
});

describe("the printed call", () => {
  it("writes unquoted keys and one rule per line", () => {
    const source = callSource(presetState(preset("chain")), 2021);
    expect(source.startsWith("buildBusinessCalendar({")).toBe(true);
    expect(source).toContain("years: { from: 2021, to: 2021 }");
    expect(source.split("\n").filter((l) => l.includes("kind:")).length).toBe(
      preset("chain").rules.length,
    );
    expect(source).not.toContain('"kind"');
  });

  it("writes a literal, with weekday keys bare", () => {
    expect(literal({ 6: "nextWorkingDay", a: [1, 2] })).toBe(
      '{ 6: "nextWorkingDay", a: [1, 2] }',
    );
    expect(literal(null)).toBe("null");
  });
});

describe("row results", () => {
  it("says what moved", () => {
    const { rows } = fullOf("chain");
    const result = rowResult(
      preset("chain").rules[0]!,
      rows[0]!.valid,
      rows[0]!.pairs,
      2021,
    );
    expect(result.state).toBe("signal");
    expect(result.text).toContain("moved from");
  });

  it("is NO SIGNAL for an invalid rule, with a reason", () => {
    const rule = ruleOfRow({ ...blankRow(), month: "13", day: "1" });
    const result = rowResult(rule, false, [], 2026);
    expect(result.state).toBe("sentinel");
    expect(result.text.startsWith(NO_SIGNAL_TEXT)).toBe(true);
  });

  it("is a plain empty answer, never NO SIGNAL, for a valid rule with no date", () => {
    const rule = ruleOfRow({
      ...blankRow("nthWeekday"),
      month: "2",
      weekday: "5",
      ordinal: "5",
    });
    const att = attributeRules(
      lib,
      { timeZone: "UTC", weekend: [6, 7], rules: [rule] },
      2026,
    );
    const result = rowResult(
      rule,
      att.rows[0]!.valid,
      att.rows[0]!.pairs,
      2026,
    );
    expect(result.state).toBe("empty");
    expect(result.text).not.toContain("NO SIGNAL");
  });

  it("labels an Easter offset with its feast", () => {
    expect(easterLabel("-2")).toBe("Easter −2 (Good Friday)");
    expect(easterLabel("1")).toBe("Easter +1 (Easter Monday)");
    expect(easterLabel("")).toBe("");
  });
});

describe("plates", () => {
  it("counts a moved holiday once per pair", () => {
    const { rows } = fullOf("chain");
    const moved = movedCount(
      lib,
      rows.map((r) => r.pairs),
    );
    const expected = rows
      .flatMap((r) => r.pairs)
      .filter((p) => p.observed !== p.unshifted).length;
    expect(moved).toBe(expected);
    expect(moved).toBeGreaterThan(0);
  });

  it("names the weekend", () => {
    expect(weekendNames([6, 7])).toBe("Sat, Sun");
    expect(weekendNames([])).toBe("none");
  });
});

describe("hand-off to the Free Time Ledger", () => {
  it("is disabled with a reason when there is no calendar", () => {
    expect(ledgerHandoff(null, "UTC", [6, 7])).toEqual({
      href: null,
      hint: HANDOFF_NO_CALENDAR,
    });
  });

  it("is disabled when the holidays run past the cap", () => {
    const holidays = Array.from(
      { length: 200 },
      (_, i) => `2026-01-${String(i).padStart(2, "0")}`,
    );
    expect(holidays.join(",").length).toBeGreaterThan(HOLIDAYS_LINK_CAP);
    expect(ledgerHandoff({ holidays }, "UTC", [6, 7])).toEqual({
      href: null,
      hint: HANDOFF_TOO_LONG,
    });
  });

  it("sends the weekend, holidays, zone and the working basis", () => {
    const handoff = ledgerHandoff(
      { holidays: ["2021-12-27", "2021-12-28"] },
      "Europe/London",
      [6, 7],
    );
    expect(handoff.href).not.toBeNull();
    const params = new URL(handoff.href!, "https://example.test").searchParams;
    expect(params.get("w")).toBe("freetime");
    const args = JSON.parse(params.get("wa")!);
    expect(args).toEqual({
      weekend: "6,7",
      holidays: "2021-12-27,2021-12-28",
      zone: "Europe/London",
      basis: "working",
    });
  });
});

describe("the folded calls", () => {
  const callsOf = (lines: string[], year: number): string => {
    const rules = lines.map((line) => parseRuleLine(line)!);
    const att = attributeRules(
      lib,
      { timeZone: "UTC", weekend: [6, 7], rules },
      year,
    );
    return ruleCallLines(
      rules,
      att.rows.map((r) => r.pairs),
      year,
    ).join("\n");
  };

  it("print a walk with its calendar, after the dates no rule walks to", () => {
    const text = callsOf(["A;f;12-26;7w", "B;d;2021-12-27"], 2021);
    expect(text).toContain(
      'observedDate("2021-12-26", { 7: "nextWorkingDay" }, calendar) // "2021-12-28"',
    );
    expect(text).toContain(
      "// calendar: the weekend and every holiday that does not walk",
    );
  });

  it("print a shift that does not walk without the walks or a calendar", () => {
    const text = callsOf(["Year start;f;01-01;6<5 7w"], 2027);
    expect(text).toContain(
      'observedDate("2027-01-01", { 6: { previous: 5 } }) // "2027-01-01"',
    );
    expect(text).not.toContain("calendar");
  });
});

describe("the folded calls hold their height", () => {
  const linesOf = (text: string) => text.split("\n").length;
  const actualLines = (id: string, year: number): number => {
    const p = preset(id);
    const att = attributeRules(
      lib,
      { timeZone: p.zone, weekend: [...p.weekend], rules: [...p.rules] },
      year,
    );
    return linesOf(
      ruleCallLines(
        p.rules,
        att.rows.map((r) => r.pairs),
        year,
      ).join("\n"),
    );
  };

  it("reserve at least the lines the library prints, for every year and preset", () => {
    for (const p of BUILDER_PRESETS) {
      const reserved = linesOf(ruleCallSizerText(p.rules));
      for (let year = YEAR_LOW; year <= YEAR_HIGH; year++) {
        expect(actualLines(p.id, year), `${p.id} ${year}`).toBeLessThanOrEqual(
          reserved,
        );
      }
    }
  }, 90_000);

  it("friday-monday and fri-sat print a different number of lines in different years, and no preset prints more than the sizer holds", () => {
    for (const id of ["friday-monday", "fri-sat", "lunisolar"]) {
      const counts = new Set<number>();
      for (let year = YEAR_LOW; year <= YEAR_HIGH; year++) {
        counts.add(actualLines(id, year));
      }
      if (id !== "lunisolar") expect(counts.size, id).toBeGreaterThan(1);
      expect(
        linesOf(ruleCallSizerText(preset(id).rules)),
        id,
      ).toBeGreaterThanOrEqual(Math.max(...counts));
    }
    // 201 years of three presets, one of them lunisolar: slow under a loaded full run.
  }, 90_000);

  it("friday-monday has a year where a shift crosses 1 January, and the sizer covers it", () => {
    const p = preset("friday-monday");
    let crossing: number | null = null;
    for (let year = YEAR_LOW; year <= YEAR_HIGH && crossing === null; year++) {
      const att = attributeRules(
        lib,
        { timeZone: p.zone, weekend: [...p.weekend], rules: [...p.rules] },
        year,
      );
      if (
        att.rows.some((r) =>
          r.pairs.some((pair) => Number.parseInt(pair.unshifted, 10) !== year),
        )
      ) {
        crossing = year;
      }
    }
    expect(crossing).not.toBeNull();
    expect(actualLines("friday-monday", crossing!)).toBeLessThanOrEqual(
      linesOf(ruleCallSizerText(p.rules)),
    );
  });

  it("count a rule without a policy at one line", () => {
    const plain = ruleCallSizerText([
      { name: "1 Jan", kind: "fixed", month: 1, day: 1 },
    ]);
    expect(linesOf(plain)).toBe(1);
  });
});
