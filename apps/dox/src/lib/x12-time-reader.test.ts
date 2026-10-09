/// <reference types="vitest/globals" />
/**
 * `x12-time-reader.ts`'s pure helpers, against the real gmt modules. Every
 * expected library result is a JSDoc example of the function that returns it.
 */
import { lib } from "~/test/edi-lib";
import {
  CUSTOM_PRESET_ID,
  DTP_MEMBER_ROWS,
  DTP_PRESETS,
  MEMBER_ROWS,
  X12_PRESETS,
  dtpBlank,
  dtpFigure,
  dtpMemberText,
  dtpPresetState,
  dtpSentinelText,
  dtpWriteBack,
  elementFigure,
  gapRows,
  instantPlan,
  isSeeded,
  mainBlank,
  matchDtpPreset,
  matchPreset,
  memberText,
  ok,
  permalinkOf,
  presetState,
  readArgs,
  readDtp,
  readX12,
  sentinelText,
  stripApplies,
  stripNote,
  verdictOf,
  writeDate,
  writeTime,
  x12Texts,
  type X12State,
} from "./x12-time-reader";

const preset = (id: string) => X12_PRESETS.find((p) => p.id === id)!;
const state = (date: string, time: string, timeCode: string): X12State => ({
  date,
  time,
  timeCode,
  zones: ["", "", "", ""],
});
const readOf = (id: string) => readX12(presetState(preset(id)), lib);

