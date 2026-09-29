/// <reference types="vitest/globals" />
/**
 * `cutoff-ruler.ts`'s pure helpers, against the real gmt modules. Every
 * expected literal is an appendix Z row (R1-R5, RA).
 */
import { cutoffAt } from "@northguild/gmt/transport/calculate";
import { timeToCutoff } from "@northguild/gmt/transport/compare";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import {
  collectRulerFacts,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readingsOf,
  RULER_PRESETS,
  rulerNullReason,
  transitionBetween,
  transitionLabel,
  type RulerState,
} from "./cutoff-ruler";
import type { CutoffLib } from "./cutoff-widgets";

const lib: CutoffLib = {
  cutoffAt,
  cutoffSchedule: () => [],
  isPastCutoff: () => false,
  timeToCutoff,
  etaAtZone,
  rollDate: () => "",
  isValidTimeZone,
  isValidDateTime,
  getUtcNow: () => "",
} as unknown as CutoffLib;

const NY = "America/New_York";

const presetById = (id: string) => RULER_PRESETS.find((p) => p.id === id)!;

describe("readingsOf", () => {
  it("builds the three calls for days=2", () => {
    const specs = readingsOf({
      anchor: "x",
      timeZone: NY,
      days: "2",
      atLocalTime: "17:00",
    });
    expect(specs.map((s) => s.offset)).toEqual(["P2D", "PT48H", "P2D"]);
    expect(specs[2]!.options).toEqual({ timeZone: NY, atLocalTime: "17:00" });
    expect(specs[0]!.label).toBe("2 calendar days (P2D)");
    expect(specs[1]!.label).toBe("48 exact hours (PT48H)");
  });

  it("builds PT168H for days=7, and PT24H for days=1", () => {
    expect(
      readingsOf({ anchor: "x", timeZone: NY, days: "7", atLocalTime: "" })[1]!
        .offset,
    ).toBe("PT168H");
    expect(
      readingsOf({ anchor: "x", timeZone: NY, days: "1", atLocalTime: "" })[1]!
        .offset,
    ).toBe("PT24H");
  });
});

describe("collectRulerFacts", () => {
  it("R1: New York fall-back — 49h/48h/50h", () => {
    const facts = collectRulerFacts(
      presetState(presetById("new-york-fall-back")),
      lib,
    );
    const [calendar, exact, pinned] = facts.readings;
    expect(calendar!.at).toBe("2024-11-02T18:00:00-04:00[America/New_York]");
    expect(calendar!.hoursBefore).toBe("PT49H");
    expect(exact!.at).toBe("2024-11-02T19:00:00-04:00[America/New_York]");
    expect(exact!.hoursBefore).toBe("PT48H");
    expect(pinned!.at).toBe("2024-11-02T17:00:00-04:00[America/New_York]");
    expect(pinned!.hoursBefore).toBe("PT50H");
  });

  it("R2: Amsterdam, no transition — P2D and PT48H agree", () => {
    const facts = collectRulerFacts(
      presetState(presetById("amsterdam-june")),
      lib,
    );
    const [calendar, exact, pinned] = facts.readings;
    expect(calendar!.at).toBe(exact!.at);
    expect(calendar!.at).toBe("2024-06-12T18:00:00+02:00[Europe/Amsterdam]");
    expect(pinned!.at).toBe("2024-06-12T17:00:00+02:00[Europe/Amsterdam]");
    expect(pinned!.hoursBefore).toBe("PT49H");
  });

  it("R3: New York spring-forward — PT48H and pinned coincide", () => {
    const facts = collectRulerFacts(
      presetState(presetById("new-york-spring-forward")),
      lib,
    );
    const [calendar, exact, pinned] = facts.readings;
    expect(calendar!.at).toBe("2024-03-09T18:00:00-05:00[America/New_York]");
    expect(calendar!.hoursBefore).toBe("PT47H");
    expect(exact!.at).toBe("2024-03-09T17:00:00-05:00[America/New_York]");
    expect(pinned!.at).toBe(exact!.at);
  });

  it("R4: repeated hour — the first 01:30, -04:00", () => {
    const facts = collectRulerFacts(
      presetState(presetById("repeated-hour")),
      lib,
    );
    const pinned = facts.readings[2]!;
    expect(pinned.at).toBe("2024-11-03T01:30:00-04:00[America/New_York]");
    expect(pinned.hoursBefore).toBe("PT41H30M");
  });

  it("R5: skipped hour — the pinned reading is ''", () => {
    const facts = collectRulerFacts(
      presetState(presetById("skipped-hour")),
      lib,
    );
    const [calendar, exact, pinned] = facts.readings;
    expect(calendar!.at).toBe("2024-03-10T18:00:00-04:00[America/New_York]");
    expect(exact!.at).toBe(calendar!.at);
    expect(pinned!.at).toBe("");
    expect(pinned!.hoursBefore).toBe("");
  });

  it("RA: the departure is rendered by etaAtZone", () => {
    expect(
      collectRulerFacts(presetState(presetById("new-york-fall-back")), lib)
        .departure,
    ).toBe("2024-11-04T18:00:00-05:00[America/New_York]");
    expect(
      collectRulerFacts(presetState(presetById("amsterdam-june")), lib)
        .departure,
    ).toBe("2024-06-14T18:00:00+02:00[Europe/Amsterdam]");
  });
});

