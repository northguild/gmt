/**
 * The HL7 Timestamp Reader's pure module against the real `@northguild/gmt`: presets, what each
 * kind of value states, the strip, the writer ladder and the permalink round trip.
 */
import { hl7Lib as lib } from "~/test/hl7-lib";
import {
  CUSTOM_PRESET_ID,
  HL7_PRESETS,
  LADDER_HEAD_OFFSET,
  MEMBER_ROWS,
  REASON_DEGREE,
  REASON_PICTURE,
  LADDER_HEAD_UTC,
  detailText,
  hl7Blank,
  hl7Figure,
  hl7Texts,
  isSeeded,
  ladderOf,
  laterText,
  matchPreset,
  memberReadout,
  permalinkOf,
  presetState,
  readArgs,
  readHl7,
  sentinelText,
  stripApplies,
  stripNote,
  stripOf,
  timelineEmptyText,
  verdictText,
} from "./hl7-timestamp-reader";

const stateOf = (value: string, ...zones: string[]) => ({
  value,
  zones: [zones[0] ?? "", zones[1] ?? "", zones[2] ?? "", zones[3] ?? ""] as [
    string,
    string,
    string,
    string,
  ],
});
const read = (value: string) => readHl7(stateOf(value), lib);

describe("presets", () => {
  it("have unique ids, and each one is matched back by its own state", () => {
    const ids = HL7_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of HL7_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
    }
  });

  it("is custom once a value or a zone differs", () => {
    const first = HL7_PRESETS[0]!;
    expect(matchPreset({ ...presetState(first), value: "2024" })).toBe(
      CUSTOM_PRESET_ID,
    );
    expect(
      matchPreset({ ...presetState(first), zones: ["UTC", "", "", ""] }),
    ).toBe(CUSTOM_PRESET_ID);
  });

  it("states the kind each one is named for", () => {
    const kinds: Record<string, string> = {
      "no-offset": "local",
      offset: "instant",
      "minus-zero": "instant",
      fraction: "instant",
      "fall-back": "local",
      "spring-forward": "local",
      midnight: "local",
      "ts-month": "partial",
      "ts-day": "partial",
      "ts-finer": "",
      "birth-year": "partial",
      "null-value": "null",
      "five-digits": "",
    };
    expect(Object.keys(kinds).sort()).toEqual(
      HL7_PRESETS.map((p) => p.id).sort(),
    );
    for (const p of HL7_PRESETS) {
      const r = readHl7(presetState(p), lib);
      expect(r.parsed?.kind ?? "", p.id).toBe(kinds[p.id]);
    }
  });
});

describe("args and permalinks", () => {
  it("seeds from a value, or from a known preset", () => {
    expect(isSeeded({ value: "2024" })).toBe(true);
    expect(isSeeded({ preset: "ts-month" })).toBe(true);
    expect(isSeeded({ preset: "nope" })).toBe(false);
    expect(isSeeded({})).toBe(false);
    expect(readArgs({ preset: "ts-month" }).value).toBe("199904011200^L");
  });

  it("keeps a typed value untrimmed and blanks an absent key", () => {
    expect(readArgs({ value: " 2024 ", zone2: "UTC" })).toEqual({
      value: " 2024 ",
      zones: ["", "UTC", "", ""],
    });
  });

  it("names the preset alone while the state matches one", () => {
    expect(permalinkOf(presetState(HL7_PRESETS[0]!))).toEqual({
      preset: HL7_PRESETS[0]!.id,
    });
  });

  it("round-trips a custom state through its link", () => {
    const state = stateOf(" 20240615103000", " Europe/Oslo ", "", "UTC");
    const link = permalinkOf(state);
    expect(link).toEqual({
      value: " 20240615103000",
      zone1: "Europe/Oslo",
      zone3: "UTC",
    });
    const back = readArgs(link);
    expect(back.value).toBe(state.value);
    expect(back.zones.map((z) => z.trim())).toEqual(
      state.zones.map((z) => z.trim()),
    );
  });

  it("calls only an untouched field blank", () => {
    expect(hl7Blank(stateOf(""))).toBe(true);
    expect(hl7Blank(stateOf(" "))).toBe(false);
    expect(hl7Blank(stateOf('""'))).toBe(false);
  });
});

