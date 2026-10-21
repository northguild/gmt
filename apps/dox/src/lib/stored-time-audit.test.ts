/**
 * The Stored Time Audit's pure logic against the real library. Kinds and
 * transitions are literal values read from a run of the built library (the
 * rows of `classifyStoredZoned.test.ts`), so a drift in the library or the logic fails here.
 */
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import { getDstTransitions } from "@northguild/gmt/zoned/get";
import { describe, expect, it } from "vitest";
import {
  AUDIT_MAX_CHARS,
  AUDIT_MAX_LINES,
  AUDIT_PRESETS,
  CUSTOM_PRESET_ID,
  NO_BAND_TEXT,
  NOT_STORED_TEXT,
  VALID_REASON_TEXT,
  defaultLine,
  dstLink,
  kindLabel,
  laneMarks,
  lineSentence,
  matchPreset,
  parseAuditLines,
  permalinkOf,
  readArgs,
  readAuditLine,
  readAuditLines,
  readingsOf,
  stripFor,
  zoneOfLine,
} from "./stored-time-audit";
import type { StoredTimeLib } from "./stored-time-lib";

const lib = { classifyStoredZoned, getDstTransitions } as StoredTimeLib;

describe("parseAuditLines", () => {
  it("trims, drops empty lines and reads CRLF", () => {
    const p = parseAuditLines("  a  \r\n\r\n\n b\n");
    expect(p.lines).toEqual(["a", "b"]);
    expect(p.truncated).toBe(false);
  });

  it("keeps the first twelve lines and says how many it dropped", () => {
    const text = Array.from({ length: 15 }, (_, i) => `l${i}`).join("\n");
    const p = parseAuditLines(text);
    expect(p.lines).toHaveLength(AUDIT_MAX_LINES);
    expect(p.droppedLines).toBe(3);
    expect(p.truncated).toBe(true);
  });

  it("cuts a line to eighty characters", () => {
    const p = parseAuditLines("x".repeat(200));
    expect(p.lines[0]).toHaveLength(AUDIT_MAX_CHARS);
    expect(p.cutLines).toBe(true);
    expect(p.truncated).toBe(true);
  });
});

describe("zoneOfLine", () => {
  it("drops a leading bang and ignores key-value annotations", () => {
    expect(zoneOfLine("2022-07-08T00:14:07+00:00[!Europe/London]")).toBe(
      "Europe/London",
    );
    expect(zoneOfLine("2016-12-01T09:00:00+03:00[Europe/Istanbul]")).toBe(
      "Europe/Istanbul",
    );
    expect(zoneOfLine("2026-03-08T02:30:00-08:00[u-ca=hebrew]")).toBeNull();
    expect(zoneOfLine("2026-03-08T02:30:00-08:00")).toBeNull();
  });
});

describe("the presets", () => {
  it("name an existing selected line and carry no verdict word", () => {
    for (const p of AUDIT_PRESETS) {
      expect(p.selected).toBeGreaterThanOrEqual(1);
      expect(p.selected).toBeLessThanOrEqual(p.lines.length);
      expect(p.lines.every((l) => l.length <= AUDIT_MAX_CHARS)).toBe(true);
      expect(p.description).not.toMatch(
        /\b(correct|wrong|bug|error|invalid)\b/i,
      );
    }
  });

  it("start on Istanbul and never on New York", () => {
    expect(AUDIT_PRESETS[0]!.id).toBe("istanbul-2016");
    expect(AUDIT_PRESETS[0]!.lines.join("\n")).not.toMatch(/New_York/);
  });

  it("match their own text and no other", () => {
    for (const p of AUDIT_PRESETS) {
      expect(matchPreset(p.lines.join("\n"))).toBe(p.id);
    }
    expect(matchPreset("2016-12-01T09:00:00+02:00[Europe/Istanbul]")).toBe(
      CUSTOM_PRESET_ID,
    );
  });
});

