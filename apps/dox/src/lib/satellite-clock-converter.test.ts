import { describe, expect, it } from "vitest";
import { lib } from "~/test/gnss-lib";
import {
  BEFORE_1972_NOTE,
  BEFORE_1972_PLATE,
  BEFORE_FIRST_INSTANT_NOTE,
  CLOCK_KEYS,
  FOOTNOTES_RESERVED,
  CLOCK_PRESETS,
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  GLO_NOTE,
  INSIDE_SECOND_TEXT,
  IRN_NOTE,
  MAX_VALUE_LENGTH,
  SENTENCES,
  LADDER,
  LADDER_NONE_NOTE,
  clockTies,
  emptyRead,
  ladderAria,
  ladderChip,
  ladderLayout,
  ladderRungs,
  ladderSpan,
  offReserve,
  isSeeded,
  matchPreset,
  permalinkOf,
  readArgs,
  readClocks,
  rowSentence,
  sliderPositions,
  summaryText,
  type ClockRead,
} from "./satellite-clock-converter";
import { leadOverUtc } from "./gnss-widgets";
import { INTEGER_UTC_FROM, insertions } from "./timescale-widgets";

const preset = (id: string) => CLOCK_PRESETS.find((p) => p.id === id)!;
const readPreset = (id: string) => readClocks(lib, preset(id).state);
const read = (value: string) => readClocks(lib, { value });
const row = (r: ClockRead, key: string) => r.rows.find((x) => x.key === key)!;
const readings = (r: ClockRead) => r.rows.map((x) => x.reading);

