/**
 * @vitest-environment jsdom
 *
 * The B/L Date Stamp end to end: template → mount → interact → assert, against
 * the real `@northguild/gmt`. Every preset's printed calls and results are
 * checked against the literal strings the library returns, the lit day of each
 * lane against the library's date, and the slider against the window it must
 * not move, so a drift in the library or the widget fails here.
 */
import { resolveWidget } from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { BL_DATE_PRESETS, SLIDER_MAX } from "./bl-date-stamp";
import {
  eventOptionsHtml,
  mountBlDateStamp,
  renderBlDateStampTemplate,
} from "./bl-date-stamp-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { SITE_BASE } from "./site";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "value",
  "event",
  "zone",
  "zone-2",
  "zone-3",
  "zone-4",
  "latest",
  "frame",
  "heroes",
  "hero-bl",
  "hero-utc",
  "plot",
  ...[0, 1, 2, 3, 4].flatMap((n) => [
    `lane-${n}`,
    `lane-label-${n}`,
    `track-${n}`,
    `cells-${n}`,
    `note-${n}`,
  ]),
  "gate",
  "gate-chip",
  "axis",
  "moment-slider",
  "moment-value",
  "summary",
  "reason-aside",
  "call-bl",
  "copy-bl",
  "bl-output",
];

const VALUE = "2024-06-16T01:00:00Z";

const bol = (value: string, event: string, zone: string | null) =>
  zone === null
    ? `bolTimestamp("${value}", "${event}")`
    : `bolTimestamp("${value}", "${event}", { timeZone: "${zone}" })`;

interface Expected {
  /** The printed calls, one a line. */
  copy: string;
  /** The output, or "NO SIGNAL". */
  output: string;
  /** The B/L plate: value, then its two sub lines. */
  bl: [string, string, string];
  /** The UTC plate: value, then its two sub lines. */
  utc: [string, string, string];
  /** The lit date of each lane, UTC first; `""` for a lane with nothing lit. */
  lit: string[];
}

