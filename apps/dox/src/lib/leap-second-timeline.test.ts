/**
 * `leap-second-timeline.ts` against the real gmt modules through
 * `~/test/timescale-lib`. Every library result a test states was read from a
 * run against the built `dist`.
 */
import {
  AXIS_START_MS,
  BEFORE_1972_TEXT,
  CUSTOM_PRESET_ID,
  NOT_INSERTED_TEXT,
  NOT_INSTANT_TEXT,
  NO_OFFSET_TEXT,
  TIMELINE_PRESETS,
  VERDICT_INSERTED,
  VERDICT_NOT_INSERTED,
  VERDICT_VALID_INSTANT,
  axisEndMs,
  axisPercent,
  axisTicks,
  blankPlates,
  drawMs,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readTimeline,
  sliderDate,
  sliderEndMs,
  sliderMax,
  sliderPosition,
  summaryText,
  timelinePlates,
  type TimelineState,
} from "./leap-second-timeline";
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { lib } from "~/test/timescale-lib";

const utcMs = (iso: string): number => convertUtcToUnix(iso) ?? Number.NaN;

const preset = (id: string) => TIMELINE_PRESETS.find((p) => p.id === id)!;
const readPreset = (id: string) => readTimeline(lib, presetState(preset(id)));
const plateOf = (id: string, role: string) =>
  timelinePlates(readPreset(id)).find((p) => p.role === role)!;

describe("the walk of inserted seconds", () => {
  const { steps } = readPreset("from-2000");

  it("lists 27 seconds, from mid-1972 to the end of 2016", () => {
    expect(steps).toHaveLength(27);
    expect(steps[0]!.insertion).toBe("1972-06-30T23:59:60Z");
    expect(steps.at(-1)!.insertion).toBe("2016-12-31T23:59:60Z");
  });

  it("reads each step's new offset from the library, one more than the last", () => {
    expect(steps.map((s) => s.offset)).toEqual(
      Array.from({ length: 27 }, (_, i) => 11 + i),
    );
    expect(steps[0]!.after).toBe("1972-07-01T00:00:00Z");
    expect(steps.every((s) => s.ms !== null)).toBe(true);
    expect(readPreset("from-2000").startOffset).toBe(10);
  });
});

describe("every preset", () => {
  it("has eight, the first the default, and each matches itself", () => {
    expect(TIMELINE_PRESETS.map((p) => p.id)).toEqual([
      "from-2000",
      "last-insertion",
      "after-the-table",
      "far-future",
      "not-inserted",
      "offset-spelling",
      "backwards",
      "before-1972",
    ]);
    for (const p of TIMELINE_PRESETS)
      expect(matchPreset(presetState(p))).toBe(p.id);
    expect(
      matchPreset({ date: "2001-01-01", check: "", from: "", to: "" }),
    ).toBe(CUSTOM_PRESET_ID);
  });

  it("from-2000: 32 s, the next insertion, five counted, a real second", () => {
    const r = readPreset("from-2000");
    expect(r.offset.offset).toBe(32);
    expect(r.offset.next).toBe("2005-12-31T23:59:60Z");
    expect(r.between.count).toBe(5);
    expect(r.between.counted).toEqual([
      "2005-12-31T23:59:60Z",
      "2008-12-31T23:59:60Z",
      "2012-06-30T23:59:60Z",
      "2015-06-30T23:59:60Z",
      "2016-12-31T23:59:60Z",
    ]);
    expect(r.check.verdict).toBe(VERDICT_INSERTED);
    expect(r.check.insertion).toBe("2016-12-31T23:59:60Z");
    expect(r.offset.calls.map((c) => c.fn)).toEqual([
      "taiMinusUtc",
      "nextLeapSecond",
    ]);
    expect(r.check.calls.map((c) => c.fn)).toEqual([
      "hasSecond60",
      "isLeapSecond",
      "isValidInstant",
    ]);
    expect(plateOf("from-2000", "hero-offset")).toMatchObject({
      value: "32 s",
      lines: ["next insertion", "2005-12-31"],
    });
    expect(plateOf("from-2000", "hero-between")).toMatchObject({
      value: "5",
      lines: ["from 2000-01-01", "to 2024-01-01"],
    });
    expect(plateOf("from-2000", "hero-check")).toMatchObject({
      value: VERDICT_INSERTED,
      lines: ["isLeapSecond true", "hasSecond60 true"],
    });
  });

  it("last-insertion: 36 s and the end of 2016 next; blank fields make no call", () => {
    const r = readPreset("last-insertion");
    expect(r.offset.offset).toBe(36);
    expect(r.offset.next).toBe("2016-12-31T23:59:60Z");
    expect(r.between.calls).toEqual([]);
    expect(r.check.calls).toEqual([]);
    expect(plateOf("last-insertion", "hero-between").value).toBeNull();
    expect(plateOf("last-insertion", "hero-check").value).toBeNull();
  });

  it("after-the-table and far-future: 37 s and no later insertion, which is a result", () => {
    for (const id of ["after-the-table", "far-future"]) {
      const r = readPreset(id);
      expect(r.offset.offset).toBe(37);
      expect(r.offset.next).toBe("");
      expect(r.offset.reason).toBe("");
      expect(plateOf(id, "hero-offset")).toMatchObject({
        value: "37 s",
        lines: ["none after this date", ""],
      });
    }
  });

  it("not-inserted: well-formed, but nothing was inserted", () => {
    const r = readPreset("not-inserted");
    expect(r.check.verdict).toBe(VERDICT_NOT_INSERTED);
    expect(r.check.hasSecond60).toBe(true);
    expect(r.check.isLeap).toBe(false);
    expect(r.check.insertion).toBe("");
    expect(plateOf("not-inserted", "hero-check").lines).toEqual([
      "isLeapSecond false",
      "hasSecond60 true",
    ]);
  });

  it("offset-spelling: a second 60 written with an offset is the real one", () => {
    const r = readPreset("offset-spelling");
    expect(r.check.verdict).toBe(VERDICT_INSERTED);
    expect(r.check.insertion).toBe("2008-12-31T23:59:60Z");
  });

  it("backwards: five, with a minus sign, the same seconds named", () => {
    const r = readPreset("backwards");
    expect(r.between.count).toBe(-5);
    expect(r.between.counted).toHaveLength(5);
    expect(plateOf("backwards", "hero-between").value).toBe("-5");
  });

  it("before-1972: no value, and why", () => {
    const r = readPreset("before-1972");
    expect(r.offset.offset).toBeNull();
    expect(r.offset.reason).toBe(BEFORE_1972_TEXT);
    expect(r.between.count).toBeNull();
    expect(r.between.reason).toBe(BEFORE_1972_TEXT);
    expect(plateOf("before-1972", "hero-offset").value).toBeNull();
  });
});

