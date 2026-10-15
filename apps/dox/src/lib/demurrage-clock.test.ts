import { demurrageLib as lib } from "~/test/ledger-lib";
import {
  CLOCK_EVENT_TYPES,
  CLOCK_SCOPES,
  DEMURRAGE_PRESETS,
  blankPlates,
  clockPair,
  clockPlates,
  eventMarks,
  eventWord,
  eventsOf,
  explainClockNull,
  freeTimeArgs,
  freeTimeHint,
  isSeeded,
  laneAria,
  laneLabel,
  matchPreset,
  optionsOf,
  permalinkOf,
  presetState,
  readArgs,
  readClocks,
  seriesOf,
  summaryText,
  zoneLabel,
  zoneReadable,
  type DemurrageState,
} from "./demurrage-clock";
import { hourDurationText } from "./ledger-widgets";

/** The intervals the presets draw, verbatim from `demurrageClock`'s JSDoc examples, with the elapsed time run against the library. */
const EXPECTED: Record<
  string,
  { start: string; end: string; duration: string; shown: string } | null
> = {
  "import-demurrage": {
    start: "2024-06-14T19:00:00Z",
    end: "2024-06-20T14:30:00Z",
    duration: "PT139H30M",
    shown: "5 d 19 h 30 min",
  },
  "import-detention": {
    start: "2024-06-20T14:30:00Z",
    end: "2024-06-27T09:00:00Z",
    duration: "PT162H30M",
    shown: "6 d 18 h 30 min",
  },
  "export-storage": {
    start: "2024-07-05T16:00:00Z",
    end: "2024-07-09T03:00:00Z",
    duration: "PT83H",
    shown: "3 d 11 h",
  },
  "merged-clock": {
    start: "2024-06-14T19:00:00Z",
    end: "2024-06-27T09:00:00Z",
    duration: "PT302H",
    shown: "12 d 14 h",
  },
  "recorded-twice": null,
  "gate-out-before-discharge": null,
};

const state = (id: string): DemurrageState =>
  presetState(DEMURRAGE_PRESETS.find((p) => p.id === id)!);

describe("the presets, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      DEMURRAGE_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(DEMURRAGE_PRESETS.map((p) => [p.id]))("%s", (id) => {
    const want = EXPECTED[id!];
    const read = readClocks(state(id!), lib);
    if (want === null) {
      expect(read.chosen.interval).toBeNull();
      expect(read.elapsed).toBeNull();
      expect(read.chosen.reason).not.toBeNull();
      return;
    }
    expect(read.chosen.interval).toEqual({
      start: want!.start,
      end: want!.end,
    });
    expect(read.elapsed!.duration).toBe(want!.duration);
    expect(hourDurationText(read.elapsed!.duration)).toBe(want!.shown);
  });

  it("matches each preset back from its own state, and a changed field to custom", () => {
    for (const p of DEMURRAGE_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
    }
    const s = state("import-demurrage");
    s.rows[0] = { ...s.rows[0]!, at: "2024-06-14T20:00:00Z" };
    expect(matchPreset(s)).toBe("custom");
  });

  it("carries the terminal clock as a literal field, and it never moves an interval", () => {
    for (const p of DEMURRAGE_PRESETS) {
      expect(p.zone).not.toBe("");
      const here = readClocks(presetState(p), lib);
      const elsewhere = readClocks({ ...presetState(p), zone: "" }, lib);
      expect(elsewhere.chosen.interval).toEqual(here.chosen.interval);
      expect(elsewhere.calls.map((c) => [c.fn, c.args])).toEqual(
        here.calls.map((c) => [c.fn, c.args]),
      );
    }
  });
});