/** What each preset prints, from a run against `packages/gmt/dist`. */
const EXPECTED: Record<string, Expected> = {
  "sao-paulo-evening": {
    copy: [
      bol(VALUE, "shippedOnBoard", "America/Sao_Paulo"),
      bol(VALUE, "shippedOnBoard", "UTC"),
      bol(VALUE, "shippedOnBoard", "Asia/Shanghai"),
      'areDatesEqual("2024-06-16", "2024-06-15")',
      'isAfterDate("2024-06-16", "2024-06-15")',
    ].join("\n"),
    output: [
      '"2024-06-15"',
      '"2024-06-16"',
      '"2024-06-16"',
      "false",
      "true",
    ].join("\n"),
    bl: ["Sat 15 Jun 2024", "22:00 in America/Sao_Paulo", ""],
    utc: ["Sun 16 Jun 2024", "one day later", ""],
    lit: ["2024-06-16", "2024-06-15", "2024-06-16", "", ""],
  },
  "shanghai-morning": {
    copy: [
      bol("2024-06-14T23:00:00Z", "shippedOnBoard", "Asia/Shanghai"),
      bol("2024-06-14T23:00:00Z", "shippedOnBoard", "UTC"),
      'areDatesEqual("2024-06-14", "2024-06-15")',
      'isAfterDate("2024-06-14", "2024-06-15")',
    ].join("\n"),
    output: ['"2024-06-15"', '"2024-06-14"', "false", "false"].join("\n"),
    bl: ["Sat 15 Jun 2024", "07:00 in Asia/Shanghai", ""],
    utc: ["Fri 14 Jun 2024", "one day earlier", ""],
    lit: ["2024-06-14", "2024-06-15", "", "", ""],
  },
  "rotterdam-fall-back": {
    copy: [
      bol("2024-10-27T00:30:00Z", "received", "Europe/Amsterdam"),
      bol("2024-10-27T00:30:00Z", "received", "UTC"),
      'areDatesEqual("2024-10-27", "2024-10-27")',
      'isAfterDate("2024-10-27", "2024-10-27")',
    ].join("\n"),
    output: ['"2024-10-27"', '"2024-10-27"', "true", "false"].join("\n"),
    bl: ["Sun 27 Oct 2024", "02:30 in Europe/Amsterdam", ""],
    utc: ["Sun 27 Oct 2024", "same date", ""],
    lit: ["2024-10-27", "2024-10-27", "", "", ""],
  },
  "apia-deleted-day": {
    copy: [
      bol("2011-12-30T10:00:00Z", "shippedOnBoard", "Pacific/Apia"),
      bol("2011-12-30T10:00:00Z", "shippedOnBoard", "UTC"),
      'areDatesEqual("2011-12-30", "2011-12-31")',
      'isAfterDate("2011-12-30", "2011-12-31")',
    ].join("\n"),
    output: ['"2011-12-31"', '"2011-12-30"', "false", "false"].join("\n"),
    bl: ["Sat 31 Dec 2011", "00:00 in Pacific/Apia", ""],
    utc: ["Fri 30 Dec 2011", "one day earlier", ""],
    lit: ["2011-12-30", "2011-12-31", "", "", ""],
  },
  "fixed-offset": {
    copy: [
      bol(VALUE, "shippedOnBoard", "+08:00"),
      bol(VALUE, "shippedOnBoard", "UTC"),
      'areDatesEqual("2024-06-16", "2024-06-16")',
      'isAfterDate("2024-06-16", "2024-06-16")',
    ].join("\n"),
    output: ['"2024-06-16"', '"2024-06-16"', "true", "false"].join("\n"),
    bl: ["Sun 16 Jun 2024", "09:00 in +08:00", ""],
    utc: ["Sun 16 Jun 2024", "same date", ""],
    lit: ["2024-06-16", "2024-06-16", "", "", ""],
  },
  "no-zone": {
    copy: [
      bol(VALUE, "shippedOnBoard", null),
      bol(VALUE, "shippedOnBoard", "UTC"),
    ].join("\n"),
    output: "NO SIGNAL",
    bl: ["no result", "", ""],
    utc: ["Sun 16 Jun 2024", "", ""],
    lit: ["2024-06-16", "", "", "", ""],
  },
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderBlDateStampTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountBlDateStamp(root, args, controller.signal);
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
  const el = q<HTMLInputElement>(root, "moment-slider");
  el.value = String(position);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";
const isSentinel = (root: HTMLElement, role: string) =>
  q(root, role).classList.contains("gmt-playground-sentinel");

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

/** The dates a lane draws, in order, and the dates it lights. */
const columns = (root: HTMLElement, lane: number) => [
  ...q(root, `cells-${lane}`).querySelectorAll<HTMLElement>(".gmt-ledger-day"),
];
const dates = (root: HTMLElement, lane: number) =>
  columns(root, lane).map((c) => c.dataset["date"]!);
const lit = (root: HTMLElement, lane: number) =>
  columns(root, lane)
    .filter((c) => c.dataset["state"] === "lit")
    .map((c) => c.dataset["date"]!)
    .join(",");
const layout = (root: HTMLElement, lane: number) =>
  columns(root, lane).map((c) => `${c.dataset["date"]}@${c.style.cssText}`);

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("renderBlDateStampTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBlDateStampTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBlDateStampTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.getAttribute("class")).toBe(
      "gmt-bl-date-stamp gmt-widget not-content",
    );
    expect(widget.attributes).toHaveLength(1);
    const classes = [...root.querySelectorAll("[class]")].flatMap((e) =>
      e.getAttribute("class")!.split(/\s+/),
    );
    expect(
      classes.filter((c) => c.includes("card") && c !== "gmt-widget-card"),
    ).toEqual([]);
  });

  it("renders three numbered sections, the middle one wide, and five lanes", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBlDateStampTemplate();
    const sections = [...root.querySelectorAll(".gmt-widget-section")];
    expect(sections.map((s) => s.querySelector("h4")!.textContent)).toEqual([
      "1. Set the moment and the place",
      "2. The date in each place",
      "3. What bolTimestamp returns",
    ]);
    expect(sections[1]!.classList.contains("gmt-widget-section--wide")).toBe(
      true,
    );
    expect(root.querySelectorAll(".gmt-bl-lane")).toHaveLength(5);
    expect(
      [...root.querySelectorAll(".gmt-bl-lane")].map(
        (l) => (l as HTMLElement).dataset["series"] ?? "",
      ),
    ).toEqual(["", "1", "2", "3", "4"]);
    // Before the library answers the plates hold their boxes and read "no result".
    expect(plate(root, "hero-bl")[0]).toBe("no result");
    expect(plate(root, "hero-utc")[0]).toBe("no result");
  });

  it("opens on the first preset's controls, and a native slider and date input", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBlDateStampTemplate();
    expect(q<HTMLInputElement>(root, "value").value).toBe(VALUE);
    expect(q<HTMLSelectElement>(root, "event").value).toBe("shippedOnBoard");
    expect(q<HTMLSelectElement>(root, "zone").value).toBe("America/Sao_Paulo");
    expect(q<HTMLSelectElement>(root, "zone-2").value).toBe("Asia/Shanghai");
    const slider = q<HTMLInputElement>(root, "moment-slider");
    expect(slider.tagName).toBe("INPUT");
    expect(slider.type).toBe("range");
    expect(slider.min).toBe("0");
    expect(slider.max).toBe(String(SLIDER_MAX));
    expect(slider.step).toBe("1");
    expect(q<HTMLInputElement>(root, "latest").type).toBe("date");
    expect(q<HTMLInputElement>(root, "value").maxLength).toBe(64);
  });

  it("labels the three events with the field each fills", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBlDateStampTemplate();
    expect(
      [...q<HTMLSelectElement>(root, "event").options].map(
        (o) => o.textContent,
      ),
    ).toEqual([
      "Shipped on board (shippedOnBoardDate)",
      "Received for shipment (receivedForShipmentDate)",
      "Issue (issueDate)",
    ]);
  });

  it("offers 'No zone', the transport zones and the offsets for the place", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBlDateStampTemplate();
    const options = [...q<HTMLSelectElement>(root, "zone").options].map(
      (o) => o.value,
    );
    expect(options[0]).toBe("");
    expect(options).toContain("Europe/Amsterdam");
    expect(options).toContain("+08:00");
    expect(options).toContain("-05:00");
    expect(new Set(options).size).toBe(options.length);
  });

  it("escapes a hostile seed", () => {
    const hostile = '"><img src=x onerror=alert(1)>';
    const root = document.createElement("div");
    root.innerHTML = renderBlDateStampTemplate({
      value: hostile,
      event: hostile,
      timeZone: hostile,
      zone2: hostile,
      zone3: hostile,
      zone4: hostile,
      latest: hostile,
    });
    expect(root.querySelector("img")).toBeNull();
    expect(q<HTMLInputElement>(root, "value").value).toBe(hostile);
    expect(q<HTMLSelectElement>(root, "zone").value).toBe(hostile);
  });

  it("adds a seed the lists lack as its own option and never replaces it", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBlDateStampTemplate({
      value: VALUE,
      event: "loaded",
      timeZone: "Pacific/Chatham",
      zone2: "+05:45",
    });
    expect(q<HTMLSelectElement>(root, "event").value).toBe("loaded");
    expect(q<HTMLSelectElement>(root, "zone").value).toBe("Pacific/Chatham");
    expect(q<HTMLSelectElement>(root, "zone-2").value).toBe("+05:45");
    expect(eventOptionsHtml("")).toContain("not chosen");
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      BL_DATE_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(BL_DATE_PRESETS.map((p) => [p.id]))(
    "%s prints the calls made and the results the library returned",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      const want = EXPECTED[id!]!;
      expect(q(root, "copy-bl").dataset["copyText"]).toBe(want.copy);
      if (want.output === "NO SIGNAL") {
        expect(isSentinel(root, "bl-output")).toBe(true);
        expect(text(root, "bl-output")).toBe("NO SIGNAL");
      } else {
        expect(isSentinel(root, "bl-output")).toBe(false);
        expect(text(root, "bl-output")).toBe(want.output);
      }
      expect(plate(root, "hero-bl")).toEqual(want.bl);
      expect(plate(root, "hero-utc")).toEqual(want.utc);
    },
  );

  it.each(BL_DATE_PRESETS.map((p) => [p.id]))(
    "%s lights the library's date in each lane, and it is the day the gate falls in",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      const want = EXPECTED[id!]!;
      for (let lane = 0; lane < 5; lane++) {
        expect(lit(root, lane), `lane ${lane}`).toBe(want.lit[lane]);
      }
      // The gate sits inside the lit column of every lane that has one.
      const gate = parseFloat(q(root, "gate").style.left);
      expect(Number.isNaN(gate)).toBe(false);
      for (let lane = 0; lane < 5; lane++) {
        const col = columns(root, lane).find(
          (c) => c.dataset["state"] === "lit",
        );
        if (!col) continue;
        const left = parseFloat(col.style.left);
        const width = parseFloat(col.style.width);
        expect(gate, `lane ${lane}`).toBeGreaterThanOrEqual(left - 0.01);
        expect(gate, `lane ${lane}`).toBeLessThan(left + width + 0.01);
      }
    },
  );

  it("opens on the first preset", async () => {
    const { root } = await mount();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(
      "sao-paulo-evening",
    );
    expect(text(root, "bl-output")).toBe(EXPECTED["sao-paulo-evening"]!.output);
    expect(text(root, "preset-description")).toBe(
      BL_DATE_PRESETS[0]!.description,
    );
  });

  it("shows two calendars on the first paint: the place, UTC and Shanghai", async () => {
    const { root } = await mount();
    expect(text(root, "lane-label-0")).toBe("UTC (naive)");
    expect(text(root, "lane-label-1")).toBe("America/Sao_Paulo");
    expect(text(root, "lane-label-2")).toBe("Asia/Shanghai");
    expect(text(root, "note-3")).toBe("no zone chosen");
    expect(q(root, "note-3").hidden).toBe(false);
    expect(q(root, "note-2").hidden).toBe(true);
  });

  it("chips the gate with the moment in UTC and numbers the lanes", async () => {
    const { root } = await mount();
    expect(text(root, "gate-chip")).toBe("01:00Z");
    expect(
      [...root.querySelectorAll(".gmt-bl-badge")].map((b) => b.textContent),
    ).toEqual(["1", "2", "3", "4"]);
  });

  it("draws the Rotterdam day as 25 hours and Apia without its 30th", async () => {
    const { root } = await mount();
    choose(root, "preset", "rotterdam-fall-back");
    const day = columns(root, 1).find(
      (c) => c.dataset["date"] === "2024-10-27",
    )!;
    expect(day.dataset["hours"]).toBe("25");
    expect(day.querySelector('[data-dst="long"]')?.textContent).toBe("25 h");
    choose(root, "preset", "apia-deleted-day");
    expect(dates(root, 1)).toContain("2011-12-29");
    expect(dates(root, 1)).toContain("2011-12-31");
    expect(dates(root, 1)).not.toContain("2011-12-30");
    expect(dates(root, 0)).toContain("2011-12-30");
  });
});

