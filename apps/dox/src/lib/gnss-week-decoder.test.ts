import { describe, expect, it, vi } from "vitest";
import { lib } from "~/test/gnss-lib";
import {
  CUSTOM_PRESET_ID,
  GNSS_PRESETS,
  GNSS_SENTENCES,
  SECONDS_PER_WEEK,
  firstRinexWeek,
  isSeeded,
  matchPreset,
  permalinkOf,
  pinOf,
  presetState,
  readArgs,
  readGnss,
  summaryText,
  type GnssDecoderState,
} from "./gnss-week-decoder";
import { GNSS_WEEK_COUNTERS, RINEX_WEEK_SYSTEMS } from "./gnss-names";

const NOW = "2026-10-15T00:00:00Z";

const preset = (id: string) => GNSS_PRESETS.find((p) => p.id === id)!;
const read = (state: GnssDecoderState) => readGnss(lib, state, NOW);
const withState = (
  id: string,
  change: Partial<GnssDecoderState>,
): GnssDecoderState => ({ ...presetState(preset(id)), ...change });

describe("presets: each one is what the library says", () => {
  // The instants come from a run of the built library.
  const EXPECTED: Record<string, string | null> = {
    "galileo-2019": "2019-04-07T00:00:00Z",
    "lnav-2024": "2024-01-01T00:00:00Z",
    "not-before-2020": "2024-01-01T00:00:00Z",
    "same-reading-two-dates": "1981-12-05T23:59:59Z",
    "second-rollover": "2019-04-06T23:59:42Z",
    "third-rollover": "2038-11-20T23:59:42Z",
    "nearest-today": "2024-01-01T00:00:00Z",
    "cnav-2024": "2024-01-01T00:00:00Z",
    "beidou-2024": "2024-01-01T00:00:00Z",
    "leap-second": "2016-12-31T23:59:60Z",
    "week-past-the-counter": null,
    "rinex-navic": "2024-01-01T00:00:00Z",
    "rinex-leap-second": "2016-12-31T23:59:60Z",
    "utc-2019-rollover": "2019-04-07T00:00:00Z",
    "utc-2024": "2024-01-01T00:00:00Z",
    "utc-before-galileo": "1999-08-21T23:59:46Z",
    "utc-no-leap-second": null,
  };

  it("covers every preset and no other", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      GNSS_PRESETS.map((p) => p.id).sort(),
    );
  });

  for (const p of GNSS_PRESETS) {
    it(`${p.id}`, () => {
      vi.setSystemTime(NOW);
      const r = read(p.state);
      const utc = EXPECTED[p.id];
      if (p.id === "utc-before-galileo") {
        expect(r.status).toBe("sentinel");
        expect(r.failure).toContain("before the counter's first week");
      }
      expect(r.utc).toBe(utc);
      if (utc === null) expect(r.status).toBe("sentinel");
      expect(r.plates).toHaveLength(3);
    });
  }

  it("the descriptions name no body, no zone and no country", () => {
    for (const p of GNSS_PRESETS) {
      const text = `${p.label} ${p.description}`;
      expect(text).not.toMatch(/UTC\+3|Moscow|MSK|New_York|en-US|GMT|GLONASS/);
    }
  });

  it("each preset matches itself, trimmed", () => {
    for (const p of GNSS_PRESETS) {
      expect(matchPreset(p.state)).toBe(p.id);
      expect(matchPreset({ ...p.state, week: ` ${p.state.week} ` })).toBe(p.id);
    }
  });
});

