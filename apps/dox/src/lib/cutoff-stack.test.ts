/// <reference types="vitest/globals" />
/**
 * `cutoff-stack.ts`'s pure helpers, against the real gmt modules. Every
 * expected literal is an appendix Z row.
 */
import { cutoffAt, cutoffSchedule } from "@northguild/gmt/transport/calculate";
import { isPastCutoff, timeToCutoff } from "@northguild/gmt/transport/compare";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { rollDate } from "@northguild/gmt/calendar/business";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import {
  collectStackFacts,
  entriesOf,
  matchPreset,
  optionsOf,
  permalinkOf,
  presetState,
  readArgs,
  STACK_PRESETS,
  stackNullReason,
  stackNullText,
  type StackState,
} from "./cutoff-stack";
import type { CutoffLib } from "./cutoff-widgets";

const lib: CutoffLib = {
  cutoffAt,
  cutoffSchedule,
  isPastCutoff,
  timeToCutoff,
  etaAtZone,
  rollDate,
  isValidTimeZone,
  isValidDateTime,
  getUtcNow: () => "",
} as unknown as CutoffLib;

const AMS = "Europe/Amsterdam";
const SAIL = "2024-06-17T18:00:00+02:00[Europe/Amsterdam]";

const presetById = (id: string) => STACK_PRESETS.find((p) => p.id === id)!;

describe("readArgs", () => {
  it("takes the chat's cutoffs array over the flat keys", () => {
    const state = readArgs({
      anchor: SAIL,
      timeZone: AMS,
      cutoffs: [
        { name: "gate-in", offset: "P2D", atLocalTime: "17:00" },
        { name: "documents", offset: "P3D", atLocalTime: "12:00" },
      ],
      weekend: [6, 7],
      roll: "preceding",
      name1: "ignored",
    });
    expect(state.cutoffCount).toBe("2");
    expect(state.cutoffs[0]).toEqual({
      name: "gate-in",
      offset: "P2D",
      atLocalTime: "17:00",
    });
    expect(state.calendar).toBe(true);
    expect(state.weekend).toEqual([6, 7]);
    expect(state.roll).toBe("preceding");
  });

  it("reads the flat permalink keys with calendar: 'on'", () => {
    const state = readArgs({
      anchor: SAIL,
      timeZone: AMS,
      cutoffCount: "2",
      name1: "gate-in",
      offset1: "P2D",
      atLocalTime1: "17:00",
      name2: "documents",
      offset2: "P3D",
      atLocalTime2: "12:00",
      calendar: "on",
      weekend: "6,7",
      roll: "preceding",
    });
    expect(state.cutoffCount).toBe("2");
    expect(state.calendar).toBe(true);
    expect(state.weekend).toEqual([6, 7]);
    expect(state.cutoffs[1]).toEqual({
      name: "documents",
      offset: "P3D",
      atLocalTime: "12:00",
    });
  });

  it("infers calendar on from holidays with no weekend, and gives weekend: []", () => {
    const state = readArgs({
      anchor: SAIL,
      timeZone: AMS,
      cutoffs: [{ name: "documents", offset: "P1D" }],
      holidays: ["2024-05-09"],
      roll: "preceding",
    });
    expect(state.calendar).toBe(true);
    expect(state.weekend).toEqual([]);
  });

  it("never defaults roll", () => {
    const state = readArgs({ anchor: SAIL, timeZone: AMS, cutoffs: [] });
    expect(state.roll).toBe("");
  });

  it("turns junk into blank fields rather than throwing", () => {
    const state = readArgs({
      anchor: 42 as unknown as string,
      cutoffs: [{ name: 1 as unknown as string }],
    });
    expect(state.anchor).toBe("");
    expect(state.cutoffs[0]!.name).toBe("");
  });
});

describe("optionsOf", () => {
  it("is just { timeZone } with no calendar and no roll", () => {
    const state = presetState(presetById("no-calendar"));
    expect(optionsOf(state)).toEqual({ timeZone: AMS });
  });

  it("adds calendar (holidays split, trimmed, blanks dropped) and roll", () => {
    const state: StackState = {
      ...presetState(presetById("rotterdam-weekend")),
      holidays: " 2024-05-09 , , 2024-12-25 ",
    };
    expect(optionsOf(state)).toEqual({
      timeZone: AMS,
      calendar: {
        weekend: [6, 7],
        holidays: ["2024-05-09", "2024-12-25"],
        timeZone: AMS,
      },
      roll: "preceding",
    });
  });

  it("omits roll when blank", () => {
    const state = presetState(presetById("no-roll"));
    expect(optionsOf(state)).toEqual({
      timeZone: AMS,
      calendar: { weekend: [6, 7], holidays: [], timeZone: AMS },
    });
  });
});

