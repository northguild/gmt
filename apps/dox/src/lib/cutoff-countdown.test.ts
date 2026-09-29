/// <reference types="vitest/globals" />
/**
 * `cutoff-countdown.ts`'s pure helpers, against the real gmt modules. Every
 * expected literal is an appendix Z row (C1-C10).
 */
import { Temporal } from "@js-temporal/polyfill";
import { isPastCutoff, timeToCutoff } from "@northguild/gmt/transport/compare";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import {
  axisWindow,
  collectCountdownFacts,
  COUNTDOWN_PRESETS,
  countdownNullReason,
  matchPreset,
  nowFromSlider,
  permalinkOf,
  presetState,
  readArgs,
  verdict,
  type CountdownState,
} from "./cutoff-countdown";
import type { CutoffLib } from "./cutoff-widgets";

const lib: CutoffLib = {
  cutoffAt: () => "",
  cutoffSchedule: () => [],
  isPastCutoff,
  timeToCutoff,
  etaAtZone,
  rollDate: () => "",
  isValidTimeZone,
  isValidDateTime,
  getUtcNow: () => "",
} as unknown as CutoffLib;

const AMS = "Europe/Amsterdam";
const presetById = (id: string) => COUNTDOWN_PRESETS.find((p) => p.id === id)!;

describe("readArgs", () => {
  it("is pinned when now is given, live otherwise", () => {
    expect(readArgs({ cutoff: "x", now: "y" }).mode).toBe("pinned");
    expect(readArgs({ cutoff: "x" }).mode).toBe("live");
  });
});

describe("collectCountdownFacts + verdict", () => {
  it("C1: 17:20, late by 20 min", () => {
    const facts = collectCountdownFacts(presetState(presetById("late")), lib);
    expect(facts.past).toBe(true);
    expect(facts.left).toBe("-PT20M");
    expect(verdict(facts)).toEqual({ kind: "late", text: "Late by 20 min." });
  });

  it("C2: 16:10, on time, PT50M left", () => {
    const facts = collectCountdownFacts(
      presetState(presetById("on-time")),
      lib,
    );
    expect(facts.past).toBe(false);
    expect(facts.left).toBe("PT50M");
    expect(verdict(facts)).toEqual({
      kind: "on-time",
      text: "On time: 50 min left.",
    });
  });

  it("C3: at the cut-off, closed", () => {
    const facts = collectCountdownFacts(
      presetState(presetById("at-cutoff")),
      lib,
    );
    expect(facts.past).toBe(true);
    expect(facts.left).toBe("PT0S");
    const v = verdict(facts);
    expect(v.kind).toBe("closed");
    expect(v.text).toContain("17:00");
  });

  it("C3b: one minute before, on time", () => {
    const state: CountdownState = {
      cutoff: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]",
      now: "2024-06-12T16:59:00+02:00",
      timeZone: AMS,
      mode: "pinned",
    };
    const facts = collectCountdownFacts(state, lib);
    expect(facts.past).toBe(false);
    expect(facts.left).toBe("PT1M");
    expect(verdict(facts)).toEqual({
      kind: "on-time",
      text: "On time: 1 min left.",
    });
  });

  it("C4: a New York clock, same instant, closed", () => {
    const facts = collectCountdownFacts(
      presetState(presetById("other-clock")),
      lib,
    );
    expect(facts.past).toBe(true);
    expect(facts.left).toBe("PT0S");
  });

  it("C5: repeated hour, late by 1 h", () => {
    const facts = collectCountdownFacts(
      presetState(presetById("repeated-hour")),
      lib,
    );
    expect(facts.past).toBe(true);
    expect(facts.left).toBe("-PT1H");
    expect(verdict(facts)).toEqual({ kind: "late", text: "Late by 1 h." });
  });

  it("C6: zoneless now, no verdict, both NO SIGNAL-worthy", () => {
    const facts = collectCountdownFacts(
      presetState(presetById("zoneless-now")),
      lib,
    );
    expect(facts.past).toBe(false);
    expect(facts.left).toBe("");
    expect(verdict(facts)).toEqual({ kind: "none", text: "" });
  });

  it("C7: cutoffAt's sentinel as the cut-off reads as not past", () => {
    const state: CountdownState = {
      cutoff: "",
      now: "2024-06-12T17:20:00+02:00",
      timeZone: AMS,
      mode: "pinned",
    };
    const facts = collectCountdownFacts(state, lib);
    expect(facts.past).toBe(false);
    expect(facts.left).toBe("");
  });

  it("C8: filing at the departure-based deadline, 60 h late", () => {
    const state: CountdownState = {
      cutoff: "2024-06-09T16:00:00+08:00[Asia/Shanghai]",
      now: "2024-06-12T04:00:00+08:00[Asia/Shanghai]",
      timeZone: "Asia/Shanghai",
      mode: "pinned",
    };
    const facts = collectCountdownFacts(state, lib);
    expect(facts.past).toBe(true);
    expect(facts.left).toBe("-PT60H");
  });
});