describe("what each preset shows", () => {
  it("draws every era of the counter and lights the reading's own", () => {
    const r = read(preset("lnav-2024").state);
    expect(r.lanes.map((l) => l.label)).toEqual([
      "era 0",
      "era 1",
      "era 2",
      "era 3",
    ]);
    expect(r.lanes.map((l) => l.result)).toEqual([
      "1984-10-01T00:00:15Z",
      "2004-05-17T00:00:05Z",
      "2024-01-01T00:00:00Z",
      "2043-08-17T00:00:00Z",
    ]);
    expect(r.lanes.filter((l) => l.chosen).map((l) => l.label)).toEqual([
      "era 2",
    ]);
    expect(r.lanes.filter((l) => l.today !== null).map((l) => l.label)).toEqual(
      ["era 2"],
    );
  });

  it("says the era the rolling choice picked", () => {
    const r = read(preset("nearest-today").state);
    expect(r.lanes.find((l) => l.nearest)?.label).toBe("era 2");
    expect(r.plates[0]!.lines[0]).toBe("era 2 · nearest today");
  });

  it("gives the plates the library's own labels and leads", () => {
    const r = read(preset("beidou-2024").state);
    expect(r.plates.map((p) => p.value)).toEqual([
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:04 BDT",
      "939",
    ]);
    expect(r.plates[1]!.lines[0]).toBe("ahead of UTC by 4 s");
    expect(r.plates[1]!.caption).toBe("BDT time");
  });

  it("says a reading inside an inserted second in words", () => {
    const r = read(preset("leap-second").state);
    expect(r.plates[0]!.lines[1]).toBe("leap second");
    expect(r.plates[1]!.lines[0]).toBe("inside an inserted second");
  });

  it("lists the same moment on every counter and every RINEX system", () => {
    const r = read(preset("utc-2019-rollover").state);
    expect(r.counters.map((c) => c.counter)).toEqual([...GNSS_WEEK_COUNTERS]);
    expect(r.rinexRows.map((c) => c.system)).toEqual([...RINEX_WEEK_SYSTEMS]);
    const gpsLnav = r.counters.find((c) => c.counter === "GPS-LNAV")!;
    expect([gpsLnav.week, gpsLnav.era, gpsLnav.yours]).toEqual([
      "0",
      "2",
      true,
    ]);
    expect(r.counters.find((c) => c.counter === "GPS-CNAV")!.week).toBe("2048");
    expect(r.counters.find((c) => c.counter === "GAL")!.week).toBe("1024");
  });

  it("marks a counter with no reading, and says why under the table", () => {
    const r = read(preset("same-reading-two-dates").state);
    const gal = r.counters.find((c) => c.counter === "GAL")!;
    expect(gal.none).toBe(true);
    expect(r.footnote).toBe("No reading: before this system's first week.");
    expect(read(preset("lnav-2024").state).footnote).toBe("");
  });

  it("draws the RINEX lanes on one axis and flags the counter that differs", () => {
    const r = read(preset("rinex-navic").state);
    expect(r.lanes.map((l) => l.label)).toEqual([
      "RINEX",
      "IRN-LNAV",
      "IRN-L1NV",
    ]);
    expect(r.lanes[1]!.result).toBe("");
    expect(r.lanes[1]!.pin).toBeNull();
    expect(r.lanes[2]!.differs).toBe(true);
    expect(r.plates[0]!.lines[0]).toBe("continuous count");
  });

  it("carries the reading's numbers to the other modes", () => {
    const r = read(preset("lnav-2024").state);
    expect(r.carry).toEqual({
      utc: "2024-01-01T00:00:00Z",
      week: "247",
      timeOfWeekSeconds: "86418",
      era: "2",
      system: "GPS",
    });
  });

  it("prints the call that was made", () => {
    const r = read(preset("lnav-2024").state);
    expect(r.calls.reading[0]).toMatchObject({
      fn: "gnssWeekToUtc",
      args: ["GPS-LNAV", 247, 86418, 2],
      result: "2024-01-01T00:00:00Z",
    });
    expect(r.calls.counters).toHaveLength(GNSS_WEEK_COUNTERS.length);
    expect(r.calls.rinex).toHaveLength(RINEX_WEEK_SYSTEMS.length);
  });

  it("puts a pin at the reading's own share of the counter's weeks", () => {
    expect(pinOf(0, 0, 1024)).toBe(0);
    expect(pinOf(512, 0, 1024)).toBe(50);
    expect(pinOf(2000, 0, 1024)).toBe(100);
    expect(pinOf(1, 1, 0)).toBe(0);
  });

  it("says the numbers in one sentence for a screen reader", () => {
    expect(summaryText(read(preset("beidou-2024").state))).toContain(
      "BDT time 2024-01-01T00:00:04 BDT, ahead of UTC by 4 s",
    );
  });
});