describe("clockPair", () => {
  const rows: [string, string, string | undefined, string, string][] = [
    ["demurrage", "import", undefined, "discharged", "gatedOut"],
    ["storage", "import", undefined, "discharged", "gatedOut"],
    ["detention", "import", undefined, "gatedOut", "emptyReturned"],
    ["combined", "import", undefined, "discharged", "emptyReturned"],
    ["demurrage", "import", "available", "available", "gatedOut"],
    ["storage", "import", "available", "available", "gatedOut"],
    ["combined", "import", "available", "available", "emptyReturned"],
    ["detention", "import", "available", "gatedOut", "emptyReturned"],
    ["demurrage", "export", undefined, "gatedIn", "loaded"],
    ["storage", "export", undefined, "gatedIn", "loaded"],
    ["detention", "export", undefined, "emptyReleased", "gatedIn"],
    ["combined", "export", undefined, "emptyReleased", "loaded"],
  ];

  it.each(rows)(
    "finds the pair the JSDoc states for %s, %s, startEvent %s",
    (scope, direction, startEvent, start, end) => {
      const options =
        startEvent === undefined ? { direction } : { direction, startEvent };
      expect(clockPair(scope, options, lib)).toEqual({ start, end });
    },
  );

  it("returns null where the library returns null", () => {
    expect(clockPair("laytime", { direction: "import" }, lib)).toBeNull();
    expect(clockPair("demurrage", { direction: "" }, lib)).toBeNull();
    expect(
      clockPair("demurrage", { direction: "import", startEvent: "gone" }, lib),
    ).toBeNull();
  });

  it("holds no table of scope to events", async () => {
    const src = await import("./demurrage-clock?raw").then((m) => m.default);
    // The scope and event names appear as lists; no object maps one to the other.
    expect(src).not.toMatch(/EXPORT_CLOCKS|demurrage:\s*\[/);
  });
});

describe("event words", () => {
  it("is one word for each type the library accepts, and a word reads back to its type", () => {
    const toType = (word: string) =>
      word
        .split(" ")
        .map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
        .join("");
    const words = CLOCK_EVENT_TYPES.map(eventWord);
    expect(new Set(words).size).toBe(CLOCK_EVENT_TYPES.length);
    expect(words.map(toType)).toEqual([...CLOCK_EVENT_TYPES]);
    // The library accepts every one of the seven: a probe holding all of them is a list.
    const probe = CLOCK_EVENT_TYPES.map((type, i) => ({
      type,
      at: `2024-01-0${i + 1}T00:00:00Z`,
    }));
    expect(
      lib.demurrageClock(probe, "demurrage", { direction: "import" }),
    ).not.toBeNull();
    expect(
      lib.demurrageClock(probe, "demurrage", { direction: "export" }),
    ).not.toBeNull();
    expect(words).toContain("gated out");
    expect(words).toContain("empty returned");
  });
});

describe("the four lanes", () => {
  it("is one demurrageClock call for each scope, the chosen one printed first", () => {
    const read = readClocks(state("import-detention"), lib);
    expect(read.lanes.map((l) => l.scope)).toEqual([...CLOCK_SCOPES]);
    const demurrageCalls = read.calls.filter((c) => c.fn === "demurrageClock");
    expect(demurrageCalls.map((c) => c.args[1])).toEqual([
      "detention",
      "demurrage",
      "storage",
      "combined",
    ]);
    expect(read.chosen.scope).toBe("detention");
    for (const call of demurrageCalls) {
      expect(call.args[0]).toEqual(eventsOf(state("import-detention")));
      expect(call.args[2]).toEqual({ direction: "import" });
    }
  });

  it("puts toOffsetInstant before diffUtcAsDuration, and reads the returned strings", () => {
    const read = readClocks(state("import-demurrage"), lib);
    expect(read.calls.slice(4).map((c) => [c.fn, ...c.args])).toEqual([
      ["toOffsetInstant", "2024-06-14T19:00:00Z"],
      ["toOffsetInstant", "2024-06-20T14:30:00Z"],
      [
        "diffUtcAsDuration",
        "2024-06-14T19:00:00Z",
        "2024-06-20T14:30:00Z",
        "hours",
      ],
    ]);
  });

  it("makes no follow-up call for a null clock", () => {
    const read = readClocks(state("recorded-twice"), lib);
    expect(read.calls.map((c) => c.fn)).toEqual([
      "demurrageClock",
      "demurrageClock",
      "demurrageClock",
      "demurrageClock",
    ]);
  });

  it("measures an offset instant on the clock the library puts it on", () => {
    const s = state("import-demurrage");
    s.rows[0] = {
      type: "discharged",
      at: "2024-06-14T15:00:00-04:00[America/New_York]",
    };
    const read = readClocks(s, lib);
    expect(read.chosen.interval!.start).toBe(
      "2024-06-14T15:00:00-04:00[America/New_York]",
    );
    expect(read.elapsed!.duration).toBe("PT139H30M");
  });

  it("moves the bars with the direction and the start event: each lane is a fresh call", () => {
    const s = state("import-demurrage");
    s.startEvent = "available";
    const read = readClocks(s, lib);
    expect(read.chosen.interval!.start).toBe("2024-06-15T12:00:00Z");
    expect(read.lanes[1]!.interval!.start).toBe("2024-06-20T14:30:00Z");
    s.direction = "export";
    s.startEvent = "";
    expect(readClocks(s, lib).chosen.interval).toBeNull();
  });
});

describe("why a clock is null", () => {
  const base = () => state("import-demurrage");
  const reasonOf = (s: DemurrageState, scope = s.scope) => {
    const lane = readClocks(s, lib).lanes.find((l) => l.scope === scope)!;
    expect(lane.interval).toBeNull();
    return lane.reason;
  };

  it("names an event recorded twice", () => {
    const r = reasonOf(state("recorded-twice"))!;
    expect(r.code).toBe("twice");
    expect(r.lane).toBe("discharged is recorded twice");
    expect(r.sentence).toContain("recorded twice");
  });

  it("names a gate-out before the discharge", () => {
    const r = reasonOf(state("gate-out-before-discharge"))!;
    expect(r.code).toBe("inverted");
    expect(r.lane).toBe("gated out is before discharged");
  });

  it("names the event that is not recorded, from the pair the library reads", () => {
    const s = base();
    s.rows = s.rows.map((r) =>
      r.type === "gatedOut" ? { type: "", at: "" } : r,
    );
    expect(reasonOf(s, "demurrage")!.lane).toBe("gated out is not recorded");
    expect(reasonOf(s, "detention")!.lane).toBe("gated out is not recorded");
    // The combined clock does not need the gate-out, so it still has a clock.
    expect(readClocks(s, lib).lanes[3]!.interval).not.toBeNull();
  });

  it("asks for the availability event the start event names", () => {
    const s = base();
    s.rows = s.rows.map((r) =>
      r.type === "available" ? { type: "", at: "" } : r,
    );
    s.startEvent = "available";
    expect(reasonOf(s)!.lane).toBe("available is not recorded");
  });

  it("names a row that is not a valid event", () => {
    const s = base();
    s.rows[1] = { type: "available", at: "2024-06-15T12:00:00" };
    expect(reasonOf(s)!.lane).toBe("row 2 is not a valid event");
    s.rows[1] = { type: "arrived", at: "2024-06-15T12:00:00Z" };
    expect(reasonOf(s)!.code).toBe("bad-event");
    s.rows[1] = { type: "", at: "2024-06-15T12:00:00Z" };
    expect(reasonOf(s)!.code).toBe("bad-event");
  });

  it("names a direction the library does not read, and never fills it in", () => {
    const s = base();
    s.direction = "";
    expect(reasonOf(s)!.code).toBe("bad-direction");
    s.direction = "sideways";
    expect(reasonOf(s)!.code).toBe("bad-direction");
  });

  it("names a start event the library does not read", () => {
    const s = base();
    s.startEvent = "arrived";
    expect(reasonOf(s)!.code).toBe("bad-start-event");
  });

  it("names a scope that is not a clock the library selects", () => {
    const s = base();
    s.scope = "laytime";
    const read = readClocks(s, lib);
    expect(read.chosen.interval).toBeNull();
    expect(read.chosen.reason!.code).toBe("bad-scope");
    expect(read.chosen.reason!.sentence).toContain("laytime");
    expect(read.calls[0]!.args[1]).toBe("laytime");
    // The four lanes are still four calls of their own.
    expect(read.lanes.every((l) => l.interval !== null)).toBe(true);
    expect(explainClockNull({ ...s, scope: "" }, "", null, lib)!.sentence).toBe(
      "No clock is chosen. Choose demurrage, detention, storage or combined.",
    );
  });

  it("gives no reason for a clock that has an interval", () => {
    for (const lane of readClocks(base(), lib).lanes) {
      expect(lane.reason).toBeNull();
    }
  });

  it("makes a blank form a clock with its own reason, not an empty state", () => {
    const s = base();
    s.rows = s.rows.map(() => ({ type: "", at: "" }));
    const read = readClocks(s, lib);
    expect(read.calls[0]!.args[0]).toEqual([]);
    expect(read.chosen.reason!.code).toBe("missing");
  });
});

describe("the plates", () => {
  it("says the start, the end and the elapsed time of the chosen clock", () => {
    const read = readClocks(state("import-demurrage"), lib);
    const [start, end, ran] = clockPlates(read, "America/New_York");
    expect(start).toMatchObject({
      role: "hero-start",
      caption: "Clock starts",
      value: "discharged",
      lines: ["Fri 14 Jun 15:00"],
      series: 1,
      quiet: true,
    });
    expect(end).toMatchObject({
      role: "hero-end",
      caption: "Clock ends",
      value: "gated out",
      lines: ["Thu 20 Jun 10:30"],
    });
    expect(ran).toMatchObject({
      role: "hero-ran",
      caption: "Ran for",
      value: "5 d 19 h 30 min",
      lines: ["PT139H30M"],
    });
  });

  it("keeps the event words when the result is null, and reads no result for the times and the elapsed time", () => {
    const read = readClocks(state("recorded-twice"), lib);
    const [start, end, ran] = clockPlates(read, "America/New_York");
    expect(start!.value).toBe("discharged");
    expect(start!.lines).toEqual(["no result"]);
    expect(end!.value).toBe("gated out");
    expect(end!.lines).toEqual(["no result"]);
    expect(ran!.value).toBeNull();
  });

  it("reads no result throughout when the library reads no pair", () => {
    const s = state("import-demurrage");
    s.direction = "";
    const plates = clockPlates(readClocks(s, lib), s.zone);
    expect(plates.map((p) => p.value)).toEqual([null, null, null]);
  });

  it("takes the series of the chosen scope's lane", () => {
    for (const scope of CLOCK_SCOPES) {
      const s = { ...state("import-demurrage"), scope };
      expect(clockPlates(readClocks(s, lib), s.zone)[0]!.series).toBe(
        seriesOf(scope),
      );
    }
    expect(seriesOf("laytime")).toBeUndefined();
    expect(blankPlates("combined").map((p) => p.series)).toEqual([4, 4, 4]);
    expect(blankPlates("combined").every((p) => p.value === null)).toBe(true);
  });

  it("shows a time on the terminal's clock, and says when the zone is not read", () => {
    const read = readClocks(state("import-demurrage"), lib);
    expect(clockPlates(read, "")[0]!.lines).toEqual(["Fri 14 Jun 19:00"]);
    expect(clockPlates(read, "Asia/Shanghai")[0]!.lines).toEqual([
      "Sat 15 Jun 03:00",
    ]);
    expect(clockPlates(read, "Nowhere/Land")[0]!.lines).toEqual([
      "zone not read",
    ]);
    expect(zoneReadable("Nowhere/Land")).toBe(false);
    expect(zoneReadable("")).toBe(true);
    expect(zoneLabel("")).toBe("UTC");
  });
});

describe("the texts", () => {
  it("labels a lane with the pair the library reads", () => {
    const read = readClocks(state("import-demurrage"), lib);
    expect(laneLabel("detention", read.lanes[1]!.pair)).toBe(
      "detention: gated out to empty returned",
    );
    expect(laneLabel("laytime", null)).toBe("laytime");
  });

  it("describes a lane for a screen reader, with the interval or the reason", () => {
    const read = readClocks(state("import-demurrage"), lib);
    expect(laneAria(read.lanes[0]!, "America/New_York")).toBe(
      "demurrage: discharged to gated out: from Fri 14 Jun 15:00 to Thu 20 Jun 10:30",
    );
    const twice = readClocks(state("recorded-twice"), lib);
    expect(laneAria(twice.lanes[0]!, "")).toBe(
      "demurrage: discharged to gated out: discharged is recorded twice",
    );
  });

  it("summarises the chosen clock in one sentence", () => {
    const read = readClocks(state("import-demurrage"), lib);
    expect(summaryText(read, "America/New_York")).toBe(
      "demurrage: discharged to gated out: from Fri 14 Jun 15:00 to Thu 20 Jun 10:30 on the America/New_York clock. It ran for 5 d 19 h 30 min.",
    );
    expect(summaryText(readClocks(state("recorded-twice"), lib), "")).toContain(
      "no clock. The discharged event is recorded twice.",
    );
  });

  it("draws the events that have a type and an instant the library accepts", () => {
    const s = state("import-demurrage");
    s.rows[4] = { type: "gatedIn", at: "not an instant" };
    s.rows[5] = { type: "arrived", at: "2024-06-14T19:00:00Z" };
    const marks = eventMarks(s, lib);
    expect(marks.map((m) => [m.n, m.word, m.local])).toEqual([
      [1, "discharged", "Fri 14 Jun 15:00"],
      [2, "available", "Sat 15 Jun 08:00"],
      [3, "gated out", "Thu 20 Jun 10:30"],
      [4, "empty returned", "Thu 27 Jun 05:00"],
    ]);
  });
});

describe("seeds and permalinks", () => {
  it("reads the chat's events array, and an array wins over flat keys", () => {
    const s = readArgs({
      events: [
        { type: "discharged", at: "2024-06-14T19:00:00Z" },
        { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
      ],
      scope: "demurrage",
      direction: "import",
      type1: "loaded",
    });
    expect(s.rows.map((r) => r.type)).toEqual([
      "discharged",
      "gatedOut",
      "",
      "",
      "",
      "",
    ]);
    expect(s.zone).toBe("");
    expect(s.startEvent).toBe("");
  });

  it("reads flat keys and limits them to eventCount", () => {
    const s = readArgs({
      eventCount: "2",
      type1: "discharged",
      at1: "2024-06-14T19:00:00Z",
      type2: "gatedOut",
      at2: "2024-06-20T14:30:00Z",
      type3: "emptyReturned",
      at3: "2024-06-27T09:00:00Z",
      scope: "detention",
    });
    expect(eventsOf(s)).toHaveLength(2);
    expect(s.direction).toBe("");
  });

  it("never fills the direction or the scope in for the reader", () => {
    const s = readArgs({ zone: "Asia/Tokyo" });
    expect(s.direction).toBe("");
    expect(s.scope).toBe("");
    expect(isSeeded({ zone: "Asia/Tokyo" })).toBe(true);
    expect(isSeeded({})).toBe(false);
  });

  it("leaves a blank row, a blank start event and a blank zone out of the call and the link", () => {
    const s = state("import-demurrage");
    expect(optionsOf(s)).toEqual({ direction: "import" });
    s.startEvent = "available";
    expect(optionsOf(s)).toEqual({
      direction: "import",
      startEvent: "available",
    });
    s.rows[1] = { type: "", at: "" };
    expect(eventsOf(s)).toHaveLength(3);
    s.zone = "";
    const link = permalinkOf(s);
    expect(link).not.toHaveProperty("zone");
    expect(link).not.toHaveProperty("type2");
    expect(link["eventCount"]).toBe("4");
    expect(Object.values(link).every((v) => typeof v === "string")).toBe(true);
  });

  it("round-trips every preset through its own permalink keys", () => {
    for (const p of DEMURRAGE_PRESETS) {
      const s = presetState(p);
      expect(readArgs(permalinkOf(s))).toEqual(s);
    }
  });
});

describe("the hand-off to the Free Time Ledger", () => {
  it("carries the returned strings and the terminal clock", () => {
    const s = state("import-demurrage");
    expect(freeTimeArgs(readClocks(s, lib), s)).toEqual({
      clockStart: "2024-06-14T19:00:00Z",
      clockEnd: "2024-06-20T14:30:00Z",
      zone: "America/New_York",
    });
    expect(freeTimeHint(readClocks(s, lib))).toBe("");
  });

  it("leaves the zone out when there is none, and carries a returned string as given", () => {
    const s = state("import-demurrage");
    s.zone = "";
    s.rows[0] = {
      type: "discharged",
      at: "2024-06-14T15:00:00-04:00[America/New_York]",
    };
    expect(freeTimeArgs(readClocks(s, lib), s)).toEqual({
      clockStart: "2024-06-14T15:00:00-04:00[America/New_York]",
      clockEnd: "2024-06-20T14:30:00Z",
    });
  });

  it("is null for a null clock, with a hint that says why", () => {
    const s = state("recorded-twice");
    const read = readClocks(s, lib);
    expect(freeTimeArgs(read, s)).toBeNull();
    expect(freeTimeHint(read)).toBe(
      "No clock to count: the chosen clock returned no interval.",
    );
  });
});

describe("naming", () => {
  it("names no law, regulator, carrier or court", () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|court)\w*/i;
    const seen: string[] = [];
    for (const p of DEMURRAGE_PRESETS) {
      seen.push(p.label, p.description);
      const read = readClocks(presetState(p), lib);
      seen.push(summaryText(read, p.zone), read.chosen.reason?.sentence ?? "");
      for (const lane of read.lanes) seen.push(lane.reason?.lane ?? "");
    }
    for (const text of seen) expect(text).not.toMatch(forbidden);
  });
});
