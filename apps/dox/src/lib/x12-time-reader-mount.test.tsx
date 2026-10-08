/**
 * @vitest-environment jsdom
 *
 * The X12 Time Reader end to end: template → mount → interact → assert, against
 * the real `@northguild/gmt`. Every preset's printed call, result, verdict,
 * members, instant and write-back are checked against values derived by running
 * the calls against `packages/gmt/dist`, so a drift in the library or the widget
 * fails here.
 */
/// <reference types="vitest/globals" />
import { lib } from "~/test/edi-lib";
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import {
  DTP_NULL_REASON_TEXT,
  DTP_PRESETS,
  NULL_REASON_TEXT,
  X12_PRESETS,
} from "./x12-time-reader";
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
  "member-date",
  "member-time",
  "member-local",
  "member-instant",
  "member-offset",
  "member-zone",
  "member-daylight",
  "call-parse",
  "copy-parse",
  "parse-output",
  "reason-aside",
  "instant-output",
  "instant-note",
  "strip-note",
  "gap-strip",
  "zone-1",
  "zone-2",
  "zone-3",
  "zone-4",
  "instant-1",
  "instant-4",
  "offset-1",
  "offset-4",
  "withoffset-1",
  "withoffset-4",
  "gap",
  "figure",
  "figure-note",
  "timeline",
  "dtp-figure",
  "strip-summary",
  "strip-aside",
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
  "year-window",
  "year-start",
  "dtp-note",
  "dtp-readouts",
  "dtp-member-date",
  "dtp-member-time",
  "dtp-member-local",
  "dtp-member-day-of-year",
  "dtp-member-year-digit",
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
const NO_SIGNAL = "NO SIGNAL";

interface Expected {
  call: string;
  result: string;
  verdict: string;
  /** Member cells the result holds; the rest read `not stated by this code`. */
  members: Record<string, string>;
  instant: string;
  date: string;
  time: string;
}

const L = "2024-06-15T14:30:00";
const base = { date: "2024-06-15", time: "14:30:00", local: L };
const BASE =
  'date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00"';

const EXPECTED: Record<string, Expected> = {
  "status-et": {
    call: 'parseX12DateTime("20240615", "1430", "ET")',
    result: `{ ${BASE}, zone: "Eastern", daylight: null }`,
    verdict: "Zone named, offset not stated: Eastern (not said)",
    members: { ...base, zone: "Eastern", daylight: "not said" },
    instant: "no instant",
    date: '"20240615"',
    time: '"1430"',
  },
  "status-ed": {
    call: 'parseX12DateTime("20240615", "1430", "ED")',
    result: `{ ${BASE}, zone: "Eastern", daylight: true }`,
    verdict: "Zone named, offset not stated: Eastern (daylight)",
    members: { ...base, zone: "Eastern", daylight: "daylight" },
    instant: "no instant",
    date: '"20240615"',
    time: '"1430"',
  },
  "status-es": {
    call: 'parseX12DateTime("20240115", "1430", "ES")',
    result:
      '{ date: "2024-01-15", time: "14:30:00", local: "2024-01-15T14:30:00", zone: "Eastern", daylight: false }',
    verdict: "Zone named, offset not stated: Eastern (standard)",
    members: {
      date: "2024-01-15",
      time: "14:30:00",
      local: "2024-01-15T14:30:00",
      zone: "Eastern",
      daylight: "standard",
    },
    instant: "no instant",
    date: '"20240115"',
    time: '"1430"',
  },
  "status-ut": {
    call: 'parseX12DateTime("20240615", "1430", "UT")',
    result: `{ ${BASE}, offset: "+00:00", instant: "2024-06-15T14:30:00Z" }`,
    verdict: "Offset stated: +00:00",
    members: { ...base, offset: "+00:00", instant: "2024-06-15T14:30:00Z" },
    instant: '"2024-06-15T14:30:00Z"',
    date: '"20240615"',
    time: '"1430"',
  },
  "code-13": {
    call: 'parseX12DateTime("20240615", "1430", "13")',
    result: `{ ${BASE}, offset: "-12:00", instant: "2024-06-16T02:30:00Z" }`,
    verdict: "Offset stated: -12:00",
    members: { ...base, offset: "-12:00", instant: "2024-06-16T02:30:00Z" },
    instant: '"2024-06-16T02:30:00Z"',
    date: '"20240615"',
    time: '"1430"',
  },
  "code-24": {
    call: 'parseX12DateTime("20240615", "1430", "24")',
    result: `{ ${BASE}, offset: "-01:00", instant: "2024-06-15T15:30:00Z" }`,
    verdict: "Offset stated: -01:00",
    members: { ...base, offset: "-01:00", instant: "2024-06-15T15:30:00Z" },
    instant: '"2024-06-15T15:30:00Z"',
    date: '"20240615"',
    time: '"1430"',
  },
  hundredths: {
    call: 'parseX12DateTime("20240615", "14300012")',
    result:
      '{ date: "2024-06-15", time: "14:30:00.12", local: "2024-06-15T14:30:00.12" }',
    verdict: "Nothing stated: no time code was sent",
    members: {
      date: "2024-06-15",
      time: "14:30:00.12",
      local: "2024-06-15T14:30:00.12",
    },
    instant: "no instant",
    date: '"20240615"',
    time: NO_SIGNAL,
  },
  "no-code": {
    call: 'parseX12DateTime("20240615", "1430")',
    result: `{ ${BASE} }`,
    verdict: "Nothing stated: no time code was sent",
    members: base,
    instant: "no instant",
    date: '"20240615"',
    time: '"1430"',
  },
  "local-lt": {
    call: 'parseX12DateTime("20240615", "1430", "LT")',
    result: `{ ${BASE}, zone: "Local", daylight: null }`,
    verdict: "Nothing stated: local to the event",
    members: { ...base, zone: "Local", daylight: "not said" },
    instant: "no instant",
    date: '"20240615"',
    time: '"1430"',
  },
  "date-only": {
    call: 'parseX12DateTime("20240615")',
    result: '{ date: "2024-06-15" }',
    verdict: "A date only",
    members: { date: "2024-06-15" },
    instant: "no instant",
    date: '"20240615"',
    time: "not sent",
  },
  "time-only": {
    call: 'parseX12DateTime("", "1430")',
    result: '{ time: "14:30:00" }',
    verdict: "A time only: a time alone names no instant",
    members: { time: "14:30:00" },
    instant: "no instant",
    date: "not sent",
    time: '"1430"',
  },
  "code-no-time": {
    call: 'parseX12DateTime("20240615", "", "ET")',
    result: NO_SIGNAL,
    verdict: "",
    members: {},
    instant: "no instant",
    date: "nothing to write back",
    time: "nothing to write back",
  },
};