describe("a call with no answer says why, in one sentence", () => {
  it("a week the counter does not show", () => {
    const r = read(preset("week-past-the-counter").state);
    expect(r.status).toBe("sentinel");
    expect(r.failure).toBe("This counter shows weeks below 1024.");
  });

  it("a week that is not a whole number", () => {
    for (const week of ["", "1.5", "-3", "abc"]) {
      const r = read(withState("lnav-2024", { week }));
      expect([r.status, r.failure]).toEqual(["sentinel", GNSS_SENTENCES.week]);
    }
  });

  it("a time of week outside the week", () => {
    for (const timeOfWeekSeconds of ["", "-1", String(SECONDS_PER_WEEK), "x"]) {
      const r = read(withState("lnav-2024", { timeOfWeekSeconds }));
      expect(r.failure).toBe(GNSS_SENTENCES.tow);
    }
  });

  it("an era that is not a whole number", () => {
    for (const era of ["", "-1", "1.5", "two"]) {
      const r = read(withState("lnav-2024", { era }));
      expect(r.failure).toBe(GNSS_SENTENCES.era);
    }
  });

  it("an era so far out the date passes the year 9999", () => {
    const r = read(withState("lnav-2024", { era: "99999999" }));
    expect([r.status, r.failure]).toEqual(["sentinel", GNSS_SENTENCES.beyond]);
  });

  it("a date the era counts from that is not an instant", () => {
    const r = read(withState("not-before-2020", { pivot: "2020-01-01" }));
    expect(r.failure).toBe(GNSS_SENTENCES.pivot);
  });

  it("a date the era counts from that is before the counter's first week", () => {
    const r = read(
      withState("not-before-2020", {
        counter: "GAL",
        system: "GAL",
        week: "10",
        pivot: "1990-01-01T00:00:00Z",
      }),
    );
    expect(r.status).toBe("sentinel");
    expect(r.failure).toBe(
      "The date the era counts from is before the counter's first week, which starts at 1999-08-21T23:59:47Z.",
    );
  });

  it("a RINEX week before the system's first week", () => {
    const r = read(
      withState("rinex-navic", {
        system: "GAL",
        week: "0",
        timeOfWeekSeconds: "0",
      }),
    );
    expect(r.status).toBe("sentinel");
    expect(r.failure).toBe(
      "This is before the system's first week, which starts at 1999-08-21T23:59:47Z.",
    );
  });

  it("an instant that is not ISO 8601", () => {
    for (const utc of ["2019-04-07", "tomorrow"]) {
      const r = read(withState("utc-2024", { utc }));
      expect(r.failure).toBe(GNSS_SENTENCES.badInstant);
    }
  });

  it("an instant before the counter's first week keeps the tables standing", () => {
    const r = read(preset("utc-before-galileo").state);
    expect(r.counters.find((c) => c.counter === "GPS-LNAV")!.none).toBe(false);
    expect(r.counters.find((c) => c.counter === "GAL")!.none).toBe(true);
  });

  it("an empty form is empty, not a failure", () => {
    const r = read(withState("utc-2024", { utc: "  " }));
    expect(r.status).toBe("empty");
    expect(r.failure).toBeNull();
  });

  it("a broadcast reading with no counter asks for one", () => {
    const r = read(withState("lnav-2024", { counter: "" }));
    expect(r.status).toBe("empty");
    expect(r.lanesEmpty).toBe("Pick a counter to see its eras");
  });

  it("a UTC instant with no counter still reads the tables", () => {
    const r = read(withState("utc-2024", { counter: "" }));
    expect(r.status).toBe("ok");
    expect(r.lanes).toEqual([]);
    expect(r.lanesEmpty).toBe("Pick a counter to see its eras");
    expect(r.counters.find((c) => c.counter === "GPS-LNAV")!.week).toBe("247");
  });

  it("a lane the counter cannot show is a result, not a no-signal", () => {
    expect(read(preset("rinex-navic").state).status).toBe("ok");
  });
});