describe("the verdict words and reasons", () => {
  const checkOf = (check: string) =>
    readTimeline(lib, { date: "", check, from: "", to: "" }).check;

  it("a valid instant that is not a second 60", () => {
    expect(checkOf("2016-12-31T23:59:59Z").verdict).toBe(VERDICT_VALID_INSTANT);
  });

  it("not an instant at all is no signal", () => {
    const c = checkOf("garbage");
    expect(c.verdict).toBeNull();
    expect(c.reason).toBe(NOT_INSTANT_TEXT);
    expect(c.calls).toHaveLength(3);
  });

  it("a second 60 on a day with no insertion explains itself for a date", () => {
    const r = readTimeline(lib, {
      date: "2017-12-31T23:59:60Z",
      check: "",
      from: "",
      to: "",
    });
    expect(r.offset.offset).toBeNull();
    expect(r.offset.reason).toBe(NOT_INSERTED_TEXT);
  });

  it("a second 60 with no offset asks for the offset first, not a leap second", () => {
    // 2016-12-31 did have a leap second; the missing offset is the problem.
    const c = checkOf("2016-12-31T23:59:60");
    expect(c.verdict).toBeNull();
    expect(c.reason).toBe(NO_OFFSET_TEXT);
    expect(checkOf("2016-12-31T23:59:60Z").verdict).toBe(VERDICT_INSERTED);
    const noLeapDay = checkOf("2017-12-31T23:59:60");
    expect(noLeapDay.verdict).toBeNull();
    expect(noLeapDay.reason).toBe(NO_OFFSET_TEXT);
  });

  it("a date with no offset asks for the offset, a second 60 or not", () => {
    for (const date of ["2016-12-31T23:59:60", "2016-12-31T23:59:59"]) {
      const r = readTimeline(lib, { date, check: "", from: "", to: "" });
      expect(r.offset.offset).toBeNull();
      expect(r.offset.reason).toBe(NO_OFFSET_TEXT);
    }
  });

  it("a span end with no offset asks for the offset", () => {
    const r = readTimeline(lib, {
      date: "",
      check: "",
      from: "2016-12-31T23:59:60",
      to: "2017-01-02T00:00:00Z",
    });
    expect(r.between.count).toBeNull();
    expect(r.between.reason).toBe(NO_OFFSET_TEXT);
  });

  it("a date that is not an instant says so", () => {
    const r = readTimeline(lib, { date: "soon", check: "", from: "", to: "" });
    expect(r.offset.reason).toBe(NOT_INSTANT_TEXT);
  });
});

