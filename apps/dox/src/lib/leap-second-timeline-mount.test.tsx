/**
 * @vitest-environment jsdom
 *
 * The Leap Second Timeline end to end: template → mount → interact → assert,
 * against the real `@northguild/gmt`. Every preset's printed calls, results,
 * plates, marks and rows are checked against literal strings read from a run
 * of the built library, so a drift in the library or the widget fails here.
 */
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  BEFORE_1972_TEXT,
  TIMELINE_PRESETS,
  VERDICT_INSERTED,
  VERDICT_NOT_INSERTED,
} from "./leap-second-timeline";
import {
  mountLeapSecondTimeline,
  renderLeapSecondTimelineTemplate,
} from "./leap-second-timeline-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "date",
  "date-slider",
  "date-value",
  "from",
  "to",
  "check",
  "frame",
  "heroes",
  "hero-offset",
  "hero-between",
  "hero-check",
  "plot",
  "step-line",
  "continuous-span",
  "continuous-chip",
  "band",
  "marks",
  "pin",
  "pin-chip",
  "axis",
  "chips-insertions",
  "timeline-list",
  "summary",
  "insertions-table",
  "insertions-body",
  ...["offset", "between", "check"].flatMap((g) => [
    `call-${g}`,
    `copy-${g}`,
    `${g}-output`,
    `${g}-aside`,
  ]),
];

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderLeapSecondTimelineTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountLeapSecondTimeline(root, args, controller.signal);
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

function slide(root: HTMLElement, position: number) {
  const el = q<HTMLInputElement>(root, "date-slider");
  el.value = String(position);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";
const isSentinel = (root: HTMLElement, role: string) =>
  q(root, role).classList.contains("gmt-playground-sentinel");
const isEmpty = (root: HTMLElement, role: string) =>
  q(root, role).classList.contains("gmt-widget-output--empty");

/** A plate's value and its two sub lines. */
const plate = (root: HTMLElement, role: string): [string, string, string] => {
  const el = q(root, role);
  const lines = [...el.querySelectorAll(".gmt-punct-hero-line")].map(
    (l) => l.textContent ?? "",
  );
  return [
    el.querySelector(".gmt-punct-hero-value")!.textContent!,
    lines[0] ?? "",
    lines[1] ?? "",
  ];
};

const litMarks = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>(".gmt-leap-mark[data-lit]")].map(
    (m) => `${m.dataset["insertion"]}:${m.dataset["series"]}`,
  );
const rows = (root: HTMLElement) => [
  ...q(root, "insertions-body").querySelectorAll("tr"),
];

interface Expected {
  copy: { offset: string; between: string; check: string };
  output: { offset: string; between: string; check: string };
  plates: {
    offset: [string, string, string];
    between: [string, string, string];
    check: [string, string, string];
  };
  lit: string[];
  band: boolean;
}

const BLANK = "Not read: the field is blank.";
const NONE: [string, string, string] = ["no result", "", ""];

