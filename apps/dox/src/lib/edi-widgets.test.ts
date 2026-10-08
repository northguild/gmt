/// <reference types="vitest/globals" />
/**
 * `edi-widgets.ts`'s pure helpers, against the real gmt modules. Every expected
 * library result is an appendix Z row (INT-15) or a JSDoc example.
 */
import { classifyLocal, resolveLocal } from "@northguild/gmt/instant/convert";
import { formatEdifactDtm, formatX12DateTimePeriod } from "@northguild/gmt/intermodal/format";
import { parseEdifactDtm, parseX12DateTime, parseX12DateTimePeriod } from "@northguild/gmt/intermodal/parse";
import { diffUtcAsDuration } from "@northguild/gmt/utc/calculate";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import {
  ABSENT_MEMBER_TEXT,
  durationText,
  EDI_ZONES,
  GAP_PROMPT,
  isoOf,
  needsYearWindow,
  NO_RESULT_TEXT,
  readoutOf,
  resolveInZone,
  resolveReason,
  widestGap,
  yearWindowControls,
  yearWindowFieldsHtml,
  yearWindowFromControls,
  yearWindowOptions,
} from "./edi-widgets";
import { lib } from "~/test/edi-lib";

describe("yearWindowOptions", () => {
  it.each([
    ["", undefined],
    ["none", undefined],
    ["  none ", undefined],
    ["rolling", { yearWindow: "rolling" }],
    ["2000", { yearWindow: 2000 }],
    [" 1950 ", { yearWindow: 1950 }],
    ["9901", { yearWindow: 9901 }],
  ])("%j gives %j", (text, expected) => {
    expect(yearWindowOptions(text)).toEqual(expected);
  });

  it("passes a non-number as NaN, so the printed call is the real call", () => {
    const options = yearWindowOptions("abc");
    expect(Number.isNaN(options?.yearWindow)).toBe(true);
  });
});

describe("year-window controls", () => {
  it("maps the state string to the two controls and back", () => {
    expect(yearWindowControls("")).toEqual({ mode: "none", start: "" });
    expect(yearWindowControls("rolling")).toEqual({ mode: "rolling", start: "" });
    expect(yearWindowControls("2000")).toEqual({ mode: "fixed", start: "2000" });
    expect(yearWindowFromControls("none", "2000")).toBe("");
    expect(yearWindowFromControls("rolling", "2000")).toBe("rolling");
    expect(yearWindowFromControls("fixed", " 2000 ")).toBe("2000");
    expect(yearWindowFromControls("fixed", "")).toBe("");
  });

  it("renders both controls every time, disabled when the code reads no window", () => {
    const on = yearWindowFieldsHtml("2000", false);
    expect(on).toContain('data-role="year-window"');
    expect(on).toContain('data-role="year-start"');
    expect(on).toContain('value="2000"');
    expect(on).not.toContain("placeholder");
    const disabled = yearWindowFieldsHtml("2000", true);
    expect(disabled.match(/ disabled/g)).toHaveLength(2);
  });
});

describe("needsYearWindow", () => {
  const EDIFACT_CODES = [
    "101", "102", "201", "202", "203", "204", "205", "206", "207", "208", "209", "301", "302", "303", "304",
    "401", "402", "404", "406", "713", "717", "718", "719", "602",
  ];
  const X12_CODES = [
    "D6", "D8", "DB", "TT", "DT", "TR", "RTS", "TM", "TS", "RD6", "RD8", "RD",
    "RDT", "DTS", "DDT", "DTD", "RTM", "TC", "TU", "EH", "UN", "CM",
  ];

  it("finds exactly the two-digit-year UN/EDIFACT codes", () => {
    const found = EDIFACT_CODES.filter((c) =>
      needsYearWindow(formatEdifactDtm, c),
    );
    expect(found).toEqual(["101", "201", "202", "206", "207", "301", "302", "713", "717"]);
  });

  it("finds exactly the two-digit-year X12 qualifiers", () => {
    const found = X12_CODES.filter((c) => needsYearWindow(formatX12DateTimePeriod, c));
    expect(found.sort()).toEqual(["D6", "RD6", "TR", "TT", "TU"]);
  });

  it("is false for a blank code", () => {
    expect(needsYearWindow(formatEdifactDtm, "")).toBe(false);
  });
});