describe("the library's limits the page leans on", () => {
  it("a week is 604800 seconds: the last fraction is read, the whole is not", () => {
    expect(lib.gnssWeekToUtc("GAL", 1, SECONDS_PER_WEEK - 0.001, 0)).not.toBe(
      "",
    );
    expect(lib.gnssWeekToUtc("GAL", 1, SECONDS_PER_WEEK, 0)).toBe("");
  });

  it("the first RINEX week is the smallest the library reads", () => {
    for (const system of RINEX_WEEK_SYSTEMS) {
      const first = firstRinexWeek(lib, system);
      expect(lib.rinexWeekToUtc(system, first, 0)).not.toBe("");
      if (first > 0) expect(lib.rinexWeekToUtc(system, first - 1, 0)).toBe("");
    }
    expect(firstRinexWeek(lib, "GAL")).toBe(1024);
    expect(firstRinexWeek(lib, "GPS")).toBe(0);
  });
});

describe("seed and permalink", () => {
  it("round-trips every preset as its id", () => {
    for (const p of GNSS_PRESETS) {
      expect(permalinkOf(p.state)).toEqual({ preset: p.id });
      expect(matchPreset(readArgs({ preset: p.id }))).toBe(p.id);
    }
  });

  it("writes only the keys a custom reading uses, every number a string", () => {
    const custom = withState("lnav-2024", { week: "100", era: "1" });
    expect(matchPreset(custom)).toBe(CUSTOM_PRESET_ID);
    expect(permalinkOf(custom)).toEqual({
      mode: "broadcast",
      week: "100",
      timeOfWeekSeconds: "86418",
      counter: "GPS-LNAV",
      rolloverEra: "1",
    });
    expect(
      permalinkOf({ ...custom, mode: "utc", utc: "2020-01-01T00:00:00Z" }),
    ).toEqual({
      mode: "utc",
      counter: "GPS-LNAV",
      utc: "2020-01-01T00:00:00Z",
    });
    expect(permalinkOf({ ...custom, mode: "rinex", system: "BDT" })).toEqual({
      mode: "rinex",
      week: "100",
      timeOfWeekSeconds: "86418",
      system: "BDT",
    });
  });

  it("reads a chat call's numbers as well as a permalink's strings", () => {
    const fromChat = readArgs({
      counter: "GPS-LNAV",
      week: 247,
      timeOfWeekSeconds: 86418,
      rolloverEra: 2,
    });
    const fromLink = readArgs({
      counter: "GPS-LNAV",
      week: "247",
      timeOfWeekSeconds: "86418",
      rolloverEra: "2",
    });
    expect(fromChat).toEqual(fromLink);
    expect(matchPreset(fromChat)).toBe("lnav-2024");
  });

  it("reads rolling and a not-before date", () => {
    expect(readArgs({ counter: "GAL", rolloverEra: "rolling" }).eraMode).toBe(
      "rolling",
    );
    const s = readArgs({
      counter: "GAL",
      rolloverNotBefore: "2020-01-01T00:00:00Z",
    });
    expect([s.eraMode, s.pivot]).toEqual(["notBefore", "2020-01-01T00:00:00Z"]);
  });

  it("opens a UTC call with no counter on none", () => {
    const s = readArgs({ mode: "utc", utc: "2024-01-01T00:00:00Z" });
    expect([s.mode, s.counter]).toEqual(["utc", ""]);
  });

  it("ignores a value that is not in its list", () => {
    const s = readArgs({ counter: "MSK", mode: "sideways", system: "GLO" });
    expect(s.counter).toBe(presetState(GNSS_PRESETS[0]!).counter);
    expect(s.mode).toBe("broadcast");
  });

  it("knows whether it has anything to seed from", () => {
    expect(isSeeded(undefined)).toBe(false);
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ unrelated: "1" })).toBe(false);
    expect(isSeeded({ week: "1" })).toBe(true);
  });
});