describe("reading", () => {
  it("makes no call for a blank field", () => {
    const r = read("");
    expect(r.parse).toBeNull();
    expect(verdictText(r)).toBe("");
  });

  it("says what each kind states", () => {
    expect(verdictText(read("20240615103000"))).toBe(
      "No offset: the sender's local time",
    );
    expect(verdictText(read("20240615103000+0200"))).toBe("Offset stated");
    expect(verdictText(read("202406"))).toBe("A span, not a moment");
    expect(verdictText(read('""'))).toBe("The HL7 null value");
    expect(verdictText(read("2024061510300"))).toBe("");
    expect(detailText(read("20240615103000"))).toContain("not UTC");
    expect(detailText(read("202406"))).toContain("month");
    expect(detailText(read('""'))).toContain("delete");
  });

  it("reads -0000 and +0000 as the same offset", () => {
    for (const v of ["20240615103000-0000", "20240615103000+0000"]) {
      expect(read(v).parsed).toMatchObject({ offset: "+00:00" });
    }
  });

  it("gives the member rows a readout for every kind", () => {
    for (const v of ["20240615103000", "20240615103000+0200", "202406", '""']) {
      expect(memberReadout(read(v), "kind")).not.toBe("");
    }
  });

  it("reads the sentinel apart from a legitimately empty result", () => {
    expect(read("20240615^S").parsed).toBeNull();
    expect(read('""').parsed).toEqual({ kind: "null" });
    expect(sentinelText(read("20240615^S"), lib)).not.toBe("");
  });

  it("names the degree only when the DTM reads and no third component is sent", () => {
    expect(sentinelText(read("20240615^S"), lib)).toBe(REASON_DEGREE);
    // an empty trailing component is not present (ch. 2 §2.6.2)
    expect(sentinelText(read("20240615^S^"), lib)).toBe(REASON_DEGREE);
    expect(sentinelText(read("20240615^D^X"), lib)).toBe(REASON_PICTURE);
    expect(sentinelText(read("20240615^^D"), lib)).toBe(REASON_PICTURE);
    expect(sentinelText(read("2024061^D"), lib)).toBe(REASON_PICTURE);
  });

  it("applies the strip to a local value only", () => {
    expect(stripApplies(read("20240615103000"))).toBe(true);
    expect(stripApplies(read("20240615103000+0200"))).toBe(false);
    expect(stripApplies(read("202406"))).toBe(false);
    expect(stripApplies(null)).toBe(false);
    expect(stripNote(read("20240615103000"))).toContain("reject");
    expect(stripNote(read("202406"))).toContain("span");
    expect(timelineEmptyText(read("202406"))).toContain("span");
    expect(timelineEmptyText(null)).toContain("No value");
  });
});

describe("the strip", () => {
  it("reads Kolkata 5 h 30 min before the same digits read as UTC", () => {
    const s = stripOf("2024-06-15T10:30:00", ["Asia/Kolkata", ""], lib);
    expect(s.rows[0]).toMatchObject({
      zone: "Asia/Kolkata",
      instant: "2024-06-15T05:00:00Z",
      third: "5 h 30 min later",
    });
    expect(s.rows[1]!.zone).toBe("");
    expect(s.utcReading).toBe("2024-06-15T10:30:00Z");
  });

  // A fraction in the widest gap is kept, not rounded away: edi-widgets.test.ts (durationText).
  it("names the widest gap and the two zones it lies between", () => {
    const s = stripOf("2024-06-15T10:30:00", ["Asia/Kolkata", "UTC"], lib);
    expect(s.gap?.text).toBe(
      "Widest gap: 5 h 30 min, between Asia/Kolkata and UTC",
    );
  });

  it("refuses a time the clock shows twice, and says why", () => {
    const s = stripOf("2024-11-03T01:30:00", ["America/New_York"], lib);
    expect(s.rows[0]!.instant).toBe("");
    expect(s.rows[0]!.reason).not.toBe("");
  });

  it("words the distance both ways", () => {
    expect(laterText("PT0S")).toBe("the same time");
    expect(laterText("-PT4H")).toBe("4 h earlier");
    expect(laterText("PT4H")).toBe("4 h later");
  });
});

