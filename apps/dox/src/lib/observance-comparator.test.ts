import { lib } from "~/test/holiday-lib";
import { unexpectedCapitalised } from "~/test/no-proper-names";
import { readArgs as readBuilderArgs } from "./holiday-rule-builder";
import {
  COMPARATOR_PRESETS,
  MAX_YEARS,
  POLICY_PRESETS,
  builderHandoffHref,
  compareHandoffHref,
  compare,
  columnOf,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  selectedColumn,
  selectedYear,
  yearSpan,
} from "./observance-comparator";
import { seedFromLocation } from "./widget-permalink";

const preset = (id: string) => COMPARATOR_PRESETS.find((p) => p.id === id)!;
const modelOf = (id: string) => compare(lib, presetState(preset(id)));
const columnIndex = (m: ReturnType<typeof modelOf>, text: string) =>
  m.columns.findIndex((c) => c.id === text);
const observed = (
  m: ReturnType<typeof modelOf>,
  year: number,
  col: number,
): string[] =>
  m.rows.find((r) => r.year === year)!.cells[col]!.map((c) => c.observed);

describe("the presets", () => {
  it("open with the first, and every one matches itself", () => {
    expect(COMPARATOR_PRESETS[0]!.id).toBe("adjacent");
    for (const p of COMPARATOR_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("names no place and keeps commas and semicolons out of names", () => {
    const strings = [COMPARATOR_PRESETS, POLICY_PRESETS]
      .flat()
      .flatMap((p) => Object.values(p))
      .filter((v): v is string => typeof v === "string");
    for (const text of strings) {
      expect(unexpectedCapitalised(text)).toEqual([]);
    }
    for (const p of COMPARATOR_PRESETS) {
      for (const h of compare(lib, presetState(p)).holidays) {
        expect(h.name).not.toMatch(/[,;]/u);
      }
    }
  });

  it("every column of every preset is a known policy", () => {
    const ids = new Set(POLICY_PRESETS.map((p) => p.id));
    for (const p of COMPARATOR_PRESETS) {
      for (const id of presetState(p).columns) expect(ids.has(id)).toBe(true);
    }
  });
});

describe("the adjacent preset", () => {
  const m = modelOf("adjacent");
  const nextWorking = columnIndex(m, "next-working");
  const friMon = columnIndex(m, "fri-mon");
  const none = columnIndex(m, "none");

  it("spans the preset's years, at most the cap", () => {
    expect(m.rows.length).toBeLessThanOrEqual(MAX_YEARS);
    expect(m.rows.length).toBe(
      Number(preset("adjacent").to) - Number(preset("adjacent").from) + 1,
    );
  });

  it("2021: next working day gives 27 and 28 Dec, the Friday-Monday policy 24 and 27", () => {
    expect(observed(m, 2021, nextWorking)).toEqual([
      "2021-12-27",
      "2021-12-28",
    ]);
    expect(observed(m, 2021, friMon)).toEqual(["2021-12-24", "2021-12-27"]);
    expect(m.rows.find((r) => r.year === 2021)!.disagree).toBe(true);
  });

  it("2026: the Saturday 26 Dec moves under a shifting policy and stays under none", () => {
    const row = m.rows.find((r) => r.year === 2026)!;
    const calendar = lib.buildBusinessCalendar({
      timeZone: "UTC",
      weekend: [6, 7],
      rules: [],
      years: { from: 2026, to: 2026 },
    })!;
    const expected = lib.observedDate(
      "2026-12-26",
      { 6: "nextWorkingDay", 7: "nextWorkingDay" },
      calendar,
    );
    expect(row.cells[none]![1]!.observed).toBe("2026-12-26");
    expect(row.cells[none]![1]!.line2).toBe("");
    expect(row.cells[nextWorking]![1]!.observed).not.toBe("2026-12-26");
    expect(row.cells[nextWorking]![1]!.line2).toMatch(/^moved from/u);
    expect(expected).not.toBe("");
    expect(row.cells[nextWorking]![1]!.observed).toBe(expected);
  });

  it("selects the first disagreeing year and a column that moves something", () => {
    const state = presetState(preset("adjacent"));
    const year = selectedYear(m, state);
    const first = m.rows.find((r) => r.disagree)!;
    expect(year).toBe(first.year);
    expect(selectedColumn(m, state)).toBeGreaterThanOrEqual(0);
  });
});

describe("the new-year preset", () => {
  it("2028, Friday-Monday: 1 Jan is observed in the year before, and says so", () => {
    const m = modelOf("new-year");
    const col = columnIndex(m, "fri-mon");
    const cell = m.rows.find((r) => r.year === 2028)!.cells[col]![0]!;
    expect(cell.observed).toBe("2027-12-31");
    expect(cell.line1).toBe("Fri 31 Dec");
    expect(cell.line2).toContain("2027");
    expect(cell.note).toContain("before");
  });
});

describe("a policy the library rejects", () => {
  it("shows NO SIGNAL in every cell, and a reason in the header", () => {
    const state = presetState(preset("adjacent"));
    state.columns[1] = "custom:6>6";
    const m = compare(lib, state);
    expect(m.columns[1]!.valid).toBe(false);
    expect(m.columns[1]!.reason).not.toBe("");
    for (const row of m.rows) {
      for (const cell of row.cells[1]!) expect(cell.state).toBe("sentinel");
    }
  });

  it("does not count a NO SIGNAL column as a disagreement", () => {
    const state = presetState(preset("adjacent"));
    state.columns = ["none", "custom:6>6"];
    const m = compare(lib, state);
    expect(m.rows.every((r) => !r.disagree)).toBe(true);
  });

  it("columnOf reads a rejected policy as invalid", () => {
    expect(columnOf(lib, "custom:6>6").valid).toBe(false);
    expect(columnOf(lib, "none").valid).toBe(true);
  });
});

describe("years", () => {
  it("cuts a long span and says so", () => {
    const span = yearSpan("2000", String(2000 + MAX_YEARS + 5));
    expect(span.years!.length).toBe(MAX_YEARS);
    expect(span.clamped).toBe(true);
  });
  it("gives null for a span that is not whole years", () => {
    expect(yearSpan("2020", "2019").years).toBeNull();
    expect(yearSpan("", "2020").years).toBeNull();
    expect(yearSpan("1800", "1900").years).toBeNull();
  });
});

describe("the permalink", () => {
  it("round-trips through readArgs", () => {
    const state = presetState(preset("fri-sat"));
    state.year = "2026";
    const back = readArgs(permalinkOf(state) as never);
    expect(back.holidays.map((h) => [Number(h.month), Number(h.day)])).toEqual(
      state.holidays.map((h) => [Number(h.month), Number(h.day)]),
    );
    expect(back.columns).toEqual(state.columns);
    expect(back.weekend).toEqual(state.weekend);
    expect(back.year).toBe("2026");
  });
  it("keeps a half-filled holiday in its link, not as 00-00", () => {
    const state = presetState(preset("fri-sat"));
    state.holidays = [
      { month: "", day: "" },
      { month: "12", day: "" },
    ];
    const link = permalinkOf(state);
    expect(link["holiday1"]).toBe("-");
    expect(readArgs(link as never).holidays).toEqual(state.holidays);
  });
  it("tops up a single column from the preset", () => {
    const state = readArgs({ column1: "mon-mon" });
    expect(state.columns.length).toBeGreaterThanOrEqual(2);
    expect(state.columns[0]).toBe("mon-mon");
  });
  it("reads the chat forms", () => {
    const state = readArgs({
      holidays: [{ month: 1, day: 1 }],
      years: { from: 2024, to: 2026 },
    } as never);
    expect(state.holidays).toEqual([{ month: "1", day: "1" }]);
    expect(state.from).toBe("2024");
    expect(state.to).toBe("2026");
  });
});

describe("the hand-offs", () => {
  it("the Builder link round-trips the rules, weekend, zone and year", () => {
    const state = presetState(preset("adjacent"));
    const m = compare(lib, state);
    const col = columnIndex(m, "next-working");
    const href = builderHandoffHref(state, m.columns[col], 2021)!;
    const seeded = seedFromLocation(
      "holidays",
      new URL(href, "https://example.test").search,
    );
    const builder = readBuilderArgs(seeded as never);
    expect(builder.rows.length).toBe(state.holidays.length);
    for (const row of builder.rows) {
      expect(row.kind).toBe("fixed");
      expect(row.policy).toBe(m.columns[col]!.text);
    }
    expect(builder.weekend).toEqual(state.weekend);
    expect(builder.zone).toBe("UTC");
    expect(String(builder.year)).toBe("2021");
  });

  it("the Builder link is off for a NO SIGNAL column", () => {
    const state = presetState(preset("adjacent"));
    state.columns[1] = "custom:6>6";
    const m = compare(lib, state);
    expect(builderHandoffHref(state, m.columns[1], 2021)).toBeNull();
  });

  it("the Comparator link from a Builder row seeds the date and the policy", () => {
    const href = compareHandoffHref(
      lib,
      { month: "12", day: "26", policy: "6<5 7>1" },
      [6, 7],
      2021,
    )!;
    const seeded = seedFromLocation(
      "observance",
      new URL(href, "https://example.test").search,
    );
    const state = readArgs(seeded as never);
    expect(state.holidays).toEqual([{ month: "12", day: "26" }]);
    expect(state.year).toBe("2021");
    expect(state.columns[0]).toBe("none");
    expect(state.columns[1]).toBe("fri-mon");
  });

  it("the Comparator link is off for a date that is not on the calendar", () => {
    const href = (month: string, day: string) =>
      compareHandoffHref(lib, { month, day, policy: "" }, [6, 7], 2026);
    expect(href("2", "31")).toBeNull();
    expect(href("13", "1")).toBeNull();
    expect(href("2", "29")).not.toBeNull();
    expect(href("", "5")).toBeNull();
  });

  it("the Comparator link has no policy columns for a blank policy", () => {
    const href = compareHandoffHref(
      lib,
      { month: "12", day: "26", policy: "" },
      [6, 7],
      null,
    )!;
    const seeded = seedFromLocation(
      "observance",
      new URL(href, "https://example.test").search,
    ) as Record<string, unknown>;
    expect(seeded["column1"]).toBeUndefined();
  });
});
