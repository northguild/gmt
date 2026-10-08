/// <reference types="vitest/globals" />
/**
 * `dtm-decoder.ts`'s pure helpers, against the real gmt modules. Every expected
 * library result is an appendix Z row (INT-15, D*) or a JSDoc example.
 */
import { parseEdifactDtm } from "@northguild/gmt/intermodal/parse";
import { lib } from "~/test/edi-lib";
import {
  CUSTOM_PRESET_ID,
  DTM_PRESETS,
  MEMBER_ROWS,
  NULL_REASON_TEXT,
  detailText,
  dtmBlank,
  effective,
  explainNull,
  gapRows,
  matchPreset,
  memberText,
  nullReasonText,
  offsetVerdict,
  permalinkOf,
  presetState,
  readArgs,
  splitDtm,
  splitText,
  stripApplies,
  stripNote,
  verdictText,
  windowOffNote,
  writeBack,
  type DtmNullReason,
  type DtmState,
} from "./dtm-decoder";

const preset = (id: string) => DTM_PRESETS.find((p) => p.id === id)!;
const stateOf = (id: string, over: Partial<DtmState> = {}): DtmState => ({
  ...presetState(preset(id)),
  ...over,
});
const value = (input: string, format: string, yearWindow = ""): DtmState => ({
  input,
  format,
  yearWindow,
  zones: ["", "", "", ""],
});
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
      yearWindow: "",
      zones: ["", "", "", ""],
    });
  });

  it("turns a numeric yearWindow into its text", () => {
    expect(
      readArgs({ input: "240615", format: "101", yearWindow: 2000 }).yearWindow,
    ).toBe("2000");
    expect(readArgs({ input: "x", yearWindow: "rolling" }).yearWindow).toBe(
      "rolling",
    );
  });

  it("reads the four zones", () => {
    expect(
      readArgs({ input: "x", zone1: "A", zone2: "B", zone3: "C", zone4: "D" })
        .zones,
    ).toEqual(["A", "B", "C", "D"]);
  });
});

describe("matchPreset", () => {
  it.each(DTM_PRESETS.map((p) => [p.id]))("matches %s", (id) => {
    expect(matchPreset(presetState(preset(id!)))).toBe(id);
  });

  it("gives local-203 and cet-303 the example's zones and every offset-stating preset none", () => {
    const four = [
      "America/New_York",
      "Europe/Berlin",
      "Asia/Shanghai",
      "America/Los_Angeles",
    ];
    expect(preset("local-203").zones).toEqual(four);
    expect(preset("cet-303").zones).toEqual(four);
    for (const p of DTM_PRESETS) {
      if (p.id === "local-203" || p.id === "cet-303") continue;
      expect(p.zones, p.id).toEqual(["", "", "", ""]);
    }
  });

  it("is custom when any field differs, and ignores surrounding blanks", () => {
    expect(matchPreset(stateOf("local-203", { zones: ["", "", "", ""] }))).toBe(
      CUSTOM_PRESET_ID,
    );
    expect(matchPreset(stateOf("period-718", { input: " 2024061520240620 " }))).toBe(
      "period-718",
    );
    expect(matchPreset(value("", ""))).toBe(CUSTOM_PRESET_ID);
  });

  it("gives every preset a distinct state", () => {
    const keys = DTM_PRESETS.map((p) => JSON.stringify(presetState(p)));
    expect(new Set(keys).size).toBe(DTM_PRESETS.length);
  });
});

describe("permalinkOf", () => {
  it("holds strings only, and only non-blank fields", () => {
    expect(permalinkOf(stateOf("local-203"))).toEqual({
      input: "DTM+137:202406151430:203'",
      zone1: "America/New_York",
      zone2: "Europe/Berlin",
      zone3: "Asia/Shanghai",
      zone4: "America/Los_Angeles",
    });
    expect(permalinkOf(stateOf("two-digit-window"))).toEqual({
      input: "240615",
      format: "101",
      yearWindow: "2000",
    });
  });

  it("leaves the format out in segment form", () => {
    expect(permalinkOf(value("DTM+137:202406151430:203'", "999"))).toEqual({
      input: "DTM+137:202406151430:203'",
    });
  });

  it("is empty for a blank state", () => {
    expect(permalinkOf(value("", ""))).toEqual({});
  });
});

