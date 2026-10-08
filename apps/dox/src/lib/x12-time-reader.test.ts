/// <reference types="vitest/globals" />
/**
 * `x12-time-reader.ts`'s pure helpers, against the real gmt modules. Every
 * expected library result is a JSDoc example of the function called, or was
 * derived by running the call against `packages/gmt/dist`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseX12DateTime,
  parseX12DateTimePeriod,
} from "@northguild/gmt/intermodal/parse";
import { lib } from "~/test/edi-lib";
import {
  CUSTOM_PRESET_ID,
  DTP_NULL_REASON_TEXT,
  DTP_PRESETS,
  NULL_REASON_TEXT,
  X12_PRESETS,
  dtpBlank,
  dtpMemberText,
  dtpPresetState,
  dtpWriteBack,
  explainDtpNull,
  explainNull,
  gapRows,
  instantPlan,
  isSeeded,
  mainBlank,
  matchDtpPreset,
  matchPreset,
  memberText,
  nothingToWriteNote,
  parseArgs,
  permalinkOf,
  presetState,
  readArgs,
  stripApplies,
  stripNote,
  verdictOf,
  writeDate,
  writeTime,
  type DtpState,
  type X12State,
} from "./x12-time-reader";

const preset = (id: string) => X12_PRESETS.find((p) => p.id === id)!;
const stateOf = (id: string, over: Partial<X12State> = {}): X12State => ({
  ...presetState(preset(id)),
  ...over,
});
const parse = (state: X12State) =>
  parseX12DateTime(...(parseArgs(state) as [string?, string?, string?])) as
    | Parameters<typeof verdictOf>[0];
const dtp = (format: string, value: string, yearWindow = ""): DtpState => ({
  format,
  value,
  yearWindow,
});

describe("parseArgs", () => {
  it("leaves out trailing blank elements and keeps a blank before a sent one", () => {
    expect(parseArgs(stateOf("status-et"))).toEqual(["20240615", "1430", "ET"]);
    expect(parseArgs(stateOf("no-code"))).toEqual(["20240615", "1430"]);
    expect(parseArgs(stateOf("date-only"))).toEqual(["20240615"]);
    expect(parseArgs(stateOf("time-only"))).toEqual(["", "1430"]);
    expect(parseArgs(stateOf("code-no-time"))).toEqual([
      "20240615",
      "",
      "ET",
    ]);
    expect(parseArgs({ ...stateOf("date-only"), date: "  " })).toEqual([]);
  });

  it("reports a blank main section", () => {
    expect(mainBlank({ date: "", time: " ", timeCode: "", zones: ["", "", "", ""] })).toBe(true);
    expect(mainBlank(stateOf("time-only"))).toBe(false);
  });
});

describe("presets", () => {
  // A preset is an example and states its own zones; the strip applies exactly
  // when the result states no offset, and only those presets carry zones.
  it("carry zones exactly where the result states no offset", () => {
    for (const p of X12_PRESETS) {
      const applies = stripApplies(parse(presetState(p)));
      const zones = presetState(p).zones;
      if (applies) {
        expect(zones[0], p.id).not.toBe("");
      } else {
        expect(zones, p.id).toEqual(["", "", "", ""]);
      }
    }
  });

  it("gives every zone a real, distinct zone with no gap before it", () => {
    for (const p of X12_PRESETS) {
      const named = p.zones.filter((z) => z !== "");
      expect(p.zones.slice(0, named.length), p.id).toEqual(named);
      expect(new Set(named).size, p.id).toBe(named.length);
      for (const z of named) expect(lib.isValidTimeZone(z), z).toBe(true);
    }
  });

  it("makes the date agree with the daylight flag of ED and ES", () => {
    for (const [id, daylight, offset] of [
      ["status-ed", true, "-04:00"],
      ["status-es", false, "-05:00"],
    ] as const) {
      const state = presetState(preset(id));
      expect(parse(state)).toMatchObject({ zone: "Eastern", daylight });
      const rows = gapRows(parse(state)!.local!, state.zones, lib);
      expect(rows[0]!.zone, id).toBe("America/New_York");
      expect(rows[0]!.offset, id).toBe(offset);
    }
  });

  it("reads ET in two zones whose clocks differ on that date", () => {
    const state = presetState(preset("status-et"));
    expect(state.zones).toEqual(["America/New_York", "America/Atikokan", "", ""]);
    const [a, b] = gapRows(parse(state)!.local!, state.zones, lib);
    expect([a!.offset, b!.offset]).toEqual(["-04:00", "-05:00"]);
    expect(lib.diffUtcAsDuration(a!.instant, b!.instant, "hours")).toBe("PT1H");
  });

  it("never states a zone for a code the reader types: a custom state keeps its blank zones", () => {
    const typed = { ...presetState(preset("status-et")), zones: ["", "", "", ""] as X12State["zones"] };
    expect(matchPreset(typed)).toBe(CUSTOM_PRESET_ID);
    expect(instantPlan(parse(typed), typed.zones).kind).toBe("none");
  });

  describe("no module maps an X12 zone name or time code to an IANA id", () => {
    const libDir = dirname(fileURLToPath(import.meta.url));
    const IANA = /\b(?:America|Europe|Asia|Africa|Australia|Pacific|Atlantic|Indian|Antarctica|Etc)\/[A-Za-z_]+(?:\/[A-Za-z_]+)?/g;
    const source = readFileSync(join(libDir, "x12-time-reader.ts"), "utf8");

    it("holds IANA ids only in preset zones arrays and in descriptions that name those same zones", () => {
      const noZones = source.replace(/zones: \[[^\]]*\]/g, "zones: []");
      const noDescriptions = noZones.replace(/description:\s*"[^"]*"/g, 'description: ""');
      // Comments are prose; the code and the data hold no id.
      const code = noDescriptions
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code.match(IANA) ?? []).toEqual([]);
      for (const p of X12_PRESETS) {
        const named = new Set(p.zones);
        for (const id of p.description.match(IANA) ?? []) {
          expect(named.has(id), `${p.id}: ${id}`).toBe(true);
        }
      }
    });

    const ZONE_ID = "[\"'](?:America|Europe|Asia|Africa|Australia|Pacific|Atlantic|Indian|Etc)/";
    const byCode = new RegExp(
      `["']?\\b(?:[ECMPAHN][DSTH]|LT|UT)\\b["']?\\s*[:=,]\\s*${ZONE_ID}`,
    );
    const byName = new RegExp(
      `["']?\\b(?:Eastern|Central|Mountain|Pacific|Atlantic|Alaska|Hawaii|Newfoundland)\\b["']?\\s*[:=,]\\s*${ZONE_ID}`,
    );

    it("the detector catches a table keyed by a code or a name", () => {
      expect(byCode.test('const m = { ET: "America/New_York" }')).toBe(true);
      expect(byCode.test('map.set("ED", "America/New_York")')).toBe(true);
      expect(byName.test('{ Eastern: "America/New_York" }')).toBe(true);
      expect(byCode.test('zones: ["America/New_York", "", "", ""]')).toBe(false);
    });

    it("has no table keyed by a time code or zone name in any site module", () => {
      const files = readdirSync(libDir).filter(
        (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
      );
      for (const f of files) {
        const text = readFileSync(join(libDir, f), "utf8");
        expect(byCode.test(text), `${f} maps a code to a zone`).toBe(false);
        expect(byName.test(text), `${f} maps a name to a zone`).toBe(false);
      }
    });
  });

  it.each(X12_PRESETS.map((p) => [p.id]))("matches %s", (id) => {
    expect(matchPreset(presetState(preset(id!)))).toBe(id);
  });

  it("matches custom when a field or a zone differs", () => {
    expect(matchPreset(stateOf("status-et", { timeCode: "ES" }))).toBe(
      CUSTOM_PRESET_ID,
    );
    expect(
      matchPreset(stateOf("status-et", { zones: ["Europe/Berlin", "", "", ""] })),
    ).toBe(CUSTOM_PRESET_ID);
  });

  it("has no duplicated state", () => {
    const keys = X12_PRESETS.map((p) => JSON.stringify(presetState(p)));
    expect(new Set(keys).size).toBe(X12_PRESETS.length);
  });

  it("matches the DTP presets and custom", () => {
    for (const p of DTP_PRESETS) {
      expect(matchDtpPreset(dtpPresetState(p))).toBe(p.id);
    }
    expect(matchDtpPreset(dtp("RD8", "20240615-20240621"))).toBe(
      CUSTOM_PRESET_ID,
    );
  });
});

describe("readArgs and permalinkOf", () => {
  it("is seeded when any element or the DTP pair is defined", () => {
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ date: "20240615" })).toBe(true);
    expect(isSeeded({ timeCode: "ET" })).toBe(true);
    expect(isSeeded({ format: "RD8" })).toBe(true);
    expect(isSeeded({ value: "166" })).toBe(true);
    expect(isSeeded({ zone: "Europe/Berlin" })).toBe(false);
  });

  it("keeps strings as typed, a numeric window as text, and falls back to nothing", () => {
    expect(readArgs({ time: "1430", yearWindow: 2000 })).toEqual({
      main: { date: "", time: "1430", timeCode: "", zones: ["", "", "", ""] },
      dtp: { format: "", value: "", yearWindow: "2000" },
    });
  });

  it("writes strings only, non-blank, under the fixed keys date, time and timeCode", () => {
    expect(
      permalinkOf(
        { date: "20240615", time: "1430", timeCode: "ET", zones: ["America/New_York", "", " ", ""] },
        dtp("", "", ""),
      ),
    ).toEqual({
      date: "20240615",
      time: "1430",
      timeCode: "ET",
      zone: "America/New_York",
    });
    expect(
      permalinkOf(presetState(preset("time-only")), dtpPresetState(DTP_PRESETS[4]!)),
    ).toEqual({
      time: "1430",
      format: "D6",
      value: "240615",
      yearWindow: "2000",
    });
  });
});

describe("verdictOf, from the members the library returned", () => {
  const verdict = (id: string) => verdictOf(parse(stateOf(id)));

  it("ET: a zone named, daylight not said (JSDoc)", () => {
    expect(verdict("status-et").verdict).toBe(
      "Zone named, offset not stated: Eastern (not said)",
    );
    expect(verdict("status-et").detail).toBe(
      "The code says neither standard nor daylight, so the date decides. X12 states no offset for a named zone.",
    );
  });
  it("ED: daylight", () => {
    expect(verdict("status-ed").verdict).toBe(
      "Zone named, offset not stated: Eastern (daylight)",
    );
  });
  it("ES: standard (JSDoc)", () => {
    const v = verdictOf(parseX12DateTime("20240615", "1430", "ES"));
    expect(v.verdict).toBe("Zone named, offset not stated: Eastern (standard)");
    expect(v.detail).toContain("The code says standard time.");
  });
  it("UT, 13 and 24: offset stated, with the instant named", () => {
    expect(verdict("status-ut").verdict).toBe("Offset stated: +00:00");
    expect(verdict("code-13").verdict).toBe("Offset stated: -12:00");
    expect(verdict("code-24").verdict).toBe("Offset stated: -01:00");
    expect(verdict("code-24").detail).toContain("name one instant");
  });
  it("no code: nothing stated", () => {
    expect(verdict("no-code").verdict).toBe(
      "Nothing stated: no time code was sent",
    );
    expect(verdict("hundredths").verdict).toBe(
      "Nothing stated: no time code was sent",
    );
  });
  it("LT: nothing stated, local to the event", () => {
    expect(verdict("local-lt").verdict).toBe(
      "Nothing stated: local to the event",
    );
  });
  it("a date only", () => {
    expect(verdict("date-only").verdict).toBe("A date only");
  });
  it("a time only: a time alone names no instant", () => {
    expect(verdict("time-only").verdict).toBe(
      "A time only: a time alone names no instant",
    );
  });
  it("a time and a zone name with no date still says a time alone names no instant", () => {
    const v = verdictOf(parseX12DateTime("", "1430", "ES"));
    expect(v.verdict).toBe("Zone named, offset not stated: Eastern (standard)");
    expect(v.detail).toContain("A time alone names no instant");
  });
  it("a time and an offset with no date has no instant (JSDoc)", () => {
    const result = parseX12DateTime("", "1430", "UT");
    expect(result).toEqual({ time: "14:30:00", offset: "+00:00" });
    expect(verdictOf(result).detail).toContain("A time alone names no instant");
  });
  it("the sentinel has no verdict", () => {
    expect(verdictOf(null)).toEqual({ verdict: "", detail: "" });
  });
});

describe("memberText", () => {
  it("shows the library's values, with daylight as its meaning: daylight, standard or not said", () => {
    expect(memberText(parseX12DateTime("20240615", "1430", "ED")!, "daylight")).toBe("daylight");
    expect(memberText(parseX12DateTime("20240615", "1430", "ES")!, "daylight")).toBe("standard");
    expect(memberText(parseX12DateTime("20240615", "1430", "ET")!, "daylight")).toBe("not said");
    expect(memberText(parseX12DateTime("20240615", "1430")!, "daylight")).toBeNull();
    expect(memberText(parseX12DateTime("20240615", "1430", "UT")!, "instant")).toBe(
      "2024-06-15T14:30:00Z",
    );
  });
});

describe("instantPlan and the strip", () => {
  const plan = (id: string, zones = ["", "", "", ""]) =>
    instantPlan(parse(stateOf(id)), zones);

  it("a stated offset: the instant is the result's own", () => {
    expect(plan("code-13").kind).toBe("stated");
  });
  it("a named zone and no pick: no instant, and the note names the code's zone", () => {
    expect(plan("status-et")).toEqual({
      kind: "none",
      note: "No instant: the code names Eastern time and states no offset. Pick the IANA zone it means for you.",
    });
  });
  it("LT and no code: pick the zone", () => {
    for (const id of ["local-lt", "no-code"]) {
      expect(plan(id).note).toBe(
        "No instant: nothing here states an offset. Pick the zone.",
      );
    }
  });
  it("a picked zone: resolve", () => {
    expect(plan("status-et", ["America/New_York", "", "", ""])).toEqual({
      kind: "resolve",
      note: 'Read with disambiguation: "reject": a time the clock shows twice or never is not resolved.',
    });
  });
  it("a date only, a time only, and no result", () => {
    expect(plan("date-only").note).toBe("A date alone names no instant.");
    expect(plan("time-only").note).toBe(
      "A time alone names no instant: there is no date.",
    );
    expect(instantPlan(null, ["", "", "", ""])).toEqual({
      kind: "none",
      note: "No value.",
    });
  });

  it("the strip applies to a local date-time with no offset only", () => {
    expect(stripApplies(parse(stateOf("status-et")))).toBe(true);
    expect(stripApplies(parse(stateOf("no-code")))).toBe(true);
    expect(stripApplies(parse(stateOf("local-lt")))).toBe(true);
    expect(stripApplies(parse(stateOf("code-13")))).toBe(false);
    expect(stripApplies(parse(stateOf("date-only")))).toBe(false);
    expect(stripApplies(parse(stateOf("time-only")))).toBe(false);
    expect(stripApplies(null)).toBe(false);
    expect(stripNote(parse(stateOf("code-13")))).toBe(
      "The time code states the offset, so there is nothing to choose.",
    );
  });

  it("reads 14:30 in each zone the reader picked, with the offset in force", () => {
    const rows = gapRows(
      "2024-06-15T14:30:00",
      ["America/New_York", "", "Europe/Berlin", "Asia/Shanghai"],
      lib,
    );
    expect(rows[0]).toMatchObject({
      instant: "2024-06-15T18:30:00Z",
      offset: "-04:00",
      withOffset: "2024-06-15T14:30:00-04:00",
      reason: "",
    });
    expect(rows[1]).toMatchObject({ zone: "", instant: "" });
    expect(rows[2]).toMatchObject({
      instant: "2024-06-15T12:30:00Z",
      offset: "+02:00",
      withOffset: "2024-06-15T14:30:00+02:00",
    });
    expect(rows[3]).toMatchObject({
      instant: "2024-06-15T06:30:00Z",
      offset: "+08:00",
      withOffset: "2024-06-15T14:30:00+08:00",
    });
  });

  it("moves an hour when the date moves into winter (X1zj)", () => {
    const rows = gapRows("2024-01-15T14:30:00", ["America/New_York"], lib);
    expect(rows[0]!.instant).toBe("2024-01-15T19:30:00Z");
  });

  it("refuses a time the clock shows twice, with the reason", () => {
    const rows = gapRows("2024-11-03T01:30:00", ["America/New_York"], lib);
    expect(rows[0]!.instant).toBe("");
    expect(rows[0]!.reason).toContain("happens twice in America/New_York");
  });
});

describe("explainNull, each confirmed null by the real parser", () => {
  const reason = (date: string, time: string, timeCode: string) => {
    const state: X12State = { date, time, timeCode, zones: ["", "", "", ""] };
    return explainNull(state, lib);
  };

  it.each([
    ["240615", "", "", "bad-date"],
    ["20230229", "1430", "", "bad-date"],
    ["20240615", "2430", "", "bad-time"],
    ["20240615", "14304", "", "bad-time"],
    ["20240615", "1430", "EST", "not-a-code"],
    ["20240615", "1430", "et", "not-a-code"],
    ["20240615", "", "ET", "needs-time"],
    ["", "", "UT", "needs-time"],
  ] as const)("%j, %j, %j is %s", (date, time, timeCode, expected) => {
    const args = [date, time, timeCode].filter(
      (_v, i, all) => all.slice(i).some((x) => x !== ""),
    );
    expect(
      parseX12DateTime(...(args as [string?, string?, string?])),
    ).toBeNull();
    expect(reason(date, time, timeCode)).toBe(expected);
  });

  it("has a sentence for every reason", () => {
    for (const make of Object.values(NULL_REASON_TEXT)) {
      expect(make({ timeCode: "EST" })).not.toBe("");
    }
    expect(NULL_REASON_TEXT["not-a-code"]({ timeCode: "EST" })).toBe(
      "EST is not a 623 time code. A code is two characters, upper case, and an abbreviation is not a code.",
    );
  });
});

describe("writing back the date and the time", () => {
  it("writes the date as element 373 with D8", () => {
    const w = writeDate(parse(stateOf("status-et")), lib);
    expect(w).toEqual({
      iso: "2024-06-15",
      code: "D8",
      output: "20240615",
      note: "",
    });
  });

  it("writes a four-digit time with TM and a six-digit time with TS", () => {
    const tm = writeTime(parse(stateOf("status-et")), "1430", lib);
    expect(tm).toMatchObject({ iso: "14:30:00", code: "TM", output: "1430" });
    const ts = writeTime(
      parseX12DateTime("20240615", "143045") as never,
      "143045",
      lib,
    );
    expect(ts).toMatchObject({ iso: "14:30:45", code: "TS", output: "143045" });
  });

  it("reads hundredths and does not write them, and says so", () => {
    const result = parse(stateOf("hundredths"));
    expect(result).toMatchObject({ time: "14:30:00.12" });
    const w = writeTime(result, "14300012", lib)!;
    expect(w.output).toBe("");
    expect(w.note).toContain("Tenths and hundredths of a second are read and not written");
  });

  it("has nothing to write for a missing member or the sentinel", () => {
    expect(writeDate(parse(stateOf("time-only")), lib)).toBeNull();
    expect(writeTime(parse(stateOf("date-only")), "", lib)).toBeNull();
    expect(writeDate(null, lib)).toBeNull();
    expect(writeTime(null, "1430", lib)).toBeNull();
  });
});

describe("the DTP section", () => {
  const read = (d: DtpState) =>
    parseX12DateTimePeriod(
      d.value,
      d.format,
      d.yearWindow === "" ? undefined : { yearWindow: Number(d.yearWindow) },
    ) as never;

  it("is blank only when both the qualifier and the value are", () => {
    expect(dtpBlank(dtp("", ""))).toBe(true);
    expect(dtpBlank(dtp("RD8", ""))).toBe(false);
  });

  it("shows a range end, a day of the year and a year digit", () => {
    const rd8 = read(dtp("RD8", "20240615-20240620"));
    expect(dtpMemberText(rd8, "date")).toBe("2024-06-15");
    expect(dtpMemberText(rd8, "periodEnd")).toBe("2024-06-20");
    expect(dtpMemberText(read(dtp("TC", "166")), "dayOfYear")).toBe("166");
    expect(dtpMemberText(read(dtp("EH", "5166")), "yearDigit")).toBe("5");
    expect(dtpMemberText(read(dtp("RTM", "2200-0600")), "periodEnd")).toBe("06:00:00");
  });

  it("writes a range back with its hyphen, and TC and the overnight window as the library says", () => {
    const w = (d: DtpState) => dtpWriteBack(d, read(d), lib);
    expect(w(dtp("RD8", "20240615-20240620"))).toMatchObject({
      iso: "2024-06-15/2024-06-20",
      output: "20240615-20240620",
    });
    expect(w(dtp("RTM", "2200-0600"))).toMatchObject({
      iso: "22:00:00/06:00:00",
      output: "2200-0600",
    });
    expect(w(dtp("TC", "166"))).toBeNull();
    expect(nothingToWriteNote(read(dtp("TC", "166")))).toContain(
      "TC keeps only the day of the year",
    );
    expect(nothingToWriteNote(read(dtp("EH", "5166")))).toContain("last digit");
  });

  it("passes a window through to the formatter for a two-digit year", () => {
    const d = dtp("D6", "240615", "2000");
    const w = dtpWriteBack(d, read(d), lib)!;
    expect(w.args).toEqual(["2024-06-15", "D6", { yearWindow: 2000 }]);
    expect(w.output).toBe("240615");
  });

  it("TU holds a date and a day of the year; the date is what is written back", () => {
    const d = dtp("TU", "24366", "2000");
    expect(read(d)).toEqual({ date: "2024-12-31", dayOfYear: 366 });
    expect(dtpWriteBack(d, read(d), lib)).toMatchObject({
      iso: "2024-12-31",
      output: "24366",
    });
  });

  it.each([
    ["", "", "blank-value"],
    ["", "20240615", "no-format"],
    ["UN", "20240615", "unstructured"],
    ["DTM", "20240615", "unread-format"],
    ["D6", "240615", "needs-year-window"],
    ["RD8", "20240615", "bad-value"],
    ["RD8", "20240620-20240615", "bad-value"],
    ["D8", "20230229", "bad-value"],
  ] as const)("explains %j / %j as %s", (format, value, expected) => {
    const state = dtp(format, value);
    if (value !== "" && format !== "") {
      expect(parseX12DateTimePeriod(value, format)).toBeNull();
    }
    expect(explainDtpNull(state, lib)).toBe(expected);
  });

  it("explains a window that is not a year", () => {
    expect(explainDtpNull(dtp("D6", "240615", "9901"), lib)).toBe(
      "bad-year-window",
    );
    expect(
      parseX12DateTimePeriod("240615", "D6", { yearWindow: 9901 }),
    ).toBeNull();
  });

  it("has a sentence for every reason", () => {
    for (const make of Object.values(DTP_NULL_REASON_TEXT)) {
      expect(make({ format: "D6" })).not.toBe("");
    }
  });
});