describe("presets: each one is what the library says", () => {
  // Every reading below is from a run of the built library.
  it("utc-2024 reads the start of 2024 on every clock", () => {
    const r = readPreset("utc-2024");
    expect(r.status).toBe("ok");
    expect(r.clock).toBe("UTC");
    expect(r.utc).toBe("2024-01-01T00:00:00Z");
    expect(readings(r)).toEqual([
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:37 TAI",
      "2024-01-01T00:00:18 GPS",
      "2024-01-01T00:00:18 GAL",
      "2024-01-01T00:00:04 BDT",
      "2024-01-01T00:00:18 QZS",
      "2024-01-01T00:00:00 GLO",
      "2024-01-01T00:00:18 IRN",
    ]);
    expect(r.rows.map((x) => x.leadText)).toEqual([
      "the reference",
      "37 s",
      "18 s",
      "18 s",
      "4 s",
      "18 s",
      "0 s",
      "18 s",
    ]);
    expect(r.taiMinusUtc).toBe(37);
    expect(r.next).toBe("");
    expect(r.footnote).toBe("");
  });

  it("galileo-first-instant reads UTC 13 seconds before", () => {
    const r = readPreset("galileo-first-instant");
    expect(r.clock).toBe("GAL");
    expect(r.utc).toBe("1999-08-21T23:59:47Z");
    expect(row(r, "GAL").yours).toBe(true);
    expect(row(r, "GAL").reading).toBe("1999-08-22T00:00:00 GAL");
    expect(row(r, "GAL").writtenAs).toBeNull();
    expect(row(r, "TAI").reading).toBe("1999-08-22T00:00:19 TAI");
    expect(r.taiMinusUtc).toBe(32);
    expect(r.next).toBe("2005-12-31T23:59:60Z");
    // BeiDou starts in 2006: its row has no reading, and the footnote says why.
    expect(row(r, "BDT").none).toBe(true);
    expect(row(r, "BDT").leadText).toBe("no result");
    expect(r.footnote).toBe(`BDT: ${BEFORE_FIRST_INSTANT_NOTE}.`);
  });

  it("beidou-reading reads the start of 2024 in UTC", () => {
    const r = readPreset("beidou-reading");
    expect(r.clock).toBe("BDT");
    expect(r.utc).toBe("2024-01-01T00:00:00Z");
    expect(row(r, "BDT").yours).toBe(true);
    expect(row(r, "BDT").writtenAs).toBeNull();
    expect(row(r, "UTC").yours).toBe(false);
    expect(r.plates[0]!.lines[0]).toBe("read from BDT");
  });

  it("tai-reading reads the start of 2026 in UTC", () => {
    const r = readPreset("tai-reading");
    expect(r.clock).toBe("TAI");
    expect(r.utc).toBe("2026-01-01T00:00:00Z");
    expect(row(r, "TAI").yours).toBe(true);
    expect(row(r, "TAI").leadText).toBe("37 s");
  });

  it("inside-leap-second reads second 60 on UTC and GLO, and the start of 2017 elsewhere", () => {
    const r = readPreset("inside-leap-second");
    expect(r.status).toBe("ok");
    expect(row(r, "GLO").reading).toBe("2016-12-31T23:59:60 GLO");
    expect(row(r, "GPS").reading).toBe("2017-01-01T00:00:17 GPS");
    expect(row(r, "TAI").reading).toBe("2017-01-01T00:00:36 TAI");
    expect(r.taiMinusUtc).toBe(36);
    for (const key of ["GPS", "GAL", "BDT", "QZS", "GLO", "IRN"]) {
      expect(row(r, key).lead).toEqual({ kind: "inside" });
      expect(row(r, key).leadText).toBe(INSIDE_SECOND_TEXT);
    }
    expect(row(r, "TAI").leadText).toBe("36 s");
    expect(r.plates[0]!.lines[1]).toBe("leap second");
  });

  it("a fraction of the leap second reads on TAI to the same fraction", () => {
    const r = read("2016-12-31T23:59:60.5Z");
    expect(row(r, "TAI").reading).toBe("2017-01-01T00:00:36.5 TAI");
    expect(row(r, "GPS").reading).toBe("2017-01-01T00:00:17.5 GPS");
  });

  it("before-beidou has no BeiDou reading but the others do", () => {
    const r = readPreset("before-beidou");
    expect(r.status).toBe("ok");
    expect(row(r, "BDT").none).toBe(true);
    expect(row(r, "BDT").reading).toBe("");
    expect(row(r, "GPS").reading).toBe("2006-01-01T00:00:12 GPS");
    expect(row(r, "TAI").reading).toBe("2006-01-01T00:00:31 TAI");
    expect(r.next).toBe("2005-12-31T23:59:60Z");
    expect(r.footnote).toBe(`BDT: ${BEFORE_FIRST_INSTANT_NOTE}.`);
  });

  it("no-leap-second-that-day says so in one sentence and calls no converter", () => {
    const r = readPreset("no-leap-second-that-day");
    expect(r.status).toBe("sentinel");
    expect(r.failure).toBe(SENTENCES.noLeapSecond);
    expect(r.failure).toBe(
      "No leap second was inserted at the end of that day.",
    );
    expect(r.calls).toEqual([]);
    expect(r.utc).toBeNull();
  });

  it("wrong-token names the tokens it reads", () => {
    const r = readPreset("wrong-token");
    expect(r.status).toBe("sentinel");
    expect(r.failure).toBe(
      "The scale after the space is not one of TAI, GPS, GAL, BDT, QZS, GLO or IRN.",
    );
    expect(r.calls).toEqual([]);
  });

  it("the default preset is the first and every preset is distinct", () => {
    expect(DEFAULT_PRESET).toBe(CLOCK_PRESETS[0]);
    expect(CLOCK_PRESETS.map((p) => p.id)).toEqual([
      "utc-2024",
      "galileo-first-instant",
      "beidou-reading",
      "tai-reading",
      "inside-leap-second",
      "before-beidou",
      "no-leap-second-that-day",
      "wrong-token",
    ]);
    expect(new Set(CLOCK_PRESETS.map((p) => p.state.value)).size).toBe(
      CLOCK_PRESETS.length,
    );
  });
});

