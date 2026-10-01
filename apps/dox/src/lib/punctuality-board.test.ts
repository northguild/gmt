/// <reference types="vitest/globals" />
/**
 * `punctuality-board.ts`'s pure helpers, against the real gmt modules. Every
 * expected library result is an appendix Z row (PB1 to PB4, PBR1 to PBR7).
 */
import {
  classifyPunctuality,
  scheduleDeviation,
} from "@northguild/gmt/transport/compare";
import {
  bestAvailable,
  estimateDrift,
  nextDeparture,
  punctualityRate,
} from "@northguild/gmt/transport/calculate";
import {
  axisMinutes,
  barLayout,
  boardNullReason,
  boardReasonText,
  collectBoardFacts,
  CUSTOM_PRESET_ID,
  DEFAULT_COMPARE_LATE,
  DEFAULT_EARLY,
  matchPreset,
  permalinkOf,
  presetState,
  PUNCTUALITY_PRESETS,
  readArgs,
  toleranceA,
  toleranceB,
  type BoardState,
} from "./punctuality-board";
import type { PunctualityLib } from "./punctuality-widgets";

const lib: PunctualityLib = {
  scheduleDeviation,
  classifyPunctuality,
  punctualityRate,
  bestAvailable,
  estimateDrift,
  nextDeparture,
} as unknown as PunctualityLib;

const preset = (id: string) => PUNCTUALITY_PRESETS.find((p) => p.id === id)!;
const stateOf = (id: string, over: Partial<BoardState> = {}): BoardState => ({
  ...presetState(preset(id)),
  ...over,
});
const LON = (t: string) => `2024-06-14T${t}+01:00[Europe/London]`;

describe("readArgs", () => {
  it("opens on the first preset with no arguments", () => {
    expect(readArgs({})).toEqual(presetState(PUNCTUALITY_PRESETS[0]!));
  });

  it("reads a chat pairs array with exactly the tolerance it gives", () => {
    const s = readArgs({
      pairs: [{ planned: LON("09:00:00"), actual: LON("09:15:00") }],
      late: "PT15M",
    });
    expect(s).toMatchObject({
      preset: CUSTOM_PRESET_ID,
      rows: [{ planned: LON("09:00:00"), actual: LON("09:15:00") }],
      late: "PT15M",
      earlyOn: false,
      compareOn: false,
    });
    expect(toleranceA(s)).toEqual({ late: "PT15M" });
  });

  it("reads a chat call with early and a second late tolerance", () => {
    const s = readArgs({
      pairs: [{ planned: "a", actual: "b" }],
      late: "PT60M",
      early: "PT10M",
      compareLate: "PT120M",
    });
    expect(toleranceA(s)).toEqual({ late: "PT60M", early: "PT10M" });
    expect(toleranceB(s)).toEqual({ late: "PT120M", early: "PT10M" });
    expect(s.compareOn).toBe(true);
  });

  it("caps the rows at six", () => {
    const pairs = Array.from({ length: 9 }, () => ({
      planned: "a",
      actual: "b",
    }));
    expect(readArgs({ pairs, late: "PT1M" }).rows).toHaveLength(6);
  });

  it("reads flat custom keys", () => {
    const s = readArgs({
      pairCount: "2",
      planned1: "p1",
      actual1: "a1",
      planned2: "p2",
      actual2: "a2",
      late: "PT15M",
    });
    expect(s.rows).toEqual([
      { planned: "p1", actual: "a1" },
      { planned: "p2", actual: "a2" },
    ]);
    expect(s.preset).toBe(CUSTOM_PRESET_ID);
  });

  it("counts flat rows when pairCount is absent", () => {
    const s = readArgs({ planned1: "p1", actual1: "a1", late: "PT1M" });
    expect(s.rows).toHaveLength(1);
  });

  it("starts from the named preset and applies scalar overrides", () => {
    const s = readArgs({ preset: "fifteen-minute", early: "PT10M" });
    expect(s.preset).toBe("fifteen-minute");
    expect(s.earlyOn).toBe(true);
    expect(s.early).toBe("PT10M");
    expect(s.late).toBe("PT15M");
    expect(s.rows).toEqual(preset("fifteen-minute").rows);
  });

  it("falls back to the first preset for an unknown id", () => {
    expect(readArgs({ preset: "nope" }).preset).toBe("fifteen-minute");
  });

  it('switches a preset tolerance off with "none"', () => {
    const day = readArgs({ preset: "day-based", early: "none" });
    expect(day.earlyOn).toBe(false);
    const sixty = readArgs({ preset: "sixty-and-120", compareLate: "none" });
    expect(sixty.compareOn).toBe(false);
  });

  it("turns non-strings into empty strings", () => {
    const s = readArgs({
      pairs: [{ planned: 5, actual: null } as never],
      late: 15 as never,
    });
    expect(s.rows).toEqual([{ planned: "", actual: "" }]);
    expect(s.late).toBe("");
  });
});