describe("entriesOf", () => {
  it("keeps only visible rows with a non-blank offset", () => {
    const state = presetState(presetById("rotterdam-weekend"));
    expect(entriesOf(state)).toEqual([
      { name: "gate-in", offset: "P2D", atLocalTime: "17:00" },
      { name: "documents", offset: "P3D", atLocalTime: "12:00" },
    ]);
  });

  it("omits atLocalTime rather than sending it blank", () => {
    const state = presetState(presetById("no-calendar"));
    expect(entriesOf(state)[0]).toEqual({ name: "gate-in", offset: "P1D" });
  });

  it("is [] with no entries", () => {
    const state = readArgs({ anchor: SAIL, timeZone: AMS, cutoffs: [] });
    expect(entriesOf(state)).toEqual([]);
  });
});

describe("matchPreset", () => {
  it("matches every preset", () => {
    for (const preset of STACK_PRESETS) {
      expect(matchPreset(presetState(preset))).toBe(preset.id);
    }
  });

  it("is custom otherwise", () => {
    const state = presetState(presetById("rotterdam-weekend"));
    expect(matchPreset({ ...state, roll: "following" })).toBe("custom");
  });
});

describe("permalinkOf", () => {
  it("round-trips the pill preset (PS1)", () => {
    const state = presetState(presetById("rotterdam-weekend"));
    expect(permalinkOf(state)).toEqual({
      anchor: SAIL,
      timeZone: AMS,
      cutoffCount: "2",
      name1: "gate-in",
      offset1: "P2D",
      atLocalTime1: "17:00",
      name2: "documents",
      offset2: "P3D",
      atLocalTime2: "12:00",
      calendar: "on",
      weekend: "6,7",
      roll: "preceding",
    });
  });

  it("omits calendar/weekend/holidays/roll when unset", () => {
    const state = presetState(presetById("no-calendar"));
    const link = permalinkOf(state);
    expect(link.calendar).toBeUndefined();
    expect(link.weekend).toBeUndefined();
    expect(link.holidays).toBeUndefined();
    expect(link.roll).toBeUndefined();
  });
});