const REJECT = { disambiguation: "reject" } as const;
const preset = (id: string) => X12_PRESETS.find((p) => p.id === id)!;

/** What the output slot shows for a preset: the library's own `resolveLocal`
 *  in the preset's first zone when it states one, else `e.instant`. */
function presetInstantOutput(id: string, e: Expected): string {
  const zone = preset(id).zones[0]!;
  if (zone === "") return e.instant;
  return `"${lib.resolveLocal(e.members["local"]!, zone, REJECT)}"`;
}

const MEMBER_KEYS = [
  "date",
  "time",
  "local",
  "instant",
  "offset",
  "zone",
  "daylight",
];

const DTP_EXPECTED: Record<
  string,
  {
    call: string;
    result: string;
    members: Record<string, string>;
    formatCall: string | null;
    format: string;
  }
> = {
  "range-rd8": {
    call: 'parseX12DateTimePeriod("20240615-20240620", "RD8")',
    result: '{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }',
    members: { date: "2024-06-15", "range-end": "2024-06-20" },
    formatCall: 'formatX12DateTimePeriod("2024-06-15/2024-06-20", "RD8")',
    format: '"20240615-20240620"',
  },
  "ordinal-tc": {
    call: 'parseX12DateTimePeriod("166", "TC")',
    result: "{ dayOfYear: 166 }",
    members: { "day-of-year": "166" },
    formatCall: null,
    format: "nothing to write back",
  },
  "overnight-rtm": {
    call: 'parseX12DateTimePeriod("2200-0600", "RTM")',
    result: '{ time: "22:00:00", periodEnd: { time: "06:00:00" } }',
    members: { time: "22:00:00", "range-end": "06:00:00" },
    formatCall: 'formatX12DateTimePeriod("22:00:00/06:00:00", "RTM")',
    format: '"2200-0600"',
  },
  "d6-no-window": {
    call: 'parseX12DateTimePeriod("240615", "D6")',
    result: NO_SIGNAL,
    members: {},
    formatCall: null,
    format: "nothing to write back",
  },
  "d6-window": {
    call: 'parseX12DateTimePeriod("240615", "D6", { yearWindow: 2000 })',
    result: '{ date: "2024-06-15" }',
    members: { date: "2024-06-15" },
    formatCall: 'formatX12DateTimePeriod("2024-06-15", "D6", { yearWindow: 2000 })',
    format: '"240615"',
  },
};

const DTP_KEYS = [
  "date",
  "time",
  "local",
  "day-of-year",
  "year-digit",
  "range-end",
];

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderX12TimeReaderTemplate(templateArgs);
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
  vi.useRealTimers();
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
    expect(widget.getAttributeNames()).toEqual(["class"]);
    const cardClasses = [...root.querySelectorAll("[class]")]
      .flatMap((el) => [...el.classList])
      .filter((c) => c.includes("card"));
    expect(new Set(cardClasses)).toEqual(new Set(["gmt-widget-card"]));
  });

  it("holds no result, renders six sections and the first preset of each", () => {
    const root = document.createElement("div");
    root.innerHTML = renderX12TimeReaderTemplate();
    expect(root.querySelectorAll(".gmt-widget-section")).toHaveLength(6);
    expect(text(root, "member-local")).toBe("no result");
    expect(text(root, "verdict")).toBe("");
    expect(q<HTMLInputElement>(root, "date").value).toBe("20240615");
    expect(q<HTMLInputElement>(root, "time-code").value).toBe("ET");
    expect(q<HTMLInputElement>(root, "dtp-format").value).toBe("RD8");
    // The first preset states its own zones, so the tool opens on an answer.
    expect(
      [1, 2, 3, 4].map((n) => q<HTMLSelectElement>(root, `zone-${n}`).value),
    ).toEqual(["America/New_York", "America/Atikokan", "", ""]);
  });

  it("escapes a hostile seed", () => {
    const root = document.createElement("div");
    root.innerHTML = renderX12TimeReaderTemplate({
      date: '"><img src=x onerror=alert(1)>',
      timeCode: '"><script>x</script>',
      value: '"><svg onload=alert(1)>',
      zone: '"><script>x</script>',
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("svg[onload]")).toBeNull();
  });

  it("renders the year controls without a placeholder, disabled until a code needs them", () => {
    const root = document.createElement("div");
    root.innerHTML = renderX12TimeReaderTemplate();
    expect(q(root, "year-start").hasAttribute("placeholder")).toBe(false);
    expect(q<HTMLSelectElement>(root, "year-window").disabled).toBe(true);
  });
});

