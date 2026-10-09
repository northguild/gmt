/**
 * @vitest-environment jsdom
 *
 * The X12 Time Reader end to end: template → mount → interact → assert, against
 * the real `@northguild/gmt`. Every preset's printed calls, results, verdict,
 * members, instant and write-back are checked, so a drift in the library or the
 * widget fails here.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { DTP_PRESETS, X12_PRESETS } from "./x12-time-reader";
import {
  mountX12TimeReader,
  renderX12TimeReaderTemplate,
} from "./x12-time-reader-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "date",
  "time",
  "time-code",
  "verdict",
  "verdict-detail",
  "readouts",
  "member-kind",
  "member-value",
  "member-code",
  "member-offset",
  "member-zone",
  "member-daylight",
  "member-instant",
  "call-parse",
  "copy-parse",
  "parse-output",
  "reason-aside",
  "instant-output",
  "instant-note",
  "strip-note",
  "gap-strip",
  "zone-1",
  "zone-4",
  "instant-1",
  "instant-4",
  "offset-1",
  "withoffset-1",
  "withoffset-4",
  "gap",
  "figure",
  "figure-note",
  "timeline",
  "dtp-figure",
  "strip-summary",
  "strip-aside",
  "resolve-block",
  "call-resolve",
  "copy-resolve",
  "date-output",
  "call-write-date",
  "copy-write-date",
  "time-output",
  "call-write-time",
  "copy-write-time",
  "format-note",
  "dtp-preset",
  "dtp-preset-description",
  "dtp-format",
  "dtp-value",
  "dtp-readouts",
  "dtp-member-kind",
  "dtp-member-value",
  "dtp-member-range-end",
  "call-dtp-parse",
  "copy-dtp-parse",
  "dtp-parse-output",
  "dtp-reason-aside",
  "dtp-format-output",
  "dtp-format-note",
  "call-dtp-format",
  "copy-dtp-format",
];

const NOT_STATED = "not stated";

interface Expected {
  /** The printed section 2 calls, one per line. */
  calls: string;
  /** The printed results, one per line. */
  results: string;
  verdict: string;
  /** Member cells the read holds; the rest read `not stated`. */
  members: Record<string, string>;
  instant: string;
  date: string;
  time: string;
}

const L = "2024-06-15T14:30:00";
const AT = '"20240615", "1430"';

