/**
 * The Day Ruler's logic against the real library. Every expected figure is a library call.
 */
import { lib } from "~/test/ccsds-lib";
import type { CcsdsLib } from "./ccsds-widgets";
import {
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  MAX_CALLS,
  NO_RESULT_TEXT,
  RULER_PRESETS,
  SCALE_DAYS,
  TYPE_A_YEAR,
  absentCell,
  bandsOf,
  createRuler,
  fieldDay,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  type RulerState,
} from "./code-b-day-ruler";

const ruler = createRuler(lib);

const state = (year: string, compare: string, day: number): RulerState => ({
  year,
  compare,
  day,
});

describe("year length", () => {
  it.each([
    ["2016", 366],
    ["2024", 366],
    ["2000", 366],
    ["2017", 365],
    ["2026", 365],
    ["2100", 365],
  ])("%s has %i days", (year, days) => {
    expect(ruler.facts(year).length).toBe(days);
    const last = lib.parseCcsdsAsciiB(`${year}-${fieldDay(days)}T00:00:00Z`);
    expect(last).not.toBe("");
    if (days === 365) {
      expect(lib.parseCcsdsAsciiB(`${year}-366T00:00:00Z`)).toBe("");
    }
  });

  it("year 10000 gives no result, and the lane says so", () => {
    expect(ruler.facts("10000").length).toBeNull();
    const read = ruler.read(state("10000", "2026", 61));
    expect(read.lanes[0].status).toBe("none");
    expect(read.lanes[0].header).toContain(NO_RESULT_TEXT);
    expect(read.lanes[0].date).toBe(
      "The library reads no Code B in year 10000.",
    );
    expect(read.lanes[1].status).toBe("ok");
  });

  it("a blank year asks for a year and leaves the other lane working", () => {
    const read = ruler.read(state("", "2026", 61));
    expect(read.lanes[0].status).toBe("empty");
    expect(read.lanes[0].date).toBe(TYPE_A_YEAR);
    expect(read.lanes[0].calls).toEqual([]);
    expect(read.lanes[1].status).toBe("ok");
  });
});

describe("month starts", () => {
  it.each(["2024", "2026"])("match the library's returns for %s", (year) => {
    const starts = ruler.facts(year).starts;
    expect(starts).toHaveLength(12);
    starts.forEach((start, i) => {
      const first = lib.formatCcsdsAsciiB(
        `${year}-${String(i + 1).padStart(2, "0")}-01T00:00:00Z`,
        0,
      );
      expect(first).toBe(`${year}-${fieldDay(start)}T00:00:00Z`);
    });
  });

  it("bands run from each start to the next, and the scale is fixed", () => {
    const lane = ruler.read(state("2024", "2026", 61)).lanes[0];
    const bands = bandsOf(lane, ruler.shortNames);
    expect(bands).toHaveLength(12);
    expect(bands[0]!.at).toBe(0);
    const end = bands.at(-1)!;
    expect(end.at + end.span).toBeCloseTo(1, 10);
    expect(bands.map((b) => b.pattern).slice(0, 3)).toEqual([
      "solid",
      "hatch",
      "solid",
    ]);
    expect(bands[2]!.label).toBe(lib.getLocaleMonthNames("en", "short")[2]);
  });

  it("a common year leaves the scale's last day absent", () => {
    const common = ruler.read(state("2024", "2026", 61)).lanes;
    expect(absentCell(common[0])).toBeNull();
    const cell = absentCell(common[1])!;
    expect(cell.at + cell.span).toBeCloseTo(1, 10);
    const end = bandsOf(common[1], ruler.shortNames).at(-1)!;
    expect(end.at + end.span).toBeCloseTo(cell.at, 10);
  });
});