describe("the calls are the calls made, in order", () => {
  it("a UTC reading calls toTAI, fromTAI, six utcToGnss, taiMinusUtc and nextLeapSecond", () => {
    const r = readPreset("utc-2024");
    expect(r.calls.map((c) => c.fn)).toEqual([
      "toTAI",
      "fromTAI",
      "utcToGnss",
      "utcToGnss",
      "utcToGnss",
      "utcToGnss",
      "utcToGnss",
      "utcToGnss",
      "taiMinusUtc",
      "nextLeapSecond",
    ]);
    expect(r.calls.slice(2, 8).map((c) => c.args[0])).toEqual([
      "GPS",
      "GAL",
      "BDT",
      "QZS",
      "GLO",
      "IRN",
    ]);
    // Each printed result is what the library returns for the printed args.
    expect(r.calls[0]!.args).toEqual(["2024-01-01T00:00:00Z"]);
    expect(r.calls[0]!.result).toBe("2024-01-01T00:00:37 TAI");
  });

  it("a system reading starts with gnssToUtc, a TAI reading with fromTAI", () => {
    const bdt = readPreset("beidou-reading");
    expect(bdt.calls[0]).toEqual({
      fn: "gnssToUtc",
      args: ["BDT", "2024-01-01T00:00:04 BDT"],
      result: "2024-01-01T00:00:00Z",
    });
    expect(bdt.calls.map((c) => c.fn)).not.toContain("fromTAI");
    const tai = readPreset("tai-reading");
    expect(tai.calls[0]).toEqual({
      fn: "fromTAI",
      args: ["2026-01-01T00:00:37 TAI"],
      result: "2026-01-01T00:00:00Z",
    });
  });

  it("a value with no result calls nothing it does not print", () => {
    const r = read("2024-01-01T00:00:00 GLO");
    expect(r.calls[0]!.fn).toBe("gnssToUtc");
    expect(r.calls.map((c) => c.fn)).toContain("nextLeapSecond");
  });
});

describe("the clock a value is on", () => {
  it("is UTC when there is no space", () => {
    expect(read("2024-01-01T00:00:00Z").clock).toBe("UTC");
  });
  it.each(["TAI", "GPS", "GAL", "BDT", "QZS", "GLO", "IRN"] as const)(
    "is %s after the space, and that row is the reader's",
    (token) => {
      const utc = "2024-01-01T00:00:00Z";
      const own = token === "TAI" ? lib.toTAI(utc) : lib.utcToGnss(token, utc);
      const r = read(own);
      expect(r.clock).toBe(token);
      expect(r.utc).toBe(utc);
      expect(r.rows.filter((x) => x.yours).map((x) => x.key)).toEqual([token]);
      expect(row(r, token).tags).toContain("your reading");
    },
  );
  it("trims the value before it reads it", () => {
    const r = read("  2024-01-01T00:00:00Z  ");
    expect(r.status).toBe("ok");
    expect(r.utc).toBe("2024-01-01T00:00:00Z");
  });
});