const EXPECTED: Record<string, Expected> = {
  "status-et": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("ET")\nx12TimeCodeZone("ET")`,
    results: `"${L}"\n{ kind: "zone", timeCode: "ET" }\n{ zone: "Eastern", daylight: null }`,
    verdict: "Offset: not stated",
    members: {
      kind: "local date-time",
      value: L,
      code: "names a zone",
      zone: "Eastern",
      daylight: "not said",
    },
    instant: "2024-06-15T18:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "status-ed": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("ED")\nx12TimeCodeZone("ED")`,
    results: `"${L}"\n{ kind: "zone", timeCode: "ED" }\n{ zone: "Eastern", daylight: true }`,
    verdict: "Offset: not stated",
    members: {
      kind: "local date-time",
      value: L,
      code: "names a zone",
      zone: "Eastern",
      daylight: "daylight",
    },
    instant: "2024-06-15T18:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "status-es": {
    calls:
      'parseX12DateAndTime("20240115", "1430")\nclassifyX12TimeCode("ES")\nx12TimeCodeZone("ES")',
    results:
      '"2024-01-15T14:30:00"\n{ kind: "zone", timeCode: "ES" }\n{ zone: "Eastern", daylight: false }',
    verdict: "Offset: not stated",
    members: {
      kind: "local date-time",
      value: "2024-01-15T14:30:00",
      code: "names a zone",
      zone: "Eastern",
      daylight: "standard",
    },
    instant: "2024-01-15T19:30:00Z",
    date: "20240115",
    time: "1430",
  },
  "status-ut": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("UT")\nx12TimeCodeOffset("UT")`,
    results: `"${L}"\n{ kind: "offset", timeCode: "UT" }\n"+00:00"`,
    verdict: "Offset: stated (+00:00)",
    members: {
      kind: "local date-time",
      value: L,
      code: "states an offset",
      offset: "+00:00",
      instant: "2024-06-15T14:30:00Z",
    },
    instant: "2024-06-15T14:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "code-13": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("13")\nx12TimeCodeOffset("13")`,
    results: `"${L}"\n{ kind: "offset", timeCode: "13" }\n"-12:00"`,
    verdict: "Offset: stated (-12:00)",
    members: {
      kind: "local date-time",
      value: L,
      code: "states an offset",
      offset: "-12:00",
      instant: "2024-06-16T02:30:00Z",
    },
    instant: "2024-06-16T02:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "code-24": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("24")\nx12TimeCodeOffset("24")`,
    results: `"${L}"\n{ kind: "offset", timeCode: "24" }\n"-01:00"`,
    verdict: "Offset: stated (-01:00)",
    members: {
      kind: "local date-time",
      value: L,
      code: "states an offset",
      offset: "-01:00",
      instant: "2024-06-15T15:30:00Z",
    },
    instant: "2024-06-15T15:30:00Z",
    date: "20240615",
    time: "1430",
  },
  hundredths: {
    calls: 'parseX12DateAndTime("20240615", "14300012")',
    results: '"2024-06-15T14:30:00.12"',
    verdict: "Offset: not stated",
    members: { kind: "local date-time", value: "2024-06-15T14:30:00.12" },
    instant: "2024-06-15T18:30:00.12Z",
    date: "20240615",
    time: "143000",
  },
  "no-code": {
    calls: `parseX12DateAndTime(${AT})`,
    results: `"${L}"`,
    verdict: "Offset: not stated",
    members: { kind: "local date-time", value: L },
    instant: "2024-06-15T18:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "local-lt": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("LT")\nx12TimeCodeZone("LT")`,
    results: `"${L}"\n{ kind: "zone", timeCode: "LT" }\n{ zone: "Local", daylight: null }`,
    verdict: "Offset: not stated",
    members: {
      kind: "local date-time",
      value: L,
      code: "names a zone",
      zone: "Local",
      daylight: "not said",
    },
    instant: "2024-06-15T18:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "date-only": {
    calls: 'parseX12Date("20240615", "D8")',
    results: '"2024-06-15"',
    verdict: "Offset: not stated",
    members: { kind: "date", value: "2024-06-15" },
    instant: "no instant",
    date: "20240615",
    time: "not sent",
  },
  "time-only": {
    calls: 'parseX12Time("1430")',
    results: '"14:30:00"',
    verdict: "Offset: not stated",
    members: { kind: "time", value: "14:30:00" },
    instant: "no instant",
    date: "not sent",
    time: "1430",
  },
};

const MEMBER_KEYS = [
  "kind",
  "value",
  "code",
  "offset",
  "zone",
  "daylight",
  "instant",
];

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderX12TimeReaderTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountX12TimeReader(root, args, controller.signal);
  return { root, handle, controller };
}

function choose(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLSelectElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function type(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLInputElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";
const isSentinel = (root: HTMLElement, role: string) =>
  q(root, role).classList.contains("gmt-playground-sentinel");
const isEmpty = (root: HTMLElement, role: string) =>
  q(root, role).classList.contains("gmt-widget-output--empty");

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderX12TimeReaderTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderX12TimeReaderTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderX12TimeReaderTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.className).toBe("gmt-x12-time-reader gmt-widget not-content");
    const cardClasses = [...root.querySelectorAll("[class]")]
      .flatMap((el) => [...el.classList])
      .filter((c) => c.includes("card"));
    expect(new Set(cardClasses)).toEqual(new Set(["gmt-widget-card"]));
  });

  it("renders six numbered sections and no year-window control", () => {
    const root = document.createElement("div");
    root.innerHTML = renderX12TimeReaderTemplate();
    expect(root.querySelectorAll(".gmt-widget-section")).toHaveLength(6);
    expect(root.querySelector('[data-role="year-window"]')).toBeNull();
    expect(root.querySelector('[data-role="year-start"]')).toBeNull();
    const dtpLine = root.querySelector('[data-line="dtp"]')!;
    expect(dtpLine.querySelectorAll(":scope > label")).toHaveLength(3);
  });

  it("escapes a hostile seed", () => {
    const root = document.createElement("div");
    root.innerHTML = renderX12TimeReaderTemplate({
      date: '"><img src=x onerror=alert(1)>',
      zone: '"><script>x</script>',
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
  });
});

