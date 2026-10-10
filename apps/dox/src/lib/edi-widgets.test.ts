/// <reference types="vitest/globals" />
/**
 * `edi-widgets.ts`'s pure helpers, against the real gmt modules. Every expected
 * library result is a JSDoc example of the function that returns it.
 */
import { classifyLocal, resolveLocal } from "@northguild/gmt/instant/convert";
import { diffUtcAsDuration } from "@northguild/gmt/utc/calculate";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import {
  ABSENT_MEMBER_TEXT,
  durationText,
  EDI_ZONES,
  EDIFACT_FUNCTIONS,
  GAP_PROMPT,
  X12_FUNCTIONS,
  formatClassified,
  houseEnds,
  houseText,
  isInterval,
  isSentinel,
  KIND_WORDS,
  NO_RESULT_TEXT,
  parseClassified,
  readoutOf,
  resolveInZone,
  resolveReason,
  runCall,
  TWO_DIGIT_YEAR_CODES,
  unreadCodeText,
  widestGap,
} from "./edi-widgets";
import { lib } from "~/test/edi-lib";

describe("runCall", () => {
  it("keeps the function, its arguments and its real result", () => {
    expect(runCall(lib, "parseEdifactDate", "20240615", "102")).toEqual({
      fn: "parseEdifactDate",
      args: ["20240615", "102"],
      result: "2024-06-15",
    });
  });

  it("keeps a sentinel as the library returned it", () => {
    expect(runCall(lib, "parseEdifactDate", "2024", "102").result).toBe("");
    expect(runCall(lib, "classifyEdifactDtmFormat", "101").result).toBeNull();
  });
});

describe("isSentinel and isInterval", () => {
  it("treats an empty string and null as the sentinel, and nothing else", () => {
    expect(isSentinel("")).toBe(true);
    expect(isSentinel(null)).toBe(true);
    expect(isSentinel("2024-06-15")).toBe(false);
    expect(isSentinel({ start: "a", end: "b" })).toBe(false);
  });

  it("tells a period from a value", () => {
    expect(isInterval({ start: "a", end: "b" })).toBe(true);
    expect(isInterval("a")).toBe(false);
    expect(isInterval(null)).toBe(false);
  });
});

describe("the kind to function maps", () => {
  it("name a parser and a formatter the library has, for every kind the classifiers return", () => {
    for (const fns of [
      ...Object.values(EDIFACT_FUNCTIONS),
      ...Object.values(X12_FUNCTIONS),
    ]) {
      expect(typeof lib[fns.parse]).toBe("function");
      expect(typeof lib[fns.format]).toBe("function");
    }
  });

  it("cover every kind the classifiers return for every code they read", () => {
    const edifact = [
      "102",
      "401",
      "402",
      "203",
      "204",
      "205",
      "208",
      "303",
      "304",
      "718",
      "719",
    ];
    for (const code of edifact) {
      const c = lib.classifyEdifactDtmFormat(code)!;
      expect(EDIFACT_FUNCTIONS[c.kind], code).toBeDefined();
      expect(KIND_WORDS[c.kind], code).toBeDefined();
    }
    const x12 = [
      "D8",
      "DB",
      "TM",
      "TS",
      "DT",
      "RTS",
      "RD8",
      "RD",
      "RDT",
      "DTS",
    ];
    for (const code of x12) {
      const c = lib.classifyX12DateTimePeriodFormat(code)!;
      expect(X12_FUNCTIONS[c.kind], code).toBeDefined();
      expect(KIND_WORDS[c.kind], code).toBeDefined();
    }
  });

  it("call the parser with the code the classifier returned, and a period's formatter with two ends", () => {
    const c = lib.classifyEdifactDtmFormat("719")!;
    const parsed = parseClassified(
      lib,
      EDIFACT_FUNCTIONS[c.kind],
      "202406151430202406201600",
      c.format,
    );
    expect(parsed.fn).toBe("parseEdifactDateTimePeriod");
    const written = formatClassified(
      lib,
      EDIFACT_FUNCTIONS[c.kind],
      parsed.result as never,
      c.format,
    );
    expect(written.args).toEqual([
      "2024-06-15T14:30:00",
      "2024-06-20T16:00:00",
      "719",
    ]);
    expect(written.result).toBe("202406151430202406201600");
  });

  it("read an X12 time under the narrowed qualifier, so TM with seconds is the sentinel", () => {
    const c = lib.classifyX12DateTimePeriodFormat("TM")!;
    const ok = parseClassified(lib, X12_FUNCTIONS[c.kind], "1430", c.format);
    expect(ok.args).toEqual(["1430", "TM"]);
    expect(ok.result).toBe("14:30:00");
    expect(
      parseClassified(lib, X12_FUNCTIONS[c.kind], "143045", c.format).result,
    ).toBe("");
  });

  it("give the ends and the text of a house value", () => {
    expect(houseEnds("2024-06-15")).toEqual(["2024-06-15"]);
    expect(houseEnds({ start: "a", end: "b" })).toEqual(["a", "b"]);
    expect(houseText({ start: "a", end: "b" })).toBe("a / b");
    expect(houseText("a")).toBe("a");
  });
});