describe("every row and every lead", () => {
  const r = readPreset("utc-2024");

  it("always has eight rows in the same order", () => {
    expect(r.rows.map((x) => x.key)).toEqual([...CLOCK_KEYS]);
    expect(CLOCK_KEYS).toEqual([
      "UTC",
      "TAI",
      "GPS",
      "GAL",
      "BDT",
      "QZS",
      "GLO",
      "IRN",
    ]);
    for (const state of ["", "garbage", "2024-01-01T00:00:00 UTC"]) {
      expect(read(state).rows.map((x) => x.key)).toEqual([...CLOCK_KEYS]);
    }
  });

  it("each system's lead is leadOverUtc of its own reading", () => {
    for (const x of r.rows.filter((y) => y.key !== "UTC" && y.key !== "TAI")) {
      const lead = leadOverUtc(lib, r.utc!, x.reading);
      expect(lead.kind).toBe("lead");
      const seconds =
        lead.kind === "lead" ? lead.duration.replace(/^PT|S$/g, "") : "";
      expect(x.lead).toEqual({ kind: "seconds", seconds });
    }
  });

  it("the TAI row's lead (taiMinusUtc) equals its leadOverUtc wherever both read", () => {
    for (const value of [
      "2024-01-01T00:00:00Z",
      "1999-08-21T23:59:47Z",
      "1972-01-01T00:00:00Z",
      "2016-12-31T23:59:59Z",
      "2017-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    ]) {
      const result = read(value);
      const tai = row(result, "TAI");
      const over = leadOverUtc(lib, result.utc!, tai.reading);
      expect(over.kind).toBe("lead");
      if (over.kind === "lead") {
        expect(tai.lead).toEqual({
          kind: "seconds",
          seconds: over.duration.replace(/^PT|S$/g, ""),
        });
      }
    }
  });

  it("inside a leap second the TAI row still reads taiMinusUtc and leadOverUtc says inside", () => {
    const result = readPreset("inside-leap-second");
    const tai = row(result, "TAI");
    expect(leadOverUtc(lib, result.utc!, tai.reading).kind).toBe(
      "inside-inserted-second",
    );
    expect(tai.lead).toEqual({ kind: "seconds", seconds: "36" });
  });

  it("the ladder has one rung per distinct lead, highest first, UTC and GLO sharing the baseline", () => {
    const { rungs, off } = ladderRungs(r);
    expect(rungs.map((x) => x.seconds)).toEqual([37, 18, 4, 0]);
    expect(rungs[1]!.keys).toEqual(["GPS", "GAL", "QZS", "IRN"]);
    expect(rungs[3]!.keys).toEqual(["UTC", "GLO"]);
    expect(off).toEqual([]);
  });

  it("the layout is one constant scale: a second is LADDER.step pixels, and no two rows overlap", () => {
    const span = ladderSpan(lib, sliderPositions(lib));
    expect(span).toBe(37);
    const layout = ladderLayout(r, span);
    expect(layout.base - layout.taiY!).toBe(37 * LADDER.step);
    const gps = layout.rungs.find((x) => x.seconds === 18)!;
    expect(layout.base - gps.y).toBe(18 * LADDER.step);
    const tops = CLOCK_KEYS.map((k) => layout.tops[k]).sort((a, b) => a - b);
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i]! - tops[i - 1]!).toBeGreaterThanOrEqual(LADDER.row);
    }
    expect(tops[0]!).toBeGreaterThanOrEqual(LADDER.edge);
    expect(tops.at(-1)! + LADDER.row).toBeLessThanOrEqual(layout.height);
  });

  it("the stage height does not depend on the reading's own scale", () => {
    const span = ladderSpan(lib, sliderPositions(lib));
    expect(ladderLayout(readPreset("inside-leap-second"), span).height).toBe(
      ladderLayout(r, span).height,
    );
    expect(ladderLayout(readPreset("tai-reading"), span).height).toBe(
      ladderLayout(r, span).height,
    );
  });

  it("with no reading the eight rows are spread evenly and no rung is drawn", () => {
    const layout = ladderLayout(emptyRead(), 37);
    expect(layout.rungs).toEqual([]);
    expect(layout.taiY).toBeNull();
    expect(new Set(CLOCK_KEYS.map((k) => layout.tops[k])).size).toBe(8);
  });

  it("the library says which clocks move with TAI and which follow UTC", () => {
    const ties = clockTies(lib, sliderPositions(lib));
    for (const key of ["GPS", "GAL", "BDT", "QZS", "IRN"] as const) {
      expect(ties[key]).toBe("tai");
    }
    expect(ties.GLO).toBe("utc");
  });

  it("a clock with no place on the scale is off the ladder, not on rung zero", () => {
    const early = readPreset("before-beidou");
    const { rungs, off } = ladderRungs(early);
    expect(off).toEqual(["BDT"]);
    expect(rungs.flatMap((x) => x.keys)).not.toContain("BDT");
    const layout = ladderLayout(early, 37);
    expect(layout.off).toEqual(["BDT"]);
    const stood = layout.rungs.flatMap((x) => x.keys);
    expect(stood).not.toContain("BDT");
    const inside = ladderRungs(readPreset("inside-leap-second"));
    const insideLayout = ladderLayout(readPreset("inside-leap-second"), 37);
    // Only TAI, UTC stand on the stage; TAI is at its true height, no leader.
    expect(insideLayout.rungs.map((x) => x.keys)).toEqual([["TAI"], ["UTC"]]);
    expect(insideLayout.rungs[0]!.top + LADDER.row / 2).toBeCloseTo(
      insideLayout.taiY!,
      6,
    );
    expect(inside.off).toEqual(["GPS", "GAL", "BDT", "QZS", "GLO", "IRN"]);
  });

  it("the NavIC row is tagged derived and no other is", () => {
    expect(
      r.rows.filter((x) => x.tags.includes("derived")).map((x) => x.key),
    ).toEqual(["IRN"]);
  });

  it("no clock is ahead of UTC by a negative or fractional number here", () => {
    for (const x of r.rows) {
      if (x.lead.kind === "seconds") {
        expect(x.lead.seconds).toMatch(/^\d+$/);
      }
    }
  });
});