describe("a day", () => {
  it.each(RULER_PRESETS)("preset $id gives its row", (preset) => {
    const read = ruler.read(preset.state);
    expect(read.day).toBe(preset.state.day);
    for (const [i, typed] of [
      preset.state.year,
      preset.state.compare,
    ].entries()) {
      const lane = read.lanes[i as 0 | 1];
      const instant = lib.parseCcsdsAsciiB(
        `${typed}-${fieldDay(preset.state.day)}T00:00:00Z`,
      );
      expect(lane.codeB).toBe(
        `${typed}-${fieldDay(preset.state.day)}T00:00:00Z`,
      );
      if (instant === "") {
        expect(lane.missing).toBe(true);
        expect(lane.date).toBe(`No day 366 in ${typed}`);
        continue;
      }
      const codeA = lib.formatCcsdsAsciiA(instant, 0);
      expect(lane.codeA).toBe(codeA);
      const [, month, dom] = codeA.split(/[-T]/);
      expect(lane.date).toBe(
        `${Number(dom)} ${lib.getLocaleMonthNames("en", "long")[Number(month) - 1]}`,
      );
    }
  });

  it("after the leap day, 061 is 1 March against 2 March", () => {
    const read = ruler.read(presetState(DEFAULT_PRESET));
    expect(read.lanes.map((l) => l.date)).toEqual(["1 March", "2 March"]);
    expect(read.sentence).toBe(
      "Day 061 is 1 March in 2024 and 2 March in 2026.",
    );
  });

  it("day 366 is 31 December in 2016 and absent in 2017", () => {
    const read = ruler.read(state("2016", "2017", 366));
    expect(read.lanes.map((l) => l.date)).toEqual([
      "31 December",
      "No day 366 in 2017",
    ]);
    expect(read.sentence).toBe(
      "Day 366 is 31 December in 2016 and does not exist in 2017.",
    );
  });

  it("the library's century rule shows in 2000 against 2100", () => {
    const read = ruler.read(state("2000", "2100", 60));
    expect(read.lanes.map((l) => l.date)).toEqual(["29 February", "1 March"]);
  });

  it("matching dates say both years", () => {
    expect(ruler.read(state("2026", "2028", 1)).sentence).toBe(
      "Day 001 is 1 January in both years.",
    );
  });

  it("a step makes exactly two parses and two formats once the years are known", () => {
    const calls: string[] = [];
    const counting = Object.fromEntries(
      Object.entries(lib).map(([name, fn]) => [
        name,
        (...args: unknown[]) => {
          calls.push(name);
          return (fn as (...a: unknown[]) => unknown)(...args);
        },
      ]),
    ) as unknown as CcsdsLib;
    const counted = createRuler(counting);
    counted.read(state("2024", "2026", 61));
    calls.length = 0;
    const read = counted.read(state("2024", "2026", 200));
    expect(calls).toEqual([
      "parseCcsdsAsciiB",
      "formatCcsdsAsciiA",
      "parseCcsdsAsciiB",
      "formatCcsdsAsciiA",
    ]);
    expect(read.calls).toHaveLength(MAX_CALLS);
    expect(read.calls.map((c) => c.fn)).toEqual(calls);
  });

  it("holds the whole scale for the keyboard", () => {
    expect(SCALE_DAYS).toBe(366);
    const read = ruler.read(state("2024", "2026", SCALE_DAYS));
    expect(read.lanes[0].date).toBe("31 December");
    expect(read.lanes[1].missing).toBe(true);
  });
});

describe("arguments and permalinks", () => {
  it("the default state writes nothing", () => {
    expect(permalinkOf(presetState(DEFAULT_PRESET))).toEqual({});
  });

  it("another preset writes its id and reads back", () => {
    for (const preset of RULER_PRESETS.slice(1)) {
      const link = permalinkOf(presetState(preset));
      expect(link).toEqual({ preset: preset.id });
      expect(readArgs(link)).toEqual(preset.state);
    }
  });

  it("a custom state writes strings and reads back", () => {
    const custom = state("1999", "", 77);
    expect(matchPreset(custom)).toBe(CUSTOM_PRESET_ID);
    const link = permalinkOf(custom);
    expect(link).toEqual({ year: "1999", compare: "", day: "77" });
    expect(readArgs(link)).toEqual(custom);
  });

  it("a missing field takes the default preset's value", () => {
    expect(readArgs({ day: 100 })).toEqual({
      ...DEFAULT_PRESET.state,
      day: 100,
    });
    expect(readArgs({ day: 400 }).day).toBe(DEFAULT_PRESET.state.day);
    expect(readArgs({ year: 2000 }).year).toBe("2000");
  });
});