describe("the codes the library does not read", () => {
  it("says what to use instead for a two-digit-year code with a pattern", () => {
    expect(unreadCodeText("TT", "x12")).toContain("MMddyy");
    expect(unreadCodeText("TR", "x12")).toContain("ddMMyyHHmm");
    expect(unreadCodeText("202", "edifact")).toContain("yyMMddHHmmss");
  });

  it("says to use the pattern parsers for a two-digit-year code with no pattern named", () => {
    const text = unreadCodeText("206", "edifact");
    expect(text).toContain("pattern parsers");
    expect(text).toContain("yearWindow");
  });

  it("says a code that is not a two-digit year is simply not read", () => {
    expect(unreadCodeText("602", "edifact")).toContain(
      "is not a format code the library reads",
    );
    expect(unreadCodeText("RTM", "x12")).toContain(
      "is not a qualifier the library reads",
    );
  });

  it("lists every two-digit-year code as one the classifiers do not know", () => {
    for (const code of Object.keys(TWO_DIGIT_YEAR_CODES)) {
      expect(
        lib.classifyEdifactDtmFormat(code) ??
          lib.classifyX12DateTimePeriodFormat(code),
      ).toBeNull();
    }
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
        diffUtcAsDuration(
          "2024-06-15T06:30:00Z",
          "2024-06-15T21:30:00Z",
          "hours",
        ),
      ),
    ).toBe("15 h");
    expect(
      durationText(
        diffUtcAsDuration(
          "2024-06-15T09:00:00Z",
          "2024-06-15T18:30:00Z",
          "hours",
        ),
      ),
    ).toBe("9 h 30 min");
    expect(
      durationText(
        diffUtcAsDuration(
          "2024-06-15T12:30:00Z",
          "2024-06-15T12:30:00Z",
          "hours",
        ),
      ),
    ).toBe("0 h");
  });
});

describe("resolveReason", () => {
  const reject = { disambiguation: "reject" } as const;

  it("D16: a time that happens twice", () => {
    expect(
      resolveLocal("2024-11-03T01:30:00", "America/New_York", reject),
    ).toBe("");
    expect(classifyLocal("2024-11-03T01:30:00", "America/New_York")).toBe(
      "ambiguous",
    );
    expect(resolveReason("2024-11-03T01:30:00", "America/New_York", lib)).toBe(
      'The 01:30 time happens twice in America/New_York on that date. With disambiguation: "reject", resolveLocal does not pick one.',
    );
  });

  it("D16n: a time the clock skipped", () => {
    expect(classifyLocal("2024-03-10T02:30:00", "America/New_York")).toBe(
      "nonexistent",
    );
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
    expect(classifyLocal("2024-06-15T14:30:00", "America/New_York")).toBe(
      "unique",
    );
    expect(resolveReason("2024-06-15T14:30:00", "America/New_York", lib)).toBe(
      "2024-06-15T14:30:00 could not be resolved in America/New_York.",
    );
  });
});

describe("readoutOf", () => {
  it("is a value, an absent member, or no result", () => {
    expect(readoutOf("2024-06-15", true)).toEqual({
      text: "2024-06-15",
      state: "value",
    });
    expect(readoutOf(null, true)).toEqual({
      text: ABSENT_MEMBER_TEXT,
      state: "absent",
    });
    expect(readoutOf(null, false)).toEqual({
      text: NO_RESULT_TEXT,
      state: "none",
    });
  });
});

describe("EDI_ZONES", () => {
  it("holds the curated zones plus Amsterdam, Singapore and Atikokan, each a real zone", () => {
    expect(EDI_ZONES).toContain("Europe/Amsterdam");
    expect(EDI_ZONES).toContain("Asia/Singapore");
    expect(EDI_ZONES).toContain("America/Atikokan");
    for (const zone of EDI_ZONES)
      expect(isValidTimeZone(zone), zone).toBe(true);
  });
});

/** The rows a strip hands to `widestGap`: each zone's
 *  `resolveLocal` with `disambiguation: "reject"`, `""` when refused or blank. */
const stripRows = (local: string, zones: string[]) =>
  zones.map((zone) => ({
    zone,
    instant:
      zone === ""
        ? ""
        : lib.resolveLocal(local, zone, { disambiguation: "reject" }),
  }));

describe("widestGap", () => {
  const L = "2024-06-15T14:30:00";
  const zones = [
    "America/New_York",
    "Europe/Berlin",
    "Asia/Shanghai",
    "America/Los_Angeles",
  ];

  it("finds the widest gap (D1min, D1max, D1gap)", () => {
    expect(widestGap(stripRows(L, zones), lib)).toEqual({
      duration: "PT15H",
      text: "Widest gap: 15 h, between Asia/Shanghai and America/Los_Angeles",
      earliest: "Asia/Shanghai",
      latest: "America/Los_Angeles",
    });
  });

  it("is null with fewer than two resolved rows", () => {
    expect(
      widestGap(stripRows(L, ["Europe/Berlin", "", "", ""]), lib),
    ).toBeNull();
    expect(
      widestGap(
        stripRows("2024-11-03T01:30:00", ["America/New_York", "Europe/Berlin"]),
        lib,
      ),
    ).toBeNull();
    expect(GAP_PROMPT).toContain("Choose two zones");
  });

  it("names two different zones when two instants are equal", () => {
    const gap = widestGap(
      stripRows(L, ["Europe/Berlin", "Europe/Paris"]),
      lib,
    )!;
    expect(gap.duration).toBe("PT0S");
    expect(gap.text).toBe(
      "Widest gap: 0 h, between Europe/Berlin and Europe/Paris",
    );
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
    expect(resolveInZone(L, "  ", lib)).toEqual({
      zone: "",
      instant: "",
      offset: "",
      reason: "",
    });
  });

  it("gives a reason, and no instant or offset, for a time the clock shows twice (D16)", () => {
    const row = resolveInZone("2024-11-03T01:30:00", "America/New_York", lib);
    expect(row.instant).toBe("");
    expect(row.offset).toBe("");
    expect(row.reason).toContain("happens twice in America/New_York");
  });
});
