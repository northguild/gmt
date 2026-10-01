/// <reference types="vitest/globals" />
/**
 * `departure-board.ts`'s pure helpers, against the real gmt modules. Every
 * expected library result is an appendix Z row (DB1 to DB4, DBR1 to DBR7).
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
  scheduleDelivery,
} from "@northguild/gmt/transport/calculate";
import {
  collectDepartureFacts,
  CUSTOM_PRESET_ID,
  DEPARTURE_PRESETS,
  departureIconMode,
  departureNullReason,
  departureReasonText,
  departureWait,
  handoffArgs,
  initialState,
  isEmptyReason,
  matchPreset,
  optionsOf,
  permalinkOf,
  presetState,
  railDepartures,
  railTickStep,
  railWindow,
  readArgs,
  thresholdOf,
  timetableOf,
  visibleCount,
  type DepartureState,
} from "./departure-board";
import { epochMs, type PunctualityLib } from "./punctuality-widgets";

const lib: PunctualityLib = {
  scheduleDeviation,
  classifyPunctuality,
  punctualityRate,
  bestAvailable,
  estimateDrift,
  nextDeparture,
} as unknown as PunctualityLib;

const AMS = (t: string) => `2024-06-15T${t}+02:00[Europe/Amsterdam]`;
const HEL = (t: string) => `2024-06-15T${t}+03:00[Europe/Helsinki]`;
const EDT = (t: string) => `2024-11-03T${t}-04:00[America/New_York]`;
const EST = (t: string) => `2024-11-03T${t}-05:00[America/New_York]`;
const FERRY_IN_TIME_ORDER = [
  HEL("07:30:00"),
  HEL("10:30:00"),
  HEL("13:00:00"),
  HEL("16:30:00"),
  HEL("19:30:00"),
];

const preset = (id: string) => DEPARTURE_PRESETS.find((p) => p.id === id)!;
const stateOf = (
  id: string,
  over: Partial<DepartureState> = {},
): DepartureState => ({
  ...presetState(preset(id)),
  ...over,
});
const facts = (s: DepartureState) => collectDepartureFacts(s, lib);
const reasonOf = (s: DepartureState) => departureNullReason(s, facts(s), lib);

describe("readArgs", () => {
  it("opens on the first preset with no arguments", () => {
    expect(readArgs({})).toEqual(presetState(DEPARTURE_PRESETS[0]!));
    expect(initialState({})).toEqual(presetState(DEPARTURE_PRESETS[0]!));
  });

  it("reads a chat list as the list form with every other field blank", () => {
    const s = readArgs({
      after: HEL("10:05:00"),
      departures: FERRY_IN_TIME_ORDER,
      minimumConnection: "PT45M",
    });
    expect(s.form).toBe("list");
    expect(timetableOf(s)).toEqual(FERRY_IN_TIME_ORDER);
    expect(s.minimumConnection).toBe("PT45M");
    expect(s.onwardDuration).toBe("");
    expect(visibleCount(s)).toBe(5);
  });

  it("reads a chat headway as the headway form", () => {
    const s = readArgs({
      after: AMS("06:12:00"),
      headway: "PT20M",
      from: AMS("06:00:00"),
      to: AMS("09:00:00"),
    });
    expect(s.form).toBe("headway");
    expect(timetableOf(s)).toEqual({
      headway: "PT20M",
      from: AMS("06:00:00"),
      to: AMS("09:00:00"),
    });
    expect(s.minimumConnection).toBe("");
  });

  it("reads flat list and headway keys", () => {
    const list = readArgs({
      form: "list",
      departureCount: "2",
      departure1: "a",
      departure2: "b",
      after: "x",
    });
    expect(list.form).toBe("list");
    expect(list.departures.slice(0, 2)).toEqual(["a", "b"]);
    expect(visibleCount(list)).toBe(2);
    const row = readArgs({
      form: "headway",
      headway: "PT20M",
      from: "f",
      to: "t",
      after: "x",
    });
    expect(row.form).toBe("headway");
    expect(row.to).toBe("t");
  });

  it("starts from a preset and overrides scalars", () => {
    const s = readArgs({ preset: "ferry-list", minimumConnection: "PT30M" });
    expect(s.minimumConnection).toBe("PT30M");
    expect(timetableOf(s)).toEqual(preset("ferry-list").departures);
  });

  it('clears a scalar with "none"', () => {
    expect(
      readArgs({ preset: "ferry-list", minimumConnection: "none" })
        .minimumConnection,
    ).toBe("");
  });

  it("falls back to the first preset for an unknown id and caps the list at six", () => {
    expect(readArgs({ preset: "nope" })).toEqual(
      presetState(DEPARTURE_PRESETS[0]!),
    );
    expect(
      visibleCount(readArgs({ departures: Array(9).fill("a") as string[] })),
    ).toBe(6);
  });

  it("turns non-strings into empty strings", () => {
    expect(
      readArgs({ departures: [5 as never], after: 3 as never }).after,
    ).toBe("");
  });
});

describe("timetableOf and optionsOf", () => {
  it("keeps the visible non-blank list entries in input order", () => {
    const s = stateOf("ferry-list");
    expect(timetableOf(s)).toEqual(preset("ferry-list").departures);
    s.departures[1] = "  ";
    expect(timetableOf(s)).toHaveLength(4);
    expect(timetableOf({ ...s, departureCount: "2" })).toEqual([
      HEL("16:30:00"),
    ]);
  });

  it("omits the options argument when the connection is blank", () => {
    expect(optionsOf(stateOf("ferry-list"))).toEqual({
      minimumConnection: "PT45M",
    });
    expect(
      optionsOf(stateOf("ferry-list", { minimumConnection: " " })),
    ).toBeUndefined();
  });
});

describe("matchPreset and permalinkOf", () => {
  it.each(DEPARTURE_PRESETS.map((p) => [p.id]))("matches %s", (id) => {
    expect(matchPreset(stateOf(id))).toBe(id);
    expect(permalinkOf(stateOf(id))).toEqual({ preset: id });
  });

  it("is custom once a field moves", () => {
    expect(matchPreset(stateOf("ferry-list", { after: HEL("10:06:00") }))).toBe(
      CUSTOM_PRESET_ID,
    );
    expect(matchPreset(stateOf("ferry-list", { form: "headway" }))).toBe(
      CUSTOM_PRESET_ID,
    );
  });

  it("PD3: writes none for a cleared connection and round-trips it", () => {
    const s = stateOf("ferry-list", { minimumConnection: "" });
    expect(permalinkOf(s)).toEqual({
      preset: "ferry-list",
      minimumConnection: "none",
    });
    expect(readArgs(permalinkOf(s))).toEqual(s);
  });

  it("writes an arrival that differs", () => {
    const s = stateOf("arrival-at-to", { after: AMS("08:40:00") });
    expect(permalinkOf(s)).toEqual({
      preset: "arrival-at-to",
      after: AMS("08:40:00"),
    });
    expect(readArgs(permalinkOf(s))).toEqual(s);
  });

  it("round-trips the flat list form, every value 64 characters or fewer", () => {
    const s = readArgs({
      after: HEL("10:05:00"),
      departures: [HEL("11:00:00"), HEL("12:00:00")],
      minimumConnection: "PT45M",
      onwardDuration: "PT2H",
      onwardZone: "Europe/Tallinn",
    });
    const link = permalinkOf(s);
    expect(link.form).toBe("list");
    for (const v of Object.values(link)) {
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v.length).toBeLessThanOrEqual(64);
    }
    expect(readArgs(link)).toEqual(s);
  });

  it("round-trips the flat headway form", () => {
    const s = readArgs({
      after: AMS("06:12:00"),
      headway: "PT30M",
      from: AMS("06:00:00"),
      to: AMS("09:00:00"),
    });
    expect(permalinkOf(s).form).toBe("headway");
    expect(readArgs(permalinkOf(s))).toEqual(s);
  });
});

describe("collectDepartureFacts", () => {
  it("DB1: a shuttle every 20 minutes, a 10-minute connection", () => {
    expect(facts(stateOf("shuttle-headway"))).toEqual({
      made: AMS("06:40:00"),
      naive: AMS("06:20:00"),
    });
  });

  it("DB1z: the threshold itself is made, with zero slack", () => {
    expect(
      facts(stateOf("shuttle-headway", { after: AMS("06:10:00") })).made,
    ).toBe(AMS("06:20:00"));
  });

  it("DB2: the ferry list, a 45-minute connection", () => {
    expect(facts(stateOf("ferry-list"))).toEqual({
      made: HEL("13:00:00"),
      naive: HEL("10:30:00"),
    });
  });

  it("DB2l: after the last ferry the answer is empty", () => {
    expect(facts(stateOf("ferry-list", { after: HEL("19:00:00") })).made).toBe(
      "",
    );
  });

  it("DB3: arriving exactly at to is empty; 08:40 is made; 08:41 is empty", () => {
    expect(facts(stateOf("arrival-at-to")).made).toBe("");
    expect(
      facts(stateOf("arrival-at-to", { after: AMS("08:40:00") })).made,
    ).toBe(AMS("08:40:00"));
    expect(
      facts(stateOf("arrival-at-to", { after: AMS("08:41:00") })).made,
    ).toBe("");
  });

  it("DB4 and DB4b: hourly across the fall-back", () => {
    expect(facts(stateOf("fall-back-hourly")).made).toBe(EST("01:00:00"));
    expect(
      facts(stateOf("fall-back-hourly", { after: EDT("00:30:00") })).made,
    ).toBe(EDT("01:00:00"));
  });

  it("PD3: with no connection the ferry made and naive agree", () => {
    const f = facts(stateOf("ferry-list", { minimumConnection: "" }));
    expect(f.made).toBe(HEL("10:30:00"));
    expect(f.naive).toBe(HEL("10:30:00"));
  });
});

describe("departureNullReason", () => {
  it("is null when a departure is found", () => {
    for (const id of DEPARTURE_PRESETS.filter(
      (p) => p.id !== "arrival-at-to",
    ).map((p) => p.id)) {
      expect(reasonOf(stateOf(id))).toBeNull();
    }
  });

  it("no-arrival: a blank arrival", () => {
    expect(reasonOf(stateOf("ferry-list", { after: "" }))).toEqual({
      kind: "no-arrival",
    });
  });

  it("DBR1: a zoneless arrival is invalid-after, and the probe agrees", () => {
    const s = stateOf("ferry-list", { after: "2024-06-15T10:05:00" });
    expect(facts(s).made).toBe("");
    expect(reasonOf(s)).toEqual({ kind: "invalid-after" });
    expect(nextDeparture(HEL("10:05:00"), [HEL("10:05:00")])).toBe(
      HEL("10:05:00"),
    );
    expect(nextDeparture("2024-06-15T10:05:00", ["2024-06-15T10:05:00"])).toBe(
      "",
    );
  });

  it("DBR4: a negative or calendar connection is invalid-connection", () => {
    for (const connection of ["-PT5M", "P1W"]) {
      const s = stateOf("ferry-list", { minimumConnection: connection });
      expect(facts(s).made).toBe("");
      expect(reasonOf(s)).toEqual({ kind: "invalid-connection" });
    }
  });

  it("N5: the connection probe returns the far moment when valid", () => {
    const far = "+275760-09-13T00:00:00Z";
    expect(
      nextDeparture(HEL("10:05:00"), [far], { minimumConnection: "PT45M" }),
    ).toBe(far);
    expect(
      nextDeparture(HEL("10:05:00"), [far], { minimumConnection: "P1W" }),
    ).toBe("");
  });

  it("DBR2: an entry with no offset or no zone offset is invalid-entry", () => {
    for (const bad of [
      "2024-06-15T09:30:00",
      "2024-06-15T09:30:00[Europe/London]",
    ]) {
      const s = stateOf("ferry-list", {
        departures: [bad, "", "", "", "", ""],
        departureCount: "1",
      });
      expect(facts(s).made).toBe("");
      expect(reasonOf(s)).toEqual({ kind: "invalid-entry", entry: 1 });
    }
  });

  it("DBR3: a zone that disagrees with its offset is invalid-entry", () => {
    const s = stateOf("ferry-list", {
      after: "2024-06-15T09:00:00Z",
      departures: [
        "2024-06-15T09:30:00+05:00[Europe/London]",
        "",
        "",
        "",
        "",
        "",
      ],
      departureCount: "1",
    });
    expect(facts(s).made).toBe("");
    expect(reasonOf(s)).toEqual({ kind: "invalid-entry", entry: 1 });
  });

  it("DBR7: one bad entry voids the list and is named", () => {
    const s = stateOf("ferry-list", {
      departures: [HEL("13:00:00"), "2024-06-15T16:30:00", "", "", "", ""],
      departureCount: "2",
    });
    expect(facts(s).made).toBe("");
    expect(reasonOf(s)).toEqual({ kind: "invalid-entry", entry: 2 });
  });

  it("DBR5: a zero headway is invalid-headway; to before from is empty-window", () => {
    const zero = stateOf("shuttle-headway", { headway: "PT0S" });
    expect(facts(zero).made).toBe("");
    expect(reasonOf(zero)).toEqual({ kind: "invalid-headway" });
    const flipped = stateOf("shuttle-headway", { to: AMS("06:00:00") });
    expect(facts(flipped).made).toBe("");
    expect(reasonOf(flipped)).toEqual({ kind: "empty-window" });
  });

  it("DBR5p: the empty-window probe", () => {
    expect(nextDeparture(AMS("06:00:00"), [AMS("06:00:00")])).toBe(
      AMS("06:00:00"),
    );
    expect(nextDeparture(AMS("09:00:00"), [AMS("06:00:00")])).toBe("");
  });

  it("names a headway from or to with no offset", () => {
    expect(
      reasonOf(stateOf("shuttle-headway", { from: "2024-06-15T06:00:00" })),
    ).toEqual({ kind: "invalid-from" });
    expect(
      reasonOf(stateOf("shuttle-headway", { to: "2024-06-15T09:00:00" })),
    ).toEqual({ kind: "invalid-to" });
  });

  it("DBR6: an empty list is a correct empty answer", () => {
    const s = stateOf("ferry-list", {
      departures: ["", "", "", "", "", ""],
      departureCount: "1",
    });
    expect(facts(s).made).toBe("");
    const r = reasonOf(s);
    expect(r).toEqual({ kind: "empty-list" });
    expect(isEmptyReason(r)).toBe(true);
  });

  it("DB2l: after the last ferry is none-left, a correct empty answer", () => {
    const r = reasonOf(stateOf("ferry-list", { after: HEL("19:00:00") }));
    expect(r).toEqual({ kind: "none-left", threshold: "Sat 15 Jun 19:45" });
    expect(isEmptyReason(r)).toBe(true);
  });

  it("DB3: arriving at to is after-window, a correct empty answer", () => {
    const r = reasonOf(stateOf("arrival-at-to"));
    expect(r).toEqual({
      kind: "after-window",
      threshold: "Sat 15 Jun 09:00",
      to: "Sat 15 Jun 09:00",
    });
    expect(isEmptyReason(r)).toBe(true);
  });

  it("only the two correct-empty and empty-list reasons are not sentinels", () => {
    expect(isEmptyReason({ kind: "invalid-after" })).toBe(false);
    expect(isEmptyReason(null)).toBe(false);
  });

  it("words every reason", () => {
    expect(departureReasonText({ kind: "no-arrival" })).toBe(
      "No arrival time.",
    );
    expect(departureReasonText({ kind: "invalid-after" })).toContain(
      "The arrival has no offset",
    );
    expect(departureReasonText({ kind: "invalid-connection" })).toContain(
      "PT45M",
    );
    expect(departureReasonText({ kind: "invalid-entry", entry: 2 })).toContain(
      "Departure 2 has no offset",
    );
    expect(departureReasonText({ kind: "empty-window" })).toContain(
      "[from, to)",
    );
    expect(departureReasonText({ kind: "invalid-headway" })).toContain("PT20M");
    expect(departureReasonText({ kind: "empty-list" })).toBe(
      "An empty timetable has no departure.",
    );
    expect(departureReasonText({ kind: "none-left", threshold: "X" })).toBe(
      "No departure at or after X: the last one leaves before it.",
    );
    expect(
      departureReasonText({ kind: "after-window", threshold: "X", to: "Y" }),
    ).toContain("the window ends at Y");
  });
});

describe("thresholdOf", () => {
  it("is the arrival plus the connection in the arrival's notation", () => {
    expect(thresholdOf(AMS("06:12:00"), "PT10M")).toBe(AMS("06:22:00"));
    expect(thresholdOf(AMS("06:12:00"), "")).toBe(AMS("06:12:00"));
  });

  it("is empty for an unreadable connection or arrival", () => {
    expect(thresholdOf(AMS("06:12:00"), "P1W")).toBe("");
    expect(thresholdOf("soon", "PT10M")).toBe("");
  });
});

describe("handoffArgs", () => {
  it("DB1h: the shuttle's departure goes on as a one-leg journey", () => {
    const s = stateOf("shuttle-headway");
    const args = handoffArgs(s, facts(s).made);
    expect(args).toEqual({
      legCount: "1",
      departure1: AMS("06:40:00"),
      duration1: "PT35M",
      timeZone1: "Europe/Amsterdam",
      mode1: "shuttle",
    });
    expect(
      scheduleDelivery([
        {
          departure: args!.departure1,
          duration: args!.duration1,
          timeZone: args!.timeZone1,
          mode: args!.mode1,
        },
      ] as never),
    ).toMatchObject({
      eta: AMS("07:15:00"),
    });
  });

  it("DB2h: the ferry's departure crosses to Tallinn", () => {
    const s = stateOf("ferry-list");
    const args = handoffArgs(s, facts(s).made)!;
    expect(args.departure1).toBe(HEL("13:00:00"));
    expect(
      (
        scheduleDelivery([
          {
            departure: args.departure1,
            duration: args.duration1,
            timeZone: args.timeZone1,
            mode: args.mode1,
          },
        ] as never) as { eta: string }
      ).eta,
    ).toBe("2024-06-15T15:00:00+03:00[Europe/Tallinn]");
  });

  it("is null with no departure or no onward leg", () => {
    expect(handoffArgs(stateOf("shuttle-headway"), "")).toBeNull();
    expect(
      handoffArgs(stateOf("fall-back-hourly"), EST("01:00:00")),
    ).toBeNull();
    expect(
      handoffArgs(
        stateOf("shuttle-headway", { onwardZone: "" }),
        AMS("06:40:00"),
      ),
    ).toBeNull();
    expect(
      handoffArgs(
        stateOf("shuttle-headway", { onwardMode: "" }),
        AMS("06:40:00"),
      ),
    ).not.toHaveProperty("mode1");
  });
});

describe("railWindow", () => {
  it("covers the service window padded by 15 minutes", () => {
    const win = railWindow(stateOf("shuttle-headway"))!;
    expect(win.startMs).toBe(epochMs(AMS("05:45:00")));
    expect(win.endMs).toBe(epochMs(AMS("09:15:00")));
  });

  it("covers a list from the earliest entry to the latest, padded 8%", () => {
    const win = railWindow(stateOf("ferry-list"))!;
    expect(win.startMs).toBeLessThan(epochMs(HEL("07:30:00")));
    expect(win.endMs).toBeGreaterThan(epochMs(HEL("19:30:00")));
    expect(win.startMs % 60_000).toBe(0);
    expect(win.endMs % 60_000).toBe(0);
  });

  it("holds an arrival outside the service window", () => {
    const win = railWindow(
      stateOf("shuttle-headway", { after: AMS("05:00:00") }),
    )!;
    expect(win.startMs).toBeLessThan(epochMs(AMS("05:00:00")));
  });

  it("goes three hours either side of the threshold for a long headway window", () => {
    const win = railWindow(
      stateOf("shuttle-headway", {
        from: AMS("00:00:00"),
        to: "2024-06-17T00:00:00+02:00[Europe/Amsterdam]",
      }),
    )!;
    expect(win.endMs - win.startMs).toBeLessThan(10 * 3_600_000);
  });

  it("is null when the arrival is not a moment", () => {
    expect(railWindow(stateOf("ferry-list", { after: "soon" }))).toBeNull();
  });
});

describe("railDepartures", () => {
  it("draws every shuttle up to the last, never to", () => {
    const state = stateOf("shuttle-headway");
    const ticks = railDepartures(state, railWindow(state)!).ticks;
    expect(ticks).toHaveLength(9);
    expect(ticks[0]).toBe(epochMs(AMS("06:00:00")));
    expect(ticks.at(-1)).toBe(epochMs(AMS("08:40:00")));
    expect(ticks).not.toContain(epochMs(AMS("09:00:00")));
  });

  it("draws the hourly service's repeated hour as two ticks", () => {
    const state = stateOf("fall-back-hourly");
    const ticks = railDepartures(state, {
      startMs: epochMs(EDT("00:00:00")),
      endMs: epochMs(EST("04:00:00")),
    }).ticks;
    expect(ticks).toContain(epochMs(EDT("01:00:00")));
    expect(ticks).toContain(epochMs(EST("01:00:00")));
  });

  it("draws a list's entries that are moments, in the window", () => {
    const state = stateOf("ferry-list");
    expect(railDepartures(state, railWindow(state)!).ticks).toHaveLength(5);
  });

  it("goes dense past 60 ticks", () => {
    const state = stateOf("shuttle-headway", { headway: "PT1M" });
    expect(railDepartures(state, railWindow(state)!)).toEqual({
      ticks: [],
      dense: true,
    });
  });

  it("draws nothing for an unreadable headway", () => {
    const state = stateOf("shuttle-headway", { headway: "P1W" });
    expect(railDepartures(state, railWindow(state)!)).toEqual({
      ticks: [],
      dense: false,
    });
  });
});

describe("railTickStep", () => {
  it("steps up as the span grows", () => {
    expect(railTickStep(3 * 3_600_000)).toBe(30);
    expect(railTickStep(12 * 3_600_000)).toBe(120);
  });
});

describe("departureWait", () => {
  it("is the exact time from the arrival to the departure made", () => {
    const s = stateOf("shuttle-headway");
    expect(departureWait(s.after, facts(s).made, lib)).toBe("PT28M");
    const f = stateOf("ferry-list");
    expect(departureWait(f.after, facts(f).made, lib)).toBe("PT2H55M");
  });

  it("counts exact time across the repeated hour", () => {
    const s = stateOf("fall-back-hourly");
    expect(facts(s).made).toBe(EST("01:00:00"));
    expect(departureWait(s.after, facts(s).made, lib)).toBe("PT30M");
  });

  it("is empty when there is no departure made", () => {
    const s = stateOf("arrival-at-to");
    expect(departureWait(s.after, facts(s).made, lib)).toBe("");
  });

  it("trims the arrival", () => {
    const s = stateOf("shuttle-headway");
    expect(departureWait(`  ${s.after} `, facts(s).made, lib)).toBe("PT28M");
  });
});

describe("departureIconMode", () => {
  it("maps ship words to the ship icon", () => {
    for (const m of ["ship", "ferry", "vessel", "boat"]) {
      expect(departureIconMode(m), m).toBe("ship");
    }
  });

  it("maps rail words to the rail icon", () => {
    for (const m of ["rail", "train", "shuttle", "tram", "metro"]) {
      expect(departureIconMode(m), m).toBe("rail");
    }
  });

  it("keeps truck, barge and air as themselves", () => {
    expect(departureIconMode("truck")).toBe("truck");
    expect(departureIconMode("barge")).toBe("barge");
    expect(departureIconMode("air")).toBe("air");
  });

  it("is trimmed and case-insensitive", () => {
    expect(departureIconMode("  Ferry ")).toBe("ship");
    expect(departureIconMode("TRAIN")).toBe("rail");
  });

  it("is null for blank or unknown tags", () => {
    expect(departureIconMode("")).toBeNull();
    expect(departureIconMode("  ")).toBeNull();
    expect(departureIconMode("hovercraft")).toBeNull();
    expect(departureIconMode("toString")).toBeNull();
  });
});