describe("the slider", () => {
  it("moves the moment in 15-minute steps and writes it in the form it was typed", async () => {
    const { root } = await mount();
    const slider = q<HTMLInputElement>(root, "moment-slider");
    // 01:00Z on 16 June is 34 hours into a window that starts at 15:00Z on 14 June.
    expect(slider.value).toBe("136");
    expect(slider.getAttribute("aria-valuetext")).toBe("Sun 16 Jun 01:00Z");
    expect(text(root, "moment-value")).toBe("Sun 16 Jun 01:00Z");
    slide(root, 137);
    expect(q<HTMLInputElement>(root, "value").value).toBe(
      "2024-06-16T01:15:00Z",
    );
    expect(slider.getAttribute("aria-valuetext")).toBe("Sun 16 Jun 01:15Z");
    expect(text(root, "gate-chip")).toBe("01:15Z");
  });

  it("keeps a zoned moment zoned, and an offset moment on its offset", async () => {
    const zoned = await mount({
      value: "2024-06-16T09:00:00+08:00[Asia/Shanghai]",
      event: "shippedOnBoard",
      timeZone: "Asia/Shanghai",
    });
    const start = Number(
      q<HTMLInputElement>(zoned.root, "moment-slider").value,
    );
    slide(zoned.root, start + 1);
    expect(q<HTMLInputElement>(zoned.root, "value").value).toBe(
      "2024-06-16T09:15:00+08:00[Asia/Shanghai]",
    );
    document.body.innerHTML = "";
    const offset = await mount({
      value: "2024-06-16T09:00:00+08:00",
      event: "shippedOnBoard",
      timeZone: "Asia/Shanghai",
    });
    const at = Number(q<HTMLInputElement>(offset.root, "moment-slider").value);
    slide(offset.root, at + 4);
    expect(q<HTMLInputElement>(offset.root, "value").value).toBe(
      "2024-06-16T10:00:00+08:00",
    );
  });

  it("changes the date when the moment crosses the place's midnight, and in no other lane at the same time", async () => {
    const { root } = await mount();
    expect(lit(root, 1)).toBe("2024-06-15");
    // The window is centred on midnight in São Paulo, 03:00Z: position 144.
    slide(root, 143);
    expect(q<HTMLInputElement>(root, "value").value).toBe(
      "2024-06-16T02:45:00Z",
    );
    expect(lit(root, 1)).toBe("2024-06-15");
    slide(root, 144);
    expect(q<HTMLInputElement>(root, "value").value).toBe(
      "2024-06-16T03:00:00Z",
    );
    expect(lit(root, 1)).toBe("2024-06-16");
    expect(plate(root, "hero-bl")[0]).toBe("Sun 16 Jun 2024");
    expect(plate(root, "hero-bl")[1]).toBe("00:00 in America/Sao_Paulo");
    expect(plate(root, "hero-utc")[1]).toBe("same date");
    expect(lit(root, 0)).toBe("2024-06-16");
    expect(lit(root, 2)).toBe("2024-06-16");
  });

  it("does not move the window while it moves: the day columns keep their places", async () => {
    const { root } = await mount();
    const before = [0, 1, 2].map((lane) => layout(root, lane));
    const axis = text(root, "axis");
    for (const position of [0, 50, 144, 200, SLIDER_MAX, 132])
      slide(root, position);
    expect([0, 1, 2].map((lane) => layout(root, lane))).toEqual(before);
    expect(text(root, "axis")).toBe(axis);
  });

  it("sets the window again when a typed value, a zone or a preset settles", async () => {
    const { root } = await mount();
    const first = layout(root, 1);
    type(root, "value", "2024-06-20T12:00:00Z");
    const typed = layout(root, 1);
    expect(typed).not.toEqual(first);
    // 12:00Z is 09:00 in São Paulo, 45 hours into a window that starts at 15:00Z
    // on 18 June.
    expect(q<HTMLInputElement>(root, "moment-slider").value).toBe("180");
    choose(root, "zone", "Asia/Shanghai");
    expect(layout(root, 1)).not.toEqual(typed);
    choose(root, "preset", "sao-paulo-evening");
    expect(layout(root, 1)).toEqual(first);
  });

  it("keeps the window when the event, a calendar or the latest date changes", async () => {
    const { root } = await mount();
    const before = layout(root, 1);
    choose(root, "event", "issue");
    choose(root, "zone-3", "Europe/Amsterdam");
    type(root, "latest", "2024-06-15");
    expect(layout(root, 1)).toEqual(before);
  });

  it("makes the state custom and holds the description's height", async () => {
    const { root } = await mount();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(
      "sao-paulo-evening",
    );
    slide(root, 140);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(text(root, "preset-description")).toBe("");
  });

  it("is disabled, and says so, when the value is not a moment it can write back", async () => {
    const { root } = await mount();
    type(root, "value", "2024-06-16T01:00:00");
    const slider = q<HTMLInputElement>(root, "moment-slider");
    expect(slider.disabled).toBe(true);
    expect(slider.getAttribute("aria-valuetext")).toBe("no moment");
    expect(dates(root, 1)).toEqual([]);
    expect(q(root, "gate").hidden).toBe(true);
    expect(isSentinel(root, "bl-output")).toBe(true);
    type(root, "value", VALUE);
    expect(slider.disabled).toBe(false);
    expect(q(root, "gate").hidden).toBe(false);
  });

  it("reads the new moment out once the slider has been still, and a typed change at once", async () => {
    vi.useFakeTimers();
    const { root } = await mount();
    const first = text(root, "summary");
    expect(first).toBe(
      "Shipped on board date: Sat 15 Jun 2024, 22:00 in America/Sao_Paulo. UTC date: Sun 16 Jun 2024, one day later.",
    );
    slide(root, 144);
    slide(root, 145);
    expect(text(root, "summary")).toBe(first);
    vi.advanceTimersByTime(499);
    expect(text(root, "summary")).toBe(first);
    vi.advanceTimersByTime(1);
    expect(text(root, "summary")).toBe(
      "Shipped on board date: Sun 16 Jun 2024, 00:15 in America/Sao_Paulo. UTC date: Sun 16 Jun 2024, same date.",
    );
    expect(q(root, "summary").getAttribute("aria-live")).toBe("polite");
    expect(q(root, "summary").classList.contains("gmt-ledger-sr")).toBe(true);
    choose(root, "preset", "shanghai-morning");
    expect(text(root, "summary")).toContain("Fri 14 Jun 2024, one day earlier");
  });
});