describe("every main preset, against the real library", () => {
  it.each(X12_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const e = EXPECTED[id!]!;

    expect(q(root, "copy-parse").dataset["copyText"]).toBe(e.call);
    expect(text(root, "parse-output")).toBe(e.result);
    expect(text(root, "verdict")).toBe(e.verdict);

    for (const key of MEMBER_KEYS) {
      const cell = q(root, `member-${key}`);
      if (e.result === NO_SIGNAL) {
        expect(cell.textContent, key).toBe("no result");
        expect(cell.dataset["state"]).toBe("none");
      } else if (e.members[key] !== undefined) {
        expect(cell.textContent, key).toBe(e.members[key]);
        expect(cell.dataset["state"]).toBe("value");
      } else {
        expect(cell.textContent, key).toBe(NOT_STATED);
        expect(cell.dataset["state"]).toBe("absent");
      }
    }

    expect(isSentinel(root, "parse-output")).toBe(e.result === NO_SIGNAL);
    if (e.result === NO_SIGNAL) {
      expect(text(root, "reason-aside")).toContain(
        NULL_REASON_TEXT["needs-time"]({ timeCode: "ET" }),
      );
    } else {
      expect(text(root, "reason-aside")).toBe("");
    }

    const instant = presetInstantOutput(id!, e);
    expect(text(root, "instant-output")).toBe(instant);
    expect(isEmpty(root, "instant-output")).toBe(instant === "no instant");

    expect(text(root, "date-output")).toBe(e.date);
    expect(text(root, "time-output")).toBe(e.time);
    expect(isSentinel(root, "time-output")).toBe(e.time === NO_SIGNAL);
    expect(isSentinel(root, "date-output")).toBe(false);
    if (e.time.startsWith('"')) {
      expect(q(root, "copy-write-time").dataset["copyText"]).toMatch(
        /^formatX12DateTimePeriod\("14:30:00", "TM"\)$/,
      );
    }
    if (e.date.startsWith('"')) {
      expect(q(root, "copy-write-date").dataset["copyText"]).toBe(
        `formatX12DateTimePeriod("${e.members["date"]}", "D8")`,
      );
    }
  });

  it("the hundredths preset reads the fraction and says it is not written", async () => {
    const { root } = await mount();
    choose(root, "preset", "hundredths");
    expect(q(root, "copy-write-time").dataset["copyText"]).toBe(
      'formatX12DateTimePeriod("14:30:00.12", "TS")',
    );
    expect(text(root, "format-note")).toContain(
      "Tenths and hundredths of a second are read and not written",
    );
  });

  it("fills a preset's own zones on choosing it, and no others", async () => {
    const { root } = await mount();
    for (const p of X12_PRESETS) {
      choose(root, "preset", p.id);
      for (const n of [1, 2, 3, 4]) {
        expect(q<HTMLSelectElement>(root, `zone-${n}`).value, p.id).toBe(
          p.zones[n - 1],
        );
      }
      expect(q<HTMLSelectElement>(root, "preset").value).toBe(p.id);
    }
  });
});