describe("offsetVerdict, verdictText and detailText", () => {
  const cases: [string, string, string, string, string][] = [
    // [row, value, format, verdict, detail]
    ["D1", "202406151430", "203", "Offset: not stated", "A local time at a place the value does not name. It is not UTC."],
    ["D2", "202406151430+00", "303", "Offset: stated (+00:00)", "The value names one instant."],
    ["D4", "202406151430CET", "303", 'Offset: not stated. "CET" is zone text, not an offset.', "No UN/EDIFACT text defines these three characters, so the library returns them unread."],
    ["D6", "2024061520240620", "718", "Offset: not stated", "A period: a start and an end. The code states no offset, so neither end names an instant."],
    ["D13", "143045+02", "404", "Offset: stated (+02:00)", "A time and an offset, but no date, so no instant."],
    ["D14", "+0200", "406", "Offset: stated (+02:00)", "The value is an offset and nothing else."],
    ["D15", "20240615", "102", "Offset: not stated", "A date. A date alone names no instant in any zone."],
    ["D-time", "1430", "401", "Offset: not stated", "A time of day with no date and no offset."],
  ];
  it.each(cases)("%s", (_row, v, f, verdict, detail) => {
    const result = parseEdifactDtm(v, f)!;
    expect(result).not.toBeNull();
    expect(verdictText(result)).toBe(verdict);
    expect(detailText(result)).toBe(detail);
  });

  it("names the three verdicts", () => {
    expect(offsetVerdict({ instant: "x", offset: "+00:00" })).toBe("stated");
    expect(offsetVerdict({ local: "x", zone: "CET" })).toBe("zone-text");
    expect(offsetVerdict({ local: "x" })).toBe("not-stated");
    expect(offsetVerdict({ time: "14:30:00" })).toBe("not-stated");
  });

  it("detail is blank for an empty result", () => {
    expect(detailText({})).toBe("");
  });
});

describe("memberText and MEMBER_ROWS", () => {
  it("lists seven rows with their roles", () => {
    expect(MEMBER_ROWS.map((r) => r.role)).toEqual([
      "member-date",
      "member-time",
      "member-local",
      "member-instant",
      "member-offset",
      "member-zone",
      "member-period-end",
    ]);
    expect(MEMBER_ROWS.map((r) => r.label)).toEqual([
      "Date",
      "Time",
      "Local date-time",
      "Instant",
      "Offset",
      "Zone text",
      "Period end",
    ]);
  });

  it("reads the member, or null when the result does not hold it", () => {
    const d1 = parseEdifactDtm("202406151430", "203")!;
    expect(memberText(d1, "local")).toBe("2024-06-15T14:30:00");
    expect(memberText(d1, "instant")).toBeNull();
    const d6 = parseEdifactDtm("2024061520240620", "718")!;
    expect(memberText(d6, "date")).toBe("2024-06-15");
    expect(memberText(d6, "periodEnd")).toBe("2024-06-20");
    const d12 = parseEdifactDtm("202406151430202406201600", "719")!;
    expect(memberText(d12, "periodEnd")).toBe("2024-06-20T16:00:00");
    expect(memberText(parseEdifactDtm("202406151430CET", "303")!, "zone")).toBe(
      "CET",
    );
  });
});

describe("stripApplies and stripNote", () => {
  it("applies to a local time with no instant and no period", () => {
    expect(stripApplies(parseEdifactDtm("202406151430", "203"))).toBe(true);
    expect(stripApplies(parseEdifactDtm("202406151430CET", "303"))).toBe(true);
    expect(stripApplies(parseEdifactDtm("202406151430+00", "303"))).toBe(false);
    expect(stripApplies(parseEdifactDtm("2024061520240620", "718"))).toBe(false);
    expect(
      stripApplies(parseEdifactDtm("202406151430202406201600", "719")),
    ).toBe(false);
    expect(stripApplies(null)).toBe(false);
  });

  it("says why it does not", () => {
    expect(stripNote(null)).toBe("No value.");
    expect(stripNote(parseEdifactDtm("202406151430+00", "303"))).toBe(
      "The value states its offset, so there is nothing to choose.",
    );
    expect(stripNote(parseEdifactDtm("20240615", "102"))).toBe(
      "A date or a time alone names no instant in any zone.",
    );
    expect(
      stripNote(parseEdifactDtm("202406151430202406201600", "719")),
    ).toBe("A period: each end is a local time. Resolve each with resolveLocal.");
    expect(stripNote(parseEdifactDtm("202406151430", "203"))).toContain(
      'disambiguation: "reject"',
    );
  });

  it("gives an offset alone its own sentence, not the date-or-time one", () => {
    const offsetAlone = parseEdifactDtm("+0200", "406");
    expect(offsetAlone).toEqual({ offset: "+02:00" });
    expect(stripApplies(offsetAlone)).toBe(false);
    expect(stripNote(offsetAlone)).toBe(
      "An offset alone names no instant: it needs a date and a time.",
    );
    expect(stripNote(offsetAlone)).not.toContain("A date or a time");
    // A time of day alone still reads as before.
    expect(stripNote(parseEdifactDtm("1430", "401"))).toBe(
      "A date or a time alone names no instant in any zone.",
    );
  });
});