describe("seeds and permalinks", () => {
  it("reads and writes only the non-blank keys, trimmed", () => {
    const state = readArgs({ date: " 2000-01-01T00:00:00Z ", to: 5 as never });
    expect(state).toEqual({
      date: "2000-01-01T00:00:00Z",
      check: "",
      from: "",
      to: "",
    });
    expect(permalinkOf(state)).toEqual({ date: "2000-01-01T00:00:00Z" });
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ check: "" })).toBe(true);
  });

  it("round-trips every preset", () => {
    for (const p of TIMELINE_PRESETS) {
      const state: TimelineState = presetState(p);
      expect(readArgs(permalinkOf(state))).toEqual(state);
    }
  });
});

describe("the axis and the slider", () => {
  const MAY_2026 = utcMs("2026-05-01T00:00:00Z");
  const MARCH_2030 = utcMs("2030-03-10T15:30:00Z");

  it("ends at continuous UTC while today is earlier, and at today after it", () => {
    expect(convertUnixToUtc(sliderEndMs(MAY_2026))).toBe(
      "2027-05-20T00:00:00Z",
    );
    expect(convertUnixToUtc(sliderEndMs(MARCH_2030))).toBe(
      "2030-03-10T00:00:00Z",
    );
    expect(sliderDate(sliderMax(MAY_2026))).toBe("2027-05-20T00:00:00Z");
    expect(sliderDate(sliderMax(MARCH_2030))).toBe("2030-03-10T00:00:00Z");
  });

  it("starts at 1972-01-01 and runs a year past the slider", () => {
    expect(sliderDate(0)).toBe("1972-01-01T00:00:00Z");
    expect(convertUnixToUtc(axisEndMs(MAY_2026))).toBe("2028-05-20T00:00:00Z");
    expect(axisPercent(AXIS_START_MS, MAY_2026)).toEqual({
      pct: 0,
      beyond: null,
    });
    expect(axisPercent(utcMs("2100-01-01T00:00:00Z"), MAY_2026)).toEqual({
      pct: 100,
      beyond: "after",
    });
    expect(axisPercent(utcMs("1960-01-01T00:00:00Z"), MAY_2026).beyond).toBe(
      "before",
    );
  });

  it("places a typed date and clamps it", () => {
    expect(sliderPosition("1972-01-02T12:00:00Z", MAY_2026)).toBe(1);
    expect(sliderPosition("2100-01-01T00:00:00Z", MAY_2026)).toBe(
      sliderMax(MAY_2026),
    );
    expect(sliderPosition("soon", MAY_2026)).toBeNull();
    expect(sliderPosition("", MAY_2026)).toBeNull();
  });

  it("places a second 60 on its own 59 for drawing only", () => {
    expect(drawMs("2016-12-31T23:59:60Z")).toBe(utcMs("2016-12-31T23:59:59Z"));
    // An offset spelling is not a UTC instant to the library, so it has no place.
    expect(drawMs("2009-01-01T08:59:60+09:00")).toBe(
      utcMs("2008-12-31T23:59:59Z"),
    );
    expect(drawMs("2016-01-01T09:00:00+09:00")).toBe(
      utcMs("2016-01-01T00:00:00Z"),
    );
    expect(drawMs("garbage")).toBeNull();
  });

  it("ticks every five years from 1975", () => {
    const ticks = axisTicks(MAY_2026);
    expect(ticks[0]!.year).toBe(1975);
    expect(ticks.at(-1)!.year).toBe(2025);
    expect(ticks.every((t) => t.pct > 0 && t.pct < 100)).toBe(true);
  });
});

describe("sentences", () => {
  it("says every reading the state asked for", () => {
    const state = presetState(preset("from-2000"));
    const text = summaryText(state, readTimeline(lib, state));
    expect(text).toContain("27 leap seconds");
    expect(text).toContain("is 32 seconds");
    expect(text).toContain("5 leap seconds between");
    expect(text).toContain(VERDICT_INSERTED);
  });

  it("says no signal with the reason", () => {
    const state = presetState(preset("before-1972"));
    expect(summaryText(state, readTimeline(lib, state))).toContain(
      BEFORE_1972_TEXT,
    );
  });

  it("three blank plates are empty, with their lines kept", () => {
    const plates = blankPlates();
    expect(plates.map((p) => p.value)).toEqual([null, null, null]);
    expect(plates.every((p) => p.lines.length === 2)).toBe(true);
  });
});