describe("toleranceA and toleranceB", () => {
  it("omits a blank early and a switched-off early", () => {
    expect(toleranceA(stateOf("fifteen-minute"))).toEqual({ late: "PT15M" });
    expect(
      toleranceA(stateOf("fifteen-minute", { earlyOn: true, early: " " })),
    ).toEqual({ late: "PT15M" });
    expect(toleranceA(stateOf("fifteen-minute", { earlyOn: true }))).toEqual({
      late: "PT15M",
      early: DEFAULT_EARLY,
    });
  });

  it("gives the second tolerance the same early", () => {
    expect(toleranceB(stateOf("sixty-and-120"))).toEqual({ late: "PT120M" });
  });

  it("starts a switched-off second tolerance at the default", () => {
    expect(stateOf("fifteen-minute").compareLate).toBe(DEFAULT_COMPARE_LATE);
  });
});

describe("matchPreset", () => {
  it.each(PUNCTUALITY_PRESETS.map((p) => [p.id]))("matches %s", (id) => {
    expect(matchPreset(stateOf(id))).toBe(id);
  });

  it("is custom once a tolerance moves or a switch flips", () => {
    expect(matchPreset(stateOf("fifteen-minute", { late: "PT16M" }))).toBe(
      CUSTOM_PRESET_ID,
    );
    expect(matchPreset(stateOf("fifteen-minute", { earlyOn: true }))).toBe(
      CUSTOM_PRESET_ID,
    );
    expect(matchPreset(stateOf("sixty-and-120", { compareOn: false }))).toBe(
      CUSTOM_PRESET_ID,
    );
  });

  it("is custom for other rows", () => {
    expect(
      matchPreset(stateOf("fifteen-minute", { rows: [], preset: "custom" })),
    ).toBe(CUSTOM_PRESET_ID);
  });
});

describe("permalinkOf", () => {
  it("is just the preset id when nothing differs", () => {
    for (const p of PUNCTUALITY_PRESETS) {
      expect(permalinkOf(stateOf(p.id))).toEqual({ preset: p.id });
    }
  });

  it("round-trips the preset form (PB1 permalink)", () => {
    const state = stateOf("fifteen-minute", { earlyOn: true, early: "PT10M" });
    const link = permalinkOf(state);
    expect(link).toEqual({ preset: "fifteen-minute", early: "PT10M" });
    expect(readArgs(link)).toEqual(state);
  });

  it("writes none for a tolerance a preset has and the state lacks", () => {
    const state = stateOf("day-based", { earlyOn: false });
    expect(permalinkOf(state)).toEqual({ preset: "day-based", early: "none" });
    expect(readArgs(permalinkOf(state))).toEqual(state);
    const sixty = stateOf("sixty-and-120", { compareOn: false });
    expect(permalinkOf(sixty)).toEqual({
      preset: "sixty-and-120",
      compareLate: "none",
    });
    expect(readArgs(permalinkOf(sixty)).compareOn).toBe(false);
  });

  it("writes a late that differs", () => {
    const state = stateOf("fifteen-minute", { late: "PT16M" });
    expect(permalinkOf(state)).toEqual({
      preset: "fifteen-minute",
      late: "PT16M",
    });
    expect(readArgs(permalinkOf(state))).toEqual(state);
  });

  it("round-trips the custom form, with every value 64 characters or fewer", () => {
    const state: BoardState = {
      preset: CUSTOM_PRESET_ID,
      rows: [
        { planned: LON("09:00:00"), actual: LON("09:15:00") },
        { planned: LON("10:00:00"), actual: LON("09:50:00") },
      ],
      late: "PT15M",
      earlyOn: true,
      early: "PT10M",
      compareOn: true,
      compareLate: "PT30M",
    };
    const link = permalinkOf(state);
    expect(link).toMatchObject({ pairCount: "2", late: "PT15M" });
    for (const v of Object.values(link)) {
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v.length).toBeLessThanOrEqual(64);
    }
    expect(readArgs(link)).toEqual({ ...state });
  });
});