describe("every main preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      X12_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(X12_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const e = EXPECTED[id!]!;

    expect(q(root, "copy-parse").dataset["copyText"]).toBe(e.calls);
    expect(text(root, "parse-output")).toBe(e.results);
    expect(isSentinel(root, "parse-output")).toBe(false);
    expect(text(root, "verdict")).toBe(e.verdict);
    expect(text(root, "reason-aside")).toBe("");
    for (const key of MEMBER_KEYS) {
      const cell = q(root, `member-${key}`);
      if (e.members[key] !== undefined) {
        expect(cell.textContent, key).toBe(e.members[key]);
        expect(cell.dataset["state"]).toBe("value");
      } else {
        expect(cell.textContent, key).toBe(NOT_STATED);
        expect(cell.dataset["state"]).toBe("absent");
      }
    }
    // The instant output is the first chosen zone's, or the stated offset's.
    expect(text(root, "instant-output")).toBe(
      e.instant === "no instant" ? e.instant : `"${e.instant}"`,
    );
    expect(text(root, "date-output")).toBe(
      e.date === "not sent" ? e.date : `"${e.date}"`,
    );
    expect(text(root, "time-output")).toBe(
      e.time === "not sent" ? e.time : `"${e.time}"`,
    );
  });

  it("prints resolveLocal(local, offset) for a code that states an offset, and no zone is read", async () => {
    const { root } = await mount();
    choose(root, "preset", "code-13");
    expect(q(root, "copy-resolve").dataset["copyText"]).toBe(
      'resolveLocal("2024-06-15T14:30:00", "-12:00")',
    );
    expect(q(root, "resolve-block").hidden).toBe(false);
    for (const n of [1, 2, 3, 4]) {
      expect(q<HTMLSelectElement>(root, `zone-${n}`).disabled).toBe(true);
    }
    expect(q(root, "timeline").dataset["state"]).toBe("stated");
  });

  it("prints resolveLocal in the first chosen zone for a code that states none", async () => {
    const { root } = await mount();
    choose(root, "preset", "status-et");
    expect(q(root, "copy-resolve").dataset["copyText"]).toBe(
      'resolveLocal("2024-06-15T14:30:00", "America/New_York", { disambiguation: "reject" })',
    );
    expect(text(root, "instant-1")).toBe("2024-06-15T18:30:00Z");
    expect(text(root, "instant-2")).toBe("2024-06-15T19:30:00Z");
    expect(text(root, "gap")).toContain("Widest gap: 1 h");
  });

  it("keeps example zones on exactly the presets whose strip has work to do", async () => {
    const { root } = await mount();
    for (const p of X12_PRESETS) {
      choose(root, "preset", p.id);
      const filled = [1, 2, 3, 4].some(
        (n) => q<HTMLSelectElement>(root, `zone-${n}`).value !== "",
      );
      expect(filled, p.id).toBe(p.zones.some((z) => z !== ""));
    }
  });

  it("never fills a zone from the time code typed", async () => {
    const { root } = await mount();
    for (const n of [1, 2, 3, 4]) choose(root, `zone-${n}`, "");
    type(root, "time-code", "ET");
    type(root, "date", "20240615");
    type(root, "time", "1430");
    for (const n of [1, 2, 3, 4])
      expect(q<HTMLSelectElement>(root, `zone-${n}`).value).toBe("");
    expect(text(root, "instant-1")).toBe("no zone chosen");
    expect(text(root, "instant-note")).toContain("Pick the IANA zone");
  });
});

describe("the sentinel", () => {
  it.each([
    ["240615", "1430", "", "CCYYMMDD"],
    ["20240615", "14:30", "", "HHMMSSDD"],
    ["20240615", "1430", "XX", "XX is not a 623 time code"],
    ["20240615", "", "ET", "qualifies a time"],
  ])("explains %j %j %j", async (date, time, code, snippet) => {
    const { root } = await mount();
    type(root, "date", date);
    type(root, "time", time);
    type(root, "time-code", code);
    expect(isSentinel(root, "parse-output")).toBe(true);
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain(snippet);
    for (const key of MEMBER_KEYS)
      expect(text(root, `member-${key}`)).toBe("no result");
    expect(text(root, "verdict")).toBe("");
    expect(text(root, "date-output")).toBe("nothing to write back");
  });

  it("a blank form makes no call and is empty, not amber", async () => {
    const { root } = await mount();
    type(root, "date", "");
    type(root, "time", "");
    type(root, "time-code", "");
    expect(text(root, "parse-output")).toBe("nothing to read");
    expect(isEmpty(root, "parse-output")).toBe(true);
    expect(q(root, "parse-block").hidden).toBe(true);
    expect(text(root, "reason-aside")).toBe("");
    expect(text(root, "verdict")).toBe("");
    expect(text(root, "instant-output")).toBe("no instant");
    expect(
      root.querySelector('[data-role="reason-aside"] .starlight-aside'),
    ).toBeNull();
  });
});

