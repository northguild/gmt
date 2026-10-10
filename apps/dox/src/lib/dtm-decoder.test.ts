/// <reference types="vitest/globals" />
/**
 * `dtm-decoder.ts`'s pure helpers, against the real gmt modules. Every expected
 * library result is a JSDoc example of the function that returns it.
 */
import { lib } from "~/test/edi-lib";
import {
  CUSTOM_PRESET_ID,
  DTM_PRESETS,
  MEMBER_ROWS,
  detailText,
  dtmBlank,
  dtmFigure,
  dtmTexts,
  effective,
  gapRows,
  matchPreset,
  memberText,
  permalinkOf,
  presetState,
  readArgs,
  readDtm,
  sentinelText,
  splitDtm,
  splitText,
  stripApplies,
  stripNote,
  verdictText,
  writeBack,
  type DtmState,
} from "./dtm-decoder";
import { TWO_DIGIT_YEAR_CODES } from "./edi-widgets";

const preset = (id: string) => DTM_PRESETS.find((p) => p.id === id)!;
const value = (input: string, format = ""): DtmState => ({
  input,
  format,
  zones: ["", "", "", ""],
});
const read = (id: string) => readDtm(presetState(preset(id)), lib);

describe("splitDtm", () => {
  it("reads the four segment presets", () => {
    expect(splitDtm("DTM+137:202406151430:203'")).toEqual({
      kind: "segment",
      qualifier: "137",
      value: "202406151430",
      format: "203",
      extra: false,
    });
    expect(splitDtm("DTM+137:202406151430?+00:303'")).toMatchObject({
      value: "202406151430+00",
      format: "303",
    });
    expect(splitDtm("DTM+137:202406151430UTC:303'")).toMatchObject({
      value: "202406151430UTC",
      format: "303",
    });
    expect(splitDtm("DTM+137:202406151430CET:303'")).toMatchObject({
      value: "202406151430CET",
      format: "303",
    });
    expect(splitDtm("DTM+137:202406151430?+0200:205'")).toMatchObject({
      value: "202406151430+0200",
      format: "205",
    });
  });

  it("lets the release character release itself, a colon and a terminator", () => {
    expect(splitDtm("DTM+137:a??b:203'")).toMatchObject({ value: "a?b" });
    expect(splitDtm("DTM+137:a?:b:203'")).toMatchObject({
      value: "a:b",
      format: "203",
    });
    expect(splitDtm("DTM+137:a?'b:203'")).toMatchObject({
      value: "a'b",
      format: "203",
    });
  });

  it("keeps a release character at the very end", () => {
    expect(splitDtm("DTM+137:2024?")).toMatchObject({ value: "2024?" });
  });

  it("reads a segment with or without its terminator", () => {
    expect(splitDtm("DTM+137:202406151430:203")).toMatchObject({
      value: "202406151430",
      format: "203",
      extra: false,
    });
  });

  it("gives a missing component as an empty string", () => {
    expect(splitDtm("DTM+137:202406151430'")).toMatchObject({
      qualifier: "137",
      value: "202406151430",
      format: "",
    });
    expect(splitDtm("DTM+137'")).toMatchObject({ value: "", format: "" });
    expect(splitDtm("DTM+")).toMatchObject({ qualifier: "", value: "" });
  });

  it("flags a fourth component, a second element and text after the terminator", () => {
    expect(splitDtm("DTM+137:202406151430:203:x'")).toMatchObject({
      extra: true,
    });
    expect(splitDtm("DTM+137:202406151430:203+9:x'")).toMatchObject({
      extra: true,
    });
    expect(splitDtm("DTM+137:202406151430:203'DTM+1:2:3'")).toMatchObject({
      extra: true,
    });
    expect(splitDtm("DTM+137:202406151430:203'  ")).toMatchObject({
      extra: false,
    });
  });

  it("treats anything but DTM+ as a bare value, passed on unchanged", () => {
    expect(splitDtm("dtm+137:202406151430:203'")).toEqual({
      kind: "value",
      value: "dtm+137:202406151430:203'",
    });
    expect(splitDtm("UNH+1")).toEqual({ kind: "value", value: "UNH+1" });
    expect(splitDtm("  202406151430?+02 ")).toEqual({
      kind: "value",
      value: "202406151430?+02",
    });
  });

  it("is a value for empty input", () => {
    expect(splitDtm("")).toEqual({ kind: "value", value: "" });
    expect(splitDtm("   ")).toEqual({ kind: "value", value: "" });
  });
});

describe("effective", () => {
  it("takes the value and the format from a segment and ignores state.format", () => {
    const e = effective(value("DTM+137:202406151430:203'", "999"));
    expect(e).toMatchObject({ value: "202406151430", format: "203" });
  });

  it("takes the typed format, trimmed, for a bare value", () => {
    expect(effective(value("240615", " 101 "))).toMatchObject({
      value: "240615",
      format: "101",
    });
  });
});