describe("collectBoardFacts", () => {
  const read = (state: BoardState) => {
    const facts = collectBoardFacts(state, lib);
    return {
      facts,
      table: facts.rows.map((r) => [r.deviation, r.classA]),
    };
  };

  it("PB1: 15 minutes, 4 of 6", () => {
    const { facts, table } = read(stateOf("fifteen-minute"));
    expect(table).toEqual([
      ["PT5M", "onTime"],
      ["PT14M59S", "onTime"],
      ["PT15M", "late"],
      ["PT17M", "late"],
      ["-PT3M", "onTime"],
      ["-PT12M", "onTime"],
    ]);
    expect(facts.rateA).toEqual({
      onTime: 4,
      total: 6,
      rate: 0.6666666666666666,
    });
    expect(facts.showNaive).toBe(false);
  });

  it("PB1e: a 10-minute early tolerance, 3 of 6", () => {
    const { facts, table } = read(
      stateOf("fifteen-minute", { earlyOn: true, early: "PT10M" }),
    );
    expect(table.at(-1)).toEqual(["-PT12M", "early"]);
    expect(facts.rateA).toEqual({ onTime: 3, total: 6, rate: 0.5 });
  });

  it("PB1d: dragged to 16 minutes, the boundary row flips and 5 of 6", () => {
    const { facts, table } = read(stateOf("fifteen-minute", { late: "PT16M" }));
    expect(table[2]).toEqual(["PT15M", "onTime"]);
    expect(facts.rateA).toEqual({
      onTime: 5,
      total: 6,
      rate: 0.8333333333333334,
    });
  });

  it("PB1z: late PT0S leaves 2 of 6", () => {
    const { facts } = read(stateOf("fifteen-minute", { late: "PT0S" }));
    expect(facts.rateA).toEqual({
      onTime: 2,
      total: 6,
      rate: 0.3333333333333333,
    });
  });

  it("PB1h: written in hours", () => {
    const { facts } = read(stateOf("fifteen-minute", { late: "PT1H30M" }));
    expect(facts.rateA).toEqual({ onTime: 6, total: 6, rate: 1 });
  });

  it("PB2a and PB2b: 60 and 120 minutes side by side", () => {
    const { facts } = read(stateOf("sixty-and-120"));
    expect(facts.rows.map((r) => [r.deviation, r.classA])).toEqual([
      ["PT30M", "onTime"],
      ["PT59M", "onTime"],
      ["PT1H", "late"],
      ["PT1H35M", "late"],
      ["PT2H", "late"],
      ["PT2H30M", "late"],
    ]);
    expect(facts.rows.map((r) => r.classB)).toEqual([
      "onTime",
      "onTime",
      "onTime",
      "onTime",
      "late",
      "late",
    ]);
    expect(facts.rateA).toEqual({
      onTime: 2,
      total: 6,
      rate: 0.3333333333333333,
    });
    expect(facts.rateB).toEqual({
      onTime: 4,
      total: 6,
      rate: 0.6666666666666666,
    });
  });

  it("PB3: day-based, both edges outside", () => {
    const { facts, table } = read(stateOf("day-based"));
    expect(table).toEqual([
      ["-PT36H", "early"],
      ["-PT24H", "early"],
      ["-PT6H", "onTime"],
      ["PT20H", "onTime"],
      ["PT24H", "late"],
      ["PT72H", "late"],
    ]);
    expect(facts.rateA).toEqual({
      onTime: 2,
      total: 6,
      rate: 0.3333333333333333,
    });
  });

  it("PB3h: the same tolerance written PT24H", () => {
    const { facts } = read(
      stateOf("day-based", { late: "PT24H", early: "PT24H" }),
    );
    expect(facts.rateA?.onTime).toBe(2);
  });

  it("PB4 and PB4n: the fall-back, measured and read off the wall clocks", () => {
    const { facts, table } = read(stateOf("fall-back"));
    expect(table).toEqual([
      ["PT1H", "late"],
      ["PT15M", "late"],
      ["PT25M", "late"],
      ["PT10M", "onTime"],
    ]);
    expect(facts.rateA).toEqual({ onTime: 1, total: 4, rate: 0.25 });
    expect(facts.rows.map((r) => [r.naiveDeviation, r.naiveClass])).toEqual([
      ["PT0S", "onTime"],
      ["-PT45M", "onTime"],
      ["PT25M", "late"],
      ["PT10M", "onTime"],
    ]);
    expect(facts.naiveRate).toEqual({ onTime: 3, total: 4, rate: 0.75 });
    expect(facts.showNaive).toBe(true);
  });

  it("shows the naive reading on the fall-back preset only", () => {
    for (const p of PUNCTUALITY_PRESETS) {
      expect(read(stateOf(p.id)).facts.showNaive).toBe(p.id === "fall-back");
    }
  });

  it("PBP: the pill's one pair is 15 minutes late, 0 of 1", () => {
    const state = readArgs({
      pairs: [{ planned: LON("09:00:00"), actual: LON("09:15:00") }],
      late: "PT15M",
    });
    const { facts, table } = read(state);
    expect(table).toEqual([["PT15M", "late"]]);
    expect(facts.rateA).toEqual({ onTime: 0, total: 1, rate: 0 });
  });
});