describe("writing back", () => {
  it("writes the date and the time with the element formatters and says where the date came from", async () => {
    const { root } = await mount();
    choose(root, "preset", "status-et");
    expect(q(root, "copy-write-date").dataset["copyText"]).toBe(
      'formatX12Date("2024-06-15", "D8")',
    );
    expect(q(root, "copy-write-time").dataset["copyText"]).toBe(
      'formatX12Time("14:30:00", "TM")',
    );
    expect(text(root, "format-note")).toContain("read alone by parseX12Date");
  });

  it("cuts hundredths and says so, instead of showing NO SIGNAL", async () => {
    const { root } = await mount();
    choose(root, "preset", "hundredths");
    expect(q(root, "copy-write-time").dataset["copyText"]).toBe(
      'formatX12Time("14:30:00.12", "TS")',
    );
    expect(text(root, "time-output")).toBe('"143000"');
    expect(isSentinel(root, "time-output")).toBe(false);
    expect(text(root, "format-note")).toContain("cuts tenths and hundredths");
  });
});

describe("the DTP section", () => {
  const EXPECTED_DTP: Record<
    string,
    { calls: string; result: string; written: string | null }
  > = {
    "range-rd8": {
      calls:
        'classifyX12DateTimePeriodFormat("RD8")\nparseX12DateRange("20240615-20240620", "RD8")',
      result:
        '{ kind: "dateRange", format: "RD8" }\n{ start: "2024-06-15", end: "2024-06-20" }',
      written: 'formatX12DateRange("2024-06-15", "2024-06-20", "RD8")',
    },
    "range-dts": {
      calls:
        'classifyX12DateTimePeriodFormat("DTS")\nparseX12DateTimeRange("20240615143000-20240620160000", "DTS")',
      result:
        '{ kind: "dateTimeRange", format: "DTS" }\n{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }',
      written:
        'formatX12DateTimeRange("2024-06-15T14:30:00", "2024-06-20T16:00:00", "DTS")',
    },
    "date-db": {
      calls:
        'classifyX12DateTimePeriodFormat("DB")\nparseX12Date("06152024", "DB")',
      result: '{ kind: "date", format: "DB" }\n"2024-06-15"',
      written: 'formatX12Date("2024-06-15", "DB")',
    },
    "d6-two-digit": {
      calls: 'classifyX12DateTimePeriodFormat("D6")',
      result: "NO SIGNAL",
      written: null,
    },
  };

  it("has an expectation for every DTP preset", () => {
    expect(Object.keys(EXPECTED_DTP).sort()).toEqual(
      DTP_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(DTP_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "dtp-preset", id!);
    const e = EXPECTED_DTP[id!]!;
    expect(q(root, "copy-dtp-parse").dataset["copyText"]).toBe(e.calls);
    expect(text(root, "dtp-parse-output")).toBe(e.result);
    if (e.written === null) {
      expect(isSentinel(root, "dtp-parse-output")).toBe(true);
      expect(text(root, "dtp-reason-aside")).toContain("yyMMdd");
      expect(text(root, "dtp-reason-aside")).toContain("yearWindow");
      expect(q(root, "dtp-format-block").hidden).toBe(true);
      for (const row of ["kind", "value", "range-end"]) {
        expect(text(root, `dtp-member-${row}`)).toBe("no result");
      }
    } else {
      expect(q(root, "copy-dtp-format").dataset["copyText"]).toBe(e.written);
      expect(isSentinel(root, "dtp-format-output")).toBe(false);
      expect(text(root, "dtp-reason-aside")).toBe("");
    }
  });

  it("starts on a preset that returns a value", async () => {
    const { root } = await mount();
    expect(isSentinel(root, "dtp-parse-output")).toBe(false);
    expect(text(root, "dtp-member-range-end")).toBe("2024-06-20");
    expect(text(root, "dtp-member-kind")).toBe("date range");
  });

  it("says a code it does not read is not read, and a blank pair is empty", async () => {
    const { root } = await mount();
    type(root, "dtp-format", "RTM");
    type(root, "dtp-value", "2200-0600");
    expect(text(root, "dtp-reason-aside")).toContain(
      "RTM is not a qualifier the library reads",
    );
    type(root, "dtp-format", "");
    type(root, "dtp-value", "");
    expect(text(root, "dtp-parse-output")).toBe("nothing to read");
    expect(q(root, "dtp-parse-block").hidden).toBe(true);
    expect(text(root, "dtp-reason-aside")).toBe("");
  });

  it("draws a range's two halves with the hyphen between", async () => {
    const { root } = await mount();
    expect(
      [...q(root, "dtp-figure").querySelectorAll(".gmt-edi-half-label")].map(
        (m) => m.textContent,
      ),
    ).toEqual(["start", "end"]);
    expect(
      q(root, "dtp-figure").querySelector(".gmt-edi-sep")?.textContent,
    ).toBe("-");
  });
});

describe("seeding and permalinks", () => {
  it("seeds the elements without a preset fallback", async () => {
    const { root } = await mount({
      date: "20240615",
      time: "1430",
      timeCode: "20",
    });
    expect(text(root, "verdict")).toBe("Offset: stated (-05:00)");
    expect(text(root, "instant-output")).toBe('"2024-06-15T19:30:00Z"');
  });

  it("loads an old link that still carries a year window without error, and ignores it", async () => {
    const { root, handle } = await mount({
      format: "D6",
      value: "240615",
      yearWindow: "2000",
    } as never);
    expect(text(root, "dtp-parse-output")).toBe("NO SIGNAL");
    expect(handle.getPermalinkState?.()).toEqual({
      format: "D6",
      value: "240615",
    });
  });

  it.each(X12_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await mount();
      choose(first.root, "preset", id!);
      const state = first.handle.getPermalinkState?.() as Record<
        string,
        unknown
      >;
      expect(
        Object.values(state).every(
          (v) => typeof v === "string" && v.length > 0,
        ),
      ).toBe(true);
      const url = encodeWidgetPermalink("xtime", state);
      const seeded = seedFromLocation("xtime", url.slice(url.indexOf("?")));
      expect(seeded).toEqual(state);
      const out = text(first.root, "parse-output");
      document.body.innerHTML = "";
      const second = await mount(seeded);
      expect(text(second.root, "parse-output")).toBe(out);
    },
  );
});