describe("the main presets, against the real library", () => {
  const EXPECTED: Record<
    string,
    { house: string; verdict: string; instant: string }
  > = {
    "status-et": {
      house: "2024-06-15T14:30:00",
      verdict: "Offset: not stated",
      instant: "",
    },
    "status-ed": {
      house: "2024-06-15T14:30:00",
      verdict: "Offset: not stated",
      instant: "",
    },
    "status-es": {
      house: "2024-01-15T14:30:00",
      verdict: "Offset: not stated",
      instant: "",
    },
    "status-ut": {
      house: "2024-06-15T14:30:00",
      verdict: "Offset: stated (+00:00)",
      instant: "2024-06-15T14:30:00Z",
    },
    "code-13": {
      house: "2024-06-15T14:30:00",
      verdict: "Offset: stated (-12:00)",
      instant: "2024-06-16T02:30:00Z",
    },
    "code-24": {
      house: "2024-06-15T14:30:00",
      verdict: "Offset: stated (-01:00)",
      instant: "2024-06-15T15:30:00Z",
    },
    hundredths: {
      house: "2024-06-15T14:30:00.12",
      verdict: "Offset: not stated",
      instant: "",
    },
    "no-code": {
      house: "2024-06-15T14:30:00",
      verdict: "Offset: not stated",
      instant: "",
    },
    "local-lt": {
      house: "2024-06-15T14:30:00",
      verdict: "Offset: not stated",
      instant: "",
    },
    "date-only": {
      house: "2024-06-15",
      verdict: "Offset: not stated",
      instant: "",
    },
    "time-only": {
      house: "14:30:00",
      verdict: "Offset: not stated",
      instant: "",
    },
  };

  it("names every preset in the expectations", () => {
    expect(X12_PRESETS.map((p) => p.id).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it.each(X12_PRESETS.map((p) => [p.id]))("%s returns a value", (id) => {
    const r = readOf(id!);
    const e = EXPECTED[id!]!;
    expect(ok(r)).toBe(true);
    expect(r.house).toBe(e.house);
    expect(verdictOf(r).verdict).toBe(e.verdict);
    expect(r.instant).toBe(e.instant);
  });

  it("carries example zones exactly on the presets whose result states no offset and has a date-time", () => {
    for (const p of X12_PRESETS) {
      const r = readX12(presetState(p), lib);
      expect(
        p.zones.some((z) => z !== ""),
        p.id,
      ).toBe(stripApplies(r));
    }
  });

  it("matches a preset by its fields and falls back to custom", () => {
    expect(matchPreset(presetState(preset("status-et")))).toBe("status-et");
    expect(matchPreset(state("20240615", "1430", "XX"))).toBe(CUSTOM_PRESET_ID);
  });
});

describe("the calls the main section makes", () => {
  it("reads a date and a time with parseX12DateAndTime, then classifies and asks the code", () => {
    const r = readOf("status-et");
    expect(r.calls.map((c) => [c.fn, ...c.args])).toEqual([
      ["parseX12DateAndTime", "20240615", "1430"],
      ["classifyX12TimeCode", "ET"],
      ["x12TimeCodeZone", "ET"],
    ]);
    expect(r.calls.map((c) => c.result)).toEqual([
      "2024-06-15T14:30:00",
      { kind: "zone", timeCode: "ET" },
      { zone: "Eastern", daylight: null },
    ]);
  });

  it("asks x12TimeCodeOffset for an offset code and resolves the instant with resolveLocal", () => {
    const r = readX12(state("20240615", "1430", "20"), lib);
    expect(r.calls.map((c) => c.fn)).toEqual([
      "parseX12DateAndTime",
      "classifyX12TimeCode",
      "x12TimeCodeOffset",
    ]);
    expect(r.offset).toBe("-05:00");
    expect(r.resolve?.fn).toBe("resolveLocal");
    expect(r.resolve?.args).toEqual(["2024-06-15T14:30:00", "-05:00"]);
    expect(r.instant).toBe("2024-06-15T19:30:00Z");
  });

  it("reads a date alone with parseX12Date and D8, and a time alone with parseX12Time", () => {
    expect(readX12(state("20240615", "", ""), lib).main).toMatchObject({
      fn: "parseX12Date",
      args: ["20240615", "D8"],
    });
    expect(readX12(state("", "143045", ""), lib).main).toMatchObject({
      fn: "parseX12Time",
      args: ["143045"],
      result: "14:30:45",
    });
  });

  it("makes no call for a blank form", () => {
    const r = readX12(state("", "", ""), lib);
    expect(mainBlank(state(" ", "", " "))).toBe(true);
    expect(r.calls).toEqual([]);
  });

  it("holds the instant of a code that states no offset for the reader's zones", () => {
    const r = readOf("status-et");
    expect(r.instant).toBe("");
    expect(instantPlan(r, preset("status-et").zones).kind).toBe("resolve");
    expect(instantPlan(r, ["", "", "", ""]).note).toContain("Eastern");
    expect(instantPlan(readOf("status-ut"), ["", "", "", ""]).kind).toBe(
      "stated",
    );
  });
});

describe("the members and the verdict", () => {
  it("holds a flag as its meaning, never a raw null", () => {
    const text = (id: string) => memberText(readOf(id), "daylight");
    expect(text("status-et")).toBe("not said");
    expect(text("status-ed")).toBe("daylight");
    expect(text("status-es")).toBe("standard");
    expect(text("status-ut")).toBeNull();
    for (const p of X12_PRESETS) {
      for (const row of MEMBER_ROWS) {
        expect(
          memberText(readX12(presetState(p), lib), row.key),
          p.id,
        ).not.toBe("null");
      }
    }
  });

  it("names the zone a code names and the kind of code", () => {
    const r = readOf("status-ed");
    expect(memberText(r, "zone")).toBe("Eastern");
    expect(memberText(r, "code")).toBe("names a zone");
    expect(memberText(readOf("code-13"), "code")).toBe("states an offset");
    expect(memberText(readOf("code-13"), "offset")).toBe("-12:00");
  });

  it("says the elements of a local code state no offset and that the place is elsewhere", () => {
    expect(verdictOf(readOf("local-lt")).detail).toContain(
      "local to the event",
    );
    expect(verdictOf(readOf("no-code")).detail).toContain("blank time code");
  });

  it("states a time alone names no instant", () => {
    expect(verdictOf(readOf("time-only")).detail).toContain("on no day");
    expect(stripNote(readOf("time-only"))).toContain("alone names no instant");
  });
});

describe("the sentinel and its sentence", () => {
  const why = (s: X12State) => sentinelText(readX12(s, lib), lib);

  it("names a date, a time and a code that are not those elements", () => {
    expect(why(state("240615", "1430", ""))).toContain("CCYYMMDD");
    expect(why(state("20240615", "14:30", ""))).toContain("HHMMSSDD");
    expect(why(state("20240615", "1430", "XX"))).toContain(
      "XX is not a 623 time code",
    );
  });

  it("says a time code with no time needs the time, and the library says so", () => {
    const r = readX12(state("20240615", "", "ET"), lib);
    expect(r.main?.fn).toBe("parseX12DateAndTime");
    expect(r.main?.result).toBe("");
    expect(ok(r)).toBe(false);
    expect(sentinelText(r, lib)).toContain("qualifies a time");
  });

  it("refuses a two-digit-year date without a pattern hint it cannot give", () => {
    expect(ok(readX12(state("240615", "1430", ""), lib))).toBe(false);
  });
});

describe("the strip", () => {
  it("resolves a local date-time in each zone the example names", () => {
    const r = readOf("status-et");
    const rows = gapRows(r.house!, preset("status-et").zones, lib);
    expect(rows[0]).toMatchObject({
      zone: "America/New_York",
      instant: "2024-06-15T18:30:00Z",
      offset: "-04:00",
    });
    expect(rows[1]).toMatchObject({
      zone: "America/Atikokan",
      instant: "2024-06-15T19:30:00Z",
      offset: "-05:00",
    });
  });

  it("carries a reason for a time the clock skips", () => {
    const rows = gapRows("2024-03-10T02:30:00", ["America/New_York"], lib);
    expect(rows[0]!.instant).toBe("");
    expect(rows[0]!.reason).toContain("never happens");
  });

  it("does not apply when the code states the offset or only one element is sent", () => {
    expect(stripApplies(readOf("status-ut"))).toBe(false);
    expect(stripApplies(readOf("date-only"))).toBe(false);
    expect(stripApplies(null)).toBe(false);
  });
});

describe("writing back", () => {
  it("writes the date with D8 from parseX12Date's result", () => {
    const w = writeDate(readOf("status-et"), lib)!;
    expect(w.call.fn).toBe("formatX12Date");
    expect(w.call.args).toEqual(["2024-06-15", "D8"]);
    expect(w.output).toBe("20240615");
  });

  it("writes the time in the form it was sent: four digits as HHMM, six as HHMMSS", () => {
    expect(writeTime(readOf("status-et"), lib)!.call.fn).toBe(
      "formatX12TimeElement",
    );
    expect(writeTime(readOf("status-et"), lib)!.call.args).toEqual([
      "14:30:00",
      "HHMM",
    ]);
    expect(writeTime(readOf("status-et"), lib)!.output).toBe("1430");
    const ts = writeTime(readX12(state("20240615", "143045", ""), lib), lib)!;
    expect(ts.call.args).toEqual(["14:30:45", "HHMMSS"]);
    expect(ts.output).toBe("143045");
  });

  it("writes hundredths back as HHMMSSDD, with nothing cut", () => {
    const w = writeTime(readOf("hundredths"), lib)!;
    expect(w.call.args).toEqual(["14:30:00.12", "HHMMSSDD"]);
    expect(w.output).toBe("14300012");
    expect(w.note).not.toContain("cut");
  });

  it("writes tenths back as HHMMSSD", () => {
    const w = writeTime(readX12(state("20240615", "1430001", ""), lib), lib)!;
    expect(w.call.args).toEqual(["14:30:00.1", "HHMMSSD"]);
    expect(w.output).toBe("1430001");
  });

  it("has nothing to write for an element that was not read", () => {
    expect(writeDate(readOf("time-only"), lib)).toBeNull();
    expect(writeTime(readOf("date-only"), lib)).toBeNull();
  });
});

describe("the picture of the three elements", () => {
  it("cuts the date, the time and the code, with what the code calls returned", () => {
    const s = presetState(preset("status-et"));
    const fig = elementFigure(s, readX12(s, lib));
    expect(fig.halves.map((h) => h.label)).toEqual(["373", "337", "623"]);
    expect(fig.notes[0]).toBe(
      'x12TimeCodeZone("ET") returned zone Eastern, daylight not said.',
    );
  });

  it("cuts a time with hundredths into its fields", () => {
    const s = presetState(preset("hundredths"));
    const fig = elementFigure(s, readX12(s, lib));
    expect(fig.halves[1]!.fields.map((f) => f.mask)).toEqual([
      "HH",
      "MM",
      "SS",
      "DD",
    ]);
    expect(fig.notes.join(" ")).toContain("hundredths");
  });

  it("draws every element neutral when the read is refused", () => {
    const s = state("20240615", "1430", "XX");
    const fig = elementFigure(s, readX12(s, lib));
    for (const h of fig.halves) {
      for (const f of h.fields) expect(["neutral"]).toContain(f.group);
    }
    expect(fig.notes[0]).toContain("does not know it");
  });
});

describe("the DTP presets, against the real library", () => {
  it("returns a value for every preset but the two-digit-year one", () => {
    for (const p of DTP_PRESETS) {
      const r = readDtp(dtpPresetState(p), lib);
      expect(r.house === null, p.id).toBe(p.id === "d6-two-digit");
    }
  });

  it("classifies the qualifier, then calls the parser of its kind", () => {
    const r = readDtp({ format: "RD8", value: "20240615-20240620" }, lib);
    expect(r.calls.map((c) => [c.fn, ...c.args])).toEqual([
      ["classifyX12DateTimePeriodFormat", "RD8"],
      ["parseX12DateRange", "20240615-20240620", "RD8"],
    ]);
    expect(r.house).toEqual({ start: "2024-06-15", end: "2024-06-20" });
    expect(dtpMemberText(r, "rangeEnd")).toBe("2024-06-20");
    expect(dtpMemberText(r, "kind")).toBe("date range");
  });

  it("reads a time with parseX12Time and the other orders by the qualifier", () => {
    const t = readDtp({ format: "TM", value: "1430" }, lib);
    expect(t.parse).toMatchObject({ fn: "parseX12Time", args: ["1430", "TM"] });
    expect(readDtp({ format: "TM", value: "143045" }, lib).house).toBeNull();
    expect(readDtp({ format: "TS", value: "143045" }, lib).house).toBe(
      "14:30:45",
    );
    expect(t.house).toBe("14:30:00");
    expect(readDtp({ format: "DB", value: "06152024" }, lib).house).toBe(
      "2024-06-15",
    );
  });

  it("writes a range back with the start and the end as two arguments", () => {
    const w = dtpWriteBack(readDtp(dtpPresetState(DTP_PRESETS[1]!), lib), lib)!;
    expect(w.call.fn).toBe("formatX12DateTimeRange");
    expect(w.call.args).toEqual([
      "2024-06-15T14:30:00",
      "2024-06-20T16:00:00",
      "DTS",
    ]);
    expect(w.output).toBe("20240615143000-20240620160000");
  });

  it("points a two-digit-year qualifier at the pattern parsers", () => {
    const r = readDtp({ format: "D6", value: "240615" }, lib);
    expect(r.classified).toBeNull();
    expect(r.parse).toBeNull();
    const text = dtpSentinelText(r);
    expect(text).toContain("yyMMdd");
    expect(text).toContain("yearWindow");
  });

  it("says a code the library does not read is not read", () => {
    expect(
      dtpSentinelText(readDtp({ format: "RTM", value: "2200-0600" }, lib)),
    ).toContain("RTM is not a qualifier the library reads");
    expect(
      dtpSentinelText(readDtp({ format: "TC", value: "166" }, lib)),
    ).not.toContain("yearWindow");
  });

  it("names a value that does not fit, a missing value and a missing qualifier", () => {
    expect(
      dtpSentinelText(readDtp({ format: "RD8", value: "20240615" }, lib)),
    ).toContain("does not fit");
    expect(
      dtpSentinelText(readDtp({ format: "RD8", value: "" }, lib)),
    ).toContain("Type an element 1251");
    expect(dtpSentinelText(readDtp({ format: "", value: "1" }, lib))).toContain(
      "Type the 1250",
    );
  });

  it("is blank only when nothing is typed, and matches a preset by its fields", () => {
    expect(dtpBlank({ format: "", value: " " })).toBe(true);
    expect(dtpBlank({ format: "D8", value: "" })).toBe(false);
    expect(matchDtpPreset(dtpPresetState(DTP_PRESETS[0]!))).toBe(
      DTP_PRESETS[0]!.id,
    );
    expect(matchDtpPreset({ format: "RD8", value: "x" })).toBe(
      CUSTOM_PRESET_ID,
    );
  });

  it("cuts a range along the layout its formatter writes, hyphen included", () => {
    const r = readDtp({ format: "RD8", value: "20240615-20240620" }, lib);
    const fig = dtpFigure(r, lib);
    expect(fig.separator).toBe("-");
    expect(fig.halves.map((h) => h.label)).toEqual(["start", "end"]);
    expect(fig.closing).toBe("no offset");
    const db = dtpFigure(
      readDtp({ format: "DB", value: "06152024" }, lib),
      lib,
    );
    expect(db.halves[0]!.fields.map((f) => f.mask)).toEqual([
      "MM",
      "DD",
      "CCYY",
    ]);
  });

  it("holds a member row for each of kind, value and range end", () => {
    expect(DTP_MEMBER_ROWS.map((r) => r.key)).toEqual([
      "kind",
      "value",
      "rangeEnd",
    ]);
  });
});

describe("args and permalinks", () => {
  it("is seeded by any of the elements or the DTP pair", () => {
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ date: "20240615" })).toBe(true);
    expect(isSeeded({ value: "x" })).toBe(true);
  });

  it("ignores a yearWindow an old link still carries", () => {
    const old = { format: "D6", value: "240615", yearWindow: "2000" } as never;
    expect(readArgs(old).dtp).toEqual({ format: "D6", value: "240615" });
    expect(permalinkOf(readArgs(old).main, readArgs(old).dtp)).toEqual({
      format: "D6",
      value: "240615",
    });
  });

  it("leaves absent keys blank with no preset fallback", () => {
    expect(readArgs({ date: "20240615" }).main).toEqual({
      date: "20240615",
      time: "",
      timeCode: "",
      zones: ["", "", "", ""],
    });
  });
});

describe("naming and the site's lists", () => {
  it("names no regulator, statute, agency, docket or business event", () => {
    const all = JSON.stringify([x12Texts(), X12_PRESETS, DTP_PRESETS]);
    expect(all).not.toMatch(
      /\b(customs|statute|regulation|docket|agency|FMC|FMCSA|CBP|demurrage|detention)\b/i,
    );
  });

  it("maps no time code, zone name or place to a zone", () => {
    for (const p of X12_PRESETS) {
      const code = p.timeCode;
      const typed = readArgs({ date: p.date, time: p.time, timeCode: code });
      expect(typed.main.zones).toEqual(["", "", "", ""]);
    }
  });
});