describe("boardNullReason", () => {
  const reasonOf = (state: BoardState) =>
    boardNullReason(state, collectBoardFacts(state, lib), lib);

  it("is null when every result is real", () => {
    for (const p of PUNCTUALITY_PRESETS) {
      expect(reasonOf(stateOf(p.id))).toBeNull();
    }
  });

  it("PBR1: a weeks tolerance is invalid-late, and the library returns null", () => {
    const state = stateOf("fifteen-minute", { late: "P1W" });
    expect(reasonOf(state)).toEqual({ kind: "invalid-late" });
    const facts = collectBoardFacts(state, lib);
    expect(facts.rateA).toBeNull();
    expect(facts.rows.every((r) => r.classA === null)).toBe(true);
  });

  it("PBR2: a negative tolerance is invalid-late", () => {
    expect(reasonOf(stateOf("fifteen-minute", { late: "-PT15M" }))).toEqual({
      kind: "invalid-late",
    });
  });

  it("PBR3: text that is not a duration is invalid-late", () => {
    expect(reasonOf(stateOf("fifteen-minute", { late: "15 min" }))).toEqual({
      kind: "invalid-late",
    });
  });

  it("PBR4: a bad early tolerance alone is invalid-early", () => {
    const state = stateOf("fifteen-minute", { earlyOn: true, early: "P1M" });
    expect(reasonOf(state)).toEqual({ kind: "invalid-early" });
    expect(collectBoardFacts(state, lib).rateA).toBeNull();
  });

  it("does not blame a blank early that the tolerance ignores", () => {
    expect(
      reasonOf(stateOf("fifteen-minute", { earlyOn: true, early: "" })),
    ).toBeNull();
  });

  it("names a bad second tolerance", () => {
    const state = stateOf("sixty-and-120", { compareLate: "P1W" });
    expect(reasonOf(state)).toEqual({ kind: "invalid-compare" });
    expect(collectBoardFacts(state, lib).rateB).toBeNull();
  });

  it("PBR5: a zoneless actual names its row, with deviation empty and class null", () => {
    const rows = [
      { planned: LON("09:00:00"), actual: LON("09:05:00") },
      { planned: LON("09:00:00"), actual: "2024-06-14T09:15:00" },
    ];
    const state = stateOf("fifteen-minute", { rows, preset: CUSTOM_PRESET_ID });
    const facts = collectBoardFacts(state, lib);
    expect(facts.rows[1]!.deviation).toBe("");
    expect(facts.rows[1]!.classA).toBeNull();
    expect(boardNullReason(state, facts, lib)).toEqual({
      kind: "invalid-row",
      row: 2,
    });
    // PBR6: one bad pair voids the whole rate.
    expect(facts.rateA).toBeNull();
  });

  it("words every reason", () => {
    expect(boardReasonText({ kind: "invalid-late" })).toContain(
      "late tolerance is not an exact duration",
    );
    expect(boardReasonText({ kind: "invalid-early" })).toContain(
      "early tolerance",
    );
    expect(boardReasonText({ kind: "invalid-compare" })).toContain(
      "second late tolerance",
    );
    expect(boardReasonText({ kind: "invalid-row", row: 3 })).toContain(
      "Arrival 3's planned or actual time has no offset",
    );
  });

  it("PBR7: an empty list has no rate", () => {
    expect(punctualityRate([], { late: "PT15M" })).toBeNull();
  });
});