describe("naming and lifecycle", () => {
  it("names no regulator, statute, agency, docket or customs body, and no business event", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|gate-in)\b/i;
    const { root } = await mount();
    const seen: string[] = [renderX12TimeReaderTemplate()];
    for (const p of X12_PRESETS) {
      choose(root, "preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const p of DTP_PRESETS) {
      choose(root, "dtp-preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const s of seen) expect(s).not.toMatch(forbidden);
  });

  it("an aborted mount is inert, and destroying twice is safe", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderX12TimeReaderTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountX12TimeReader(root, {}, controller.signal);
    expect(text(root, "member-value")).toBe("no result");
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });

  it("stops answering once destroyed", async () => {
    const { root, handle } = await mount();
    handle.destroy();
    type(root, "time-code", "XX");
    expect(text(root, "verdict")).toBe("Offset: not stated");
  });
});

function screenText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('.gmt-codeframe, output[data-role$="output"]')
    .forEach((e) => e.remove());
  const labels = [...clone.querySelectorAll("[aria-label]")].map((e) =>
    e.getAttribute("aria-label"),
  );
  return `${clone.textContent}\n${labels.join("\n")}`;
}

describe("on-screen words", () => {
  it.each(X12_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null and never calls the library GMT",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      const shown = screenText(root);
      expect(shown).not.toMatch(/\b(null|undefined)\b/);
      expect(shown).not.toMatch(/GMT (does|returns|maps|reads|never)/);
      for (const key of MEMBER_KEYS) {
        expect(text(root, `member-${key}`)).not.toMatch(/null|undefined|^$/);
      }
    },
  );

  it("takes the three elements apart and says what the code calls returned", async () => {
    const { root } = await mount();
    expect(q(root, "figure").getAttribute("aria-label")).toBe(
      "Date: year 2024, month 06, day 15. Time: hour 14, minute 30. Time code ET: zone Eastern, daylight not said.",
    );
    expect(text(root, "figure-note")).toContain(
      'x12TimeCodeZone("ET") returned zone Eastern, daylight not said.',
    );
  });

  it("reserves a hold for every text a region can show", () => {
    const root = document.createElement("div");
    root.innerHTML = renderX12TimeReaderTemplate();
    const descriptions = root.querySelector(
      '[data-role="preset-description"]',
    )!.parentElement!;
    expect(descriptions.querySelectorAll(".gmt-edi-sizer").length).toBe(
      new Set(X12_PRESETS.map((p) => p.description)).size,
    );
    for (const sizer of root.querySelectorAll(".gmt-edi-sizer")) {
      expect(sizer.getAttribute("aria-hidden")).toBe("true");
    }
  });
});