/** What each preset prints, from a run against `packages/gmt/dist`. */
const EXPECTED: Record<string, Expected> = {
  "from-2000": {
    copy: {
      offset:
        'taiMinusUtc("2000-01-01T00:00:00Z")\nnextLeapSecond("2000-01-01T00:00:00Z")',
      between:
        'leapSecondsBetween("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
      check:
        'hasSecond60("2016-12-31T23:59:60Z")\nisLeapSecond("2016-12-31T23:59:60Z")\nisValidInstant("2016-12-31T23:59:60Z")',
    },
    output: {
      offset: '32\n"2005-12-31T23:59:60Z"',
      between: "5",
      check: "true\ntrue\nfalse",
    },
    plates: {
      offset: ["32 s", "next insertion", "2005-12-31"],
      between: ["5", "from 2000-01-01", "to 2024-01-01"],
      check: [VERDICT_INSERTED, "isLeapSecond true", "hasSecond60 true"],
    },
    lit: [
      "2005-12-31T23:59:60Z:2",
      "2008-12-31T23:59:60Z:2",
      "2012-06-30T23:59:60Z:2",
      "2015-06-30T23:59:60Z:2",
      "2016-12-31T23:59:60Z:3",
    ],
    band: true,
  },
  "last-insertion": {
    copy: {
      offset:
        'taiMinusUtc("2016-01-01T00:00:00Z")\nnextLeapSecond("2016-01-01T00:00:00Z")',
      between: "",
      check: "",
    },
    output: {
      offset: '36\n"2016-12-31T23:59:60Z"',
      between: BLANK,
      check: BLANK,
    },
    plates: {
      offset: ["36 s", "next insertion", "2016-12-31"],
      between: NONE,
      check: NONE,
    },
    lit: [],
    band: false,
  },
  "after-the-table": {
    copy: {
      offset:
        'taiMinusUtc("2024-01-01T00:00:00Z")\nnextLeapSecond("2024-01-01T00:00:00Z")',
      between: "",
      check: "",
    },
    output: { offset: '37\n""', between: BLANK, check: BLANK },
    plates: {
      offset: ["37 s", "none after this date", ""],
      between: NONE,
      check: NONE,
    },
    lit: [],
    band: false,
  },
  "far-future": {
    copy: {
      offset:
        'taiMinusUtc("2100-01-01T00:00:00Z")\nnextLeapSecond("2100-01-01T00:00:00Z")',
      between: "",
      check: "",
    },
    output: { offset: '37\n""', between: BLANK, check: BLANK },
    plates: {
      offset: ["37 s", "none after this date", ""],
      between: NONE,
      check: NONE,
    },
    lit: [],
    band: false,
  },
  "not-inserted": {
    copy: {
      offset: "",
      between: "",
      check:
        'hasSecond60("2017-12-31T23:59:60Z")\nisLeapSecond("2017-12-31T23:59:60Z")\nisValidInstant("2017-12-31T23:59:60Z")',
    },
    output: { offset: BLANK, between: BLANK, check: "true\nfalse\nfalse" },
    plates: {
      offset: NONE,
      between: NONE,
      check: [VERDICT_NOT_INSERTED, "isLeapSecond false", "hasSecond60 true"],
    },
    lit: [],
    band: false,
  },
  "offset-spelling": {
    copy: {
      offset: "",
      between: "",
      check:
        'hasSecond60("2009-01-01T08:59:60+09:00")\nisLeapSecond("2009-01-01T08:59:60+09:00")\nisValidInstant("2009-01-01T08:59:60+09:00")',
    },
    output: { offset: BLANK, between: BLANK, check: "true\ntrue\nfalse" },
    plates: {
      offset: NONE,
      between: NONE,
      check: [VERDICT_INSERTED, "isLeapSecond true", "hasSecond60 true"],
    },
    lit: ["2008-12-31T23:59:60Z:3"],
    band: false,
  },
  backwards: {
    copy: {
      offset: "",
      between:
        'leapSecondsBetween("2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z")',
      check: "",
    },
    output: { offset: BLANK, between: "-5", check: BLANK },
    plates: {
      offset: NONE,
      between: ["-5", "from 2024-01-01", "to 2000-01-01"],
      check: NONE,
    },
    lit: [
      "2005-12-31T23:59:60Z:2",
      "2008-12-31T23:59:60Z:2",
      "2012-06-30T23:59:60Z:2",
      "2015-06-30T23:59:60Z:2",
      "2016-12-31T23:59:60Z:2",
    ],
    band: true,
  },
  "before-1972": {
    copy: {
      offset:
        'taiMinusUtc("1971-01-01T00:00:00Z")\nnextLeapSecond("1971-01-01T00:00:00Z")',
      between:
        'leapSecondsBetween("1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
      check: "",
    },
    output: { offset: "NO SIGNAL", between: "NO SIGNAL", check: BLANK },
    plates: { offset: NONE, between: NONE, check: NONE },
    lit: [],
    band: false,
  },
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("renderLeapSecondTimelineTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderLeapSecondTimelineTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderLeapSecondTimelineTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.getAttribute("class")).toBe(
      "gmt-leap-second-timeline gmt-widget not-content",
    );
    expect(widget.attributes).toHaveLength(1);
    const classes = [...root.querySelectorAll("[class]")].flatMap((e) =>
      e.getAttribute("class")!.split(/\s+/),
    );
    expect(
      classes.filter((c) => c.includes("card") && c !== "gmt-widget-card"),
    ).toEqual([]);
  });

  it("renders three numbered sections and three empty plates before the library answers", () => {
    const root = document.createElement("div");
    root.innerHTML = renderLeapSecondTimelineTemplate();
    expect(
      [...root.querySelectorAll(".gmt-widget-section h4")].map(
        (h) => h.textContent,
      ),
    ).toEqual([
      "1. Set a date, a span and a second 60",
      "2. Every inserted second",
      "3. What the library returns",
    ]);
    for (const role of ["hero-offset", "hero-between", "hero-check"]) {
      expect(plate(root, role)[0]).toBe("no result");
    }
    expect(q(root, "plot").getAttribute("role")).toBe("img");
  });

  it("opens on the first preset, with a native range and text inputs", () => {
    const root = document.createElement("div");
    root.innerHTML = renderLeapSecondTimelineTemplate();
    expect(q<HTMLInputElement>(root, "date").value).toBe(
      "2000-01-01T00:00:00Z",
    );
    expect(q<HTMLInputElement>(root, "check").value).toBe(
      "2016-12-31T23:59:60Z",
    );
    const slider = q<HTMLInputElement>(root, "date-slider");
    expect(slider.type).toBe("range");
    for (const role of ["date", "from", "to", "check"]) {
      expect(q<HTMLInputElement>(root, role).type).toBe("text");
    }
  });

  it("escapes a hostile seed", () => {
    const hostile = '"><img src=x onerror=alert(1)>';
    const root = document.createElement("div");
    root.innerHTML = renderLeapSecondTimelineTemplate({
      date: hostile,
      check: hostile,
      from: hostile,
      to: hostile,
    });
    expect(root.querySelector("img")).toBeNull();
    expect(q<HTMLInputElement>(root, "date").value).toBe(hostile);
  });
});