describe("isoOf", () => {
  const iso = (value: unknown) => isoOf(value as never, lib);

  it("D1: a local time is its own string", () => {
    expect(iso(parseEdifactDtm("202406151430", "203"))).toBe("2024-06-15T14:30:00");
  });
  it("D2l: an instant and an offset go through fromOffsetInstant", () => {
    expect(iso(parseEdifactDtm("202406151430+00", "303"))).toBe(
      "2024-06-15T14:30:00+00:00",
    );
  });
  it("D13: a time and an offset are joined", () => {
    expect(iso(parseEdifactDtm("143045+02", "404"))).toBe("14:30:45+02:00");
  });
  it("D14: an offset alone", () => {
    expect(iso(parseEdifactDtm("+0200", "406"))).toBe("+02:00");
  });
  it("D6: a date period is start/end", () => {
    expect(iso(parseEdifactDtm("2024061520240620", "718"))).toBe(
      "2024-06-15/2024-06-20",
    );
  });
  it("D12: a local period is start/end", () => {
    expect(iso(parseEdifactDtm("202406151430202406201600", "719"))).toBe(
      "2024-06-15T14:30:00/2024-06-20T16:00:00",
    );
  });
  it("X7: a time window is start/end", () => {
    expect(iso(parseX12DateTimePeriod("2200-0600", "RTM"))).toBe("22:00:00/06:00:00");
  });
  it("X20: a TU value holds a date and a day of the year; the date is written", () => {
    const result = parseX12DateTimePeriod("24366", "TU", { yearWindow: 2000 });
    expect(result).toEqual({ date: "2024-12-31", dayOfYear: 366 });
    expect(iso(result)).toBe("2024-12-31");
  });
  it("X6: a day of the year with no year writes nothing back", () => {
    expect(iso(parseX12DateTimePeriod("166", "TC"))).toBeNull();
  });
  it("a date alone", () => {
    expect(iso(parseEdifactDtm("20240615", "102"))).toBe("2024-06-15");
  });
  it("a zone-text value writes its local", () => {
    expect(iso(parseEdifactDtm("202406151430CET", "303"))).toBe(
      "2024-06-15T14:30:00",
    );
  });
  it("a time alone", () => {
    expect(iso(parseX12DateTimePeriod("1430", "TM"))).toBe("14:30:00");
  });
  it("a time and a zone name from parseX12DateTime write the time", () => {
    expect(iso(parseX12DateTime("", "1430", "ES"))).toBe("14:30:00");
  });
  it("an empty result writes nothing", () => {
    expect(iso({})).toBeNull();
  });
});

describe("durationText", () => {
  it.each([
    ["PT15H", "15 h"],
    ["PT9H30M", "9 h 30 min"],
    ["PT0S", "0 h"],
    ["PT45M", "45 min"],
    ["PT1H30S", "1 h 30 s"],
    ["P1D", "P1D"],
  ])("%s is %s", (iso, text) => {
    expect(durationText(iso)).toBe(text);
  });

  it("formats the library's own durations (D1gap, Dgap-half, Dgap-one)", () => {
    expect(
      durationText(
        diffUtcAsDuration("2024-06-15T06:30:00Z", "2024-06-15T21:30:00Z", "hours"),
      ),
    ).toBe("15 h");
    expect(
      durationText(
        diffUtcAsDuration("2024-06-15T09:00:00Z", "2024-06-15T18:30:00Z", "hours"),
      ),
    ).toBe("9 h 30 min");
    expect(
      durationText(
        diffUtcAsDuration("2024-06-15T12:30:00Z", "2024-06-15T12:30:00Z", "hours"),
      ),
    ).toBe("0 h");
  });
});