describe("dtmBlank", () => {
  it("is true only when neither the input nor the format has a character", () => {
    expect(dtmBlank(value("", ""))).toBe(true);
    expect(dtmBlank(value("  ", " "))).toBe(true);
    expect(dtmBlank(value("", "203"))).toBe(false);
    expect(dtmBlank(value("202406151430", ""))).toBe(false);
    expect(dtmBlank(value("DTM+", ""))).toBe(false);
  });

  it("ignores zones and the year window, which are not the value", () => {
    expect(
      dtmBlank({ ...value("", ""), yearWindow: "rolling", zones: ["Europe/Berlin", "", "", ""] }),
    ).toBe(true);
  });
});

describe("gapRows", () => {
  const L = "2024-06-15T14:30:00";
  const zones = ["America/New_York", "Europe/Berlin", "Asia/Shanghai", "America/Los_Angeles"];

  it("reads the local time in each zone (D1a to D1d)", () => {
    const rows = gapRows(L, zones, lib);
    expect(rows.map((r) => [r.zone, r.instant, r.offset, r.as205])).toEqual([
      ["America/New_York", "2024-06-15T18:30:00Z", "-04:00", "202406151430-0400"],
      ["Europe/Berlin", "2024-06-15T12:30:00Z", "+02:00", "202406151430+0200"],
      ["Asia/Shanghai", "2024-06-15T06:30:00Z", "+08:00", "202406151430+0800"],
      ["America/Los_Angeles", "2024-06-15T21:30:00Z", "-07:00", "202406151430-0700"],
    ]);
    expect(rows.every((r) => r.reason === "")).toBe(true);
  });

  it("leaves a blank slot as just a blank zone", () => {
    const rows = gapRows(L, ["", "Europe/Berlin", " ", ""], lib);
    expect(rows[0]).toEqual({ zone: "", instant: "", offset: "", as205: "", reason: "" });
    expect(rows[1]!.instant).toBe("2024-06-15T12:30:00Z");
  });

  it("gives a reason for a time the clock shows twice (D16)", () => {
    const [row] = gapRows("2024-11-03T01:30:00", ["America/New_York"], lib);
    expect(row!.instant).toBe("");
    expect(row!.reason).toContain("happens twice in America/New_York");
  });

  it("changes the Kolkata row (D-kolkata)", () => {
    const rows = gapRows(L, ["Asia/Kolkata"], lib);
    expect(rows[0]!.instant).toBe("2024-06-15T09:00:00Z");
  });
});

