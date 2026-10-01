/// <reference types="vitest/globals" />
/**
 * `eta-drift.ts`'s pure helpers, against the real gmt modules. Every expected
 * library result is an appendix Z row (ED1 to ED4, EDR1 to EDR7).
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
  CLASS_SERIES,
  collectDriftFacts,
  CUSTOM_PRESET_ID,
  driftNullReason,
  driftReasonText,
  ETA_PRESETS,
  eventsOf,
  indexOfPick,
  initialState,
  matchPreset,
  naivePick,
  permalinkOf,
  plotWindow,
  plotZone,
  presetState,
  readArgs,
  toleranceBand,
  visibleCount,
  xTicks,
  yTickStep,
  yTicks,
  type DriftState,
} from "./eta-drift";
import {
  epochMs,
  type PunctualityLib,
  type TimestampEvent,
} from "./punctuality-widgets";

const lib: PunctualityLib = {
  scheduleDeviation,
  classifyPunctuality,
  punctualityRate,
  bestAvailable,
  estimateDrift,
  nextDeparture,
} as unknown as PunctualityLib;

const preset = (id: string) => ETA_PRESETS.find((p) => p.id === id)!;
const stateOf = (id: string, over: Partial<DriftState> = {}): DriftState => ({
  ...presetState(preset(id)),
  ...over,
});
const ev = (
  classifier: string,
  at: string,
  recordedAt: string,
): TimestampEvent => ({ classifier: classifier as never, at, recordedAt });

describe("readArgs", () => {
  it("opens on the first preset with no arguments", () => {
    expect(readArgs({})).toEqual(presetState(ETA_PRESETS[0]!));
    expect(initialState({})).toEqual(presetState(ETA_PRESETS[0]!));
  });

  it("reads a chat events array with exactly the tolerance it gives", () => {
    const s = readArgs({
      events: [ev("EST", "2024-06-20T08:00:00Z", "2024-06-01T00:00:00Z")],
    });
    expect(s.eventCount).toBe("1");
    expect(s.tolerance).toBe("");
    expect(eventsOf(s)).toEqual([
      ev("EST", "2024-06-20T08:00:00Z", "2024-06-01T00:00:00Z"),
    ]);
    expect(
      readArgs({ events: [ev("EST", "a", "b")], tolerance: "PT8H" }).tolerance,
    ).toBe("PT8H");
  });

  it("reads flat keys", () => {
    const s = readArgs({
      eventCount: "2",
      classifier1: "PLN",
      at1: "a1",
      recordedAt1: "r1",
      classifier2: "EST",
      at2: "a2",
      recordedAt2: "r2",
      tolerance: "PT15M",
    });
    expect(eventsOf(s)).toEqual([ev("PLN", "a1", "r1"), ev("EST", "a2", "r2")]);
    expect(s.tolerance).toBe("PT15M");
  });

  it("starts from a preset and overrides its tolerance", () => {
    const s = readArgs({ preset: "vessel-slide", tolerance: "PT9H" });
    expect(s.tolerance).toBe("PT9H");
    expect(eventsOf(s)).toEqual(preset("vessel-slide").events);
  });

  it('clears a tolerance with "none"', () => {
    expect(
      readArgs({ preset: "vessel-slide", tolerance: "none" }).tolerance,
    ).toBe("");
  });

  it("falls back to the first preset for an unknown id and caps at six", () => {
    expect(readArgs({ preset: "nope" })).toEqual(presetState(ETA_PRESETS[0]!));
    const many = Array.from({ length: 9 }, () => ev("EST", "a", "b"));
    expect(visibleCount(readArgs({ events: many }))).toBe(6);
  });

  it("turns non-strings into empty strings", () => {
    const s = readArgs({
      events: [{ classifier: 1, at: null, recordedAt: {} } as never],
    });
    expect(eventsOf(s)).toEqual([ev("", "", "")]);
  });
});

describe("eventsOf and visibleCount", () => {
  it("returns the visible events trimmed", () => {
    const s = stateOf("est-after-act");
    s.events[0]!.at = " 2024-06-15T12:00:00Z ";
    expect(eventsOf(s)).toHaveLength(4);
    expect(eventsOf(s)[0]!.at).toBe("2024-06-15T12:00:00Z");
    expect(eventsOf({ ...s, eventCount: "2" })).toHaveLength(2);
  });

  it("clamps a junk count to 1 to 6", () => {
    expect(visibleCount({ ...stateOf("vessel-slide"), eventCount: "x" })).toBe(
      1,
    );
    expect(visibleCount({ ...stateOf("vessel-slide"), eventCount: "99" })).toBe(
      6,
    );
  });
});

describe("matchPreset and permalinkOf", () => {
  it.each(ETA_PRESETS.map((p) => [p.id]))("matches %s", (id) => {
    expect(matchPreset(stateOf(id))).toBe(id);
    expect(permalinkOf(stateOf(id))).toEqual({ preset: id });
  });

  it("is custom once the tolerance moves", () => {
    expect(matchPreset(stateOf("vessel-slide", { tolerance: "PT9H" }))).toBe(
      CUSTOM_PRESET_ID,
    );
  });

  it("PE2: writes a tolerance that differs, and none when cleared", () => {
    const moved = stateOf("vessel-slide", { tolerance: "PT9H" });
    expect(permalinkOf(moved)).toEqual({
      preset: "vessel-slide",
      tolerance: "PT9H",
    });
    expect(readArgs(permalinkOf(moved))).toEqual(moved);
    const cleared = stateOf("vessel-slide", { tolerance: "" });
    expect(permalinkOf(cleared)).toEqual({
      preset: "vessel-slide",
      tolerance: "none",
    });
    expect(readArgs(permalinkOf(cleared))).toEqual(cleared);
  });

  it("round-trips the flat form with every value 64 characters or fewer", () => {
    const s = readArgs({
      events: [
        ev(
          "EST",
          "2024-06-20T08:00:00+02:00[Europe/Amsterdam]",
          "2024-06-01T00:00:00Z",
        ),
        ev("ACT", "2024-06-20T09:00:00Z", "2024-06-20T09:05:00Z"),
      ],
      tolerance: "PT30M",
    });
    const link = permalinkOf(s);
    expect(link.eventCount).toBe("2");
    for (const v of Object.values(link)) {
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v.length).toBeLessThanOrEqual(64);
    }
    expect(readArgs(link)).toEqual(s);
  });
});

describe("naivePick", () => {
  it("ED2: the latest recorded is the 13:05 estimate", () => {
    const pick = naivePick(eventsOf(stateOf("est-after-act")))!;
    expect(pick.index).toBe(3);
    expect(pick.event.classifier).toBe("EST");
    expect(pick.event.at).toBe("2024-06-15T13:05:00Z");
  });

  it("ED3: the latest recorded is the 12:45 estimate", () => {
    expect(naivePick(eventsOf(stateOf("req-beats-est")))!.event.at).toBe(
      "2024-06-15T12:45:00Z",
    );
  });

  it("a tie goes to the later index", () => {
    const pick = naivePick([
      ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z"),
      ev("EST", "2024-06-15T12:50:00Z", "2024-06-14T00:00:00Z"),
    ])!;
    expect(pick.index).toBe(1);
  });

  it("is null when any recordedAt does not parse", () => {
    expect(
      naivePick([ev("EST", "2024-06-15T12:40:00Z", "yesterday")]),
    ).toBeNull();
  });
});

describe("indexOfPick", () => {
  it("finds the event a pick names, the latest recorded of a tie", () => {
    const events = eventsOf(stateOf("est-after-act"));
    expect(indexOfPick(events, bestAvailable(events))).toBe(2);
    expect(indexOfPick(events, null)).toBeNull();
    expect(indexOfPick(events, { at: "nope", classifier: "ACT" })).toBeNull();
    const twin = [
      ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z"),
      ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T05:00:00Z"),
    ];
    expect(
      indexOfPick(twin, { at: "2024-06-15T12:40:00Z", classifier: "EST" }),
    ).toBe(1);
  });
});

describe("collectDriftFacts", () => {
  const facts = (state: DriftState) => collectDriftFacts(state, lib);

  it("ED1: a vessel slides 9 hours against 8", () => {
    const f = facts(stateOf("vessel-slide"));
    expect(f.best).toEqual({ at: "2024-06-20T17:00:00Z", classifier: "EST" });
    expect(f.drift).toEqual({
      first: "2024-06-20T08:00:00Z",
      last: "2024-06-20T17:00:00Z",
      drift: "PT9H",
      revisions: 3,
      exceedsTolerance: true,
    });
    expect(f.naive!.event.at).toBe("2024-06-20T17:00:00Z");
    expect(f.estCount).toBe(3);
  });

  it("ED1a, ED1b, ED1c: the tolerance decides exceedsTolerance", () => {
    expect(
      facts(stateOf("vessel-slide", { tolerance: "PT9H" })).drift!
        .exceedsTolerance,
    ).toBe(false);
    expect(
      facts(stateOf("vessel-slide", { tolerance: "PT8H45M" })).drift!
        .exceedsTolerance,
    ).toBe(true);
    expect(
      facts(stateOf("vessel-slide", { tolerance: "" })).drift!.exceedsTolerance,
    ).toBeNull();
  });

  it("ED2: an estimate recorded after the actual", () => {
    const f = facts(stateOf("est-after-act"));
    expect(f.best).toEqual({ at: "2024-06-15T12:52:00Z", classifier: "ACT" });
    expect(f.drift).toEqual({
      first: "2024-06-15T12:40:00Z",
      last: "2024-06-15T13:05:00Z",
      drift: "PT25M",
      revisions: 2,
      exceedsTolerance: null,
    });
  });

  it("ED2r: reclassify the actual as an estimate", () => {
    const s = stateOf("est-after-act");
    s.events[2]!.classifier = "EST";
    const f = facts(s);
    expect(f.best).toEqual({ at: "2024-06-15T12:00:00Z", classifier: "PLN" });
    expect(f.drift).toEqual({
      first: "2024-06-15T12:40:00Z",
      last: "2024-06-15T13:05:00Z",
      drift: "PT25M",
      revisions: 3,
      exceedsTolerance: null,
    });
  });

  it("ED3: a request beats a later estimate", () => {
    const f = facts(stateOf("req-beats-est"));
    expect(f.best).toEqual({ at: "2024-06-15T12:30:00Z", classifier: "REQ" });
    expect(f.drift).toEqual({
      first: "2024-06-15T12:40:00Z",
      last: "2024-06-15T12:45:00Z",
      drift: "PT5M",
      revisions: 2,
      exceedsTolerance: false,
    });
  });

  it("ED4: one estimate has no drift, and the plan is the pick", () => {
    const f = facts(stateOf("one-estimate"));
    expect(f.best).toEqual({ at: "2024-06-15T12:00:00Z", classifier: "PLN" });
    expect(f.drift).toBeNull();
    expect(f.naive!.event.classifier).toBe("EST");
    expect(f.estCount).toBe(1);
  });
});

describe("driftNullReason", () => {
  const reasonOf = (state: DriftState) =>
    driftNullReason(state, collectDriftFacts(state, lib), lib);

  it("is null when every result is real", () => {
    for (const id of ["vessel-slide", "est-after-act", "req-beats-est"]) {
      expect(reasonOf(stateOf(id))).toBeNull();
    }
  });

  it("EDR1: an unknown class names its event, and both calls return null", () => {
    const s = stateOf("vessel-slide");
    s.events[0]!.classifier = "ETA" as never;
    const f = collectDriftFacts(s, lib);
    expect(f.best).toBeNull();
    expect(f.drift).toBeNull();
    expect(driftNullReason(s, f, lib)).toEqual({
      kind: "invalid-event",
      event: 1,
    });
  });

  it("EDR2: a zoneless at names its event", () => {
    const s = stateOf("req-beats-est");
    s.events[1]!.at = "2024-06-15T12:40:00";
    const f = collectDriftFacts(s, lib);
    expect(f.best).toBeNull();
    expect(driftNullReason(s, f, lib)).toEqual({
      kind: "invalid-event",
      event: 2,
    });
  });

  it("EDR3: a weeks tolerance is invalid-tolerance", () => {
    const s = stateOf("vessel-slide", { tolerance: "P1W" });
    const f = collectDriftFacts(s, lib);
    expect(f.drift).toBeNull();
    expect(driftNullReason(s, f, lib)).toEqual({ kind: "invalid-tolerance" });
  });

  it("ED4: one estimate", () => {
    expect(reasonOf(stateOf("one-estimate"))).toEqual({ kind: "one-estimate" });
  });

  it("no estimate at all", () => {
    const s = stateOf("est-after-act", { eventCount: "1" });
    expect(reasonOf(s)).toEqual({ kind: "no-estimate" });
  });

  it("EDR4: an empty list returns null from both calls", () => {
    expect(bestAvailable([])).toBeNull();
    expect(estimateDrift([])).toBeNull();
  });

  it("words every reason", () => {
    expect(driftReasonText({ kind: "invalid-event", event: 2 })).toContain(
      "Event 2 is not a timestamp",
    );
    expect(driftReasonText({ kind: "invalid-tolerance" })).toContain("PT8H");
    expect(driftReasonText({ kind: "one-estimate" })).toContain(
      "fewer than two",
    );
    expect(driftReasonText({ kind: "no-estimate" })).toContain("No EST");
  });
});

describe("plotWindow", () => {
  it("pads x 8% and y 16%", () => {
    const win = plotWindow(eventsOf(stateOf("vessel-slide")))!;
    const day = 86_400_000;
    const rec0 = epochMs("2024-06-01T00:00:00Z");
    const span = 9 * day;
    expect(win.xMin).toBeCloseTo(rec0 - span * 0.08, 0);
    expect(win.xMax).toBeCloseTo(rec0 + span * 1.08, 0);
    const at0 = epochMs("2024-06-20T08:00:00Z");
    expect(win.yMin).toBeCloseTo(at0 - 9 * 3_600_000 * 0.16, 0);
  });

  it("pads a zero span a day on x and an hour on y", () => {
    const win = plotWindow([
      ev("EST", "2024-06-20T08:00:00Z", "2024-06-01T00:00:00Z"),
    ])!;
    expect(win.xMax - win.xMin).toBe(2 * 86_400_000);
    expect(win.yMax - win.yMin).toBe(2 * 3_600_000);
  });

  it("holds the band's edges", () => {
    const win = plotWindow(eventsOf(stateOf("vessel-slide")), {
      lowMs: epochMs("2024-06-20T00:00:00Z"),
      highMs: epochMs("2024-06-20T20:00:00Z"),
    })!;
    expect(win.yMin).toBeLessThan(epochMs("2024-06-20T00:00:00Z"));
    expect(win.yMax).toBeGreaterThan(epochMs("2024-06-20T20:00:00Z"));
  });

  it("skips events that are not instants and is null with none", () => {
    expect(plotWindow([ev("EST", "x", "y")])).toBeNull();
    expect(plotWindow([])).toBeNull();
  });
});

describe("toleranceBand", () => {
  it("is the tolerance either side of the first estimate", () => {
    const drift = estimateDrift(eventsOf(stateOf("vessel-slide")) as never, {
      tolerance: "PT8H",
    });
    const band = toleranceBand(drift as never, "PT8H")!;
    expect(band.minutes).toBe(480);
    expect(band.highMs - band.lowMs).toBe(16 * 3_600_000);
  });

  it("is null without a drift or with an unreadable tolerance", () => {
    expect(toleranceBand(null, "PT8H")).toBeNull();
    const drift = estimateDrift(eventsOf(stateOf("vessel-slide")) as never);
    expect(toleranceBand(drift as never, "P1W")).toBeNull();
    expect(toleranceBand(drift as never, "")).toBeNull();
  });
});

describe("axis ticks", () => {
  it("reads the plot zone from the first valid at", () => {
    expect(plotZone([ev("EST", "2024-06-20T08:00:00Z", "r")])).toBe("UTC");
    expect(plotZone([ev("EST", "2024-06-20T08:00:00+02:00", "r")])).toBe(
      "+02:00",
    );
    expect(
      plotZone([
        ev("EST", "x", "r"),
        ev("EST", "2024-06-20T08:00:00+02:00[Europe/Amsterdam]", "r"),
      ]),
    ).toBe("Europe/Amsterdam");
    expect(plotZone([])).toBe("UTC");
  });

  it("gives at most five y ticks", () => {
    for (const id of ["vessel-slide", "est-after-act", "req-beats-est"]) {
      const events = eventsOf(stateOf(id));
      const win = plotWindow(events)!;
      expect(yTicks(win, plotZone(events)).length).toBeLessThanOrEqual(5);
    }
  });

  it("labels y ticks with the time, and the date over a long window", () => {
    const win = plotWindow(eventsOf(stateOf("vessel-slide")))!;
    expect(yTicks(win, "UTC").every((t) => /^\d{2}:\d{2}$/.test(t.label))).toBe(
      true,
    );
    const long = { ...win, yMax: win.yMin + 5 * 86_400_000 };
    expect(
      yTicks(long, "UTC").every((t) => /^\d+ \w{3} \d{2}:\d{2}$/.test(t.label)),
    ).toBe(true);
  });

  it("steps the y ticks up as the span grows", () => {
    expect(yTickStep(60 * 60_000)).toBe(15);
    expect(yTickStep(10 * 3_600_000)).toBe(180);
  });

  it("draws day ticks on a recorded-at axis of days and hour ticks inside three", () => {
    const win = plotWindow(eventsOf(stateOf("vessel-slide")))!;
    expect(xTicks(win, "UTC")[0]!.label).toMatch(/^\d+ Jun$/);
    expect(
      xTicks({ ...win, xMax: win.xMin + 3_600_000 * 5 }, "UTC")[0]!.label,
    ).toMatch(/^\d{2}:00$/);
  });
});

describe("CLASS_SERIES", () => {
  it("gives every class its own series, EST cyan, PLN spring, REQ purple, ACT teal", () => {
    expect(CLASS_SERIES).toEqual({ EST: 1, PLN: 2, REQ: 3, ACT: 4 });
    expect(new Set(Object.values(CLASS_SERIES)).size).toBe(4);
  });
});
