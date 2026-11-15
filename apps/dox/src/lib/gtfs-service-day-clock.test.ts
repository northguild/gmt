/**
 * The GTFS Service Day Clock's pure half, against the real library in `dist`: every preset,
 * the issue's verification rows, the order of the reason probes, the gap's sign, the rail and the
 * permalink both ways. The expected instants are the library's own (`serviceDayLib`) or the
 * values the issue and the spec state.
 */
import { serviceDayLib as lib } from "~/test/service-day-lib";
import { showGtfsServiceDayClockInput } from "./dox-tools";
import {
  BLANK_RESULT,
  CUSTOM_PRESET_ID,
  GHOST_LOCAL,
  GHOST_UTC,
  MIDNIGHT_NOTES,
  PRESETS,
  REASONS,
  VERDICT_SAMPLES,
  WIDEST_ZONE,
  callsSizerText,
  clockOf,
  computeClock,
  dayOf,
  explainRefusal,
  isSeeded,
  matchPreset,
  midnightNoteOf,
  permalinkOf,
  presetState,
  readArgs,
  readingOf,
  verdictOf,
  type ServiceDayState,
} from "./gtfs-service-day-clock";

const preset = (id: string) => {
  const found = PRESETS.find((p) => p.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return found;
};

const run = (date: string, time: string, zone: string) =>
  computeClock(lib, { date, time, zone });

describe("the chat tool's preset list", () => {
  it("names exactly the page's presets", () => {
    for (const p of PRESETS) {
      expect(
        showGtfsServiceDayClockInput.safeParse({ preset: p.id }).success,
      ).toBe(true);
    }
    expect(
      showGtfsServiceDayClockInput.safeParse({ preset: "far-future" }).success,
    ).toBe(false);
  });
});

describe("the presets, against the library", () => {
  it("has eight presets with distinct ids", () => {
    expect(PRESETS).toHaveLength(8);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(8);
  });

  it.each(PRESETS.map((p) => [p.id, p] as const))(
    "%s gives what the library gives",
    (_id, p) => {
      const r = run(p.date, p.time, p.zone);
      const gtfs = lib.gtfsToInstant(p.date, p.time, p.zone);
      expect(r.gtfs.answer.utc).toBe(gtfs);
      expect(r.gtfs.answer.local).toBe(
        gtfs === "" ? "" : lib.convertUtcToZoned(gtfs, p.zone),
      );
      expect(r.gtfs.anchor.utc).toBe(
        lib.gtfsToInstant(p.date, "00:00:00", p.zone),
      );
    },
  );

  it("spring-forward is the default: the midnight answer is 60 minutes later", () => {
    const p = preset("spring-forward");
    expect(PRESETS[0]).toBe(p);
    const r = run(p.date, p.time, p.zone);
    expect(r.gtfs.answer.utc).toBe("2026-03-29T06:00:00Z");
    expect(readingOf(r.gtfs.answer.local)).toBe("08:00 +02:00");
    expect(readingOf(r.midnight.answer.local)).toBe("09:00 +02:00");
    expect(r.gap).toBe(60);
    expect(r.reason).toBe("ok");
    expect(verdictOf(r.gap)).toMatchObject({ tone: "bad" });
  });

  it("spring-start: 00:00:00 is 23:00 the day before, the midnight anchor is 00:00", () => {
    const p = preset("spring-start");
    const r = run(p.date, p.time, p.zone);
    expect(readingOf(r.gtfs.answer.local)).toBe("23:00 +01:00");
    expect(r.gtfs.answer.local.startsWith("2026-03-28")).toBe(true);
    expect(readingOf(r.midnight.answer.local)).toBe("00:00 +01:00");
    expect(r.midnight.answer.local.startsWith("2026-03-29")).toBe(true);
    expect(r.gap).toBe(60);
  });

  it("fall-back: the midnight answer is 60 minutes earlier", () => {
    const p = preset("fall-back");
    const r = run(p.date, p.time, p.zone);
    expect(readingOf(r.gtfs.answer.local)).toBe("08:00 +01:00");
    expect(readingOf(r.midnight.answer.local)).toBe("07:00 +01:00");
    expect(r.gap).toBe(-60);
  });

  it("ordinary: both anchors agree", () => {
    const p = preset("ordinary");
    const r = run(p.date, p.time, p.zone);
    expect(r.gtfs.answer.utc).toBe(r.midnight.answer.utc);
    expect(readingOf(r.gtfs.answer.local)).toBe("08:00 +02:00");
    expect(r.gap).toBe(0);
    expect(verdictOf(r.gap)).toMatchObject({ tone: "good" });
  });

  it("past-midnight: 26:30:00 is elapsed time, not 02:30", () => {
    const p = preset("past-midnight");
    const r = run(p.date, p.time, p.zone);
    expect(readingOf(r.gtfs.answer.local)).toBe("03:30 +02:00");
    expect(r.gtfs.answer.local.startsWith("2026-03-29")).toBe(true);
    expect(r.midnight.answer.utc).toBe(r.gtfs.answer.utc);
    expect(r.gap).toBe(0);
  });

  it("lord-howe: a 30-minute change, so the anchors are 30 minutes apart", () => {
    const p = preset("lord-howe");
    const r = run(p.date, p.time, p.zone);
    expect(readingOf(r.gtfs.answer.local)).toBe("08:00 +11:00");
    expect(readingOf(r.midnight.answer.local)).toBe("08:30 +11:00");
    expect(r.gap).toBe(30);
    expect(verdictOf(r.gap)).toMatchObject({
      tone: "bad",
      detail: expect.stringContaining("30 minutes later"),
    });
  });

  it("relabels past-midnight and has no US preset", () => {
    expect(preset("past-midnight").label).toBe(
      "Berlin, 26:30:00 across the change",
    );
    expect(PRESETS.some((p) => p.zone.startsWith("America/"))).toBe(false);
  });

  it("no-noon: GTFS gives nothing, the midnight code answers for a day that never happened", () => {
    const p = preset("no-noon");
    const r = run(p.date, p.time, p.zone);
    expect(r.gtfs.answer.utc).toBe("");
    expect(r.gtfs.answer.local).toBe("");
    expect(r.reason).toBe("nonexistent");
    expect(r.midnight.answer.utc).not.toBe("");
    expect(readingOf(r.midnight.answer.local)).toBe("12:00 +14:00");
    expect(r.midnight.answer.local.startsWith("2011-12-31")).toBe(true);
    expect(r.gap).toBeNull();
    expect(verdictOf(r.gap)).toBeNull();
  });

  it("offset: +05:30 never changes", () => {
    const p = preset("offset");
    const r = run(p.date, p.time, p.zone);
    expect(readingOf(r.gtfs.answer.local)).toBe("08:00 +05:30");
    expect(r.gap).toBe(0);
    expect(r.hasChange).toBe(false);
    expect(r.rail?.changes).toEqual([]);
  });
});

describe("the issue's verification rows", () => {
  it.each([
    ["20240130", "25:35:00", "America/Los_Angeles", "2024-01-31T09:35:00Z"],
    ["20240130", "27:00:00", "America/Los_Angeles", "2024-01-31T11:00:00Z"],
    ["20240331", "00:00:00", "Europe/Berlin", "2024-03-30T22:00:00Z"],
    ["20240331", "03:00:00", "Europe/Berlin", "2024-03-31T01:00:00Z"],
    ["20240331", "14:30:00", "Europe/Berlin", "2024-03-31T12:30:00Z"],
    ["20240407", "00:00:00", "Australia/Sydney", "2024-04-06T14:00:00Z"],
    ["20240407", "12:00:00", "Australia/Sydney", "2024-04-07T02:00:00Z"],
  ])("%s %s in %s is %s", (date, time, zone, utc) => {
    expect(run(date, time, zone).gtfs.answer.utc).toBe(utc);
  });

  it("agrees between the ISO and the basic form of the date", () => {
    const a = run("20240331", "03:00:00", "Europe/Berlin");
    const b = run("2024-03-31", "03:00:00", "Europe/Berlin");
    expect(b.gtfs.answer.utc).toBe(a.gtfs.answer.utc);
    expect(b.iso).toBe("2024-03-31");
    expect(a.iso).toBe("2024-03-31");
  });

  it.each([
    ["20240331", "Europe/Berlin"],
    ["20240310", "America/New_York"],
    ["20241027", "Europe/Berlin"],
    ["20240407", "Australia/Sydney"],
  ])(
    "the midnight answer differs on the clock-change day %s in %s",
    (date, zone) => {
      const r = run(date, "08:00:00", zone);
      expect(r.gap).not.toBe(0);
      expect(r.gap).not.toBeNull();
    },
  );
});

describe("the gap's sign", () => {
  it("reads +60 on spring forward: diffUtc gives the later minus the earlier", () => {
    const r = run("20260329", "08:00:00", "Europe/Berlin");
    expect(r.gap).toBe(
      lib.diffUtc(r.gtfs.answer.utc, r.midnight.answer.utc, "minutes"),
    );
    expect(r.gap).toBe(60);
  });
});

describe("the reason a refusal gives, in probe order", () => {
  const reasonOf = (date: string, time: string, zone: string) => {
    const r = run(date, time, zone);
    expect(r.gtfs.answer.utc).toBe("");
    return r.reason;
  };

  it("the time first", () => {
    expect(reasonOf("20240130", "25:60:00", "America/Los_Angeles")).toBe(
      "time",
    );
    // A bad time and a bad date: the time is named.
    expect(reasonOf("20240230", "25:60:00", "America/Los_Angeles")).toBe(
      "time",
    );
  });

  it.each([
    "20240230",
    "2024-01-30T23:00",
    "20240130T2300",
    "+002024-01-30",
    "2024-01-30[u-ca=hebrew]",
  ])("the date for %s", (date) => {
    expect(reasonOf(date, "08:00:00", "America/Los_Angeles")).toBe("date");
  });

  it("the zone for a name that is not one", () => {
    expect(reasonOf("20240130", "08:00:00", "Not/AZone")).toBe("zone");
  });

  it("the zone for an empty zone, asked of the library directly", () => {
    expect(explainRefusal(lib, "20240130", "08:00:00", "")).toBe("zone");
  });

  it("no noon: skipped", () => {
    expect(reasonOf("20111230", "12:00:00", "Pacific/Apia")).toBe(
      "nonexistent",
    );
  });

  it("every reason has its own words", () => {
    const texts = Object.values(REASONS);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe("an empty box", () => {
  it.each([
    [{ date: "", time: "08:00:00", zone: "Europe/Berlin" }],
    [{ date: "20260329", time: "", zone: "Europe/Berlin" }],
    [{ date: "20260329", time: "08:00:00", zone: "" }],
  ])("is the empty state and makes no call: %j", (state) => {
    const r = computeClock(lib, state);
    expect(r).toBe(BLANK_RESULT);
    expect(r.calls).toEqual([]);
    expect(r.rail).toBeNull();
  });
});

describe("the rail", () => {
  it("places the anchors, the answers and the noon on both lanes", () => {
    const r = run("20260329", "08:00:00", "Europe/Berlin");
    expect(r.rail).not.toBeNull();
    const labels = r.rail!.marks.map((m) => `${m.lane}:${m.kind}`);
    expect(labels).toContain("gtfs:anchor");
    expect(labels).toContain("gtfs:answer");
    expect(labels).toContain("gtfs:noon");
    expect(labels).toContain("midnight:anchor");
    expect(labels).toContain("midnight:answer");
    expect(labels).toContain("gtfs:change");
    expect(labels).toContain("midnight:change");
    for (const m of r.rail!.marks) {
      expect(m.at).toBeGreaterThanOrEqual(0);
      expect(m.at).toBeLessThanOrEqual(1);
    }
  });

  it("names the clock change as the library returned it", () => {
    const r = run("20260329", "08:00:00", "Europe/Berlin");
    const t = lib
      .getDstTransitions("Europe/Berlin", 2026)
      .find((x) => x.instant.startsWith("2026-03-29"));
    expect(r.rail!.changes).toHaveLength(1);
    expect(r.rail!.changes[0]!.label).toBe(
      `${t!.offsetBefore} → ${t!.offsetAfter}`,
    );
  });

  it("draws a gap span only where the anchors differ", () => {
    expect(
      run("20260329", "08:00:00", "Europe/Berlin").rail!.spans,
    ).toHaveLength(2);
    expect(run("20260615", "08:00:00", "Europe/Berlin").rail!.spans).toEqual(
      [],
    );
  });

  it("puts an ordinary day's two anchors at the same place", () => {
    const r = run("20260615", "08:00:00", "Europe/Berlin");
    const at = (kind: string, laneId: string) =>
      r.rail!.marks.find((m) => m.kind === kind && m.lane === laneId)!.at;
    expect(at("anchor", "gtfs")).toBe(at("anchor", "midnight"));
    expect(at("answer", "gtfs")).toBe(at("answer", "midnight"));
  });

  it("labels the axis in the zone's clock every 6 hours", () => {
    const r = run("20260615", "08:00:00", "Europe/Berlin");
    expect(r.rail!.ticks.length).toBeGreaterThanOrEqual(3);
    for (const t of r.rail!.ticks) expect(t.label).toMatch(/^\d\d:\d\d$/);
  });

  it("does not crowd the axis for a long window", () => {
    const r = run("20260615", "999:59:59", "Europe/Berlin");
    if (r.rail !== null) expect(r.rail.ticks.length).toBeLessThanOrEqual(13);
  });

  it("still draws the rail when GTFS refuses and the midnight code answers", () => {
    const r = run("20111230", "12:00:00", "Pacific/Apia");
    expect(r.rail).not.toBeNull();
    expect(
      r.rail!.marks.some((m) => m.lane === "midnight" && m.kind === "answer"),
    ).toBe(true);
  });

  it("says so when the library gives no position (the far year)", () => {
    const r = run("99991231", "999:59:59", "UTC");
    // The answer is Temporal's expanded-year string, shown as returned.
    expect(r.gtfs.answer.utc).toMatch(/^\+010000-/);
    if (r.rail === null) expect(r.railNote).toBe("notDrawn");
  });

  it("is not drawn, with no note, when nothing is typed", () => {
    expect(BLANK_RESULT.railNote).toBe("nothing");
  });
});

describe("the calls", () => {
  it("prints each call with its result as a comment", () => {
    const r = run("20260329", "08:00:00", "Europe/Berlin");
    expect(r.calls[0]).toBe(
      'gtfsToInstant("20260329", "08:00:00", "Europe/Berlin"); // "2026-03-29T06:00:00Z"',
    );
    for (const line of r.calls) expect(line).toMatch(/^\w+\(.*\); \/\/ .+$/);
  });

  it("never prints more lines than the sizer reserves", () => {
    const reserved = callsSizerText().split("\n").length;
    for (const p of PRESETS) {
      expect(run(p.date, p.time, p.zone).calls.length).toBeLessThanOrEqual(
        reserved,
      );
    }
    expect(
      run("20240230", "25:60:00", "Not/AZone").calls.length,
    ).toBeLessThanOrEqual(reserved);
  });

  it("the sizer's widest line is at least as wide as any preset's", () => {
    const widest = Math.max(
      ...callsSizerText()
        .split("\n")
        .map((l) => l.length),
    );
    for (const p of PRESETS) {
      for (const line of run(p.date, p.time, p.zone).calls) {
        expect(line.length).toBeLessThanOrEqual(widest);
      }
    }
  });
});

describe("the held widths", () => {
  const locals = PRESETS.flatMap((p) => {
    const r = run(p.date, p.time, p.zone);
    return [
      r.gtfs.anchor.local,
      r.gtfs.answer.local,
      r.midnight.anchor.local,
      r.midnight.answer.local,
    ].filter((v) => v !== "");
  });
  const utcs = PRESETS.flatMap((p) => {
    const r = run(p.date, p.time, p.zone);
    return [r.gtfs.answer.utc, r.midnight.answer.utc].filter((v) => v !== "");
  });

  it("each local ghost is a library output: the presets', plus the widest zone's", () => {
    const widest = lib.convertUtcToZoned("2026-03-08T11:00:00Z", WIDEST_ZONE);
    expect(widest).toBe(`2026-03-08T08:00:00-03:00[${WIDEST_ZONE}]`);
    for (const ghost of GHOST_LOCAL) {
      expect(ghost === widest || locals.includes(ghost), ghost).toBe(true);
    }
    expect(GHOST_LOCAL).toContain(widest);
  });

  it("reserves a reading in the widest zone, wider than any preset's", () => {
    const widest = Math.max(...GHOST_LOCAL.map((g) => g.length));
    const buenosAires = run("20260308", "08:00:00", WIDEST_ZONE);
    expect(buenosAires.gtfs.answer.local.length).toBeLessThanOrEqual(widest);
    expect(GHOST_LOCAL[0]).toBe(buenosAires.gtfs.answer.local);
    for (const v of locals) expect(v.length).toBeLessThan(widest);
  });

  it("no preset reading is wider than the widest ghost", () => {
    const widest = Math.max(...GHOST_LOCAL.map((g) => g.length));
    const presetWidest = Math.max(...locals.map((v) => v.length));
    expect(presetWidest).toBeLessThanOrEqual(widest);
    const widestUtc = Math.max(...GHOST_UTC.map((g) => g.length));
    for (const v of utcs) expect(v.length).toBeLessThanOrEqual(widestUtc);
  });

  it("each UTC ghost is a library output", () => {
    for (const ghost of GHOST_UTC) expect(utcs).toContain(ghost);
  });

  it("the verdict samples include the widest it can say", () => {
    expect(VERDICT_SAMPLES.length).toBeGreaterThan(2);
  });
});

describe("the midnight card's note", () => {
  const noteOf = (date: string, time: string, zone: string) =>
    midnightNoteOf(run(date, time, zone));

  it("says nothing special for a midnight that happened once", () => {
    const r = run("20260329", "08:00:00", "Europe/Berlin");
    expect(r.midnightKind).toBe("unique");
    expect(midnightNoteOf(r)).toBe("ok");
    expect(MIDNIGHT_NOTES[midnightNoteOf(r)]).toMatch(
      /^Local midnight of the date/,
    );
  });

  it.each([
    ["the Samoa preset (30 December 2011)", "20111230", "Pacific/Apia"],
    [
      "Santiago, where the clocks change at midnight",
      "20260906",
      "America/Santiago",
    ],
  ])("says midnight did not happen for %s", (_name, date, zone) => {
    const r = run(date, "08:00:00", zone);
    expect(lib.classifyLocal(`${r.iso}T00:00:00`, zone)).toBe("nonexistent");
    expect(r.midnightKind).toBe("nonexistent");
    expect(midnightNoteOf(r)).toBe("skipped");
    expect(MIDNIGHT_NOTES.skipped).toContain("did not happen");
    expect(MIDNIGHT_NOTES.skipped).toContain("moved it forward");
  });

  it("says midnight happened twice, and the earlier one was taken", () => {
    const r = run("20261101", "08:00:00", "America/Havana");
    expect(lib.classifyLocal("2026-11-01T00:00:00", "America/Havana")).toBe(
      "ambiguous",
    );
    expect(r.midnightKind).toBe("ambiguous");
    expect(midnightNoteOf(r)).toBe("repeated");
    expect(MIDNIGHT_NOTES.repeated).toContain("happened twice");
    expect(MIDNIGHT_NOTES.repeated).toContain("took the earlier one");
    // The earlier reading is the one resolveLocal returns.
    expect(r.midnight.anchor.utc).toBe(
      lib.resolveLocal("2026-11-01T00:00:00", "America/Havana"),
    );
  });

  it("keeps the empty and the no-signal notes", () => {
    expect(noteOf("", "08:00:00", "Europe/Berlin")).toBe("empty");
    expect(noteOf("20260329", "08:00:00", "Not/AZone")).toBe("none");
    expect(noteOf("20240230", "08:00:00", "Europe/Berlin")).toBe("none");
  });

  it("has five distinct texts", () => {
    const texts = Object.values(MIDNIGHT_NOTES);
    expect(texts).toHaveLength(5);
    expect(new Set(texts).size).toBe(5);
  });
});

describe("a window that crosses into the next year", () => {
  it("marks the clock change in January that follows a December date (Fiji 2014/15)", () => {
    const r = run("20141215", "999:59:59", "Pacific/Fiji");
    expect(r.rail).not.toBeNull();
    expect(r.gtfs.answer.local.startsWith("2015-01-25")).toBe(true);
    expect(
      lib
        .getDstTransitions("Pacific/Fiji", 2015)
        .map((t) => `${t.offsetBefore} → ${t.offsetAfter}`)[0],
    ).toBe("+13:00 → +12:00");
    expect(r.rail!.changes.map((c) => c.label)).toEqual(["+13:00 → +12:00"]);
    expect(r.rail!.marks.some((m) => m.kind === "change")).toBe(true);
    // The date's own year is still the one that sets the DST link.
    expect(r.year).toBe(2014);
    expect(r.hasChange).toBe(true);
    // Each year is asked of the library once.
    expect(r.calls.filter((c) => c.startsWith("getDstTransitions"))).toEqual([
      expect.stringContaining('"Pacific/Fiji", 2014'),
      expect.stringContaining('"Pacific/Fiji", 2015'),
    ]);
  });

  it("asks one year for a window inside one year", () => {
    const r = run("20260615", "08:00:00", "Europe/Berlin");
    expect(
      r.calls.filter((c) => c.startsWith("getDstTransitions")),
    ).toHaveLength(1);
  });
});

describe("an axis tick a day or more apart", () => {
  it("carries the date with the clock", () => {
    const r = run("20260615", "999:59:59", "Europe/Berlin");
    expect(r.rail).not.toBeNull();
    for (const t of r.rail!.ticks)
      expect(t.label).toMatch(/^\d\d-\d\d \d\d:\d\d$/);
    // The library's own reading of the first tick.
    const start = lib.subtractUtc(r.gtfs.anchor.utc, { hours: 2 });
    const first = lib.convertUtcToZoned(start, "Europe/Berlin");
    expect(r.rail!.ticks[0]!.label).toBe(`${dayOf(first)} ${clockOf(first)}`);
  });

  it("is only the clock while the step is under a day", () => {
    const r = run("20260615", "08:00:00", "Europe/Berlin");
    for (const t of r.rail!.ticks) expect(t.label).toMatch(/^\d\d:\d\d$/);
  });

  it("reads the month and day of a zoned string", () => {
    expect(dayOf("2026-03-29T08:00:00+02:00[Europe/Berlin]")).toBe("03-29");
    expect(dayOf("+010000-02-10T15:59:59Z")).toBe("02-10");
    expect(dayOf("")).toBe("");
  });
});

describe("a clock reading cut from the library's string", () => {
  it("reads the time and offset", () => {
    expect(readingOf("2026-03-29T08:00:00+02:00[Europe/Berlin]")).toBe(
      "08:00 +02:00",
    );
    expect(readingOf("2026-03-29T08:00:30+02:00[Europe/Berlin]")).toBe(
      "08:00:30 +02:00",
    );
    expect(clockOf("2026-03-29T08:00:00+02:00[Europe/Berlin]")).toBe("08:00");
  });

  it("is empty for a string that is not one", () => {
    expect(readingOf("")).toBe("");
    expect(clockOf("")).toBe("");
  });
});

describe("state and permalink", () => {
  it("matches a preset only while all three boxes equal it", () => {
    for (const p of PRESETS) expect(matchPreset(p)).toBe(p.id);
    const p = preset("ordinary");
    expect(matchPreset({ ...p, time: "08:00:01" })).toBe(CUSTOM_PRESET_ID);
    expect(matchPreset({ ...p, zone: "UTC" })).toBe(CUSTOM_PRESET_ID);
    expect(matchPreset({ ...p, date: "" })).toBe(CUSTOM_PRESET_ID);
  });

  it("starts on the first preset", () => {
    expect(presetState()).toEqual({
      date: "20260329",
      time: "08:00:00",
      zone: "Europe/Berlin",
    });
  });

  it("round-trips a preset and a typed state", () => {
    const state: ServiceDayState = {
      date: "20240331",
      time: "03:00:00",
      zone: "Europe/Berlin",
    };
    expect(readArgs(permalinkOf(state))).toEqual(state);
    expect(permalinkOf(preset("fall-back"))).toEqual({ preset: "fall-back" });
    expect(readArgs({ preset: "fall-back" })).toEqual(
      presetState(preset("fall-back")),
    );
  });

  it("keeps a cleared box cleared", () => {
    const state: ServiceDayState = { date: "", time: "08:00:00", zone: "UTC" };
    expect(permalinkOf(state)).toEqual({
      serviceDate: "",
      time: "08:00:00",
      timeZone: "UTC",
    });
    expect(readArgs(permalinkOf(state)).date).toBe("");
  });

  it("is seeded by any of the four keys, and by nothing else", () => {
    expect(isSeeded(undefined)).toBe(false);
    expect(isSeeded({})).toBe(false);
    for (const k of ["preset", "serviceDate", "time", "timeZone"] as const) {
      expect(isSeeded({ [k]: "" })).toBe(true);
    }
  });

  it("falls back to the first preset for an unknown id", () => {
    expect(readArgs({ preset: "nope" })).toEqual(presetState());
  });
});