describe("resolveReason", () => {
  const reject = { disambiguation: "reject" } as const;

  it("D16: a time that happens twice", () => {
    expect(resolveLocal("2024-11-03T01:30:00", "America/New_York", reject)).toBe("");
    expect(classifyLocal("2024-11-03T01:30:00", "America/New_York")).toBe("ambiguous");
    expect(resolveReason("2024-11-03T01:30:00", "America/New_York", lib)).toBe(
      'The 01:30 time happens twice in America/New_York on that date. With disambiguation: "reject", resolveLocal does not pick one.',
    );
  });

  it("D16n: a time the clock skipped", () => {
    expect(classifyLocal("2024-03-10T02:30:00", "America/New_York")).toBe("nonexistent");
    expect(resolveReason("2024-03-10T02:30:00", "America/New_York", lib)).toBe(
      'The 02:30 time never happens in America/New_York on that date: the clock skipped it. With disambiguation: "reject", resolveLocal does not pick another time.',
    );
  });

  it("a zone the browser does not know", () => {
    expect(classifyLocal("2024-06-15T14:30:00", "Not/AZone")).toBeNull();
    expect(resolveReason("2024-06-15T14:30:00", "Not/AZone", lib)).toBe(
      "Not/AZone is not a time zone this browser knows.",
    );
  });

  it("D16u: a unique time falls through to a plain line", () => {
    expect(classifyLocal("2024-06-15T14:30:00", "America/New_York")).toBe("unique");
    expect(resolveReason("2024-06-15T14:30:00", "America/New_York", lib)).toBe(
      "2024-06-15T14:30:00 could not be resolved in America/New_York.",
    );
  });
});

describe("readoutOf", () => {
  it("is a value, an absent member, or no result", () => {
    expect(readoutOf("2024-06-15", true)).toEqual({ text: "2024-06-15", state: "value" });
    expect(readoutOf(null, true)).toEqual({ text: ABSENT_MEMBER_TEXT, state: "absent" });
    expect(readoutOf(null, false)).toEqual({ text: NO_RESULT_TEXT, state: "none" });
  });
});

describe("EDI_ZONES", () => {
  it("holds the curated zones plus Amsterdam, Singapore and Atikokan, each a real zone", () => {
    expect(EDI_ZONES).toContain("Europe/Amsterdam");
    expect(EDI_ZONES).toContain("Asia/Singapore");
    expect(EDI_ZONES).toContain("America/Atikokan");
    for (const zone of EDI_ZONES) expect(isValidTimeZone(zone), zone).toBe(true);
  });
});

/** The rows a strip hands to `widestGap`: each zone's
 *  `resolveLocal` with `disambiguation: "reject"`, `""` when refused or blank. */
const stripRows = (local: string, zones: string[]) =>
  zones.map((zone) => ({
    zone,
    instant: zone === "" ? "" : lib.resolveLocal(local, zone, { disambiguation: "reject" }),
  }));

describe("widestGap", () => {
  const L = "2024-06-15T14:30:00";
  const zones = ["America/New_York", "Europe/Berlin", "Asia/Shanghai", "America/Los_Angeles"];

  it("finds the widest gap (D1min, D1max, D1gap)", () => {
    expect(widestGap(stripRows(L, zones), lib)).toEqual({
      duration: "PT15H",
      text: "Widest gap: 15 h, between Asia/Shanghai and America/Los_Angeles",
      earliest: "Asia/Shanghai",
      latest: "America/Los_Angeles",
    });
  });

  it("is null with fewer than two resolved rows", () => {
    expect(widestGap(stripRows(L, ["Europe/Berlin", "", "", ""]), lib)).toBeNull();
    expect(
      widestGap(stripRows("2024-11-03T01:30:00", ["America/New_York", "Europe/Berlin"]), lib),
    ).toBeNull();
    expect(GAP_PROMPT).toContain("Choose two zones");
  });

  it("names two different zones when two instants are equal", () => {
    const gap = widestGap(stripRows(L, ["Europe/Berlin", "Europe/Paris"]), lib)!;
    expect(gap.duration).toBe("PT0S");
    expect(gap.text).toBe("Widest gap: 0 h, between Europe/Berlin and Europe/Paris");
  });
});

describe("resolveInZone", () => {
  const L = "2024-06-15T14:30:00";

  it("resolves a zone and reads the offset in force (D1a)", () => {
    expect(resolveInZone(L, " America/New_York ", lib)).toEqual({
      zone: "America/New_York",
      instant: "2024-06-15T18:30:00Z",
      offset: "-04:00",
      reason: "",
    });
  });

  it("leaves a blank slot as just a blank zone", () => {
    expect(resolveInZone(L, "  ", lib)).toEqual({ zone: "", instant: "", offset: "", reason: "" });
  });

  it("gives a reason, and no instant or offset, for a time the clock shows twice (D16)", () => {
    const row = resolveInZone("2024-11-03T01:30:00", "America/New_York", lib);
    expect(row.instant).toBe("");
    expect(row.offset).toBe("");
    expect(row.reason).toContain("happens twice in America/New_York");
  });
});
