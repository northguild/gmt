/**
 * The B/L Date Stamp's pure module against the real `@northguild/gmt`. Every
 * preset runs through the library, so a drift in `bolTimestamp` or in the
 * widget's reading fails here. The drawing is checked against the library: the
 * lit day of each lane is the library's date for it, and it is the day the
 * gate falls in.
 */
import { Temporal } from "@js-temporal/polyfill";
import { blDateLib } from "~/test/ledger-lib";
import {
  BL_DATE_PRESETS,
  EVENT_OPTIONS,
  LANE_COUNT,
  SLIDER_MAX,
  SLIDER_STEPS,
  blNullText,
  blPlates,
  blankPlates,
  clockTime,
  dayHoldingMoment,
  eventCaption,
  isSeeded,
  laneAria,
  laneLabel,
  laneView,
  matchPreset,
  momentMs,
  momentText,
  permalinkOf,
  presetState,
  readArgs,
  readBlDate,
  sliderMoment,
  sliderPosition,
  sliderReadable,
  summaryText,
  utcClock,
  windowFor,
  zoneDrawable,
  type BlDateState,
} from "./bl-date-stamp";

const state = (over: Partial<BlDateState> = {}): BlDateState => ({
  value: "2024-06-16T01:00:00Z",
  event: "shippedOnBoard",
  timeZone: "America/Sao_Paulo",
  zone2: "",
  zone3: "",
  zone4: "",
  latest: "",
  ...over,
});

/** An epoch time as the `Z` instant the library reads. */
const iso = (ms: number): string =>
  Temporal.Instant.fromEpochMilliseconds(ms).toString();

const preset = (id: string): BlDateState =>
  presetState(BL_DATE_PRESETS.find((p) => p.id === id)!);

/** What each preset gives, from a run against `packages/gmt/dist`. */
const EXPECTED: Record<
  string,
  { bl: string; utc: string; sameness: string | null; calendars?: string[] }
> = {
  "sao-paulo-evening": {
    bl: "2024-06-15",
    utc: "2024-06-16",
    sameness: "one day later",
    calendars: ["2024-06-16"],
  },
  "shanghai-morning": {
    bl: "2024-06-15",
    utc: "2024-06-14",
    sameness: "one day earlier",
  },
  "rotterdam-fall-back": {
    bl: "2024-10-27",
    utc: "2024-10-27",
    sameness: "same date",
  },
  "apia-deleted-day": {
    bl: "2011-12-31",
    utc: "2011-12-30",
    sameness: "one day earlier",
  },
  "fixed-offset": {
    bl: "2024-06-16",
    utc: "2024-06-16",
    sameness: "same date",
  },
  "no-zone": { bl: "", utc: "2024-06-16", sameness: null },
};