describe("stripFor", () => {
  const strip = (value: string) => stripFor(readAuditLine(value, lib), lib);

  it("draws the Istanbul mismatch as a since strip from the 2016 change", () => {
    const s = strip("2016-12-01T09:00:00+02:00[Europe/Istanbul]");
    expect(s.kind).toBe("since");
    if (s.kind !== "since") return;
    expect(s.transition).toEqual({
      instant: "2016-03-27T01:00:00Z",
      offsetBefore: "+02:00",
      offsetAfter: "+03:00",
    });
    expect(s.years).toEqual([2016]);
    expect(s.calls.map((c) => c.fn)).toEqual(["getDstTransitions"]);
  });

  it("draws the Casablanca mismatch from the June 2018 change", () => {
    const s = strip("2018-12-01T09:00:00+00:00[Africa/Casablanca]");
    expect(s.kind === "since" && s.transition?.instant).toBe(
      "2018-06-17T02:00:00Z",
    );
  });

  it("looks in the year before, in two calls and never more (Sao Paulo)", () => {
    const s = strip("2020-01-15T12:00:00-02:00[America/Sao_Paulo]");
    expect(s.kind).toBe("since");
    if (s.kind !== "since") return;
    expect(s.years).toEqual([2020, 2019]);
    expect(s.calls).toHaveLength(2);
    expect(s.transition).toEqual({
      instant: "2019-02-17T02:00:00Z",
      offsetBefore: "-02:00",
      offsetAfter: "-03:00",
    });
  });

  it("draws the London mismatch from March 2022", () => {
    const s = strip("2022-07-08T00:14:07-00:00[Europe/London]");
    expect(s.kind === "since" && s.transition?.instant).toBe(
      "2022-03-27T01:00:00Z",
    );
  });

  it("draws a gap as a day strip with its band", () => {
    const s = strip("2024-10-06T02:15:00+10:30[Australia/Lord_Howe]");
    expect(s.kind).toBe("day");
    if (s.kind !== "day") return;
    expect(s.gap).toBe(true);
    expect(s.date).toBe("2024-10-06");
    expect(s.window.zoneStartMinutes).toBe(120);
    expect(s.window.zoneEndMinutes).toBe(150);
    expect(s.pinMinute).toBe(135);
  });

  it("draws an overlap as a day strip, not a gap", () => {
    const s = strip("2026-11-01T01:30:00-07:00[America/Los_Angeles]");
    expect(s.kind === "day" && s.gap).toBe(false);
  });

  it("draws nothing for a valid line, with its reason", () => {
    const s = strip("2016-12-01T09:00:00+03:00[Europe/Istanbul]");
    expect(s).toEqual({ kind: "none", reason: VALID_REASON_TEXT, calls: [] });
  });

  it("draws nothing for a line that is not a stored time", () => {
    const s = strip("2026-03-08T02:30:00-08:00");
    expect(s).toEqual({ kind: "none", reason: NOT_STORED_TEXT, calls: [] });
  });

  it("draws no band for a whole skipped day (Apia 2011-12-30)", () => {
    const s = strip("2011-12-30T12:00:00+14:00[Pacific/Apia]");
    expect(s.kind).toBe("none");
    if (s.kind === "none") expect(s.reason).toBe(NO_BAND_TEXT);
  });

  it("draws every preset's selected line without a NaN", () => {
    for (const p of AUDIT_PRESETS) {
      const line = readAuditLine(p.lines[p.selected - 1]!, lib);
      expect(JSON.stringify(stripFor(line, lib))).not.toMatch(/NaN|null,"gap"/);
    }
  });
});