describe("every preset", () => {
  it("covers every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      TIMELINE_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(Object.entries(EXPECTED))("%s", async (id, want) => {
    const { root } = await mount();
    choose(root, "preset", id);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(id);
    for (const g of ["offset", "between", "check"] as const) {
      const copy = q(root, `copy-${g}`).dataset["copyText"] ?? "";
      expect(copy, g).toBe(want.copy[g]);
      const out = text(root, `${g}-output`);
      expect(out, g).toBe(want.output[g]);
      expect(isSentinel(root, `${g}-output`), g).toBe(out === "NO SIGNAL");
      expect(isEmpty(root, `${g}-output`), g).toBe(out === BLANK);
    }
    expect(plate(root, "hero-offset")).toEqual(want.plates.offset);
    expect(plate(root, "hero-between")).toEqual(want.plates.between);
    expect(plate(root, "hero-check")).toEqual(want.plates.check);
    expect(litMarks(root)).toEqual(want.lit);
    expect(q(root, "band").hidden).toBe(!want.band);
    // Every inserted second is a mark, a table row and a list item, lit or not.
    expect(root.querySelectorAll(".gmt-leap-mark")).toHaveLength(27);
    expect(rows(root)).toHaveLength(27);
    expect(q(root, "timeline-list").children).toHaveLength(27);
    expect(
      rows(root).filter((r) => r.hasAttribute("data-reading")),
    ).toHaveLength(want.lit.length);
    expect(q(root, "plot").getAttribute("aria-label")).toBe(
      text(root, "summary"),
    );
  });

  it("before-1972 explains each no signal in one sentence", async () => {
    const { root } = await mount();
    choose(root, "preset", "before-1972");
    expect(text(root, "offset-aside")).toContain(BEFORE_1972_TEXT);
    expect(text(root, "between-aside")).toContain(BEFORE_1972_TEXT);
    expect(text(root, "check-aside")).toBe("");
  });

  it("a legitimately empty next insertion is a live result, not no signal", async () => {
    const { root } = await mount();
    choose(root, "preset", "after-the-table");
    expect(isSentinel(root, "offset-output")).toBe(false);
    expect(text(root, "offset-aside")).toBe("");
  });

  it("the table lists the 27 seconds in order with the offset after each", async () => {
    const { root } = await mount();
    const cells = rows(root).map((r) => [
      r
        .querySelector("th")!
        .textContent!.replace(/\s*(counted|your second 60)$/, ""),
      r.querySelector("td")!.textContent,
    ]);
    expect(cells[0]).toEqual(["1972-06-30T23:59:60Z", "11 s"]);
    expect(cells[26]).toEqual(["2016-12-31T23:59:60Z", "37 s"]);
    // The counted rows say so in words, not by colour alone.
    expect(rows(root)[22]!.textContent).toContain("counted");
    expect(rows(root)[26]!.textContent).toContain("your second 60");
  });
});