describe("readArgs", () => {
  it("keeps strings as typed and leaves absent keys blank, with no preset fallback", () => {
    expect(readArgs({ input: "240615", format: "101" })).toEqual({
      input: "240615",
      format: "101",
      zones: ["", "", "", ""],
    });
  });

  it("ignores a yearWindow an old link or chat call still carries", () => {
    const old = { input: "240615", format: "101", yearWindow: "2000" } as never;
    expect(readArgs(old)).toEqual({
      input: "240615",
      format: "101",
      zones: ["", "", "", ""],
    });
  });
});

describe("permalinkOf", () => {
  it("carries the format only for a bare value, and never a year window", () => {
    expect(permalinkOf(value("202406151430", "203"))).toEqual({
      input: "202406151430",
      format: "203",
    });
    expect(permalinkOf(value("DTM+137:202406151430:203'", "203"))).toEqual({
      input: "DTM+137:202406151430:203'",
    });
  });
});

describe("the presets, against the real library", () => {
  const EXPECTED: Record<string, { kind: string; house: unknown } | null> = {
    "local-203": { kind: "dateTime", house: "2024-06-15T14:30:00" },
    "released-303": {
      kind: "offsetDateTime",
      house: "2024-06-15T14:30:00+00:00",
    },
    "utc-303": { kind: "offsetDateTime", house: "2024-06-15T14:30:00+00:00" },
    "gmt-303": { kind: "offsetDateTime", house: "2024-06-15T14:30:00+00:00" },
    "offset-205": {
      kind: "offsetDateTime",
      house: "2024-06-15T14:30:00+02:00",
    },
    "offset-208": {
      kind: "offsetDateTime",
      house: "2024-06-15T14:30:45+02:00",
    },
    "date-102": { kind: "date", house: "2024-06-15" },
    "time-402": { kind: "time", house: "14:30:45" },
    "period-718": {
      kind: "datePeriod",
      house: { start: "2024-06-15", end: "2024-06-20" },
    },
    "period-719": {
      kind: "dateTimePeriod",
      house: { start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" },
    },
    "cet-303": null,
    "two-digit-101": null,
  };

  it("names every preset in the expectations", () => {
    expect(DTM_PRESETS.map((p) => p.id).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it.each(DTM_PRESETS.map((p) => [p.id]))("%s", (id) => {
    const r = read(id!);
    const expected = EXPECTED[id!];
    if (expected === null) {
      expect(r.house).toBeNull();
      return;
    }
    expect(r.classified?.kind).toBe(expected.kind);
    expect(r.house).toEqual(expected.house);
    // Every other preset returns a value, and writes it back to the wire value.
    const written = writeBack(r, lib);
    expect(written?.output).not.toBe("");
    // The written value parses back to the house value it was written from
    // (UTC and GMT come back as +00, which the signed-hour code reads).
    const again = lib.parseEdifactOffsetDateTime;
    if (r.classified?.kind === "offsetDateTime") {
      expect(again(written!.output, r.classified.format)).toBe(r.house);
    } else {
      expect(written?.output).toBe(r.value);
    }
  });

  it("matches a preset by its fields and falls back to custom", () => {
    expect(matchPreset(presetState(preset("local-203")))).toBe("local-203");
    expect(matchPreset(value("202406151430", "203"))).toBe(CUSTOM_PRESET_ID);
  });

  it("gives only the presets that state no offset and have instants a set of example zones", () => {
    for (const p of DTM_PRESETS) {
      const r = readDtm(presetState(p), lib);
      const zones = p.zones.some((z) => z !== "");
      expect(zones, p.id).toBe(stripApplies(r));
    }
  });
});

describe("classifying first, then the kind's parser", () => {
  it("prints the classifier's call and the parser's call, in order", () => {
    const r = read("local-203");
    expect(r.calls.map((c) => [c.fn, ...c.args])).toEqual([
      ["classifyEdifactDtmFormat", "203"],
      ["parseEdifactDateTime", "202406151430", "203"],
    ]);
    expect(r.calls.map((c) => c.result)).toEqual([
      { kind: "dateTime", format: "203" },
      "2024-06-15T14:30:00",
    ]);
  });

  it("adds toOffsetInstant for a date-time with an offset", () => {
    const r = read("offset-205");
    expect(r.calls.map((c) => c.fn)).toEqual([
      "classifyEdifactDtmFormat",
      "parseEdifactOffsetDateTime",
      "toOffsetInstant",
    ]);
    expect(memberText(r, "instant")).toBe("2024-06-15T12:30:00Z");
    expect(memberText(r, "offset")).toBe("+02:00");
    expect(verdictText(r)).toBe("Offset: stated (+02:00)");
  });

  it("states the offset of UTC and GMT, which the signed-hour code reads", () => {
    for (const id of ["utc-303", "gmt-303", "released-303"]) {
      expect(verdictText(read(id))).toBe("Offset: stated (+00:00)");
    }
  });

  it("makes no parse call for a code the classifier does not know", () => {
    const r = read("two-digit-101");
    expect(r.classified).toBeNull();
    expect(r.parse).toBeNull();
    expect(r.calls.map((c) => c.fn)).toEqual(["classifyEdifactDtmFormat"]);
  });

  it("calls the period parser for a period and holds both ends", () => {
    const r = read("period-718");
    expect(memberText(r, "value")).toBe("2024-06-15");
    expect(memberText(r, "periodEnd")).toBe("2024-06-20");
    expect(memberText(r, "kind")).toBe("date period");
    expect(memberText(r, "instant")).toBeNull();
  });

  it("returns no member for a refused value, never a raw null", () => {
    const r = read("cet-303");
    for (const row of MEMBER_ROWS) expect(memberText(r, row.key)).toBeNull();
    expect(verdictText(r)).toBe("Offset: not stated");
    expect(detailText(r)).toBe("");
  });
});

describe("the sentinel and its sentence", () => {
  const why = (state: DtmState) =>
    sentinelText(state, readDtm(state, lib), lib);

  it("says CET under 303 is not a signed hour, UTC or GMT", () => {
    const text = why(presetState(preset("cet-303")));
    expect(text).toContain("signed hour");
    expect(text).toContain("UTC");
    expect(text).toContain("CET");
    expect(text).not.toContain("GMT)");
  });

  it("points a two-digit-year code at the pattern parsers with a yearWindow", () => {
    const text = why(presetState(preset("two-digit-101")));
    expect(text).toContain("two-digit year");
    expect(text).toContain("yyMMdd");
    expect(text).toContain("yearWindow");
  });

  it("says a code the library does not read is not read, with no pattern", () => {
    const text = why(value("20240615", "602"));
    expect(text).toContain("602 is not a format code the library reads");
    expect(text).not.toContain("yearWindow");
  });

  it("names the missing code and the missing value", () => {
    expect(why(value("20240615", ""))).toContain("Type the code");
    expect(why(value("DTM+137:20240615'"))).toContain("carries none");
    expect(why(value("", "203"))).toContain("Paste a DTM segment");
  });

  it("names a released character left in a bare value", () => {
    expect(why(value("202406151430?+0200", "205"))).toContain(
      "release character",
    );
  });

  it("names a value that does not fit its code", () => {
    expect(why(value("2024061514", "203"))).toContain("does not fit code 203");
    expect(why(value("2024-06-15", "102"))).toContain("does not fit code 102");
  });

  it("does not call a zone-text reason for a code with hours and minutes", () => {
    expect(why(value("202406151430CET", "205"))).toContain(
      "does not fit code 205",
    );
  });

  it("reads a seconds field a signed-hour code has no room for as not fitting", () => {
    expect(why(value("20240615143045+0200", "304"))).toContain("does not fit");
  });
});

describe("the advisory list of two-digit-year codes", () => {
  it("lists only codes the classifiers return null for", () => {
    for (const code of Object.keys(TWO_DIGIT_YEAR_CODES)) {
      expect(
        lib.classifyEdifactDtmFormat(code) ??
          lib.classifyX12DateTimePeriodFormat(code),
        code,
      ).toBeNull();
    }
  });

  it("gives the pattern the guide gives for the five it maps", () => {
    expect(TWO_DIGIT_YEAR_CODES).toMatchObject({
      "101": "yyMMdd",
      D6: "yyMMdd",
      TT: "MMddyy",
      "201": "yyMMddHHmm",
      "202": "yyMMddHHmmss",
      TR: "ddMMyyHHmm",
    });
  });
});

describe("the strip", () => {
  it("resolves a local date-time in each zone, with the offset and as 205", () => {
    const r = read("local-203");
    expect(stripApplies(r)).toBe(true);
    const rows = gapRows(r.house!, preset("local-203").zones, lib);
    expect(rows.map((x) => x.instant)).toEqual([
      "2024-06-15T18:30:00Z",
      "2024-06-15T12:30:00Z",
      "2024-06-15T06:30:00Z",
      "2024-06-15T21:30:00Z",
    ]);
    expect(rows[0]!.offset).toBe("-04:00");
    expect(rows[0]!.third).toBe("202406151430-0400");
  });

  it("resolves both ends of a period of local date-times", () => {
    const r = read("period-719");
    expect(stripApplies(r)).toBe(true);
    const row = gapRows(r.house!, ["Europe/Berlin", "", "", ""], lib)[0]!;
    expect(row.instant).toBe("2024-06-15T12:30:00Z");
    expect(row.third).toBe("2024-06-20T14:00:00Z");
  });

  it("carries the refusal reason for a time the clock shows twice", () => {
    const rows = gapRows("2024-11-03T01:30:00", ["America/New_York"], lib);
    expect(rows[0]!.instant).toBe("");
    expect(rows[0]!.reason).toContain("happens twice");
  });

  it("does not apply to a date, a time, a period of dates or an offset date-time", () => {
    for (const id of ["date-102", "time-402", "period-718", "offset-205"]) {
      expect(stripApplies(read(id)), id).toBe(false);
    }
    expect(stripNote(read("offset-205"))).toContain("states its offset");
    expect(stripNote(read("period-718"))).toContain("period of dates");
  });
});

describe("writing back", () => {
  it("calls the period formatter with the start and the end as two arguments", () => {
    const w = writeBack(read("period-719"), lib)!;
    expect(w.call.fn).toBe("formatEdifactDateTimePeriod");
    expect(w.call.args).toEqual([
      "2024-06-15T14:30:00",
      "2024-06-20T16:00:00",
      "719",
    ]);
    expect(w.output).toBe("202406151430202406201600");
    expect(w.note).toContain("without a hyphen");
  });

  it("writes UTC as +00 and says so", () => {
    const w = writeBack(read("utc-303"), lib)!;
    expect(w.output).toBe("202406151430+00");
    expect(w.note).toContain("never as UTC or GMT");
    expect(w.note).toContain("?+");
  });

  it("has nothing to write for a refused value", () => {
    expect(writeBack(read("cet-303"), lib)).toBeNull();
  });
});

describe("the value taken apart", () => {
  it("cuts a date-time with an offset into date, time and offset", () => {
    const fig = dtmFigure(
      presetState(preset("offset-208")),
      read("offset-208"),
      lib,
    );
    expect(fig.halves[0]!.fields.map((f) => [f.text, f.mask, f.group])).toEqual(
      [
        ["2024", "CCYY", "date"],
        ["06", "MM", "date"],
        ["15", "DD", "date"],
        ["14", "HH", "time"],
        ["30", "MM", "time"],
        ["45", "SS", "time"],
        ["+0200", "ZHHMM", "offset"],
      ],
    );
    expect(fig.closing).toBe("");
  });

  it("closes an offsetless value with no offset", () => {
    const fig = dtmFigure(
      presetState(preset("local-203")),
      read("local-203"),
      lib,
    );
    expect(fig.closing).toBe("no offset");
  });

  it("cuts a period into its two halves with no separator", () => {
    const fig = dtmFigure(
      presetState(preset("period-719")),
      read("period-719"),
      lib,
    );
    expect(fig.halves.map((h) => h.label)).toEqual(["start", "end"]);
    expect(fig.separator).toBe("");
    expect(fig.halves[1]!.fields[2]!.text).toBe("20");
  });

  it("cuts the zone field of 303 as a three-character field", () => {
    const fig = dtmFigure(presetState(preset("utc-303")), read("utc-303"), lib);
    const last = fig.halves[0]!.fields.at(-1)!;
    expect([last.text, last.mask]).toEqual(["UTC", "ZZZ"]);
  });

  it("draws a refused value in neutral boxes", () => {
    const s = presetState(preset("cet-303"));
    const fig = dtmFigure(s, readDtm(s, lib), lib);
    expect(
      fig.halves.every((h) => h.fields.every((f) => f.group === "neutral")),
    ).toBe(true);
  });
});

describe("splitText and the blank form", () => {
  it("is blank only when nothing is typed in either field", () => {
    expect(dtmBlank(value("", ""))).toBe(true);
    expect(dtmBlank(value("  ", " "))).toBe(true);
    expect(dtmBlank(value("", "203"))).toBe(false);
  });

  it("says how a segment was read", () => {
    expect(splitText(value("DTM+137:2024:203'"))).toContain(
      "function qualifier 137",
    );
    expect(splitText(value("2024", "203"))).toBe("Read as a bare value.");
  });
});

describe("naming", () => {
  it("names no regulator, statute, agency, docket or business event", () => {
    const all = JSON.stringify([dtmTexts(), DTM_PRESETS]);
    expect(all).not.toMatch(
      /\b(customs|statute|regulation|docket|agency|FMC|FMCSA|CBP|demurrage|detention)\b/i,
    );
  });

  it("never calls the library GMT in a sentence the reader sees", () => {
    const all = JSON.stringify([
      dtmTexts(),
      DTM_PRESETS.map((p) => p.description),
    ]);
    expect(all).not.toMatch(
      /the GMT library|@northguild\/gmt|GMT (provides|returns|reads|library)/,
    );
  });
});
