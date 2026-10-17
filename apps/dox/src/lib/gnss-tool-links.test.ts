/**
 * The links between the five GNSS and leap-second tools, against the real
 * library. Each link is a permalink built by `encodeWidgetPermalink`; its round
 * trip runs through `seedFromLocation` into the target tool's own `readArgs`,
 * and the target then reads the same moment. With no result a link has nothing
 * to send.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lib as gnssLib } from "~/test/gnss-lib";
import { lib as timescaleLib } from "~/test/timescale-lib";
import {
  GNSS_PRESETS,
  decoderHandoffs,
  presetState as decoderPreset,
  readArgs as readDecoderArgs,
  readGnss,
} from "./gnss-week-decoder";
import {
  CLOCK_PRESETS,
  clockHandoffs,
  presetState as clockPreset,
  readArgs as readClockArgs,
  readClocks,
} from "./satellite-clock-converter";
import {
  ROLLOVER_PRESETS,
  presetState as rolloverPreset,
  readArgs as readRolloverArgs,
  readRollover,
  rolloverHandoffs,
} from "./gnss-rollover-checker";
import {
  TIMELINE_PRESETS,
  presetState as timelinePreset,
  readArgs as readTimelineArgs,
  readTimeline,
  timelineHandoffs,
} from "./leap-second-timeline";
import {
  ELAPSED_PRESETS,
  elapsedHandoffs,
  presetState as elapsedPreset,
  readArgs as readElapsedArgs,
  readElapsed,
} from "./elapsed-vs-clock";
import {
  WIDGET_PAGE_PATHS,
  handoffHref,
  seedFromLocation,
  type ToolHandoff,
} from "./widget-permalink";

const NOW = "2026-10-15T00:00:00Z";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** The seed a reader lands on after following `handoff`, through the real
 *  permalink reader. */
function landing(handoff: ToolHandoff | null) {
  const href = handoffHref(handoff);
  expect(href).not.toBeNull();
  expect(href!.startsWith(WIDGET_PAGE_PATHS[handoff!.kind] + "?")).toBe(true);
  return seedFromLocation(handoff!.kind, href!.slice(href!.indexOf("?")));
}

const pick = <T extends { id: string }>(list: readonly T[], id: string): T =>
  list.find((p) => p.id === id)!;

describe("GNSS Week Decoder links", () => {
  const read = (id: string) =>
    readGnss(gnssLib, decoderPreset(pick(GNSS_PRESETS, id)), NOW);

  it("sends the UTC result to the Clock Converter", () => {
    const r = read("galileo-2019");
    const seed = landing(decoderHandoffs(r).clocks);
    expect(seed).toEqual({ value: "2019-04-07T00:00:00Z" });
    expect(readClockArgs(seed).value).toBe("2019-04-07T00:00:00Z");
  });

  it("sends the counter, the build date and the date to the Rollover Checker", () => {
    const r = read("not-before-2020");
    const seed = landing(decoderHandoffs(r).rollover);
    expect(seed).toEqual({
      counter: r.counter,
      firmwareNotBefore: r.state.pivot.trim(),
      date: "2024-01-01T00:00:00Z",
    });
    expect(readRolloverArgs(seed).pivot).toBe(r.state.pivot.trim());
  });

  it("sends an integer era as firmwareEra, and the era rolling chose", () => {
    const fixed = landing(decoderHandoffs(read("galileo-2019")).rollover);
    expect(fixed).toMatchObject({ counter: "GAL", firmwareEra: "0" });
    const rolling = decoderHandoffs(read("nearest-today"));
    expect(rolling.rollover?.args["firmwareEra"]).toMatch(/^\d+$/);
  });

  it("has nothing to send without a result", () => {
    const none = decoderHandoffs(read("week-past-the-counter"));
    expect(none).toEqual({ clocks: null, rollover: null });
    expect(handoffHref(none.clocks)).toBeNull();
  });

  it("sends no counter from a RINEX reading", () => {
    const r = decoderHandoffs(read("rinex-navic"));
    expect(r.clocks).not.toBeNull();
    expect(r.rollover).toBeNull();
  });

  it("round-trips back into the decoder", () => {
    const seed = { mode: "utc", utc: "2024-01-01T00:00:00Z" };
    expect(readDecoderArgs(seed).utc).toBe("2024-01-01T00:00:00Z");
  });
});

