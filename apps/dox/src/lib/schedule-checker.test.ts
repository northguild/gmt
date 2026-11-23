/** The checker's facts against the real library: one row per kind, and every preset. */
import { OPERATING_SCHEDULE_PRESETS } from "~/data/operating-schedule-presets";
import { loadHoursLib, type HoursLib } from "./hours-lib";
import {
  CLOSED_TITLE,
  OPEN_TITLE,
  REFUSED_TITLE,
  checkSchedule,
  intervalsResult,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  refusedLines,
  validResult,
  verdictOf,
  type CheckerState,
} from "./schedule-checker";

let lib: HoursLib;
beforeAll(async () => {
  lib = await loadHoursLib();
});

const preset = (id: string) =>
  OPERATING_SCHEDULE_PRESETS.find((p) => p.id === id)!;
const check = (id: string, over: Partial<CheckerState> = {}) =>
  checkSchedule(lib, { ...presetState(preset(id)), ...over });
const fnsOf = (f: ReturnType<typeof check>) =>
  "calls" in f ? f.calls.map((c) => c.fn) : [];

describe("one row per kind", () => {
  it("not-json makes no call", () => {
    const f = checkSchedule(lib, { schedule: "{", start: "", end: "" });
    expect(f).toEqual({ kind: "not-json" });
    expect(validResult(f)).toBeNull();
    expect(intervalsResult(f)).toBeNull();
  });

  it("refused still asks operatingIntervals when an interval is typed", () => {
    const f = check("london-weekday-8");
    expect(f.kind).toBe("refused");
    expect(fnsOf(f)).toEqual([
      "isValidOperatingSchedule",
      "operatingIntervals",
    ]);
    expect(validResult(f)).toBe(false);
    expect(intervalsResult(f)).toEqual([]);
    expect(verdictOf(f)).toMatchObject({
      title: REFUSED_TITLE,
      tone: "sentinel",
    });
  });

  it("refused with no interval makes one call", () => {
    const f = check("london-weekday-8", { start: "", end: "" });
    expect(fnsOf(f)).toEqual(["isValidOperatingSchedule"]);
  });

  it("no-interval when a valid schedule has a blank end", () => {
    const f = check("tokyo-desk", { end: "" });
    expect(f.kind).toBe("no-interval");
    expect(fnsOf(f)).toEqual(["isValidOperatingSchedule"]);
    expect(validResult(f)).toBe(true);
  });

  it("interval-refused when the interval is not an interval", () => {
    const f = check("tokyo-desk", { start: "yesterday" });
    expect(f.kind).toBe("interval-refused");
    expect(verdictOf(f).tone).toBe("sentinel");
  });

  it("closed is a plain word, not the sentinel", () => {
    const f = check("johannesburg-holidays");
    expect(f.kind).toBe("closed");
    expect(verdictOf(f)).toMatchObject({
      title: CLOSED_TITLE,
      tone: "neutral",
    });
    expect(intervalsResult(f)).toEqual([]);
  });

  it("open names the intervals and the open time", () => {
    const f = check("tokyo-desk");
    if (f.kind !== "open") throw new Error(`expected open, got ${f.kind}`);
    expect(f.intervals).toHaveLength(5);
    expect(f.openTime).toBe("PT45H");
    expect(fnsOf(f)).toEqual([
      "isValidOperatingSchedule",
      "isValidInterval",
      "operatingIntervals",
      "operatingTimeBetween",
    ]);
    expect(verdictOf(f).title).toBe(OPEN_TITLE);
  });
});

describe("every preset against the real library", () => {
  it.each([
    ["tokyo-desk", "open"],
    ["johannesburg-holidays", "closed"],
    ["london-weekday-8", "refused"],
    ["kolkata-annotated-holiday", "refused"],
    ["sao-paulo-two-overrides", "refused"],
    ["sydney-night-curfew", "open"],
  ])("%s is %s", (id, kind) => {
    expect(check(id).kind).toBe(kind);
  });

  it("covers every preset", () => {
    expect(OPERATING_SCHEDULE_PRESETS).toHaveLength(6);
  });

  it("names the weekday 8 and says two overrides are only an example", () => {
    const f = check("london-weekday-8");
    if (f.kind !== "refused") throw new Error("expected refused");
    expect(refusedLines(f.probe).join(" ")).toContain('weekly["8"]');
    const together = check("sao-paulo-two-overrides");
    if (together.kind !== "refused") throw new Error("expected refused");
    expect(refusedLines(together.probe).join(" ")).toMatch(/for example/);
  });
});

describe("state", () => {
  it("reads a preset arg with its interval", () => {
    const p = preset("sydney-night-curfew");
    expect(readArgs({ preset: p.id })).toEqual(presetState(p));
  });

  it("reads typed arguments exactly, without defaults", () => {
    expect(readArgs({ schedule: " {} ", start: "a" })).toEqual({
      schedule: " {} ",
      start: "a",
      end: "",
    });
  });

  it("is seeded by a schedule or a preset only", () => {
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ schedule: "{}" })).toBe(true);
    expect(isSeeded({ preset: "tokyo-desk" })).toBe(true);
  });

  it("puts only what is typed in the permalink", () => {
    expect(permalinkOf({ schedule: "{}", start: "", end: "" })).toEqual({
      schedule: "{}",
    });
  });

  it("matches a preset by its text, else custom", () => {
    const p = preset("tokyo-desk");
    expect(matchPreset(p.text)).toBe(p.id);
    expect(matchPreset(`${p.text} `)).toBe("custom");
  });
});