describe("collectStackFacts", () => {
  it("S1: gate-in moved from Sat 15 Jun, documents not", () => {
    const facts = collectStackFacts(
      presetState(presetById("rotterdam-weekend")),
      lib,
    );
    expect(facts.result).toEqual([
      { name: "documents", at: "2024-06-14T12:00:00+02:00[Europe/Amsterdam]" },
      { name: "gate-in", at: "2024-06-14T17:00:00+02:00[Europe/Amsterdam]" },
    ]);
    const [documents, gateIn] = facts.rows;
    expect(documents!.moved).toBe(false);
    expect(gateIn!.moved).toBe(true);
    expect(gateIn!.unrolled).toBe(
      "2024-06-15T17:00:00+02:00[Europe/Amsterdam]",
    );
    // S1x, S1y
    expect(documents!.beforeDeparture).toBe("PT78H");
    expect(gateIn!.beforeDeparture).toBe("PT73H");
    expect(documents!.afterDeparture).toBe(false);
    expect(gateIn!.afterDeparture).toBe(false);
  });

  it("S2: gate-in and VGM moved, documents not", () => {
    const facts = collectStackFacts(
      presetState(presetById("rotterdam-following")),
      lib,
    );
    expect(facts.result).toEqual([
      { name: "documents", at: "2024-06-14T12:00:00+02:00[Europe/Amsterdam]" },
      { name: "VGM", at: "2024-06-17T10:00:00+02:00[Europe/Amsterdam]" },
      { name: "gate-in", at: "2024-06-17T17:00:00+02:00[Europe/Amsterdam]" },
    ]);
    const byName = new Map(facts.rows.map((r) => [r.name, r]));
    expect(byName.get("documents")!.moved).toBe(false);
    expect(byName.get("VGM")!.moved).toBe(true);
    expect(byName.get("gate-in")!.moved).toBe(true);
    // S2x, S2y — gate-in lands 1 h before sailing
    expect(byName.get("gate-in")!.beforeDeparture).toBe("PT1H");
    expect(byName.get("VGM")!.beforeDeparture).toBe("PT8H");
  });

  it("S6: documents moved from 2024-05-09T12:00, gate-in not", () => {
    const facts = collectStackFacts(presetState(presetById("holiday")), lib);
    expect(facts.result).toEqual([
      { name: "documents", at: "2024-05-08T12:00:00+02:00[Europe/Amsterdam]" },
      { name: "gate-in", at: "2024-05-10T12:00:00+02:00[Europe/Amsterdam]" },
    ]);
    const byName = new Map(facts.rows.map((r) => [r.name, r]));
    expect(byName.get("documents")!.moved).toBe(true);
    expect(byName.get("documents")!.unrolled).toBe(
      "2024-05-09T12:00:00+02:00[Europe/Amsterdam]",
    );
    expect(byName.get("gate-in")!.moved).toBe(false);
  });

  it("SC: the weekend is shaded, holidays are not", () => {
    const facts = collectStackFacts(
      presetState(presetById("rotterdam-weekend")),
      lib,
    );
    expect(facts.closedDays["2024-06-14"]).toBe(false);
    expect(facts.closedDays["2024-06-15"]).toBe(true);
    expect(facts.closedDays["2024-06-16"]).toBe(true);
    expect(facts.closedDays["2024-06-17"]).toBe(false);
  });

  it("SC2: a holiday is shaded too", () => {
    const facts = collectStackFacts(presetState(presetById("holiday")), lib);
    expect(facts.closedDays["2024-05-08"]).toBe(false);
    expect(facts.closedDays["2024-05-09"]).toBe(true);
    expect(facts.closedDays["2024-05-10"]).toBe(false);
  });

  it("S7: following can land a cut-off after the departure", () => {
    const state: StackState = {
      ...presetState(presetById("rotterdam-following")),
      anchor: "2024-06-17T09:00:00+02:00[Europe/Amsterdam]",
      cutoffs: [
        { name: "gate-in", offset: "P1D", atLocalTime: "17:00" },
        { name: "documents", offset: "P3D", atLocalTime: "12:00" },
        { name: "", offset: "", atLocalTime: "" },
        { name: "", offset: "", atLocalTime: "" },
      ],
      cutoffCount: "2",
    };
    const facts = collectStackFacts(state, lib);
    const gateIn = facts.rows.find((r) => r.name === "gate-in")!;
    expect(gateIn.at).toBe("2024-06-17T17:00:00+02:00[Europe/Amsterdam]");
    expect(gateIn.afterDeparture).toBe(true);
    expect(gateIn.beforeDeparture).toBe("-PT8H");
  });

  it("returns [] with no calendar, at no cost to timeToCutoff/isPastCutoff", () => {
    const facts = collectStackFacts(
      presetState(presetById("no-calendar")),
      lib,
    );
    expect(facts.result).toEqual([
      { name: "document", at: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]" },
      { name: "VGM", at: "2024-06-13T10:00:00+02:00[Europe/Amsterdam]" },
      { name: "gate-in", at: "2024-06-13T18:00:00+02:00[Europe/Amsterdam]" },
    ]);
    expect(facts.closedDays).toEqual({});
  });
});