describe("the options", () => {
  it("compares both dates against the latest date allowed", async () => {
    const { root } = await mount();
    type(root, "latest", "2024-06-15");
    expect(plate(root, "hero-bl")).toEqual([
      "Sat 15 Jun 2024",
      "22:00 in America/Sao_Paulo",
      "on or before the latest date",
    ]);
    expect(plate(root, "hero-utc")).toEqual([
      "Sun 16 Jun 2024",
      "one day later",
      "after the latest date",
    ]);
    expect(text(root, "bl-output").split("\n").slice(-3)).toEqual([
      "true",
      "false",
      "true",
    ]);
    type(root, "latest", "");
    expect(plate(root, "hero-bl")[2]).toBe("");
  });

  it("says a latest date that is not a date makes no comparison, even when the date input refuses it", async () => {
    const { root, handle } = await mount({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "America/Sao_Paulo",
      latest: "2024-02-30",
    });
    expect(q<HTMLInputElement>(root, "latest").value).toBe("");
    expect(plate(root, "hero-bl")[2]).toBe("latest date is not a date");
    expect(plate(root, "hero-utc")[2]).toBe("latest date is not a date");
    expect(text(root, "bl-output")).not.toContain("true\ntrue");
    const state = handle.getPermalinkState?.() as Record<string, string>;
    expect(state["latest"]).toBe("2024-02-30");
    type(root, "latest", "2024-06-15");
    expect(plate(root, "hero-bl")[2]).toBe("on or before the latest date");
  });

  it("changes the caption with the event, and reaches the library with the event as given", async () => {
    const { root } = await mount();
    choose(root, "event", "received");
    expect(text(root, "hero-bl")).toContain("Received for shipment date");
    expect(q(root, "copy-bl").dataset["copyText"]).toContain('"received"');
    choose(root, "event", "issue");
    expect(text(root, "hero-bl")).toContain("Issue date");
  });

  it("adds a calendar in its own lane and lights its date", async () => {
    const { root } = await mount();
    choose(root, "zone-3", "Europe/Amsterdam");
    expect(text(root, "lane-label-3")).toBe("Europe/Amsterdam");
    expect(lit(root, 3)).toBe("2024-06-16");
    expect(q(root, "note-3").hidden).toBe(true);
    expect(q(root, "copy-bl").dataset["copyText"]).toContain(
      '{ timeZone: "Europe/Amsterdam" }',
    );
  });

  it("leaves a blank calendar out of the call", async () => {
    const { root } = await mount();
    choose(root, "zone-2", "");
    expect(
      q(root, "copy-bl")
        .dataset["copyText"]!.split("\n")
        .filter((l) => l.startsWith("bolTimestamp")),
    ).toHaveLength(2);
  });
});