describe("a preset with zones answers on load; one without keeps its empty state", () => {
  const withZones = X12_PRESETS.filter((p) => p.zones[0] !== "");
  const without = X12_PRESETS.filter((p) => p.zones[0] === "");

  it.each(withZones.map((p) => [p.id]))("%s: instant, strip rows and gap line, values from the library", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const p = preset(id!);
    const e = EXPECTED[id!]!;
    const local = e.members["local"]!;
    const named = p.zones.filter((z) => z !== "");

    expect(text(root, "instant-output")).toBe(
      `"${lib.resolveLocal(local, named[0]!, REJECT)}"`,
    );
    expect(isEmpty(root, "instant-output")).toBe(false);
    expect(q(root, "copy-resolve").dataset["copyText"]).toBe(
      `resolveLocal("${local}", "${named[0]}", { disambiguation: "reject" })`,
    );
    expect(q<HTMLElement>(root, "resolve-block").hidden).toBe(false);

    const instants: string[] = [];
    p.zones.forEach((zone, i) => {
      const n = i + 1;
      expect(q<HTMLSelectElement>(root, `zone-${n}`).disabled).toBe(false);
      if (zone === "") {
        expect(text(root, `instant-${n}`)).toBe("no zone chosen");
        return;
      }
      const instant = lib.resolveLocal(local, zone, REJECT) as string;
      instants.push(instant);
      expect(text(root, `instant-${n}`)).toBe(instant);
      expect(text(root, `offset-${n}`)).toBe(
        lib.toOffsetInstant(instant, zone)!.offset,
      );
      expect(text(root, `withoffset-${n}`)).toBe(
        lib.fromOffsetInstant({
          instant,
          offset: lib.toOffsetInstant(instant, zone)!.offset,
        }),
      );
      expect(isSentinel(root, `instant-${n}`)).toBe(false);
    });

    if (named.length < 2) {
      expect(text(root, "gap")).toBe(
        "Choose two zones to see how far apart the answers are.",
      );
    } else {
      const min = lib.minUtc(instants)!;
      const max = lib.maxUtc(instants)!;
      const hours = lib.diffUtcAsDuration(min, max, "hours");
      expect(hours).toMatch(/^PT\d+H$/);
      expect(text(root, "gap")).toMatch(
        new RegExp(`^Widest gap: ${hours.slice(2, -1)} h, between `),
      );
    }
    // The description says whose pick the zone is.
    expect(text(root, "preset-description")).toMatch(/example's picks?\b/);
  });

  it.each(without.map((p) => [p.id]))("%s: no zone, strip disabled or empty as before", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const result = EXPECTED[id!]!.result;
    for (const n of [1, 2, 3, 4]) {
      expect(q<HTMLSelectElement>(root, `zone-${n}`).value).toBe("");
      const row = text(root, `instant-${n}`);
      const disabled = q<HTMLSelectElement>(root, `zone-${n}`).disabled;
      // A strip that applies would show no zone chosen; every other case is
      // disabled and blank.
      expect(disabled || row === "no zone chosen").toBe(true);
      if (disabled) expect(row).toBe("");
    }
    expect(text(root, "instant-output")).toBe(
      presetInstantOutput(id!, EXPECTED[id!]!),
    );
    expect(q<HTMLElement>(root, "resolve-block").hidden).toBe(true);
    expect(result).toBeDefined();
  });
});