describe("axisMinutes", () => {
  const axis = (id: string) => {
    const state = stateOf(id);
    return axisMinutes(state, collectBoardFacts(state, lib));
  };

  it.each([
    ["fifteen-minute", 30],
    ["sixty-and-120", 180],
    ["day-based", 5760],
    ["fall-back", 90],
  ])("%s runs ±%i minutes", (id, minutes) => {
    expect(axis(id)).toBe(minutes);
  });

  it("holds a tolerance wider than every arrival", () => {
    const state = stateOf("fifteen-minute", { late: "PT1H30M" });
    expect(axisMinutes(state, collectBoardFacts(state, lib))).toBe(120);
  });
});

describe("barLayout", () => {
  it("is all inside a band an arrival does not reach", () => {
    expect(barLayout(5, 15, null, "onTime")).toEqual({
      inside: { from: 0, to: 5 },
      outside: null,
    });
  });

  it("hatches the part beyond the late edge", () => {
    expect(barLayout(17, 15, null, "late")).toEqual({
      inside: { from: 0, to: 15 },
      outside: { from: 15, to: 17 },
    });
  });

  it("gives an arrival exactly on the late edge a hatched cap", () => {
    expect(barLayout(15, 15, null, "late")).toEqual({
      inside: { from: 0, to: 15 },
      outside: { from: 15, to: 15 },
    });
  });

  it("with late at zero, an on-the-plan arrival is a cap at zero", () => {
    expect(barLayout(0, 0, null, "late")).toEqual({
      inside: null,
      outside: { from: 0, to: 0 },
    });
  });

  it("leaves an early bar inside when early is off", () => {
    expect(barLayout(-12, 15, null, "onTime")).toEqual({
      inside: { from: -12, to: 0 },
      outside: null,
    });
  });

  it("hatches the part beyond the early edge", () => {
    expect(barLayout(-12, 15, 10, "early")).toEqual({
      inside: { from: -10, to: 0 },
      outside: { from: -12, to: -10 },
    });
  });

  it("gives an arrival exactly on the early edge a hatched cap", () => {
    expect(barLayout(-24, 24, 24, "early")).toEqual({
      inside: { from: -24, to: 0 },
      outside: { from: -24, to: -24 },
    });
  });

  it("treats an unreadable late tolerance as no edge", () => {
    expect(barLayout(40, null, null, null)).toEqual({
      inside: { from: 0, to: 40 },
      outside: null,
    });
  });
});