describe("the written-as note", () => {
  it("is absent when the library spells the value as typed", () => {
    for (const p of CLOCK_PRESETS) {
      const result = read(p.state.value);
      if (result.status !== "ok") continue;
      expect(row(result, result.clock!).writtenAs).toBeNull();
    }
  });

  it("shows an offset rewritten as Z", () => {
    const result = read("2024-01-01T00:00:00+01:00");
    expect(result.status).toBe("ok");
    expect(result.clock).toBe("UTC");
    expect(row(result, "UTC").yours).toBe(true);
    expect(row(result, "UTC").writtenAs).toBe("2023-12-31T23:00:00Z");
    expect(row(result, "GPS").reading).toBe("2023-12-31T23:00:18 GPS");
    // The lead is read from the same instant written with Z.
    const asZ = read("2023-12-31T23:00:00Z");
    expect(result.utc).toBe("2024-01-01T00:00:00+01:00");
    expect(result.rows.map((x) => x.leadText)).toEqual(
      asZ.rows.map((x) => x.leadText),
    );
    expect(row(result, "GPS").lead).toEqual({ kind: "seconds", seconds: "18" });
    expect(row(result, "GPS").leadText).toBe("18 s");
    expect(row(result, "BDT").leadText).toBe("4 s");
    expect(ladderAria(result)).toBe(ladderAria(asZ));
    expect(ladderAria(result)).not.toContain("no result");
  });

  it("shows a trimmed fraction on a scale string", () => {
    const result = read("2024-01-01T00:00:18.50 GPS");
    expect(result.status).toBe("ok");
    expect(result.utc).toBe("2024-01-01T00:00:00.5Z");
    expect(row(result, "GPS").writtenAs).toBe("2024-01-01T00:00:18.5 GPS");
  });
});

describe("each sentence, in order", () => {
  it("empty makes no call and is not a sentinel", () => {
    for (const value of ["", "   "]) {
      const result = read(value);
      expect(result.status).toBe("empty");
      expect(result.failure).toBeNull();
      expect(result.emptyText).not.toBeNull();
      expect(result.calls).toEqual([]);
    }
  });

  it("an unknown token comes before everything", () => {
    for (const value of [
      "2024-01-01T00:00:37 UTC",
      "2024-01-01T00:00:37 gps",
      "2017-12-31T23:59:60 UTC",
    ]) {
      expect(read(value).failure).toBe(SENTENCES.unknownToken);
    }
  });

  it("a second 60 with no offset asks for the offset, whether or not the day had a leap second", () => {
    // 2016-12-31 had a leap second; 2017-12-31 did not.
    expect(read("2016-12-31T23:59:60").failure).toBe(SENTENCES.notAnInstant);
    expect(read("2017-12-31T23:59:60").failure).toBe(SENTENCES.notAnInstant);
    expect(read("2016-12-31T23:59:60Z").status).toBe("ok");
  });

  it("a second 60 on a day with no leap second is its own sentence", () => {
    expect(read("2017-12-31T23:59:60Z").failure).toBe(SENTENCES.noLeapSecond);
    expect(read("2017-12-31T23:59:60 GLO").failure).toBe(
      SENTENCES.noLeapSecond,
    );
    expect(read("2017-12-31T23:59:60+01:00").failure).toBe(
      SENTENCES.noLeapSecond,
    );
  });

  it("a scale string the converter returns nothing for says so", () => {
    for (const value of [
      "1990-01-01T00:00:00 GAL",
      "2005-12-31T23:59:59 BDT",
      "2024-01-01T00:00:18Z GPS",
      "2024-01-01 00:00:18 GPS",
      "2024-01-01T00:00:60 GPS",
      "2024-01-01T00:00:60 TAI",
    ]) {
      const result = read(value);
      expect(result.status, value).toBe("sentinel");
      if (result.failure !== SENTENCES.notOnClock) {
        expect(result.failure, value).toBe(SENTENCES.notAnInstant);
      }
    }
    expect(read("1990-01-01T00:00:00 GAL").failure).toBe(SENTENCES.notOnClock);
    expect(read("2024-01-01T00:00:18Z GPS").failure).toBe(SENTENCES.notOnClock);
  });

  it("a value that is not an instant says so", () => {
    for (const value of [
      "garbage",
      "2024-01-01",
      "2024-13-01T00:00:00Z",
      "2024-01-01T00:00:00 GPS extra",
      "a b c",
    ]) {
      expect(read(value).failure, value).toBe(SENTENCES.notAnInstant);
    }
  });

  it("a sentinel keeps every row and draws no plate value", () => {
    const result = read("garbage");
    expect(result.rows).toHaveLength(8);
    expect(result.plates.every((p) => p.value === null)).toBe(true);
    expect(result.footnote).toBe("");
  });

  it("before 1972 is its own case, not 'none after this instant'", () => {
    const result = read("1971-06-01T00:00:00Z");
    expect(result.status).toBe("ok");
    expect(result.taiMinusUtc).toBeNull();
    expect(result.plates[2]!.value).toBe(BEFORE_1972_PLATE.value);
    expect(result.plates[2]!.lines[0]).toBe(BEFORE_1972_PLATE.line);
    expect(result.plates[2]!.value).not.toBe("none after this instant");
    expect(result.footnote).toBe(BEFORE_1972_NOTE);
    // From 1972 on, a later instant with no insertion still says "none after".
    expect(read("1972-01-01T00:00:00Z").plates[2]!.value).not.toBe(
      BEFORE_1972_PLATE.value,
    );
  });

  it("no footnote is longer than the longest one the page reserves", () => {
    const longest = Math.max(...FOOTNOTES_RESERVED.map((t) => t.length));
    for (const value of [
      "1971-06-01T00:00:00Z",
      "1990-01-01T00:00:00Z",
      "2004-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
    ]) {
      expect(read(value).footnote.length).toBeLessThanOrEqual(longest);
    }
  });

  it("a sentinel is never the legitimate 'none after this instant'", () => {
    const result = read("2027-06-01T00:00:00Z");
    expect(result.status).toBe("ok");
    expect(result.next).toBe("");
    expect(result.plates[2]!.value).toBe("none after this instant");
    expect(result.plates[2]!.lines[0]).toBe("these gaps stay as they are");
  });
});