describe("NO SIGNAL", () => {
  const reason = (root: HTMLElement) => text(root, "reason-aside");

  it("asks for a place when there is none", async () => {
    const { root } = await mount();
    choose(root, "preset", "no-zone");
    expect(isSentinel(root, "bl-output")).toBe(true);
    expect(reason(root)).toContain(
      "Choose the place of the event. Every bill of lading date is the local one, so the zone is required.",
    );
    expect(lit(root, 1)).toBe("");
    expect(text(root, "note-1")).toBe("no zone chosen");
    expect(text(root, "lane-label-1")).toBe("Place of the event");
    expect(q(root, "gate").hidden).toBe(false);
  });

  it("clears the reason when a date comes back", async () => {
    const { root } = await mount();
    choose(root, "preset", "no-zone");
    choose(root, "zone", "Asia/Shanghai");
    expect(reason(root)).toBe("");
    expect(isSentinel(root, "bl-output")).toBe(false);
  });

  it("says when the value is not a moment", async () => {
    const { root } = await mount();
    type(root, "value", "2024-06-16");
    expect(reason(root)).toContain("The value is not a moment.");
    expect(plate(root, "hero-bl")[0]).toBe("no result");
    expect(plate(root, "hero-utc")[0]).toBe("no result");
  });

  it("shows a chat seed with a zone the library cannot read as NO SIGNAL with its reason, and mounts", async () => {
    const { root } = await mount({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "Mars/Base",
    });
    expect(q<HTMLSelectElement>(root, "zone").value).toBe("Mars/Base");
    expect(isSentinel(root, "bl-output")).toBe(true);
    expect(text(root, "bl-output")).toBe("NO SIGNAL");
    expect(reason(root)).toContain(
      "The library does not read Mars/Base as a place.",
    );
    expect(plate(root, "hero-bl")[0]).toBe("no result");
    expect(plate(root, "hero-utc")[0]).toBe("Sun 16 Jun 2024");
    expect(text(root, "lane-label-1")).toBe("Mars/Base");
    expect(text(root, "note-1")).toBe("the library returned no date");
  });

  it("accepts a chat seed that names a UTC offset as the place and as a calendar", async () => {
    const { root } = await mount({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "-05:00",
      zone2: "+08:00",
      zone3: "+05:45",
    });
    expect(isSentinel(root, "bl-output")).toBe(false);
    expect(plate(root, "hero-bl")).toEqual([
      "Sat 15 Jun 2024",
      "20:00 in -05:00",
      "",
    ]);
    expect(lit(root, 1)).toBe("2024-06-15");
    expect(lit(root, 2)).toBe("2024-06-16");
    expect(lit(root, 3)).toBe("2024-06-16");
  });

  it("shows a calendar the library does not read in its own lane, and keeps the answer", async () => {
    const { root } = await mount({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "America/Sao_Paulo",
      zone2: "Mars/Base",
    });
    expect(isSentinel(root, "bl-output")).toBe(false);
    expect(text(root, "note-2")).toBe("the library returned no date");
    expect(lit(root, 1)).toBe("2024-06-15");
    expect(plate(root, "hero-bl")[0]).toBe("Sat 15 Jun 2024");
  });

  it("says when a zone is read but its days cannot be drawn, and shows the library's date", async () => {
    const { root } = await mount({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "America/Sao_Paulo",
      zone2: "+08:00:30",
    });
    expect(dates(root, 2)).toEqual([]);
    expect(text(root, "note-2")).toBe("2024-06-16 · its days are not drawn");
    expect(q(root, "lane-2").getAttribute("aria-label")).toBe(
      "+08:00:30: Sun 16 Jun 2024",
    );
  });

  it("names an event that is not one of the three", async () => {
    const { root } = await mount({
      value: VALUE,
      event: "loaded",
      timeZone: "America/Sao_Paulo",
    });
    expect(q<HTMLSelectElement>(root, "event").value).toBe("loaded");
    expect(isSentinel(root, "bl-output")).toBe(true);
    expect(reason(root)).toContain("loaded is not one of the three events");
    expect(text(root, "hero-bl")).toContain("B/L date");
  });

  it("does not guess a place or an event for a seed that names neither", async () => {
    const { root } = await mount({ value: VALUE });
    expect(q<HTMLSelectElement>(root, "zone").value).toBe("");
    expect(q<HTMLSelectElement>(root, "event").value).toBe("");
    expect(isSentinel(root, "bl-output")).toBe(true);
  });
});