describe("countdownNullReason", () => {
  it("no-cutoff when the cut-off is blank", () => {
    const state: CountdownState = {
      cutoff: "",
      now: "x",
      timeZone: AMS,
      mode: "pinned",
    };
    expect(countdownNullReason(state, lib)).toBe("no-cutoff");
  });

  it("zoneless-now for a wall time with no offset", () => {
    const state = presetState(presetById("zoneless-now"));
    expect(countdownNullReason(state, lib)).toBe("zoneless-now");
  });

  it("zoneless-cutoff for a cut-off with no offset", () => {
    const state: CountdownState = {
      cutoff: "2024-06-12T17:00:00",
      now: "2024-06-12T17:20:00+02:00",
      timeZone: AMS,
      mode: "pinned",
    };
    expect(countdownNullReason(state, lib)).toBe("zoneless-cutoff");
  });

  it("invalid-zone for a zone this browser does not know", () => {
    const state: CountdownState = {
      cutoff: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]",
      now: "2024-06-12T17:20:00+02:00[Europe/Amsterdam]",
      timeZone: "Mars/Olympus_Mons",
      mode: "pinned",
    };
    expect(countdownNullReason(state, lib)).toBe("invalid-zone");
  });
});

describe("axisWindow", () => {
  it("C1: contains both instants with at least 30 min padding either side", () => {
    const w = axisWindow(
      "2024-06-12T17:00:00+02:00[Europe/Amsterdam]",
      "2024-06-12T17:20:00+02:00",
    );
    expect(w).not.toBeNull();
    const cutoffMs = Temporal.Instant.from(
      "2024-06-12T15:00:00Z",
    ).epochMilliseconds;
    const nowMs = Temporal.Instant.from(
      "2024-06-12T15:20:00Z",
    ).epochMilliseconds;
    expect(w!.startMs).toBeLessThanOrEqual(cutoffMs - 30 * 60_000);
    expect(w!.endMs).toBeGreaterThanOrEqual(nowMs + 30 * 60_000);
  });

  it("C8: a 60-hour gap gets 15 h of padding", () => {
    const w = axisWindow(
      "2024-06-09T16:00:00+08:00[Asia/Shanghai]",
      "2024-06-12T04:00:00+08:00[Asia/Shanghai]",
    );
    const cutoffMs = Temporal.Instant.from(
      "2024-06-09T08:00:00Z",
    ).epochMilliseconds;
    const nowMs = Temporal.Instant.from(
      "2024-06-11T20:00:00Z",
    ).epochMilliseconds;
    expect(nowMs - cutoffMs).toBe(60 * 3_600_000);
    expect(w!.startMs).toBe(cutoffMs - 15 * 3_600_000);
    expect(w!.endMs).toBe(nowMs + 15 * 3_600_000);
  });
});

describe("nowFromSlider", () => {
  it("+20 from the gate-in cut-off in Amsterdam", () => {
    expect(
      nowFromSlider(
        "2024-06-12T17:00:00+02:00[Europe/Amsterdam]",
        20,
        "Europe/Amsterdam",
      ),
    ).toBe("2024-06-12T17:20:00+02:00[Europe/Amsterdam]");
  });
});

describe("matchPreset / permalinkOf", () => {
  it("matches every preset", () => {
    for (const preset of COUNTDOWN_PRESETS) {
      expect(matchPreset(presetState(preset))).toBe(preset.id);
    }
  });

  it("omits now in live mode", () => {
    const state: CountdownState = {
      cutoff: "x",
      now: "y",
      timeZone: AMS,
      mode: "live",
    };
    expect(permalinkOf(state).now).toBeUndefined();
  });

  it("keeps now in pinned mode", () => {
    const state = presetState(presetById("late"));
    expect(permalinkOf(state).now).toBe(state.now);
  });
});