describe("the instant and the strip", () => {
  it("ET opens on America/New_York at 18:30Z; a January date moves it an hour, and the select reads Custom (X1z, X1zj)", async () => {
    const { root } = await mount();
    expect(text(root, "instant-output")).toBe('"2024-06-15T18:30:00Z"');
    expect(q(root, "copy-resolve").dataset["copyText"]).toBe(
      'resolveLocal("2024-06-15T14:30:00", "America/New_York", { disambiguation: "reject" })',
    );
    expect(q<HTMLElement>(root, "resolve-block").hidden).toBe(false);
    expect(text(root, "instant-1")).toBe("2024-06-15T18:30:00Z");
    expect(text(root, "offset-1")).toBe("-04:00");
    expect(text(root, "withoffset-1")).toBe("2024-06-15T14:30:00-04:00");
    expect(text(root, "instant-2")).toBe("2024-06-15T19:30:00Z");
    expect(text(root, "offset-2")).toBe("-05:00");
    expect(text(root, "gap")).toBe(
      "Widest gap: 1 h, between America/New_York and America/Atikokan",
    );
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("status-et");

    type(root, "date", "20240115");
    expect(text(root, "instant-output")).toBe('"2024-01-15T19:30:00Z"');
    expect(text(root, "offset-1")).toBe("-05:00");
    // Editing a field switches to Custom and keeps the zones, which are state.
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(q<HTMLSelectElement>(root, "zone-1").value).toBe("America/New_York");
    expect(q<HTMLSelectElement>(root, "zone-2").value).toBe("America/Atikokan");
  });

  it("a hidden block holds no stale call line: clearing the zones empties the resolve call and its copy text", async () => {
    const { root } = await mount();
    expect(text(root, "call-resolve")).toContain("resolveLocal(");
    for (const n of [1, 2, 3, 4]) choose(root, `zone-${n}`, "");
    expect(q<HTMLElement>(root, "resolve-block").hidden).toBe(true);
    expect(text(root, "call-resolve")).toBe("");
    expect(q(root, "copy-resolve").dataset["copyText"]).toBeUndefined();
    // The write-back blocks follow the same rule.
    choose(root, "preset", "time-only");
    expect(q<HTMLElement>(root, "date-block").hidden).toBe(true);
    expect(text(root, "call-write-date")).toBe("");
    expect(q(root, "copy-write-date").dataset["copyText"]).toBeUndefined();
    choose(root, "preset", "date-only");
    expect(text(root, "call-write-time")).toBe("");
    expect(q(root, "copy-write-time").dataset["copyText"]).toBeUndefined();
  });

  it("reads the same digits in four zones and names the widest gap", async () => {
    const { root } = await mount();
    choose(root, "zone-1", "America/New_York");
    choose(root, "zone-2", "Europe/Berlin");
    choose(root, "zone-3", "Asia/Shanghai");
    choose(root, "zone-4", "America/Los_Angeles");
    expect(text(root, "instant-2")).toBe("2024-06-15T12:30:00Z");
    expect(text(root, "instant-3")).toBe("2024-06-15T06:30:00Z");
    expect(text(root, "instant-4")).toBe("2024-06-15T21:30:00Z");
    expect(text(root, "gap")).toBe(
      "Widest gap: 15 h, between Asia/Shanghai and America/Los_Angeles",
    );
    const line = q(root, "timeline");
    expect(line.dataset["state"]).toBe("marks");
    expect(line.querySelectorAll(".gmt-edi-tl-mark")).toHaveLength(4);
    expect(line.querySelector(".gmt-edi-tl-gap")?.textContent).toBe("15 h");
  });

  it("says no zone chosen for a blank slot, and no instant until one is picked", async () => {
    const { root } = await mount();
    for (const n of [1, 2, 3, 4]) choose(root, `zone-${n}`, "");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(text(root, "instant-1")).toBe("no zone chosen");
    expect(text(root, "instant-output")).toBe("no instant");
    expect(text(root, "instant-note")).toBe(
      "No instant: the code names Eastern time and states no offset. Pick the IANA zone it means for you.",
    );
    expect(text(root, "gap")).toBe(
      "Choose two zones to see how far apart the answers are.",
    );
    expect(q<HTMLElement>(root, "resolve-block").hidden).toBe(true);
    choose(root, "zone-1", "America/New_York");
    expect(text(root, "instant-output")).toBe('"2024-06-15T18:30:00Z"');
  });

  it("UT disables the four zone selects and blanks the strip", async () => {
    const { root } = await mount();
    choose(root, "preset", "status-ut");
    for (const n of [1, 2, 3, 4]) {
      expect(q<HTMLSelectElement>(root, `zone-${n}`).disabled).toBe(true);
      expect(text(root, `instant-${n}`)).toBe("");
    }
    expect(text(root, "gap")).toBe("");
    expect(q(root, "timeline").dataset["state"]).toBe("stated");
    expect(text(root, "strip-note")).toBe(
      "The time code states the offset, so there is nothing to choose.",
    );
    expect(text(root, "instant-note")).toContain("instant member of the call above");
    expect(q<HTMLElement>(root, "resolve-block").hidden).toBe(true);
  });

  it("disables the zones for a date only and a time only, and enables them for LT and no code", async () => {
    const { root } = await mount();
    for (const [id, disabled] of [
      ["date-only", true],
      ["time-only", true],
      ["local-lt", false],
      ["no-code", false],
    ] as const) {
      choose(root, "preset", id);
      expect(q<HTMLSelectElement>(root, "zone-1").disabled, id).toBe(disabled);
    }
  });

  it("renders a time the clock shows twice as NO SIGNAL with its reason (D16)", async () => {
    const { root } = await mount();
    type(root, "date", "20241103");
    type(root, "time", "0130");
    type(root, "time-code", "");
    choose(root, "zone-1", "America/New_York");
    expect(text(root, "instant-output")).toBe(NO_SIGNAL);
    expect(isSentinel(root, "instant-output")).toBe(true);
    expect(isSentinel(root, "instant-1")).toBe(true);
    expect(text(root, "strip-aside")).toContain(
      "America/New_York: The 01:30 time happens twice in America/New_York",
    );
    expect(text(root, "strip-aside")).toContain("happens twice");
  });

  it("changes a row when its zone changes", async () => {
    const { root } = await mount();
    choose(root, "zone-2", "Asia/Kolkata");
    expect(text(root, "instant-2")).toBe("2024-06-15T09:00:00Z");
  });
});

describe("a sentinel is told apart from an empty answer", () => {
  it("a time code with no time is NO SIGNAL, with the reason", async () => {
    const { root } = await mount();
    choose(root, "preset", "code-no-time");
    expect(isSentinel(root, "parse-output")).toBe(true);
    expect(text(root, "reason-aside")).toContain(
      "X12 requires the time whenever the code is sent",
    );
    expect(text(root, "verdict")).toBe("");
  });

  it.each([
    ["EST", "20240615", "1430", "is not a 623 time code"],
    ["et", "20240615", "1430", "is not a 623 time code"],
    ["", "240615", "1430", "four-digit year"],
    ["", "20240615", "2430", "element 337 forms"],
  ])("code %j, date %j, time %j is NO SIGNAL (%s)", async (code, date, time, snippet) => {
    const { root } = await mount();
    type(root, "date", date);
    type(root, "time", time);
    type(root, "time-code", code);
    expect(text(root, "parse-output")).toBe(NO_SIGNAL);
    expect(text(root, "reason-aside")).toContain(snippet);
  });

  it("a blank main section makes no call and is empty, not amber", async () => {
    const { root } = await mount();
    type(root, "date", "");
    type(root, "time", "");
    type(root, "time-code", "");
    expect(text(root, "parse-output")).toBe("nothing to read");
    expect(isEmpty(root, "parse-output")).toBe(true);
    expect(isSentinel(root, "parse-output")).toBe(false);
    expect(text(root, "reason-aside")).toBe("");
    expect(text(root, "date-output")).toBe("nothing to write back");
  });

  it("a legitimately empty write-back is not NO SIGNAL", async () => {
    const { root } = await mount();
    choose(root, "preset", "date-only");
    expect(text(root, "time-output")).toBe("not sent");
    expect(isEmpty(root, "time-output")).toBe(true);
    expect(isSentinel(root, "time-output")).toBe(false);
  });
});