describe("the plates", () => {
  it("are UTC, TAI minus UTC and the next change", () => {
    const result = readPreset("galileo-first-instant");
    expect(result.plates.map((p) => p.role)).toEqual([
      "hero-utc",
      "hero-tai",
      "hero-next",
    ]);
    expect(result.plates.map((p) => p.caption)).toEqual([
      "UTC",
      "TAI − UTC",
      "Next change",
    ]);
    expect(result.plates[0]!.value).toBe("1999-08-21T23:59:47Z");
    expect(result.plates[0]!.series).toBe(1);
    expect(result.plates[1]!.value).toBe("32 s");
    expect(result.plates[1]!.lines[0]).toBe("1999-08-22T00:00:19 TAI");
    expect(result.plates[2]!.value).toBe("2005-12-31T23:59:60Z");
  });

  it("keep the same number of lines in every state", () => {
    const counts = ["utc-2024", "wrong-token", "inside-leap-second"].map((id) =>
      readPreset(id).plates.map((p) => p.lines.length),
    );
    expect(counts[0]).toEqual(counts[1]);
    expect(counts[0]).toEqual(counts[2]);
  });

  it("the summary names every plate, or the one sentence", () => {
    expect(summaryText(readPreset("utc-2024"))).toContain("TAI − UTC 37 s");
    expect(summaryText(readPreset("wrong-token"))).toBe(SENTENCES.unknownToken);
    expect(summaryText(read(""))).not.toBe("");
  });

  it("the ladder's label and sentences read each clock", () => {
    const result = readPreset("utc-2024");
    expect(ladderAria(result)).toBe(
      "Ladder of 8 clocks on one scale of seconds ahead of UTC, TAI at the top: TAI 37 s ahead of UTC; GPS, GAL, QZS and IRN 18 s ahead of UTC; BDT 4 s ahead of UTC; UTC and GLO on the baseline, 0 s.",
    );
    expect(ladderChip(row(result, "GPS"))).toBe("18 s");
    expect(ladderChip(row(readPreset("inside-leap-second"), "GPS"))).toBe(
      "inserted second",
    );
    expect(LADDER_NONE_NOTE).toContain("first instant");
    expect(rowSentence(row(result, "GPS"))).toBe(
      "GPS: 2024-01-01T00:00:18 GPS, 18 s ahead of UTC",
    );
    expect(rowSentence(row(readPreset("before-beidou"), "BDT"))).toContain(
      BEFORE_FIRST_INSTANT_NOTE,
    );
  });
});