describe("the writer ladder", () => {
  it("has seven rows from year to fraction", () => {
    const l = ladderOf(read("20240615103045.1234+0000"), null, lib);
    expect(l.rows.map((r) => r.precision)).toEqual([
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "fraction",
    ]);
    expect(l.third).toBe(LADDER_HEAD_UTC);
    expect(l.rows[0]!.sent).toEqual({ text: "2024+0000", state: "value" });
  });

  it("never rounds up, and says no result for a finer precision", () => {
    const l = ladderOf(read("20240615103000"), null, lib);
    expect(l.rows[6]!.sent.state).toBe("none");
    expect(l.rows[5]!.sent.text).toBe("20240615103000");
    expect(l.third).toBe(LADDER_HEAD_OFFSET);
  });

  it("keeps the fraction digits as sent, trailing zeros too", () => {
    const l = ladderOf(read("20240615103000.1000+0000"), null, lib);
    expect(l.rows[6]!.sent).toEqual({
      text: "20240615103000.1000+0000",
      state: "value",
    });
    expect(l.rows[6]!.offset).toEqual({
      text: "20240615103000.1000+0000",
      state: "value",
    });
    expect(l.note).toContain('"2024-06-15T10:30:00.1000+00:00"');
  });

  it("writes a fraction of zeros, which is still a fraction", () => {
    const l = ladderOf(read("20240615103000.0000+0200"), null, lib);
    expect(l.rows[6]!.sent.text).toBe("20240615103000.0000+0200");
    expect(l.rows[6]!.offset.text).toBe("20240615083000.0000+0000");
  });

  it("makes up no seconds for a value sent to the minute", () => {
    const l = ladderOf(read("202406151030+0200"), null, lib);
    expect(l.rows[4]!.sent.text).toBe("202406151030+0200");
    expect(l.rows[4]!.offset.text).toBe("202406150830+0000");
    expect(l.rows[5]!.sent.state).toBe("none");
    expect(l.rows[5]!.offset.state).toBe("none");
    expect(
      ladderOf(read("20240615103000^M"), null, lib).rows[5]!.sent.state,
    ).toBe("none");
  });

  it("writes a local value in zone 1 with the digits as sent", () => {
    const zoned = ladderOf(
      read("20240615103000.1000"),
      stripOf("2024-06-15T10:30:00.1000", ["Europe/Helsinki"], lib),
      lib,
    );
    expect(zoned.rows[6]!.sent.text).toBe("20240615103000.1000");
    expect(zoned.rows[6]!.offset.text).toBe("20240615103000.1000+0300");

    const minute = ladderOf(
      read("202406151030"),
      stripOf("2024-06-15T10:30:00", ["Europe/Helsinki"], lib),
      lib,
    );
    expect(minute.rows[4]!.offset.text).toBe("202406151030+0300");
    expect(minute.rows[5]!.sent.state).toBe("none");
    expect(minute.rows[5]!.offset.state).toBe("none");
  });

  it("makes no call for a partial value that carries an offset", () => {
    const l = ladderOf(read("202406-0500"), null, lib);
    expect(l.note).toMatch(/makes no call/);
    expect(l.rows.every((r) => r.sent.state === "empty")).toBe(true);
  });

  it("is empty for a blank field", () => {
    const l = ladderOf(read(""), null, lib);
    expect(l.note).toBe("Nothing to write: there is no value.");
    expect(l.rows.every((r) => r.sent.state === "empty")).toBe(true);
  });
});