describe("typing", () => {
  it("a typed date draws its pin, and a date past the axis says so", async () => {
    const { root } = await mount();
    type(root, "date", "2100-01-01T00:00:00Z");
    expect(q(root, "pin").hidden).toBe(false);
    expect(text(root, "pin-chip")).toContain("past the axis");
    // The other fields still hold the first preset's values, so it is no longer a preset.
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("an offset-spelled date draws its pin where the same instant in Z does", async () => {
    const { root } = await mount();
    type(root, "date", "2016-01-01T00:00:00Z");
    const z = q(root, "pin").getAttribute("style");
    type(root, "date", "2016-01-01T09:00:00+09:00");
    expect(q(root, "pin").hidden).toBe(false);
    expect(q(root, "pin").getAttribute("style")).toBe(z);
    expect(text(root, "offset-output")).toBe('36\n"2016-12-31T23:59:60Z"');
    expect(q<HTMLInputElement>(root, "date-slider").disabled).toBe(false);
    expect(isSentinel(root, "offset-output")).toBe(false);
  });

  it("an invalid date is no signal with the reason, and draws no pin", async () => {
    const { root } = await mount();
    type(root, "date", "soon");
    expect(isSentinel(root, "offset-output")).toBe(true);
    expect(text(root, "offset-aside")).toContain(
      "This is not an ISO 8601 instant.",
    );
    expect(q(root, "pin").hidden).toBe(true);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("clearing a field leaves its call out and its output empty", async () => {
    const { root } = await mount();
    type(root, "check", "");
    expect(q(root, "copy-check").dataset["copyText"] ?? "").toBe("");
    expect(text(root, "check-output")).toBe(BLANK);
    expect(isSentinel(root, "check-output")).toBe(false);
  });

  it("a second 60 that is not an instant is no signal", async () => {
    const { root } = await mount();
    type(root, "check", "garbage");
    expect(isSentinel(root, "check-output")).toBe(true);
    expect(plate(root, "hero-check")[0]).toBe("no result");
    expect(text(root, "check-aside")).toContain(
      "This is not an ISO 8601 instant.",
    );
  });
});

describe("the date slider", () => {
  const at = async (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(convertUtcToUnix(iso) ?? 0);
    return mount();
  };

  it("runs from 1972-01-01 to continuous UTC while today is earlier", async () => {
    const { root } = await at("2026-10-16T09:00:00Z");
    const slider = q<HTMLInputElement>(root, "date-slider");
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("20228");
    expect(root.querySelector(".gmt-range-ends")!.textContent).toBe(
      "1972-01-012027-05-20",
    );
  });

  it("runs to the reader's today once it is later", async () => {
    const { root } = await at("2030-03-10T09:00:00Z");
    const slider = q<HTMLInputElement>(root, "date-slider");
    expect(slider.max).toBe("21253");
    expect(root.querySelector(".gmt-range-ends")!.textContent).toBe(
      "1972-01-012030-03-10",
    );
  });

  it("writes a midnight and follows the date it wrote", async () => {
    const { root } = await at("2026-10-16T09:00:00Z");
    slide(root, 0);
    expect(q<HTMLInputElement>(root, "date").value).toBe(
      "1972-01-01T00:00:00Z",
    );
    expect(plate(root, "hero-offset")[0]).toBe("10 s");
    slide(root, 20228);
    expect(q<HTMLInputElement>(root, "date").value).toBe(
      "2027-05-20T00:00:00Z",
    );
    expect(plate(root, "hero-offset")[0]).toBe("37 s");
    expect(q<HTMLInputElement>(root, "date-slider").value).toBe("20228");
  });

  it("is disabled while the date cannot be placed, and a typed date moves it", async () => {
    const { root } = await at("2026-10-16T09:00:00Z");
    type(root, "date", "soon");
    expect(q<HTMLInputElement>(root, "date-slider").disabled).toBe(true);
    type(root, "date", "1972-01-11T12:00:00Z");
    expect(q<HTMLInputElement>(root, "date-slider").disabled).toBe(false);
    expect(q<HTMLInputElement>(root, "date-slider").value).toBe("10");
  });

  it("moving it does not resize the plates or the table", async () => {
    const { root } = await at("2026-10-16T09:00:00Z");
    const shape = () =>
      `${q(root, "heroes").children.length}/${rows(root).length}/${q(root, "marks").children.length}`;
    const before = shape();
    for (const day of [0, 5000, 10000, 20228]) {
      slide(root, day);
      expect(shape()).toBe(before);
    }
  });
});

describe("permalinks", () => {
  it.each(TIMELINE_PRESETS.map((p) => [p.id]))(
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
          (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
        ),
      ).toBe(true);
      const url = encodeWidgetPermalink("leapline", state);
      expect(url).toMatch(/^\/tools\/leap-second-timeline\/\?w=leapline&wa=/);
      const seeded = seedFromLocation("leapline", url.slice(url.indexOf("?")));
      expect(seeded).toEqual(state);
      const outputs = ["offset", "between", "check"].map((g) =>
        text(first.root, `${g}-output`),
      );
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(
        ["offset", "between", "check"].map((g) =>
          text(second.root, `${g}-output`),
        ),
      ).toEqual(outputs);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );

  it("leaves blank fields out of the link", async () => {
    const { root, handle } = await mount();
    choose(root, "preset", "last-insertion");
    expect(handle.getPermalinkState?.()).toEqual({
      date: "2016-01-01T00:00:00Z",
    });
  });
});

describe("on-screen words", () => {
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

  it.each(TIMELINE_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null or undefined outside the printed output",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      expect(screenText(root)).not.toMatch(/\b(null|undefined)\b/);
    },
  );

  it("names no law, regulator or national lead, and counts nothing about the site", async () => {
    const forbidden =
      /\b(CFR|statut|regulat|docket|agency|court|America\/|en-US|NIST|USNO)\w*/i;
    const { root } = await mount();
    const seen: string[] = [renderLeapSecondTimelineTemplate()];
    for (const p of TIMELINE_PRESETS) {
      choose(root, "preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const s of seen) expect(s).not.toMatch(forbidden);
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderLeapSecondTimelineTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountLeapSecondTimeline(root, {}, controller.signal);
    expect(plate(root, "hero-offset")[0]).toBe("no result");
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });

  it("releases its width observer on destroy, and destroying twice is safe", async () => {
    const spy = spyOnResizeObservers();
    const { handle } = await mount();
    expect(spy.live.size).toBe(1);
    handle.destroy();
    handle.destroy();
    expect(spy.live.size).toBe(0);
    spy.restore();
  });

  it("fits its chip rows again when the width changes, and keeps the drawing", async () => {
    const spy = spyOnResizeObservers();
    const { root } = await mount();
    const marks = q(root, "marks").innerHTML;
    Object.defineProperty(q(root, "frame"), "clientWidth", {
      configurable: true,
      value: 480,
    });
    spy.fire();
    expect(q(root, "marks").innerHTML).toBe(marks);
    spy.restore();
  });
});

describe("the links row (D13)", () => {
  const ELAPSED = "Count the real seconds between these dates";
  const CLOCKS = "Every clock on this date";
  async function mountPreset(id: string) {
    const mounted = await mount();
    choose(mounted.root, "preset", id);
    return mounted;
  }
  const link = (root: HTMLElement, role: string) =>
    q<HTMLAnchorElement>(root, role);
  const state = (root: HTMLElement, role: string) => ({
    text: link(root, role).textContent,
    href: link(root, role).getAttribute("href"),
    disabled: link(root, role).getAttribute("aria-disabled"),
  });
  const enabled = (text: string, href: string) => ({
    text,
    href,
    disabled: null,
  });
  const disabled = (text: string) => ({ text, href: null, disabled: "true" });

  it("has both links in the links row, in order", async () => {
    const { root } = await mount();
    const row = q(root, "tool-links");
    expect(row.classList.contains("gmt-widget-controls")).toBe(true);
    expect(
      [...row.querySelectorAll("a")].map((a) => a.dataset["role"]),
    ).toEqual(["link-elapsed", "link-clocks"]);
  });

  it("sends the span to Elapsed vs. Clock as start and end, and the date to the Clock Converter", async () => {
    const { root } = await mountPreset("from-2000");
    expect(state(root, "link-elapsed")).toEqual(
      enabled(
        ELAPSED,
        encodeWidgetPermalink("elapsed", {
          start: "2000-01-01T00:00:00Z",
          end: "2024-01-01T00:00:00Z",
        }),
      ),
    );
    expect(state(root, "link-clocks")).toEqual(
      enabled(
        CLOCKS,
        encodeWidgetPermalink("satclock", { value: "2000-01-01T00:00:00Z" }),
      ),
    );
  });

  it("sends a backwards span as typed", async () => {
    const { root } = await mountPreset("backwards");
    expect(link(root, "link-elapsed").getAttribute("href")).toBe(
      encodeWidgetPermalink("elapsed", {
        start: "2024-01-01T00:00:00Z",
        end: "2000-01-01T00:00:00Z",
      }),
    );
  });

  it("follows what is typed, and each link is lit by its own fields", async () => {
    const { root } = await mountPreset("from-2000");
    type(root, "date", "2016-01-01T00:00:00Z");
    expect(link(root, "link-clocks").getAttribute("href")).toBe(
      encodeWidgetPermalink("satclock", { value: "2016-01-01T00:00:00Z" }),
    );
    type(root, "to", "2020-01-01T00:00:00Z");
    expect(link(root, "link-elapsed").getAttribute("href")).toBe(
      encodeWidgetPermalink("elapsed", {
        start: "2000-01-01T00:00:00Z",
        end: "2020-01-01T00:00:00Z",
      }),
    );
  });

  it("follows the slider's date", async () => {
    const { root } = await mountPreset("from-2000");
    slide(root, 0);
    const date = q<HTMLInputElement>(root, "date").value;
    expect(date).toBe("1972-01-01T00:00:00Z");
    expect(link(root, "link-clocks").getAttribute("href")).toBe(
      encodeWidgetPermalink("satclock", { value: date }),
    );
  });

  it("disables the clocks link with no date, and the span link with no span", async () => {
    const { root } = await mountPreset("backwards");
    expect(state(root, "link-clocks")).toEqual(disabled(CLOCKS));
    expect(link(root, "link-elapsed").hasAttribute("href")).toBe(true);
    type(root, "from", "");
    expect(state(root, "link-elapsed")).toEqual(disabled(ELAPSED));
  });

  it("disables the clocks link for a date before 1972, where the library has no offset", async () => {
    const { root } = await mountPreset("before-1972");
    expect(state(root, "link-clocks")).toEqual(disabled(CLOCKS));
  });

  it("disables both links on a second 60 that never happened", async () => {
    const { root } = await mountPreset("not-inserted");
    expect(state(root, "link-elapsed")).toEqual(disabled(ELAPSED));
    expect(state(root, "link-clocks")).toEqual(disabled(CLOCKS));
  });

  it("disables the span link for a span the library refused, and lights it again", async () => {
    const { root } = await mountPreset("from-2000");
    type(root, "from", "not a date");
    expect(state(root, "link-elapsed")).toEqual(disabled(ELAPSED));
    // The date is separate: its link is untouched.
    expect(link(root, "link-clocks").hasAttribute("href")).toBe(true);
    type(root, "from", "2000-01-01T00:00:00Z");
    expect(link(root, "link-elapsed").hasAttribute("href")).toBe(true);
    expect(link(root, "link-elapsed").hasAttribute("aria-disabled")).toBe(
      false,
    );
  });

  it("lands on seeds the other tools read back", async () => {
    const { root } = await mountPreset("from-2000");
    const read = (role: string, kind: "elapsed" | "satclock") => {
      const href = link(root, role).getAttribute("href")!;
      return seedFromLocation(kind, href.slice(href.indexOf("?")));
    };
    expect(read("link-elapsed", "elapsed")).toEqual({
      start: "2000-01-01T00:00:00Z",
      end: "2024-01-01T00:00:00Z",
    });
    expect(read("link-clocks", "satclock")).toEqual({
      value: "2000-01-01T00:00:00Z",
    });
  });
});

describe("the staircase", () => {
  it("draws the y axis, the area, a riser per insertion and the end cap", async () => {
    const { root } = await mount();
    expect(
      [...root.querySelectorAll(".gmt-leap-ytick")].map((t) => t.textContent),
    ).toEqual(["10", "20", "30", "37"]);
    expect(root.querySelectorAll(".gmt-leap-riser")).toHaveLength(27);
    expect(q(root, "step-area").getAttribute("d")).toMatch(/^M0,100 L/);
    expect(text(root, "continuous-chip")).toBe("continuous UTC from 2027-05-20");
  });

  it("lights the risers of the counted span and the checked second, and counts them", async () => {
    const { root } = await mount();
    const lit = [...root.querySelectorAll(".gmt-leap-riser[data-lit]")].map(
      (r) => r.getAttribute("data-series"),
    );
    expect(lit).toEqual(["2", "2", "2", "2", "3"]);
    expect(q(root, "band-flag").hidden).toBe(false);
    expect(text(root, "band-chip")).toBe("5 leap seconds counted");
  });

  it("puts the cursor's readout and its dot at the step", async () => {
    const { root } = await mount();
    expect(text(root, "pin-chip")).toBe("2000-01-01 · 32 s");
    expect(q(root, "pin-dot").hidden).toBe(false);
    expect(q(root, "pin-guide").hidden).toBe(false);
  });

  it("draws a ghost riser for a second 60 that never happened, and no band", async () => {
    const { root } = await mount();
    expect(q(root, "ghost").hidden).toBe(true);
    choose(root, "preset", "not-inserted");
    expect(q(root, "ghost").hidden).toBe(false);
    expect(root.querySelectorAll(".gmt-leap-riser[data-lit]")).toHaveLength(0);
    expect(q(root, "band-flag").hidden).toBe(true);
  });

  it("shows NO SIGNAL in the plot for a date before 1972, and not for a legitimate empty result", async () => {
    const { root } = await mount();
    expect(q(root, "plot-sentinel").hidden).toBe(true);
    choose(root, "preset", "after-the-table");
    expect(q(root, "plot-sentinel").hidden).toBe(true);
    choose(root, "preset", "before-1972");
    expect(q(root, "plot-sentinel").hidden).toBe(false);
    expect(q(root, "plot-sentinel").textContent).toBe(
      "⟨ NO SIGNAL — invalid input ⟩",
    );
    expect(q(root, "pin-dot").hidden).toBe(true);
  });
});