describe("the readings", () => {
  it("carry the Istanbul mismatch's four values", () => {
    const r = readAuditLine(
      "2016-12-01T09:00:00+02:00[Europe/Istanbul]",
      lib,
    ).result!;
    expect(r.kind).toBe("offsetMismatch");
    expect(readingsOf(r)).toEqual([
      { name: "storedOffset", value: "+02:00" },
      { name: "zoneOffset", value: "+03:00" },
      { name: "atStoredOffset", value: "2016-12-01T07:00:00Z" },
      { name: "atZoneOffset", value: "2016-12-01T06:00:00Z" },
    ]);
  });

  it("place a gap's three readings on three marks", () => {
    const r = readAuditLine(
      "2026-03-08T02:30:00-03:00[America/Los_Angeles]",
      lib,
    ).result!;
    expect(r.kind).toBe("nonexistent");
    const marks = laneMarks(r);
    expect(marks.map((m) => m.instant)).toEqual([
      "2026-03-08T09:30:00Z",
      "2026-03-08T10:30:00Z",
      "2026-03-08T05:30:00Z",
    ]);
  });

  it("put readings at one instant on one mark", () => {
    const r = readAuditLine(
      "2016-12-01T09:00:00+03:00[Europe/Istanbul]",
      lib,
    ).result!;
    const marks = laneMarks(r);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.names).toEqual(["instant", "atStoredOffset"]);
  });
});

describe("lineSentence and kindLabel", () => {
  it("say one plain thing per kind", () => {
    const sentence = (v: string) => lineSentence(readAuditLine(v, lib));
    expect(sentence("2016-12-01T09:00:00+02:00[Europe/Istanbul]")).toBe(
      "The zone was at +03:00 at this time; the stored +02:00 is no offset it has.",
    );
    expect(sentence("2015-11-08T03:30:00+01:00[Europe/Istanbul]")).toBe(
      "This wall time happens twice, and the stored offset picks neither.",
    );
    expect(sentence("2026-03-08T02:30:00-03:00[America/Los_Angeles]")).toMatch(
      /falls in a gap/,
    );
    expect(sentence("2015-11-08T03:30:00+03:00[Europe/Istanbul]")).toMatch(
      /^This wall time happens twice, and the stored offset picks the one at /,
    );
    expect(sentence("2016-12-01T09:00:00+03:00[Europe/Istanbul]")).toMatch(
      /^The zone has the stored offset/,
    );
    expect(sentence("not a time")).toBe(NOT_STORED_TEXT);
  });

  it("name the five kinds in words", () => {
    expect(
      (
        [
          "valid",
          "validInOverlap",
          "offsetMismatch",
          "ambiguous",
          "nonexistent",
        ] as const
      ).map(kindLabel),
    ).toEqual([
      "Valid",
      "Valid in an overlap",
      "Offset mismatch",
      "Ambiguous",
      "Nonexistent",
    ]);
  });
});

describe("the default line", () => {
  it("is the first line that is neither valid nor not-a-time, else 1", () => {
    const read = (xs: string[]) => readAuditLines(xs, lib);
    expect(
      defaultLine(
        read([
          "2016-12-01T09:00:00+03:00[Europe/Istanbul]",
          "nope",
          "2016-12-01T09:00:00+02:00[Europe/Istanbul]",
        ]),
      ),
    ).toBe(3);
    expect(defaultLine(read(["nope"]))).toBe(1);
  });
});

describe("the DST Inspector link", () => {
  it("seeds the zone and the wall year", () => {
    const link = dstLink(
      readAuditLine("2016-12-01T09:00:00+02:00[Europe/Istanbul]", lib),
    )!;
    expect(link.zone).toBe("Europe/Istanbul");
    expect(link.year).toBe(2016);
    expect(link.text).toBe("This zone's clock changes in 2016");
    const params = new URL(link.href, "https://x.test").searchParams;
    expect(params.get("w")).toBe("dst");
    expect(JSON.parse(params.get("wa")!)).toEqual({
      zone: "Europe/Istanbul",
      year: 2016,
    });
  });

  it("is absent for a line that is not a stored time", () => {
    expect(dstLink(readAuditLine("2026-03-08T02:30:00-08:00", lib))).toBeNull();
  });
});

describe("args and permalink", () => {
  it("round-trip the lines and the selected line", () => {
    const values = "a\nb\nc";
    const state = readArgs({ values, line: "2" });
    expect(permalinkOf(state)).toEqual({ values, line: "2" });
  });

  it("drop a line number outside the lines", () => {
    expect(readArgs({ values: "a", line: "13" }).line).toBeNull();
    expect(readArgs({ values: "a", line: "0" }).line).toBeNull();
    expect(permalinkOf({ values: "", line: 3 })).toEqual({});
  });
});