describe("the presets", () => {
  it("has an expectation for every preset, and no other", () => {
    expect(BL_DATE_PRESETS.map((p) => p.id).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it("carries Shanghai as the second calendar of the New York preset, and no other preset carries one", () => {
    expect(preset("sao-paulo-evening").zone2).toBe("Asia/Shanghai");
    for (const p of BL_DATE_PRESETS.filter(
      (x) => x.id !== "sao-paulo-evening",
    )) {
      expect([p.zone2, p.zone3, p.zone4], p.id).toEqual(["", "", ""]);
    }
  });

  it.each(BL_DATE_PRESETS.map((p) => [p.id]))(
    "%s gives the library's dates and the words that compare them",
    (id) => {
      const read = readBlDate(preset(id!), blDateLib);
      const want = EXPECTED[id!]!;
      expect(read.bl).toBe(want.bl);
      expect(read.utc).toBe(want.utc);
      expect(read.sameness).toBe(want.sameness);
      if (want.calendars) {
        expect(
          read.lanes
            .slice(2)
            .map((l) => l.date)
            .filter(Boolean),
        ).toEqual(want.calendars);
      }
    },
  );

  it("gives the 27th a 25-hour day in the Rotterdam lane", () => {
    const s = preset("rotterdam-fall-back");
    const ms = momentMs(s.value);
    const win = windowFor(ms, s.timeZone)!;
    const view = laneView(readBlDate(s, blDateLib).lanes[1]!, win, ms);
    expect(view.cells.find((c) => c.date === "2024-10-27")?.hours).toBe(25);
  });

  it("leaves 30 December out of the Apia lane", () => {
    const s = preset("apia-deleted-day");
    const ms = momentMs(s.value);
    const win = windowFor(ms, s.timeZone)!;
    const view = laneView(readBlDate(s, blDateLib).lanes[1]!, win, ms);
    const dates = view.cells.map((c) => c.date);
    expect(dates).toContain("2011-12-29");
    expect(dates).toContain("2011-12-31");
    expect(dates).not.toContain("2011-12-30");
  });
});

describe("the calls made", () => {
  it("calls bolTimestamp for the place, then UTC, then each calendar chosen", () => {
    const read = readBlDate(
      state({ zone2: "Asia/Shanghai", zone4: "Europe/Amsterdam" }),
      blDateLib,
    );
    const bol = read.calls.filter((c) => c.fn === "bolTimestamp");
    expect(bol.map((c) => c.args)).toEqual([
      [
        "2024-06-16T01:00:00Z",
        "shippedOnBoard",
        { timeZone: "America/Sao_Paulo" },
      ],
      ["2024-06-16T01:00:00Z", "shippedOnBoard", { timeZone: "UTC" }],
      ["2024-06-16T01:00:00Z", "shippedOnBoard", { timeZone: "Asia/Shanghai" }],
      [
        "2024-06-16T01:00:00Z",
        "shippedOnBoard",
        { timeZone: "Europe/Amsterdam" },
      ],
    ]);
    expect(bol.map((c) => c.result)).toEqual([
      "2024-06-15",
      "2024-06-16",
      "2024-06-16",
      "2024-06-16",
    ]);
  });

  it("leaves the options out of the call when no place is chosen", () => {
    const read = readBlDate(preset("no-zone"), blDateLib);
    expect(read.calls[0]).toMatchObject({
      fn: "bolTimestamp",
      args: ["2024-06-16T01:00:00Z", "shippedOnBoard"],
      result: "",
    });
    expect(read.calls[0]!.args).toHaveLength(2);
  });

  it("calls the comparisons only when both dates came back", () => {
    const fns = (s: BlDateState) =>
      readBlDate(s, blDateLib).calls.map((c) => c.fn);
    expect(fns(preset("no-zone"))).not.toContain("areDatesEqual");
    expect(fns(preset("no-zone"))).not.toContain("isAfterDate");
    expect(fns(state({ value: "not a moment" }))).not.toContain(
      "areDatesEqual",
    );
    const both = readBlDate(state(), blDateLib).calls;
    expect(both.map((c) => c.fn)).toEqual([
      "bolTimestamp",
      "bolTimestamp",
      "areDatesEqual",
      "isAfterDate",
    ]);
    expect(both[2]!.args).toEqual(["2024-06-16", "2024-06-15"]);
    expect(both[3]!.args).toEqual(["2024-06-16", "2024-06-15"]);
  });

  it("makes no latest-date call for a blank latest date", () => {
    const fns = readBlDate(state(), blDateLib).calls.map((c) => c.fn);
    expect(fns).not.toContain("isValidDate");
  });

  it("compares both dates against a latest date the library accepts", () => {
    const read = readBlDate(state({ latest: "2024-06-15" }), blDateLib);
    expect(read.latest).toEqual({
      value: "2024-06-15",
      valid: true,
      bl: "on or before the latest date",
      utc: "after the latest date",
    });
    const tail = read.calls.slice(-3);
    expect(tail.map((c) => [c.fn, c.args, c.result])).toEqual([
      ["isValidDate", ["2024-06-15"], true],
      ["isAfterDate", ["2024-06-15", "2024-06-15"], false],
      ["isAfterDate", ["2024-06-16", "2024-06-15"], true],
    ]);
  });

  it("makes no comparison against a latest date that is not a date", () => {
    const read = readBlDate(state({ latest: "2024-02-30" }), blDateLib);
    expect(read.latest).toEqual({
      value: "2024-02-30",
      valid: false,
      bl: null,
      utc: null,
    });
    expect(read.calls.at(-1)).toMatchObject({
      fn: "isValidDate",
      result: false,
    });
    expect(
      read.calls.filter(
        (c) => c.fn === "isAfterDate" && c.args[1] === "2024-02-30",
      ),
    ).toHaveLength(0);
  });

  it("does not compare a missing date against the latest date", () => {
    const read = readBlDate(
      { ...preset("no-zone"), latest: "2024-06-15" },
      blDateLib,
    );
    expect(read.latest.bl).toBeNull();
    expect(read.latest.utc).toBe("after the latest date");
  });
});

describe("the lit day", () => {
  it.each(BL_DATE_PRESETS.filter((p) => p.timeZone !== "").map((p) => [p.id]))(
    "%s lights, in every lane, the library's date, and it is the day the gate falls in",
    (id) => {
      const s = preset(id!);
      const ms = momentMs(s.value);
      const win = windowFor(ms, s.timeZone)!;
      const read = readBlDate(s, blDateLib);
      for (const lane of read.lanes) {
        if (lane.zone === "") continue;
        const view = laneView(lane, win, ms);
        expect(view.lit, `${id} lane ${lane.index}`).toBe(lane.date);
        expect(
          dayHoldingMoment(view.cells, ms),
          `${id} lane ${lane.index}`,
        ).toBe(view.lit);
        expect(Object.keys(view.marks)).toEqual([lane.date]);
        expect(view.marks[lane.date]).toMatchObject({
          state: "lit",
          chip: lane.date,
        });
      }
    },
  );

  it("lights the same date for the same moment at any step of the slider", () => {
    const s = state({ zone2: "Asia/Shanghai" });
    const win = windowFor(momentMs(s.value), s.timeZone)!;
    for (let step = 0; step <= SLIDER_MAX; step += 1) {
      const ms = sliderMoment(win, step);
      const at = state({
        zone2: "Asia/Shanghai",
        value: iso(ms),
      });
      const read = readBlDate(at, blDateLib);
      for (const lane of read.lanes) {
        if (lane.zone === "") continue;
        const view = laneView(lane, win, ms);
        expect(view.lit, `step ${step} lane ${lane.index}`).toBe(lane.date);
        expect(dayHoldingMoment(view.cells, ms)).toBe(lane.date);
      }
    }
  });

  it("draws a lane with no zone as a box with a note, and no days", () => {
    const s = preset("sao-paulo-evening");
    const ms = momentMs(s.value);
    const win = windowFor(ms, s.timeZone)!;
    const lanes = readBlDate(s, blDateLib).lanes;
    const view = laneView(lanes[3]!, win, ms);
    expect(view).toMatchObject({
      cells: [],
      lit: null,
      note: "no zone chosen",
    });
    expect(laneAria(lanes[3]!)).toBe("Calendar 3: no zone chosen");
  });

  it("shows a zone the drawing cannot lay out with its library date, and says its days are not drawn", () => {
    const s = state({ zone2: "+08:00:30" });
    const ms = momentMs(s.value);
    expect(zoneDrawable("+08:00:30")).toBe(false);
    const lane = readBlDate(s, blDateLib).lanes[2]!;
    expect(lane.date).toBe("2024-06-16");
    const view = laneView(lane, windowFor(ms, s.timeZone), ms);
    expect(view.cells).toEqual([]);
    expect(view.lit).toBeNull();
    expect(view.note).toBe("2024-06-16 · its days are not drawn");
    expect(laneAria(lane)).toBe("+08:00:30: Sun 16 Jun 2024");
  });

  it("names a zone the library does not read, and draws no lit day", () => {
    const s = state({ zone3: "Mars/Base" });
    const lane = readBlDate(s, blDateLib).lanes[3]!;
    expect(lane.date).toBe("");
    const view = laneView(lane, windowFor(momentMs(s.value), s.timeZone), 0);
    expect(view.note).toBe("the library returned no date");
    expect(view.lit).toBeNull();
    expect(laneAria(lane)).toBe("Mars/Base: no date");
  });

  it("labels the lanes", () => {
    const lanes = readBlDate(
      state({ zone2: "Asia/Shanghai" }),
      blDateLib,
    ).lanes;
    expect(lanes).toHaveLength(LANE_COUNT);
    expect(lanes.map(laneLabel)).toEqual([
      "UTC (naive)",
      "America/Sao_Paulo",
      "Asia/Shanghai",
      "Calendar 3",
      "Calendar 4",
    ]);
    expect(laneLabel(readBlDate(preset("no-zone"), blDateLib).lanes[1]!)).toBe(
      "Place of the event",
    );
  });
});

describe("the window and the slider", () => {
  it("is 72 hours wide, centred on the local midnight nearest the moment", () => {
    const s = preset("sao-paulo-evening");
    const win = windowFor(momentMs(s.value), s.timeZone)!;
    // 21:00 on 15 June in São Paulo is nearer the midnight that ends the day.
    expect(iso(win.startMs)).toBe("2024-06-14T15:00:00Z");
    expect(iso(win.endMs)).toBe("2024-06-17T15:00:00Z");
    expect(win.endMs - win.startMs).toBe(72 * 3_600_000);
    expect(win.snapMinutes).toBe(15);
  });

  it("uses the midnight before when the moment is in the morning", () => {
    const s = preset("shanghai-morning");
    const win = windowFor(momentMs(s.value), s.timeZone)!;
    // 07:00 on 15 June in Shanghai: the midnight before is 2024-06-14T16:00Z.
    expect(iso(win.startMs + 36 * 3_600_000)).toBe("2024-06-14T16:00:00Z");
  });

  it("reads in UTC with no zone, and when the drawing cannot read the zone", () => {
    const ms = momentMs("2024-06-16T01:00:00Z");
    const utc = windowFor(ms, "")!;
    expect(iso(utc.startMs + 36 * 3_600_000)).toBe("2024-06-16T00:00:00Z");
    expect(windowFor(ms, "Mars/Base")!.startMs).toBe(utc.startMs);
    expect(windowFor(Number.NaN, "UTC")).toBeNull();
  });

  it("moves in 15-minute steps, and the position and the moment agree", () => {
    const win = windowFor(momentMs("2024-06-16T01:00:00Z"), "UTC")!;
    expect(SLIDER_STEPS).toBe(288);
    expect(SLIDER_MAX).toBe(287);
    expect(sliderPosition(win, momentMs("2024-06-16T01:00:00Z"))).toBe(
      36 * 4 + 4,
    );
    expect(sliderMoment(win, 0)).toBe(win.startMs);
    expect(sliderMoment(win, 1) - sliderMoment(win, 0)).toBe(15 * 60_000);
    for (const step of [0, 1, 100, 144, 287]) {
      expect(sliderPosition(win, sliderMoment(win, step))).toBe(step);
    }
    expect(sliderPosition(win, win.startMs - 10 ** 9)).toBe(0);
    expect(sliderPosition(win, win.endMs + 10 ** 9)).toBe(SLIDER_MAX);
  });

  it("can move a value that reads as a moment and no other", () => {
    expect(sliderReadable("2024-06-16T01:00:00Z")).toBe(true);
    expect(sliderReadable("2024-06-16T01:00:00+08:00[Asia/Shanghai]")).toBe(
      true,
    );
    expect(sliderReadable("2024-06-16T01:00:00")).toBe(false);
    expect(sliderReadable("")).toBe(false);
  });

  it("writes a clock time and the gate chip", () => {
    const ms = momentMs("2024-06-16T01:00:00Z");
    expect(clockTime(ms, "America/Sao_Paulo")).toBe("22:00");
    expect(clockTime(ms + 30_000, "UTC")).toBe("01:00:30");
    expect(clockTime(ms, "Mars/Base")).toBe("");
    expect(utcClock(ms)).toBe("01:00Z");
    expect(momentText(ms)).toBe("Sun 16 Jun 01:00Z");
    expect(momentText(Number.NaN)).toBe("");
  });
});

describe("why NO SIGNAL", () => {
  it("asks for the place when there is none, without calling the library", () => {
    const spy = vi.fn(blDateLib.bolTimestamp);
    const text = blNullText(preset("no-zone"), {
      ...blDateLib,
      bolTimestamp: spy,
    });
    expect(text).toBe(
      "Choose the place of the event. Every bill of lading date is the local one, so the zone is required.",
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("probes the library to find a zone it does not read", () => {
    const spy = vi.fn(blDateLib.bolTimestamp);
    const text = blNullText(state({ timeZone: "Mars/Base" }), {
      ...blDateLib,
      bolTimestamp: spy,
    });
    expect(text).toBe(
      "The library does not read Mars/Base as a place. Use an IANA zone name such as Europe/London, or a UTC offset such as +08:00.",
    );
    expect(spy).toHaveBeenCalledWith("2024-06-15T12:00:00Z", "issue", {
      timeZone: "Mars/Base",
    });
  });

  it("says when the value is not a moment", () => {
    for (const value of ["2024-06-16T01:00:00", "not a moment", ""]) {
      expect(blNullText(state({ value }), blDateLib), value).toBe(
        "The value is not a moment. It needs a Z, an offset, or an offset with a bracketed zone.",
      );
    }
  });

  it("says when the event is not one of the three", () => {
    expect(blNullText(state({ event: "loaded" }), blDateLib)).toBe(
      "loaded is not one of the three events. Use shippedOnBoard, received or issue.",
    );
    expect(blNullText(state({ event: "" }), blDateLib)).toBe(
      "No event is chosen. Use shippedOnBoard, received or issue.",
    );
  });

  it("decides by the library and not by a list: a zone the library stops reading is reported as unread", () => {
    const lib = {
      ...blDateLib,
      bolTimestamp: (value: string, event: string, o?: { timeZone: string }) =>
        o?.timeZone === "Europe/Amsterdam"
          ? ""
          : blDateLib.bolTimestamp(value, event, o),
    };
    expect(blNullText(state({ timeZone: "Europe/Amsterdam" }), lib)).toBe(
      "The library does not read Europe/Amsterdam as a place. Use an IANA zone name such as Europe/London, or a UTC offset such as +08:00.",
    );
    expect(blNullText(state({ timeZone: "Europe/Amsterdam" }), blDateLib)).toBe(
      "The library returned no date for these inputs.",
    );
  });

  it("agrees with the library for every input that gives no date", () => {
    for (const s of [
      state({ timeZone: "" }),
      state({ timeZone: "Mars/Base" }),
      state({ value: "x" }),
      state({ event: "loaded" }),
    ]) {
      expect(readBlDate(s, blDateLib).bl).toBe("");
      expect(blNullText(s, blDateLib)).not.toBe(
        "The library returned no date for these inputs.",
      );
    }
  });
});

describe("the plates and the sentence", () => {
  it("captions the B/L plate with the event", () => {
    expect(EVENT_OPTIONS.map((o) => eventCaption(o.value))).toEqual([
      "Shipped on board date",
      "Received for shipment date",
      "Issue date",
    ]);
    expect(eventCaption("loaded")).toBe("B/L date");
  });

  it("labels each event with the field it fills", () => {
    expect(EVENT_OPTIONS.map((o) => o.label)).toEqual([
      "Shipped on board (shippedOnBoardDate)",
      "Received for shipment (receivedForShipmentDate)",
      "Issue (issueDate)",
    ]);
  });

  it("shows the date, the local time and the words for the New York preset", () => {
    const s = preset("sao-paulo-evening");
    const plates = blPlates(s, readBlDate(s, blDateLib));
    expect(plates).toEqual([
      {
        role: "hero-bl",
        caption: "Shipped on board date",
        captions: [
          "Shipped on board date",
          "Received for shipment date",
          "Issue date",
        ],
        series: 1,
        value: "Sat 15 Jun 2024",
        lines: ["22:00 in America/Sao_Paulo", ""],
      },
      {
        role: "hero-utc",
        caption: "UTC date",
        quiet: true,
        value: "Sun 16 Jun 2024",
        lines: ["one day later", ""],
      },
    ]);
  });

  it("adds the latest-date words, or says the latest date is not a date", () => {
    const s = state({ latest: "2024-06-15" });
    const [bl, utc] = blPlates(s, readBlDate(s, blDateLib));
    expect(bl!.lines[1]).toBe("on or before the latest date");
    expect(utc!.lines[1]).toBe("after the latest date");
    const bad = state({ latest: "2024-02-30" });
    const [bl2, utc2] = blPlates(bad, readBlDate(bad, blDateLib));
    expect(bl2!.lines[1]).toBe("latest date is not a date");
    expect(utc2!.lines[1]).toBe("latest date is not a date");
  });

  it("reads 'no result' on the B/L plate for the no-zone preset, and keeps the UTC date", () => {
    const s = preset("no-zone");
    const [bl, utc] = blPlates(s, readBlDate(s, blDateLib));
    expect(bl!.value).toBeNull();
    expect(utc!.value).toBe("Sun 16 Jun 2024");
    expect(utc!.lines[0]).toBe("");
  });

  it("holds the same two plates before the library answers", () => {
    const blank = blankPlates("issue");
    expect(blank.map((p) => p.role)).toEqual(["hero-bl", "hero-utc"]);
    expect(blank.every((p) => p.value === null)).toBe(true);
    expect(blank[0]!.caption).toBe("Issue date");
    expect(blank.map((p) => p.lines.length)).toEqual([2, 2]);
  });

  it("says both plates as one sentence", () => {
    const s = preset("sao-paulo-evening");
    expect(summaryText(s, readBlDate(s, blDateLib), "")).toBe(
      "Shipped on board date: Sat 15 Jun 2024, 22:00 in America/Sao_Paulo. UTC date: Sun 16 Jun 2024, one day later.",
    );
    const none = preset("no-zone");
    expect(
      summaryText(
        none,
        readBlDate(none, blDateLib),
        blNullText(none, blDateLib),
      ),
    ).toBe(
      "Shipped on board date: no result. Choose the place of the event. Every bill of lading date is the local one, so the zone is required. UTC date: Sun 16 Jun 2024.",
    );
  });
});

describe("seeds, presets and the permalink", () => {
  it("reads a seed as control values and never fills a key it does not carry", () => {
    expect(
      readArgs({ value: " 2024-06-16T01:00:00Z ", timeZone: "+08:00" }),
    ).toEqual({
      value: "2024-06-16T01:00:00Z",
      event: "",
      timeZone: "+08:00",
      zone2: "",
      zone3: "",
      zone4: "",
      latest: "",
    });
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ latest: "2024-06-15" })).toBe(true);
  });

  it("matches a preset by its controls, and calls anything else custom", () => {
    for (const p of BL_DATE_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
    }
    expect(matchPreset(state({ value: "2024-06-16T01:15:00Z" }))).toBe(
      "custom",
    );
  });

  it("leaves a blank key out of the permalink", () => {
    expect(permalinkOf(preset("no-zone"))).toEqual({
      value: "2024-06-16T01:00:00Z",
      event: "shippedOnBoard",
    });
    expect(permalinkOf(preset("sao-paulo-evening"))).toEqual({
      value: "2024-06-16T01:00:00Z",
      event: "shippedOnBoard",
      timeZone: "America/Sao_Paulo",
      zone2: "Asia/Shanghai",
    });
  });
});

describe("the module's own words", () => {
  it("names no law, regulator, carrier or court", () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|court)\w*/i;
    const strings = [
      ...BL_DATE_PRESETS.flatMap((p) => [p.label, p.description]),
      ...EVENT_OPTIONS.map((o) => o.label),
    ];
    for (const s of strings) expect(s).not.toMatch(forbidden);
  });
});