describe("stackNullReason", () => {
  const base = presetState(presetById("rotterdam-weekend"));

  it("S3: calendar without roll", () => {
    const state: StackState = { ...base, roll: "" };
    const facts = collectStackFacts(state, lib);
    expect(facts.result).toEqual([]);
    expect(stackNullReason(state, facts, lib)).toEqual({
      reason: "calendar-without-roll",
    });
  });

  it("S3b: roll without calendar", () => {
    const state: StackState = { ...base, calendar: false, weekend: [] };
    const facts = collectStackFacts(state, lib);
    expect(facts.result).toEqual([]);
    expect(stackNullReason(state, facts, lib)).toEqual({
      reason: "roll-without-calendar",
    });
  });

  it("S9e: an invalid holiday", () => {
    const state: StackState = {
      ...base,
      cutoffCount: "1",
      cutoffs: [
        { name: "gate-in", offset: "P2D", atLocalTime: "17:00" },
        { name: "", offset: "", atLocalTime: "" },
        { name: "", offset: "", atLocalTime: "" },
        { name: "", offset: "", atLocalTime: "" },
      ],
      holidays: "2024-02-30",
    };
    const facts = collectStackFacts(state, lib);
    expect(facts.result).toEqual([]);
    expect(stackNullReason(state, facts, lib)).toEqual({
      reason: "invalid-calendar",
    });
  });

  it("S9c: a zoneless anchor", () => {
    const state: StackState = {
      ...base,
      anchor: "2024-06-17T18:00:00",
      calendar: false,
      weekend: [],
      roll: "",
    };
    const facts = collectStackFacts(state, lib);
    expect(facts.result).toEqual([]);
    expect(stackNullReason(state, facts, lib)).toEqual({
      reason: "zoneless-anchor",
    });
  });

  it("S9d: an unknown zone", () => {
    const state: StackState = {
      ...base,
      timeZone: "Mars/Olympus_Mons",
      calendar: false,
      weekend: [],
      roll: "",
    };
    const facts = collectStackFacts(state, lib);
    expect(facts.result).toEqual([]);
    expect(stackNullReason(state, facts, lib)).toEqual({
      reason: "invalid-zone",
    });
  });

  it("S9: a bad offset", () => {
    const state: StackState = {
      ...base,
      calendar: false,
      weekend: [],
      roll: "",
      cutoffCount: "1",
      cutoffs: [
        { name: "gate-in", offset: "2 days", atLocalTime: "" },
        { name: "", offset: "", atLocalTime: "" },
        { name: "", offset: "", atLocalTime: "" },
        { name: "", offset: "", atLocalTime: "" },
      ],
    };
    const facts = collectStackFacts(state, lib);
    expect(facts.result).toEqual([]);
    expect(stackNullReason(state, facts, lib)).toEqual({
      reason: "invalid-offset",
      n: 1,
    });
    expect(stackNullText({ reason: "invalid-offset", n: 1 })).toContain(
      "Cut-off 1's offset",
    );
  });

  it("S9b: a bad local time", () => {
    const state: StackState = {
      ...base,
      calendar: false,
      weekend: [],
      roll: "",
      cutoffCount: "1",
      cutoffs: [
        { name: "gate-in", offset: "P2D", atLocalTime: "25:00" },
        { name: "", offset: "", atLocalTime: "" },
        { name: "", offset: "", atLocalTime: "" },
        { name: "", offset: "", atLocalTime: "" },
      ],
    };
    const facts = collectStackFacts(state, lib);
    expect(facts.result).toEqual([]);
    expect(stackNullReason(state, facts, lib)).toEqual({
      reason: "invalid-time",
      n: 1,
    });
  });

  it("S5: a skipped hour", () => {
    const state = presetState(presetById("skipped-hour"));
    const facts = collectStackFacts(state, lib);
    expect(facts.result).toEqual([]);
    expect(stackNullReason(state, facts, lib)).toEqual({
      reason: "skipped-hour",
      n: 2,
    });
  });

  it("S8: no entries at all is a correct empty result, not a reason", () => {
    const state = readArgs({ anchor: SAIL, timeZone: AMS, cutoffs: [] });
    const facts = collectStackFacts(state, lib);
    expect(facts.result).toEqual([]);
    expect(stackNullReason(state, facts, lib)).toBeNull();
  });

  it("S9f: roll 'none' leaves Saturday's gate-in on Saturday, moved false", () => {
    const state: StackState = { ...base, roll: "none", cutoffCount: "1" };
    const facts = collectStackFacts(state, lib);
    const gateIn = facts.rows.find((r) => r.name === "gate-in")!;
    expect(gateIn.at).toBe("2024-06-15T17:00:00+02:00[Europe/Amsterdam]");
    expect(gateIn.moved).toBe(false);
  });
});

describe("StackRow.series", () => {
  it("is the matched entry's 1-based place in the entries, not the sorted row's", () => {
    const state = presetState(presetById("rotterdam-weekend"));
    const facts = collectStackFacts(state, lib);
    const entries = entriesOf(state);
    for (const row of facts.rows) {
      const idx = entries.findIndex((e) => e.name === row.name);
      expect(row.series).toBe(idx + 1);
    }
  });

  it("cycles back to 1 past the fourth entry", () => {
    const state: StackState = {
      ...presetState(presetById("no-calendar")),
      cutoffCount: "4",
      cutoffs: [
        { name: "a", offset: "P1D", atLocalTime: "" },
        { name: "b", offset: "P2D", atLocalTime: "" },
        { name: "c", offset: "P3D", atLocalTime: "" },
        { name: "d", offset: "P4D", atLocalTime: "" },
      ],
    };
    const facts = collectStackFacts(state, lib);
    expect(facts.rows.map((r) => r.series).sort()).toEqual([1, 2, 3, 4]);
  });
});