describe("the DTP section", () => {
  it.each(DTP_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "dtp-preset", id!);
    const e = DTP_EXPECTED[id!]!;
    expect(q(root, "copy-dtp-parse").dataset["copyText"]).toBe(e.call);
    expect(text(root, "dtp-parse-output")).toBe(e.result);
    for (const key of DTP_KEYS) {
      const cell = q(root, `dtp-member-${key}`);
      if (e.result === NO_SIGNAL) {
        expect(cell.textContent, key).toBe("no result");
      } else if (e.members[key] !== undefined) {
        expect(cell.textContent, key).toBe(e.members[key]);
      } else {
        expect(cell.textContent, key).toBe(NOT_STATED);
      }
    }
    expect(isSentinel(root, "dtp-parse-output")).toBe(e.result === NO_SIGNAL);
    if (e.result === NO_SIGNAL) {
      expect(text(root, "dtp-reason-aside")).toContain(
        DTP_NULL_REASON_TEXT["needs-year-window"]({ format: "D6" }),
      );
    }
    expect(text(root, "dtp-format-output")).toBe(e.format);
    if (e.formatCall !== null) {
      expect(q(root, "copy-dtp-format").dataset["copyText"]).toBe(e.formatCall);
    }
    expect(isEmpty(root, "dtp-format-output")).toBe(e.formatCall === null);
  });

  it("explains why TC writes nothing back", async () => {
    const { root } = await mount();
    choose(root, "dtp-preset", "ordinal-tc");
    expect(text(root, "dtp-format-note")).toContain(
      "TC keeps only the day of the year",
    );
  });

  it("D6 with no window disables nothing it should enable: the year controls open, then a start year clears the sentinel", async () => {
    const { root } = await mount();
    choose(root, "dtp-preset", "d6-no-window");
    expect(q<HTMLSelectElement>(root, "year-window").disabled).toBe(false);
    expect(q<HTMLInputElement>(root, "year-start").disabled).toBe(true);
    choose(root, "year-window", "fixed");
    expect(q<HTMLInputElement>(root, "year-start").disabled).toBe(false);
    type(root, "year-start", "2000");
    expect(text(root, "dtp-parse-output")).toBe('{ date: "2024-06-15" }');
    expect(q<HTMLSelectElement>(root, "dtp-preset").value).toBe("d6-window");
  });

  it("disables both year controls for a qualifier with a four-digit year, and keeps them in the template", async () => {
    const { root } = await mount();
    expect(q<HTMLSelectElement>(root, "year-window").disabled).toBe(true);
    expect(q<HTMLInputElement>(root, "year-start").disabled).toBe(true);
    expect(text(root, "dtp-note")).toBe(
      "Qualifier RD8 carries a four-digit year. The window is not read.",
    );
  });

  it("explains a window that is not a year, and a hyphen-less range", async () => {
    const { root } = await mount();
    choose(root, "dtp-preset", "d6-no-window");
    choose(root, "year-window", "fixed");
    type(root, "year-start", "9901");
    expect(text(root, "dtp-parse-output")).toBe(NO_SIGNAL);
    expect(text(root, "dtp-reason-aside")).toContain(
      "The window is rolling or a whole year from 0 to 9900.",
    );
    choose(root, "dtp-preset", "range-rd8");
    type(root, "dtp-value", "2024061520240620");
    expect(text(root, "dtp-parse-output")).toBe(NO_SIGNAL);
    expect(text(root, "dtp-reason-aside")).toContain("range sent without its hyphen");
  });

  it("passes rolling through to the library, which reads the clock (faked here)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-10-07T12:00:00Z");
    const { root } = await mount();
    choose(root, "dtp-preset", "d6-no-window");
    type(root, "dtp-value", "990615");
    choose(root, "year-window", "rolling");
    expect(q(root, "copy-dtp-parse").dataset["copyText"]).toBe(
      'parseX12DateTimePeriod("990615", "D6", { yearWindow: "rolling" })',
    );
    expect(text(root, "dtp-parse-output")).toBe('{ date: "1999-06-15" }');
  });

  it("an empty DTP section makes no call and is empty, not amber", async () => {
    const { root } = await mount({ date: "20240615", time: "1430" });
    expect(text(root, "dtp-parse-output")).toBe("nothing to read");
    expect(isEmpty(root, "dtp-parse-output")).toBe(true);
    expect(text(root, "dtp-reason-aside")).toBe("");
  });

  it("a main-section preset leaves the DTP section alone", async () => {
    const { root } = await mount();
    choose(root, "dtp-preset", "overnight-rtm");
    choose(root, "preset", "code-13");
    expect(q<HTMLInputElement>(root, "dtp-format").value).toBe("RTM");
    expect(q<HTMLSelectElement>(root, "dtp-preset").value).toBe("overnight-rtm");
  });
});