describe("figure widths", () => {
  it("reserves the width the longest value takes, read off formatHL7", () => {
    const widest = hl7Texts().ladderWidest;
    expect(
      lib.formatHL7("2024-06-15T10:30:45.1234+05:30", {
        precision: "fraction",
      }),
    ).toBe(widest);
  });

  it("draws every preset", () => {
    for (const p of HL7_PRESETS) {
      expect(() => hl7Figure(readHl7(presetState(p), lib), lib)).not.toThrow();
    }
  });
});

describe("hl7Texts", () => {
  const t = hl7Texts();

  it("covers every preset description and every verdict", () => {
    expect(t.descriptions).toHaveLength(HL7_PRESETS.length);
    for (const p of HL7_PRESETS) {
      const v = verdictText(readHl7(presetState(p), lib));
      if (v !== "") expect(t.verdicts).toContain(v);
    }
  });

  it("covers every detail each preset shows", () => {
    for (const p of HL7_PRESETS) {
      const r = readHl7(presetState(p), lib);
      if (r.parsed !== null) expect(t.details).toContain(detailText(r));
    }
  });

  it("covers every reason a refused value can give", () => {
    for (const p of HL7_PRESETS) {
      const r = readHl7(presetState(p), lib);
      if (r.parse !== null && r.parsed === null) {
        expect(t.reasons).toContain(sentinelText(r, lib));
      }
    }
    expect(t.reasons).toContain(REASON_DEGREE);
    expect(t.reasons).toContain(REASON_PICTURE);
    expect(t.refusals.length).toBeGreaterThan(0);
  });

  it("covers every strip note and ladder note", () => {
    for (const p of HL7_PRESETS) {
      const r = readHl7(presetState(p), lib);
      expect(t.stripNotes).toContain(stripNote(r));
    }
    expect(t.stripNotes).toContain(stripNote(null));
    expect(t.ladderNotes).toContain(ladderOf(read(""), null, lib).note);
  });

  it("gives every member row a text for every preset", () => {
    for (const p of HL7_PRESETS) {
      const r = readHl7(presetState(p), lib);
      for (const row of MEMBER_ROWS) {
        const m = memberReadout(r, row.key);
        expect(m.text, `${p.id}: ${row.label}`).not.toBe("");
      }
    }
    const r = read("202406");
    expect(memberReadout(r, "instant").text).toBe("none (a span)");
    expect(memberReadout(read("20240615103000"), "offset").text).toBe(
      "not sent",
    );
    expect(memberReadout(read('""'), "local").text).toBe("no result");
  });

  it("reads picture widths off formatHL7, each group the characters its precision adds", () => {
    const source = "20240615103045.1234+0530";
    expect(t.ladderWidest).toBe(source);
    const r = read(source);
    expect(r.parsed?.kind).toBe("instant");
    const fields = hl7Figure(r, lib).halves.flatMap((h) => h.fields);
    const precisions = [
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "fraction",
    ] as const;
    const local = r.parsed!.kind === "instant" ? r.parsed!.local : "";
    let written = "";
    const widths: string[] = [];
    for (const p of precisions) {
      const next = lib.formatHL7(local, { precision: p });
      widths.push(next.slice(written.length));
      written = next;
    }
    expect(fields.slice(0, precisions.length).map((f) => f.text)).toEqual(
      widths,
    );
    expect(written + "+0530").toBe(source);
  });

  it("reads a figure for every preset that parses, widths summing to what was sent", () => {
    for (const p of HL7_PRESETS) {
      const r = readHl7(presetState(p), lib);
      const fig = hl7Figure(r, lib);
      expect(fig.halves[0]!.fields.map((f) => f.text).join(""), p.id).toBe(
        r.value,
      );
    }
  });
});