describe("Satellite Clock Converter links", () => {
  const read = (id: string) =>
    readClocks(gnssLib, clockPreset(pick(CLOCK_PRESETS, id)));

  it("sends the UTC instant to the Week Decoder and to the timeline", () => {
    const r = read("utc-2024");
    const { weeks, timeline } = clockHandoffs(r);
    const w = landing(weeks);
    expect(w).toEqual({ mode: "utc", utc: "2024-01-01T00:00:00Z" });
    expect(readDecoderArgs(w).utc).toBe("2024-01-01T00:00:00Z");
    expect(landing(timeline)).toEqual({ date: "2024-01-01T00:00:00Z" });
  });

  it("sends the UTC instant a TAI reading stands for, not the string typed", () => {
    const r = read("tai-reading");
    expect(r.utc).not.toBeNull();
    expect(landing(clockHandoffs(r).weeks)["utc"]).toBe(r.utc);
  });

  it("has nothing to send when no clock was read", () => {
    expect(clockHandoffs(read("wrong-token"))).toEqual({
      weeks: null,
      timeline: null,
    });
  });
});

describe("GNSS Rollover Checker link", () => {
  const read = (id: string) =>
    readRollover(gnssLib, rolloverPreset(pick(ROLLOVER_PRESETS, id)), NOW);

  it("sends the broadcast week and time of week with the build date", () => {
    const r = read("navic-built-2020");
    const seed = landing(rolloverHandoffs(r).eras);
    expect(seed).toMatchObject({
      mode: "broadcast",
      counter: "IRN-LNAV",
      rolloverNotBefore: r.state.pivot.trim(),
    });
    expect(seed["week"]).toBe(String(r.broadcast!.week));
    expect(seed["timeOfWeekSeconds"]).toBe(
      String(r.broadcast!.timeOfWeekSeconds),
    );
    expect(readDecoderArgs(seed).mode).toBe("broadcast");
  });

  it("sends a fixed era as rolloverEra", () => {
    const seed = landing(rolloverHandoffs(read("navic-fixed-era")).eras);
    expect(seed).toMatchObject({ counter: "IRN-LNAV" });
    expect(seed["rolloverEra"]).toMatch(/^\d+$/);
    expect(seed["rolloverNotBefore"]).toBeUndefined();
  });

  it("opens the decoder on the same instant the checker reported", () => {
    const r = read("navic-built-2020");
    const seed = landing(rolloverHandoffs(r).eras);
    const d = readGnss(gnssLib, readDecoderArgs(seed), NOW);
    expect(d.status).toBe("ok");
    expect(d.utc).toBe(r.reported);
  });
});

describe("Leap Second Timeline links", () => {
  const state = (id: string) => timelinePreset(pick(TIMELINE_PRESETS, id));

  it("sends the span to Elapsed vs. Clock and the date to the converter", () => {
    const s = state("from-2000");
    const links = timelineHandoffs(s, readTimeline(timescaleLib, s));
    const e = landing(links.elapsed);
    expect(e).toEqual({
      start: "2000-01-01T00:00:00Z",
      end: "2024-01-01T00:00:00Z",
    });
    expect(readElapsedArgs(e).start).toBe("2000-01-01T00:00:00Z");
    expect(landing(links.clocks)).toEqual({ value: "2000-01-01T00:00:00Z" });
  });

  it("has nothing to send for a span the library refused", () => {
    const s = { ...state("from-2000"), from: "not a date" };
    const read = readTimeline(timescaleLib, s);
    expect(read.between.count).toBeNull();
    expect(timelineHandoffs(s, read).elapsed).toBeNull();
  });

  it("has nothing to send with no date and no span", () => {
    const s = { ...state("from-2000"), date: "", from: "", to: "" };
    expect(timelineHandoffs(s, readTimeline(timescaleLib, s))).toEqual({
      elapsed: null,
      clocks: null,
    });
  });
});

describe("Elapsed vs. Clock links", () => {
  const state = (id: string) => elapsedPreset(pick(ELAPSED_PRESETS, id));

  it("sends the span to the timeline and the start to the converter", () => {
    const s = state("across-2016");
    const links = elapsedHandoffs(s, readElapsed(timescaleLib, s));
    const t = landing(links.timeline);
    expect(t).toEqual({ from: s.start.trim(), to: s.end.trim() });
    expect(readTimelineArgs(t).from).toBe(s.start.trim());
    expect(landing(links.clocks)).toEqual({ value: s.start.trim() });
  });

  it("has nothing to send with no result", () => {
    const s = { ...state("across-2016"), start: "", end: "" };
    expect(elapsedHandoffs(s, readElapsed(timescaleLib, s))).toEqual({
      timeline: null,
      clocks: null,
    });
  });
});