describe("the chat registration", () => {
  const base = { value: VALUE, event: "shippedOnBoard" };

  it("accepts a zone the library cannot read, and a UTC offset, and does not validate either", async () => {
    for (const timeZone of [
      "Mars/Base",
      "+08:00",
      "-05:00",
      "Etc/GMT+8",
      "+08:00:30",
    ]) {
      const resolved = resolveWidget("showBlDateStamp", { ...base, timeZone });
      expect(resolved.ok, timeZone).toBe(true);
      if (!resolved.ok) continue;
      expect(
        await resolved.entry.validate?.(resolved.args),
        timeZone,
      ).toBeFalsy();
    }
    const calendars = resolveWidget("showBlDateStamp", {
      ...base,
      timeZone: "America/Sao_Paulo",
      zone2: "Mars/Base",
      zone3: "+05:45",
      zone4: "Asia/Shanghai",
    });
    expect(calendars.ok).toBe(true);
  });

  it("refuses a call that does not fit the shape", () => {
    expect(resolveWidget("showBlDateStamp", { ...base }).ok).toBe(false);
    expect(
      resolveWidget("showBlDateStamp", {
        ...base,
        timeZone: "New York",
      }).ok,
    ).toBe(false);
    expect(
      resolveWidget("showBlDateStamp", {
        ...base,
        event: "loaded",
        timeZone: "UTC",
      }).ok,
    ).toBe(false);
  });
});