describe("seeding", () => {
  it("a seed that names no zone gets none: nothing falls back to the preset's zones", async () => {
    const { root } = await mount({
      date: "20240615",
      time: "1430",
      timeCode: "ET",
    });
    expect(text(root, "verdict")).toBe(
      "Zone named, offset not stated: Eastern (not said)",
    );
    expect(text(root, "instant-1")).toBe("no zone chosen");
    expect(text(root, "instant-output")).toBe("no instant");
    for (const n of [1, 2, 3, 4]) {
      expect(q<HTMLSelectElement>(root, `zone-${n}`).value).toBe("");
    }
    // The preset has zones, so a state with none is not that preset.
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("a seed that carries the example's zones is that preset", async () => {
    const { root } = await mount({
      date: "20240615",
      time: "1430",
      timeCode: "ED",
      zone: "America/New_York",
    });
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("status-ed");
    expect(text(root, "instant-output")).toBe('"2024-06-15T18:30:00Z"');
  });

  it("seeds an unlisted zone without dropping it", async () => {
    const { root } = await mount({
      date: "20240615",
      time: "1430",
      zone: "Africa/Nairobi",
    });
    expect(q<HTMLSelectElement>(root, "zone-1").value).toBe("Africa/Nairobi");
    expect(text(root, "instant-1")).toBe("2024-06-15T11:30:00Z");
  });

  it("does not fall back to a preset: a time only seed leaves the date blank", async () => {
    const { root } = await mount({ time: "1430" });
    expect(q<HTMLInputElement>(root, "date").value).toBe("");
    expect(text(root, "parse-output")).toBe('{ time: "14:30:00" }');
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("time-only");
  });

  it("seeds a DTP pair and a numeric window", async () => {
    const { root } = await mount({
      format: "D6",
      value: "240615",
      yearWindow: 2000,
    });
    expect(q<HTMLSelectElement>(root, "year-window").value).toBe("fixed");
    expect(q<HTMLInputElement>(root, "year-start").value).toBe("2000");
    expect(text(root, "dtp-parse-output")).toBe('{ date: "2024-06-15" }');
    expect(text(root, "parse-output")).toBe("nothing to read");
  });

  it("seeds from the template too", async () => {
    const args = { date: "20240615", timeCode: "ET", time: "1430" };
    const { root } = await mount(args, args);
    expect(q<HTMLInputElement>(root, "time-code").value).toBe("ET");
  });
});

describe("permalinks", () => {
  const ALL = [
    ...X12_PRESETS.map((p) => ["preset", p.id] as const),
    ...DTP_PRESETS.map((p) => ["dtp-preset", p.id] as const),
  ];

  it.each(ALL)("round-trips %s %s as a permalink of strings", async (role, id) => {
    const first = await mount();
    choose(first.root, role, id);
    const state = first.handle.getPermalinkState?.() as Record<string, unknown>;
    expect(
      Object.values(state).every(
        (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
      ),
    ).toBe(true);
    const url = encodeWidgetPermalink("xtime", state);
    expect(url).toMatch(/\?w=xtime&wa=[^)"'\s]+$/);
    const seeded = seedFromLocation("xtime", url.slice(url.indexOf("?")));
    expect(seeded).toEqual(state);
    const out = [
      text(first.root, "parse-output"),
      text(first.root, "dtp-parse-output"),
    ];
    document.body.innerHTML = "";

    const second = await mount(seeded);
    expect([
      text(second.root, "parse-output"),
      text(second.root, "dtp-parse-output"),
    ]).toEqual(out);
  });

  it("uses the fixed keys date, time and timeCode", async () => {
    const { root, handle } = await mount();
    choose(root, "preset", "status-et");
    choose(root, "zone-1", "America/New_York");
    expect(handle.getPermalinkState?.()).toMatchObject({
      date: "20240615",
      time: "1430",
      timeCode: "ET",
      zone: "America/New_York",
    });
  });
});

describe("naming", () => {
  it("names no regulator, statute, agency or business event, and no peer library", async () => {
    const forbidden =
      /\b(CFR|statut|regulat|docket|agency|customs|HIPAA|healthcare|gate-in|bill of lading|booking)\b|luxon|date-fns|moment/i;
    const { root } = await mount();
    const seen: string[] = [renderX12TimeReaderTemplate()];
    for (const p of X12_PRESETS) {
      seen.push(p.label, p.description);
      choose(root, "preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const p of DTP_PRESETS) {
      seen.push(p.label, p.description);
      choose(root, "dtp-preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const reason of Object.values(NULL_REASON_TEXT)) {
      seen.push(reason({ timeCode: "EST" }));
    }
    for (const reason of Object.values(DTP_NULL_REASON_TEXT)) {
      seen.push(reason({ format: "DTM" }));
    }
    for (const s of seen) expect(s).not.toMatch(forbidden);
  });

  it("never derives a zone from a time code: with the zones empty, typing any of the 56 codes changes no zone and shows no IANA id", async () => {
    const codes: string[] = [];
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (const a of chars) {
      for (const b of chars) {
        if (lib.x12TimeCode(a + b) !== null) codes.push(a + b);
      }
    }
    expect(codes).toHaveLength(56);

    const { root } = await mount();
    for (const n of [1, 2, 3, 4]) choose(root, `zone-${n}`, "");
    type(root, "date", "20240615");
    type(root, "time", "1430");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");

    const IANA = /\b(?:America|Europe|Asia|Africa|Australia|Pacific|Atlantic|Indian|Etc)\/[A-Za-z_]+/;
    for (const code of codes) {
      type(root, "time-code", code);
      for (const n of [1, 2, 3, 4]) {
        expect(q<HTMLSelectElement>(root, `zone-${n}`).value, code).toBe("");
      }
      // Typing never lands on a preset that carries zones; a code that spells a
      // zoneless preset (UT, 13, 24) selects that preset.
      const id = q<HTMLSelectElement>(root, "preset").value;
      expect(id === "custom" || preset(id).zones[0] === "", code).toBe(true);
      // The zone pickers list every id as an option, and a hidden block may
      // still hold the call line of a zone just cleared; the rendered answer
      // holds none.
      const clone = root.cloneNode(true) as HTMLElement;
      // The hidden sizers hold every text a region can show, so they are static.
      clone.querySelectorAll("select, [hidden], .gmt-edi-sizer").forEach((el) => el.remove());
      expect(clone.textContent ?? "", code).not.toMatch(IANA);
    }
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderX12TimeReaderTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountX12TimeReader(root, {}, controller.signal);
    expect(text(root, "member-local")).toBe("no result");
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });

  it("destroying twice is safe, and the widget stops answering", async () => {
    const { root, handle } = await mount();
    handle.destroy();
    handle.destroy();
    type(root, "time-code", "UT");
    expect(text(root, "verdict")).toBe(
      "Zone named, offset not stated: Eastern (not said)",
    );
  });
});

/** Every string the reader sees or hears, leaving out the printed calls and
 *  results, which are the library's literal output. */
function screenText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.gmt-codeframe, output[data-role$="output"]').forEach((e) => e.remove());
  const labels = [...clone.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label"));
  return `${clone.textContent}\n${labels.join("\n")}`;
}

describe("on-screen words", () => {
  const states = [
    ...X12_PRESETS.map((p) => ["preset", p.id] as const),
    ...DTP_PRESETS.map((p) => ["dtp-preset", p.id] as const),
  ];

  it.each(states)("%s %s never names the library as GMT, and shows no raw null", async (role, id) => {
    const { root } = await mount();
    choose(root, role, id);
    const text = screenText(root);
    expect(text).not.toMatch(/GMT (does|returns|maps|reads|never)/);
    expect(text).not.toMatch(/\b(null|undefined)\b/);
    for (const cell of root.querySelectorAll('[data-role^="member-"], [data-role^="dtp-member-"]')) {
      expect(cell.textContent).not.toMatch(/null|undefined/);
      expect(cell.textContent).not.toBe("");
    }
  });

  it("shows daylight as words in the member cell", async () => {
    const { root } = await mount();
    choose(root, "preset", "status-et");
    expect(text(root, "member-daylight")).toBe("not said");
    choose(root, "preset", "status-ed");
    expect(text(root, "member-daylight")).toBe("daylight");
    choose(root, "preset", "status-es");
    expect(text(root, "member-daylight")).toBe("standard");
  });

  it("takes the three elements apart, with what x12TimeCode returned", async () => {
    const { root } = await mount();
    choose(root, "preset", "status-et");
    const figure = q(root, "figure");
    expect(figure.getAttribute("aria-label")).toBe(
      "Date: year 2024, month 06, day 15. Time: hour 14, minute 30. Time code ET: zone Eastern, daylight not said.",
    );
    expect([...figure.querySelectorAll(".gmt-edi-mask")].map((m) => m.textContent)).toEqual(["CCYY", "MM", "DD", "HH", "MM", "623"]);
    expect(text(root, "figure-note")).toContain('x12TimeCode("ET") returned zone Eastern, daylight not said.');
    choose(root, "preset", "hundredths");
    expect([...q(root, "figure").querySelectorAll(".gmt-edi-mask")].map((m) => m.textContent)).toContain("DD");
    expect(text(root, "figure-note")).toContain("hundredths of a second");
  });

  it("finds each DTP qualifier's own field order by probing", async () => {
    const { root } = await mount();
    const masks = () => [...q(root, "dtp-figure").querySelectorAll(".gmt-edi-mask")].map((m) => m.textContent?.trim()).filter((m) => m !== "");
    type(root, "dtp-format", "DB");
    type(root, "dtp-value", "06152024");
    expect(masks()).toEqual(["MM", "DD", "CCYY"]);
    type(root, "dtp-format", "RD8");
    type(root, "dtp-value", "20240615-20240620");
    expect(masks()).toEqual(["CCYY", "MM", "DD", "CCYY", "MM", "DD"]);
    expect(q(root, "dtp-figure").querySelector(".gmt-edi-sep")?.textContent).toBe("-");
    expect(q(root, "dtp-figure").textContent).toContain("no offset");
  });

  it("draws a refused value in neutral boxes, never amber, with the reason beside it", async () => {
    const { root } = await mount();
    type(root, "date", "20241399");
    expect(q(root, "figure").querySelectorAll('[data-group="neutral"]').length).toBeGreaterThan(0);
    expect(q(root, "figure").querySelector(".gmt-playground-sentinel")).toBeNull();
    expect(text(root, "reason-aside")).toContain("No result");
  });
});