describe("the slider", () => {
  it("has one more position than there are inserted seconds, the first at INTEGER_UTC_FROM", () => {
    const positions = sliderPositions(lib);
    expect(positions[0]).toBe(INTEGER_UTC_FROM);
    expect(positions).toHaveLength(insertions(lib).length + 1);
  });

  it("every position is an instant the converter reads, and each is the second after an insertion", () => {
    const positions = sliderPositions(lib);
    const inserted = insertions(lib);
    inserted.forEach((label, i) => {
      expect(positions[i + 1]).toBe(
        lib.addUtc(label.replace(":60Z", ":59Z"), { seconds: 1 }),
      );
    });
    for (const position of positions) {
      const result = read(position);
      expect(result.status, position).toBe("ok");
      expect(result.utc).toBe(position);
    }
  });

  it("the offset only grows along the slider", () => {
    const leads = sliderPositions(lib).map((p) => read(p).taiMinusUtc);
    for (let i = 1; i < leads.length; i += 1) {
      expect(leads[i]!).toBeGreaterThanOrEqual(leads[i - 1]!);
    }
    expect(leads[0]).toBe(10);
  });
});

describe("the permalink", () => {
  it("round trips the value under the key `value`", () => {
    for (const p of CLOCK_PRESETS) {
      expect(permalinkOf(p.state)).toEqual({ value: p.state.value });
      expect(readArgs(permalinkOf(p.state))).toEqual(p.state);
    }
  });

  it("carries a custom value as typed, trimmed", () => {
    expect(permalinkOf({ value: "  2030-05-05T05:05:05Z " })).toEqual({
      value: "2030-05-05T05:05:05Z",
    });
    expect(readArgs({ value: "2030-05-05T05:05:05Z" }).value).toBe(
      "2030-05-05T05:05:05Z",
    );
  });

  it("an empty value has no permalink key", () => {
    expect(permalinkOf({ value: "" })).toEqual({});
  });

  it("a value is cut at 64 characters", () => {
    const long = "x".repeat(100);
    expect(permalinkOf({ value: long }).value).toHaveLength(MAX_VALUE_LENGTH);
    expect(readArgs({ value: long }).value).toHaveLength(MAX_VALUE_LENGTH);
  });

  it("seeds from a preset id, then from the default", () => {
    expect(readArgs({ preset: "beidou-reading" })).toEqual(
      preset("beidou-reading").state,
    );
    expect(readArgs({})).toEqual(DEFAULT_PRESET.state);
    expect(isSeeded({ value: "x" })).toBe(true);
    expect(isSeeded({ preset: "utc-2024" })).toBe(true);
    expect(isSeeded({})).toBe(false);
    expect(isSeeded(undefined)).toBe(false);
    expect(isSeeded({ value: "" })).toBe(false);
  });

  it("matches a preset by its trimmed value, else custom", () => {
    expect(matchPreset({ value: " 2024-01-01T00:00:00Z " })).toBe("utc-2024");
    expect(matchPreset({ value: "2030-01-01T00:00:00Z" })).toBe(
      CUSTOM_PRESET_ID,
    );
  });
});

describe("what the page says", () => {
  it("names no national time, zone or body", () => {
    const text = JSON.stringify([CLOCK_PRESETS, SENTENCES, GLO_NOTE, IRN_NOTE]);
    expect(text).not.toMatch(/UTC\+3|Moscow|MSK|America\/New_York|en-US/);
    expect(GLO_NOTE).toContain("GLONASS time");
    expect(IRN_NOTE).toContain("derives");
  });
});

describe("the off-scale reserve", () => {
  it("is the most clocks any stop leaves off the ladder, from the library", () => {
    const positions = sliderPositions(lib);
    const counts = positions.map(
      (value) => ladderRungs(readClocks(lib, { value })).off.length,
    );
    expect(offReserve(lib, positions)).toBe(Math.max(...counts));
    expect(offReserve(lib, positions)).toBeGreaterThanOrEqual(5);
  });
});