describe("seeding", () => {
  it("seeds the chat's arguments and paints them on the first frame", async () => {
    const args = {
      value: "2024-06-14T23:00:00Z",
      event: "received",
      timeZone: "Asia/Shanghai",
      zone2: "America/Sao_Paulo",
      latest: "2024-06-14",
    };
    const { root } = await mount(args, args);
    expect(q<HTMLInputElement>(root, "value").value).toBe(args.value);
    expect(q<HTMLSelectElement>(root, "event").value).toBe("received");
    expect(q<HTMLInputElement>(root, "latest").value).toBe("2024-06-14");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(plate(root, "hero-bl")).toEqual([
      "Sat 15 Jun 2024",
      "07:00 in Asia/Shanghai",
      "after the latest date",
    ]);
    expect(lit(root, 2)).toBe("2024-06-14");
  });

  it("opens on a preset whose controls a seed matches", async () => {
    const preset = BL_DATE_PRESETS.find((p) => p.id === "shanghai-morning")!;
    const { root } = await mount({
      value: preset.value,
      event: preset.event,
      timeZone: preset.timeZone,
    });
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("shanghai-morning");
  });
});

describe("permalinks", () => {
  it.each(BL_DATE_PRESETS.map((p) => [p.id]))(
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
      const url = encodeWidgetPermalink("bldate", state);
      expect(url).toMatch(
        new RegExp(`^${SITE_BASE}/tools/bl-date-stamp/\\?w=bldate&wa=`),
      );
      const seeded = seedFromLocation("bldate", url.slice(url.indexOf("?")));
      expect(seeded).toEqual(state);
      const output = text(first.root, "bl-output");
      const copy = q(first.root, "copy-bl").dataset["copyText"];
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(text(second.root, "bl-output")).toBe(output);
      expect(q(second.root, "copy-bl").dataset["copyText"]).toBe(copy);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );

  it("leaves a blank place, calendar and latest date out of the link", async () => {
    const { root, handle } = await mount();
    choose(root, "zone", "");
    choose(root, "zone-2", "");
    const state = handle.getPermalinkState?.() as Record<string, string>;
    expect(state).toEqual({ value: VALUE, event: "shippedOnBoard" });
  });

  it("carries a moment the slider wrote", async () => {
    const { root, handle } = await mount();
    slide(root, 144);
    const state = handle.getPermalinkState?.() as Record<string, string>;
    expect(state["value"]).toBe("2024-06-16T03:00:00Z");
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

  it.each(BL_DATE_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null or undefined outside the printed output",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      expect(screenText(root)).not.toMatch(/\b(null|undefined)\b/);
    },
  );

  it("names no law, regulator, carrier or court", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|court)\w*/i;
    const { root } = await mount();
    const seen: string[] = [renderBlDateStampTemplate()];
    for (const p of BL_DATE_PRESETS) {
      choose(root, "preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const s of seen) expect(s).not.toMatch(forbidden);
  });

  it("names the library's three DCSA fields and no other standard body", async () => {
    const { root } = await mount();
    const content = root.textContent ?? "";
    expect(content).toContain("shippedOnBoardDate");
    expect(content).toContain("receivedForShipmentDate");
    expect(content).toContain("issueDate");
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderBlDateStampTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountBlDateStamp(root, {}, controller.signal);
    expect(plate(root, "hero-bl")[0]).toBe("no result");
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

  it("drops a pending reading on destroy", async () => {
    vi.useFakeTimers();
    const { root, handle } = await mount();
    const first = text(root, "summary");
    slide(root, 144);
    handle.destroy();
    vi.advanceTimersByTime(1000);
    expect(text(root, "summary")).toBe(first);
  });

  it("draws again when the width changes, and keeps the window", async () => {
    const spy = spyOnResizeObservers();
    const { root } = await mount();
    slide(root, 144);
    const before = layout(root, 1);
    q(root, "cells-1").innerHTML = "";
    // jsdom has no layout, so the observer only draws when the width differs.
    Object.defineProperty(q(root, "plot"), "clientWidth", {
      configurable: true,
      value: 480,
    });
    spy.fire();
    expect(layout(root, 1)).toEqual(before);
    expect(spy.live.size).toBe(1);
    spy.restore();
  });
});