describe("explainNull", () => {
  const cases: [DtmNullReason, DtmState][] = [
    ["blank-value", value("", "203")],
    ["no-format", value("202406151430", "")],
    ["no-format", value("DTM+137:202406151430'", "")],
    ["unsupported-format", value("2024", "602")],
    ["needs-year-window", stateOf("two-digit-no-window")],
    ["bad-year-window", value("240615", "101", "9901")],
    ["released-character", value("202406151430?+02", "303")],
    ["bad-value", value("not a date", "203")],
    ["bad-value", value("2024062020240615", "718")],
  ];
  it.each(cases)("%s", (reason, state) => {
    const e = effective(state);
    const options =
      state.yearWindow === "9901"
        ? { yearWindow: 9901 }
        : state.yearWindow === ""
          ? undefined
          : { yearWindow: Number(state.yearWindow) };
    expect(parseEdifactDtm(e.value, e.format, options)).toBeNull();
    expect(explainNull(state, lib)).toBe(reason);
  });

  it("writes a text for every reason, naming no body", () => {
    const context = { format: "602", form: "value" as const };
    for (const [reason, text] of Object.entries(NULL_REASON_TEXT)) {
      const line = text(context);
      expect(line.length, reason).toBeGreaterThan(10);
      expect(line, reason).not.toMatch(/\b(CFR|statut|regulat|docket|agency|customs)\b/i);
    }
    expect(NULL_REASON_TEXT["no-format"]({ format: "", form: "segment" })).toContain(
      "The segment carries none.",
    );
    expect(NULL_REASON_TEXT["no-format"]({ format: "", form: "value" })).toContain(
      "Type the code.",
    );
    expect(nullReasonText("unsupported-format", value("2024", "602"))).toContain(
      "602 is not a format code the library reads",
    );
  });
});

describe("windowOffNote and splitText", () => {
  it("says a four-digit-year code does not read the window", () => {
    expect(windowOffNote(stateOf("local-203"), lib)).toBe(
      "Code 203 carries a four-digit year. The window is not read.",
    );
    expect(windowOffNote(stateOf("two-digit-window"), lib)).toBe("");
    expect(windowOffNote(value("x", ""), lib)).toBe("");
    expect(windowOffNote(value("x", "602"), lib)).toBe("");
  });

  it("describes how the input was read", () => {
    expect(splitText(stateOf("local-203"))).toBe(
      "Read as a segment: function qualifier 137, shown as sent and not interpreted; value 202406151430; format code 203.",
    );
    expect(splitText(stateOf("period-718"))).toBe("Read as a bare value.");
    expect(splitText(value("DTM+137:202406151430:203:x'", ""))).toContain(
      "Text after the first composite is not read.",
    );
  });
});

describe("writeBack", () => {
  const wb = (id: string) => {
    const s = stateOf(id);
    const e = effective(s);
    const result = parseEdifactDtm(
      e.value,
      e.format,
      s.yearWindow === "2000" ? { yearWindow: 2000 } : undefined,
    );
    return writeBack(s, result, lib);
  };

  it("writes each preset back", () => {
    expect(wb("local-203")).toMatchObject({
      iso: "2024-06-15T14:30:00",
      args: ["2024-06-15T14:30:00", "203"],
      output: "202406151430",
    });
    expect(wb("released-303")).toMatchObject({
      iso: "2024-06-15T14:30:00+00:00",
      args: ["2024-06-15T14:30:00+00:00", "303"],
      output: "202406151430+00",
    });
    expect(wb("utc-303")!.output).toBe("202406151430+00");
    expect(wb("offset-205")).toMatchObject({
      iso: "2024-06-15T14:30:00+02:00",
      output: "202406151430+0200",
    });
    expect(wb("period-718")).toMatchObject({
      iso: "2024-06-15/2024-06-20",
      output: "2024061520240620",
    });
    expect(wb("two-digit-window")).toMatchObject({
      iso: "2024-06-15",
      args: ["2024-06-15", "101", { yearWindow: 2000 }],
      output: "240615",
    });
  });

  it("returns a sentinel with the zone-text note (D4w)", () => {
    const w = wb("cet-303")!;
    expect(w.output).toBe("");
    expect(w.note).toContain(
      "A zone text has no offset to write. Resolve the local time in a zone first, then write it with its offset.",
    );
  });

  it("has nothing to write without a result", () => {
    expect(wb("two-digit-no-window")).toBeNull();
  });

  it("explains the notes it adds", () => {
    expect(wb("utc-303")!.note).toContain("never as UTC or GMT");
    expect(wb("gmt-303")!.note).toContain("never as UTC or GMT");
    expect(wb("period-718")!.note).toContain("without a hyphen");
    expect(wb("released-303")!.note).toContain("+ is sent as ?+");
    expect(wb("local-203")!.note).toBe("");
  });

  it("does not pass a window to a four-digit-year code", () => {
    const s = stateOf("local-203", { yearWindow: "2000" });
    const w = writeBack(s, parseEdifactDtm("202406151430", "203"), lib)!;
    expect(w.args).toEqual(["2024-06-15T14:30:00", "203"]);
  });
});