describe("transitionBetween", () => {
  it("R1: fall-back, go back 1 h", () => {
    const state = presetState(presetById("new-york-fall-back"));
    const facts = collectRulerFacts(state, lib);
    const t = transitionBetween(state, facts);
    expect(t).not.toBeNull();
    expect(t!.wallBefore).toBe("02:00");
    expect(t!.wallAfter).toBe("01:00");
    expect(transitionLabel(t!, state.timeZone)).toContain("go back 1 h");
  });

  it("R3: spring-forward, go forward 1 h", () => {
    const state = presetState(presetById("new-york-spring-forward"));
    const facts = collectRulerFacts(state, lib);
    const t = transitionBetween(state, facts);
    expect(t).not.toBeNull();
    expect(t!.wallBefore).toBe("02:00");
    expect(t!.wallAfter).toBe("03:00");
    expect(transitionLabel(t!, state.timeZone)).toContain("go forward 1 h");
  });

  it("R2: no transition between them", () => {
    const state = presetState(presetById("amsterdam-june"));
    const facts = collectRulerFacts(state, lib);
    expect(transitionBetween(state, facts)).toBeNull();
  });
});

describe("rulerNullReason", () => {
  it("names the skipped-hour reason for R5's pinned reading", () => {
    const state = presetState(presetById("skipped-hour"));
    const facts = collectRulerFacts(state, lib);
    const pinned = facts.readings[2]!;
    expect(rulerNullReason(pinned, state, lib)).toBe("skipped-hour");
  });

  it("is null for a resolved reading", () => {
    const state = presetState(presetById("skipped-hour"));
    const facts = collectRulerFacts(state, lib);
    expect(rulerNullReason(facts.readings[0]!, state, lib)).toBeNull();
  });
});

describe("readArgs", () => {
  it("takes days as a number or a string", () => {
    expect(readArgs({ days: 2 }).days).toBe("2");
    expect(readArgs({ days: "2" }).days).toBe("2");
  });
});

describe("matchPreset / permalinkOf", () => {
  it("matches every preset and round-trips as strings", () => {
    for (const preset of RULER_PRESETS) {
      const state = presetState(preset);
      expect(matchPreset(state)).toBe(preset.id);
      const link = permalinkOf(state);
      for (const v of Object.values(link)) expect(typeof v).toBe("string");
      expect(link.days).toBe(preset.days);
    }
  });

  it("is custom otherwise", () => {
    const state: RulerState = {
      ...presetState(presetById("amsterdam-june")),
      days: "3",
    };
    expect(matchPreset(state)).toBe("custom");
  });
});
