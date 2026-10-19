/**
 * @vitest-environment jsdom
 *
 * The Demurrage Clock end to end: template → mount → interact → assert, against
 * the real `@northguild/gmt`. Every preset's printed calls and results are
 * checked against the literal strings of `demurrageClock`'s JSDoc examples, the
 * bars against the library's intervals, and the hand-off link through the Free
 * Time Ledger's own `readArgs`, so a drift in the library or the widget fails
 * here.
 */
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { CLOCK_EVENT_TYPES, DEMURRAGE_PRESETS } from "./demurrage-clock";
import {
  mountDemurrageClock,
  renderDemurrageClockTemplate,
  selectOptionsHtml,
} from "./demurrage-clock-mount";
import { readArgs as readFreeTimeArgs } from "./free-time-ledger";
import { renderFreeTimeLedgerTemplate } from "./free-time-ledger-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { SITE_BASE } from "./site";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "scope",
  "direction",
  "start-event",
  "zone",
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`type-${n}`, `at-${n}`]),
  "frame",
  "heroes",
  "hero-start",
  "hero-end",
  "hero-ran",
  "plot",
  "label",
  "track",
  "cells",
  "rail",
  "lanes",
  ...[1, 2, 3, 4].flatMap((n) => [`lane-${n}`, `bar-${n}`, `why-${n}`]),
  "axis",
  "summary",
  "reason-aside",
  "handoff",
  "handoff-hint",
  "call-clock",
  "copy-clock",
  "clock-output",
];

const IMPORT = [
  ["discharged", "2024-06-14T19:00:00Z"],
  ["available", "2024-06-15T12:00:00Z"],
  ["gatedOut", "2024-06-20T14:30:00Z"],
  ["emptyReturned", "2024-06-27T09:00:00Z"],
] as const;
const EXPORT = [
  ["emptyReleased", "2024-07-01T08:00:00Z"],
  ["gatedIn", "2024-07-05T16:00:00Z"],
  ["loaded", "2024-07-09T03:00:00Z"],
] as const;

type Pairs = readonly (readonly [string, string])[];
const list = (events: Pairs) =>
  `[${events.map(([type, at]) => `{ type: "${type}", at: "${at}" }`).join(", ")}]`;
const call = (events: Pairs, scope: string, direction: string) =>
  `demurrageClock(${list(events)}, "${scope}", { direction: "${direction}" })`;
const interval = (start: string, end: string) =>
  `{ start: "${start}", end: "${end}" }`;
const offsetOf = (instant: string) =>
  `{ instant: "${instant}", offset: "+00:00" }`;

const TWICE: Pairs = [
  ["discharged", "2024-06-14T19:00:00Z"],
  ["discharged", "2024-06-15T19:00:00Z"],
  ["gatedOut", "2024-06-20T14:30:00Z"],
];
const INVERTED: Pairs = [
  ["discharged", "2024-06-21T19:00:00Z"],
  ["gatedOut", "2024-06-20T14:30:00Z"],
];

/** The four lane calls, in lane order, then the chosen one first. */
function calls(events: Pairs, direction: string, chosen: string): string[] {
  const order = ["demurrage", "detention", "storage", "combined"];
  return [chosen, ...order.filter((s) => s !== chosen)].map((s) =>
    call(events, s, direction),
  );
}

interface Expected {
  /** The printed calls, one a line. */
  copy: string;
  /** The output, or "NO SIGNAL". */
  output: string;
  /** Per lane (demurrage, detention, storage, combined): the interval or null. */
  lanes: ([string, string] | null)[];
  plates: [string, string, string] | null;
}

const IMPORT_LANES: Expected["lanes"] = [
  ["2024-06-14T19:00:00Z", "2024-06-20T14:30:00Z"],
  ["2024-06-20T14:30:00Z", "2024-06-27T09:00:00Z"],
  ["2024-06-14T19:00:00Z", "2024-06-20T14:30:00Z"],
  ["2024-06-14T19:00:00Z", "2024-06-27T09:00:00Z"],
];
const EXPORT_LANES: Expected["lanes"] = [
  ["2024-07-05T16:00:00Z", "2024-07-09T03:00:00Z"],
  ["2024-07-01T08:00:00Z", "2024-07-05T16:00:00Z"],
  ["2024-07-05T16:00:00Z", "2024-07-09T03:00:00Z"],
  ["2024-07-01T08:00:00Z", "2024-07-09T03:00:00Z"],
];

function expected(
  events: Pairs,
  direction: string,
  scope: string,
  lanes: Expected["lanes"],
  duration: string | null,
): Expected {
  const order = ["demurrage", "detention", "storage", "combined"];
  const chosen = lanes[order.indexOf(scope)];
  const sequence = [scope, ...order.filter((s) => s !== scope)];
  const results = sequence.map((s) => {
    const l = lanes[order.indexOf(s)];
    return l === null || l === undefined ? "null" : interval(l[0], l[1]);
  });
  const printed = calls(events, direction, scope);
  if (chosen !== null && chosen !== undefined) {
    printed.push(
      `toOffsetInstant("${chosen[0]}")`,
      `toOffsetInstant("${chosen[1]}")`,
      `diffUtcAsDuration("${chosen[0]}", "${chosen[1]}", "hours")`,
    );
    results.push(offsetOf(chosen[0]), offsetOf(chosen[1]), `"${duration}"`);
  }
  return {
    copy: printed.join("\n"),
    output:
      chosen === null || chosen === undefined
        ? "NO SIGNAL"
        : results.join("\n"),
    lanes,
    plates: null,
  };
}

const EXPECTED: Record<string, Expected> = {
  "import-demurrage": expected(
    IMPORT,
    "import",
    "demurrage",
    IMPORT_LANES,
    "PT139H30M",
  ),
  "import-detention": expected(
    IMPORT,
    "import",
    "detention",
    IMPORT_LANES,
    "PT162H30M",
  ),
  "export-storage": expected(
    EXPORT,
    "export",
    "storage",
    EXPORT_LANES,
    "PT83H",
  ),
  "merged-clock": expected(
    IMPORT,
    "import",
    "combined",
    IMPORT_LANES,
    "PT302H",
  ),
  "recorded-twice": expected(
    TWICE,
    "import",
    "demurrage",
    [null, null, null, null],
    null,
  ),
  "gate-out-before-discharge": expected(
    INVERTED,
    "import",
    "demurrage",
    [null, null, null, null],
    null,
  ),
};

/** Plates: [start value, start time, end value, end time, ran value, ran sub]. */
const PLATES: Record<string, string[]> = {
  "import-demurrage": [
    "discharged",
    "Fri 14 Jun 20:00",
    "gated out",
    "Thu 20 Jun 15:30",
    "5 d 19 h 30 min",
    "PT139H30M",
  ],
  "import-detention": [
    "gated out",
    "Thu 20 Jun 16:30",
    "empty returned",
    "Thu 27 Jun 11:00",
    "6 d 18 h 30 min",
    "PT162H30M",
  ],
  "export-storage": [
    "gated in",
    "Sat 6 Jul 00:00",
    "loaded",
    "Tue 9 Jul 11:00",
    "3 d 11 h",
    "PT83H",
  ],
  "merged-clock": [
    "discharged",
    "Fri 14 Jun 21:00",
    "empty returned",
    "Thu 27 Jun 11:00",
    "12 d 14 h",
    "PT302H",
  ],
  "recorded-twice": [
    "discharged",
    "no result",
    "gated out",
    "no result",
    "no result",
    "",
  ],
  "gate-out-before-discharge": [
    "discharged",
    "no result",
    "gated out",
    "no result",
    "no result",
    "",
  ],
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderDemurrageClockTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountDemurrageClock(root, args, controller.signal);
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

/** The plate's value and its one sub line. */
const plate = (root: HTMLElement, role: string) => [
  q(root, role).querySelector(".gmt-punct-hero-value")!.textContent!,
  q(root, role).querySelector(".gmt-punct-hero-sub")!.textContent!,
];

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("renderDemurrageClockTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDemurrageClockTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDemurrageClockTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.className).toBe("gmt-demurrage-clock gmt-widget not-content");
    expect(widget.getAttributeNames()).toEqual(["class"]);
    const cardClasses = [...root.querySelectorAll("[class]")]
      .flatMap((el) => [...el.classList])
      .filter((c) => c.includes("card"));
    expect(new Set(cardClasses)).toEqual(new Set(["gmt-widget-card"]));
  });

  it("renders three numbered sections, six event rows and four lanes, and holds no result", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDemurrageClockTemplate();
    expect(root.querySelectorAll(".gmt-widget-section")).toHaveLength(3);
    expect(root.querySelectorAll('[data-role^="row-"]')).toHaveLength(6);
    expect(root.querySelectorAll(".gmt-dem-lane")).toHaveLength(4);
    expect(root.querySelectorAll(".gmt-punct-hero")).toHaveLength(3);
    for (const hero of ["hero-start", "hero-end", "hero-ran"]) {
      expect(plate(root, hero)[0]).toBe("no result");
    }
    expect(root.querySelectorAll(".gmt-widget-section--wide")).toHaveLength(3);
  });

  it("says beside the control that the terminal clock is a display zone, not an argument", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDemurrageClockTemplate();
    expect(root.textContent).toContain("The terminal clock is a display zone.");
    expect(root.textContent).toContain("not an argument of demurrageClock");
  });

  it("offers the seven event types the library accepts", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDemurrageClockTemplate();
    const values = [...q(root, "type-1").querySelectorAll("option")].map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(values).toEqual(["", ...CLOCK_EVENT_TYPES]);
  });

  it("escapes a hostile seed", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDemurrageClockTemplate({
      events: [
        { type: '"><img src=x onerror=alert(1)>', at: "<script>x</script>" },
      ],
      scope: '"><script>y</script>',
      direction: "<b>x</b>",
      startEvent: "<i>z</i>",
      zone: '"><svg onload=alert(1)>',
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("svg[onload]")).toBeNull();
    expect(root.querySelector("b")).toBeNull();
  });

  it("adds a seed the list lacks as its own option and never replaces it", () => {
    const html = selectOptionsHtml([{ value: "a", label: "a" }], "b");
    expect(html).toContain('<option value="b" selected>b</option>');
    const blank = selectOptionsHtml([{ value: "a", label: "a" }], "");
    expect(blank).toContain('<option value="" selected>not chosen</option>');
    const optional = selectOptionsHtml(
      [{ value: "a", label: "a" }],
      "",
      "not given",
    );
    expect(optional).toContain('<option value="" selected>not given</option>');
    expect(optional).not.toContain("not chosen");
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      DEMURRAGE_PRESETS.map((p) => p.id).sort(),
    );
    expect(Object.keys(PLATES).sort()).toEqual(
      DEMURRAGE_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(DEMURRAGE_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const want = EXPECTED[id!]!;
    const sentinel = want.output === "NO SIGNAL";

    // The calls made and what they returned, in the same order.
    expect(q(root, "copy-clock").dataset["copyText"]).toBe(want.copy);
    expect(text(root, "call-clock")).toBe(want.copy);
    expect(text(root, "clock-output")).toBe(want.output);
    expect(isSentinel(root, "clock-output")).toBe(sentinel);

    // Each lane draws its own call's interval; only the chosen output is amber.
    want.lanes.forEach((lane, i) => {
      const bar = q(root, `bar-${i + 1}`);
      expect(bar.hidden, `bar ${i + 1}`).toBe(lane === null);
      expect(q(root, `why-${i + 1}`).hidden).toBe(lane !== null);
    });
    expect(text(root, "reason-aside") === "").toBe(!sentinel);

    // The plates.
    const p = PLATES[id!]!;
    expect(plate(root, "hero-start")).toEqual([p[0], p[1]]);
    expect(plate(root, "hero-end")).toEqual([p[2], p[3]]);
    expect(plate(root, "hero-ran")).toEqual([p[4], p[5]]);

    // Exactly one lane is lit: the chosen scope's.
    const lit = [...root.querySelectorAll('.gmt-dem-lane[data-chosen="true"]')];
    expect(lit).toHaveLength(1);
    expect((lit[0] as HTMLElement).dataset["scope"]).toBe(
      DEMURRAGE_PRESETS.find((x) => x.id === id)!.scope,
    );
    expect(root.querySelectorAll(".gmt-playground-sentinel")).toHaveLength(
      sentinel ? 1 : 0,
    );
  });

  it("opens on the first preset with its terminal clock", async () => {
    const { root } = await mount();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("import-demurrage");
    expect(q<HTMLSelectElement>(root, "zone").value).toBe("Europe/London");
    expect(text(root, "label")).toBe("Europe/London");
  });

  it("lays the day columns out in the terminal's zone and the bars over the same scale", async () => {
    const { root } = await mount();
    const days = [...q(root, "cells").querySelectorAll(".gmt-ledger-day")];
    expect(days.length).toBeGreaterThan(5);
    // The canvas pads the clocks, then widens to whole local days.
    expect((days[0] as HTMLElement).dataset["date"]! <= "2024-06-14").toBe(
      true,
    );
    expect(
      days.some((d) => (d as HTMLElement).dataset["date"] === "2024-06-27"),
    ).toBe(true);
    expect(days.every((d) => d.getAttribute("role") === "listitem")).toBe(true);
    const bar = q(root, "bar-1");
    expect(parseFloat(bar.style.left)).toBeGreaterThan(0);
    expect(parseFloat(bar.style.width)).toBeGreaterThan(0);
  });

  it("draws one diamond and one chip for each event, with the words and the local time", async () => {
    const { root } = await mount();
    const events = [...q(root, "rail").querySelectorAll(".gmt-dem-event")];
    expect(events.map((e) => e.getAttribute("aria-label"))).toEqual([
      "discharged, Fri 14 Jun 20:00 on the Europe/London clock",
      "available, Sat 15 Jun 13:00 on the Europe/London clock",
      "gated out, Thu 20 Jun 15:30 on the Europe/London clock",
      "empty returned, Thu 27 Jun 10:00 on the Europe/London clock",
    ]);
    expect(
      [...q(root, "rail").querySelectorAll(".gmt-dem-word")].map(
        (w) => w.textContent,
      ),
    ).toEqual(["discharged", "available", "gated out", "empty returned"]);
  });
});

describe("the terminal clock is a display zone", () => {
  it("changes the day columns and the local times and nothing the library is asked", async () => {
    const { root } = await mount();
    const printed = q(root, "copy-clock").dataset["copyText"];
    const output = text(root, "clock-output");
    choose(root, "zone", "Asia/Shanghai");
    expect(text(root, "label")).toBe("Asia/Shanghai");
    expect(plate(root, "hero-start")[1]).toBe("Sat 15 Jun 03:00");
    expect(q(root, "copy-clock").dataset["copyText"]).toBe(printed);
    expect(text(root, "clock-output")).toBe(output);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    choose(root, "zone", "");
    expect(text(root, "label")).toBe("UTC");
    expect(plate(root, "hero-start")[1]).toBe("Fri 14 Jun 19:00");
  });

  it("says when a seeded zone cannot be read, and still answers", async () => {
    const { root } = await mount({
      events: [
        { type: "discharged", at: "2024-06-14T19:00:00Z" },
        { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
      ],
      scope: "demurrage",
      direction: "import",
      zone: "Nowhere/Land",
    });
    expect(text(root, "label")).toBe("zone not read");
    expect(plate(root, "hero-start")[1]).toBe("zone not read");
    expect(q(root, "cells").children).toHaveLength(0);
    expect(text(root, "clock-output")).toContain("PT139H30M");
    expect(q<HTMLSelectElement>(root, "zone").value).toBe("Nowhere/Land");
  });
});

describe("the options", () => {
  it("moves the bars with the start event: each lane is a fresh call", async () => {
    const { root } = await mount();
    choose(root, "start-event", "available");
    expect(q(root, "copy-clock").dataset["copyText"]).toContain(
      '{ direction: "import", startEvent: "available" }',
    );
    expect(plate(root, "hero-start")).toEqual([
      "available",
      "Sat 15 Jun 13:00",
    ]);
    expect(text(root, "clock-output")).toContain(
      interval("2024-06-15T12:00:00Z", "2024-06-20T14:30:00Z"),
    );
    choose(root, "start-event", "");
    expect(q(root, "copy-clock").dataset["copyText"]).not.toContain(
      "startEvent",
    );
  });

  it("reads the same events as an export and finds no clock, with the reason in words", async () => {
    const { root } = await mount();
    choose(root, "direction", "export");
    expect(isSentinel(root, "clock-output")).toBe(true);
    expect(text(root, "reason-aside")).toContain("is not recorded");
    // The pair is read from the library, so the captions hold.
    expect(plate(root, "hero-start")[0]).toBe("gated in");
    expect(plate(root, "hero-end")[0]).toBe("loaded");
    expect(text(root, "why-1")).toBe("gated in is not recorded");
  });

  it("changes the chosen clock and the lit lane", async () => {
    const { root } = await mount();
    choose(root, "scope", "combined");
    expect(plate(root, "hero-end")[0]).toBe("empty returned");
    expect(q(root, "lane-4").dataset["chosen"]).toBe("true");
    expect(q(root, "lane-1").dataset["chosen"]).toBe("false");
    expect(q(root, "copy-clock").dataset["copyText"]!.split("\n")[0]).toContain(
      '"combined"',
    );
  });

  it("names a reason on the lane of every clock the library returns null for, and amber only on the chosen output", async () => {
    const { root } = await mount();
    choose(root, "preset", "import-demurrage");
    // Drop the empty return: detention and the combined clock lose their end.
    choose(root, "type-4", "");
    type(root, "at-4", "");
    expect(text(root, "why-2")).toBe("empty returned is not recorded");
    expect(text(root, "why-4")).toBe("empty returned is not recorded");
    expect(q(root, "why-1").hidden).toBe(true);
    expect(root.querySelectorAll(".gmt-playground-sentinel")).toHaveLength(0);
    expect(text(root, "clock-output")).toContain("null");
  });

  it("names a row that is not a valid event", async () => {
    const { root } = await mount();
    type(root, "at-2", "2024-06-15T12:00:00");
    expect(isSentinel(root, "clock-output")).toBe(true);
    expect(text(root, "reason-aside")).toContain("Row 2 is not a valid event");
    expect(text(root, "why-1")).toBe("row 2 is not a valid event");
  });

  it("makes a blank form a clock with its own reason, not the empty state or a blank box", async () => {
    const { root } = await mount();
    for (let n = 1; n <= 6; n++) {
      choose(root, `type-${n}`, "");
      type(root, `at-${n}`, "");
    }
    expect(q(root, "copy-clock").dataset["copyText"]).toContain(
      "demurrageClock([]",
    );
    expect(isSentinel(root, "clock-output")).toBe(true);
    expect(text(root, "reason-aside")).toContain("is not recorded");
    expect(q(root, "plot-empty").hidden).toBe(false);
    expect(text(root, "plot-empty")).toContain("Add an event");
    // Every region keeps its box.
    expect(q(root, "heroes").children).toHaveLength(3);
    expect(root.querySelectorAll(".gmt-dem-lane")).toHaveLength(4);
    expect(q(root, "handoff").hasAttribute("href")).toBe(false);
  });

  it("does not guess a direction or a scope for a seed that names neither", async () => {
    const { root } = await mount({
      events: [{ type: "discharged", at: "2024-06-14T19:00:00Z" }],
    });
    expect(q<HTMLSelectElement>(root, "direction").value).toBe("");
    expect(q<HTMLSelectElement>(root, "scope").value).toBe("");
    expect(text(root, "reason-aside")).toContain("No clock is chosen");
    choose(root, "scope", "demurrage");
    expect(text(root, "reason-aside")).toContain("must be import or export");
  });
});

describe("the hand-off to the Free Time Ledger", () => {
  it("links the chosen interval and the terminal clock, and the Free Time Ledger reads them back", async () => {
    const { root } = await mount();
    const link = q<HTMLAnchorElement>(root, "handoff");
    const href = link.getAttribute("href")!;
    expect(link.hasAttribute("aria-disabled")).toBe(false);
    expect(link.textContent).toBe("Count the days in the Free Time Ledger");
    expect(href).toBe(
      encodeWidgetPermalink("freetime", {
        clockStart: "2024-06-14T19:00:00Z",
        clockEnd: "2024-06-20T14:30:00Z",
        zone: "Europe/London",
      }),
    );
    const seeded = seedFromLocation("freetime", href.slice(href.indexOf("?")));
    expect(seeded).toEqual({
      clockStart: "2024-06-14T19:00:00Z",
      clockEnd: "2024-06-20T14:30:00Z",
      zone: "Europe/London",
    });
    const state = readFreeTimeArgs(seeded);
    expect(state.clockStart).toBe("2024-06-14T19:00:00Z");
    expect(state.clockEnd).toBe("2024-06-20T14:30:00Z");
    expect(state.zone).toBe("Europe/London");
    // And the tool the link opens shows the same values.
    const target = document.createElement("div");
    target.innerHTML = renderFreeTimeLedgerTemplate(seeded);
    expect(
      target.querySelector<HTMLInputElement>('[data-role="clock-start"]')!
        .value,
    ).toBe("2024-06-14T19:00:00Z");
    expect(
      target.querySelector<HTMLInputElement>('[data-role="clock-end"]')!.value,
    ).toBe("2024-06-20T14:30:00Z");
    expect(
      target.querySelector<HTMLSelectElement>('[data-role="zone"]')!.value,
    ).toBe("Europe/London");
  });

  it("carries the strings the library returned, and leaves the zone out when there is none", async () => {
    const { root } = await mount();
    type(root, "at-1", "2024-06-14T15:00:00-04:00[America/New_York]");
    choose(root, "zone", "");
    const href = q<HTMLAnchorElement>(root, "handoff").getAttribute("href")!;
    const seeded = seedFromLocation("freetime", href.slice(href.indexOf("?")));
    expect(seeded).toEqual({
      clockStart: "2024-06-14T15:00:00-04:00[America/New_York]",
      clockEnd: "2024-06-20T14:30:00Z",
    });
    expect(readFreeTimeArgs(seeded).clockStart).toBe(
      "2024-06-14T15:00:00-04:00[America/New_York]",
    );
  });

  it.each(DEMURRAGE_PRESETS.map((p) => [p.id]))(
    "is enabled with an href for %s only when the clock has an interval",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      const link = q<HTMLAnchorElement>(root, "handoff");
      const has = EXPECTED[id!]!.output !== "NO SIGNAL";
      expect(link.hasAttribute("href")).toBe(has);
      expect(link.getAttribute("aria-disabled")).toBe(has ? null : "true");
      expect(text(root, "handoff-hint")).toBe(
        has ? "" : "No clock to count: the chosen clock returned no interval.",
      );
    },
  );
});

describe("seeding", () => {
  it("seeds the chat's events array and paints it on the first frame", async () => {
    const args = {
      events: [
        { type: "discharged", at: "2024-06-14T19:00:00Z" },
        { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
      ],
      scope: "detention",
      direction: "import",
      zone: "Pacific/Auckland",
    };
    const { root } = await mount(args, args);
    expect(q<HTMLInputElement>(root, "at-2").value).toBe(
      "2024-06-20T14:30:00Z",
    );
    expect(q<HTMLSelectElement>(root, "zone").value).toBe("Pacific/Auckland");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(isSentinel(root, "clock-output")).toBe(true);
    expect(text(root, "why-2")).toBe("empty returned is not recorded");
  });

  it("seeds an unlisted event type, scope and zone without dropping them", async () => {
    const { root } = await mount({
      events: [{ type: "arrived", at: "2024-06-14T19:00:00Z" }],
      scope: "laytime",
      direction: "import",
      zone: "Pacific/Chatham",
    });
    expect(q<HTMLSelectElement>(root, "type-1").value).toBe("arrived");
    expect(q<HTMLSelectElement>(root, "scope").value).toBe("laytime");
    expect(q<HTMLSelectElement>(root, "zone").value).toBe("Pacific/Chatham");
    expect(q(root, "copy-clock").dataset["copyText"]).toContain('"laytime"');
    expect(text(root, "reason-aside")).toContain("laytime is not a clock");
  });
});

describe("permalinks", () => {
  it.each(DEMURRAGE_PRESETS.map((p) => [p.id]))(
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
      const url = encodeWidgetPermalink("demclock", state);
      expect(url).toMatch(
        new RegExp(`^${SITE_BASE}/tools/demurrage-clock/\\?w=demclock&wa=`),
      );
      const seeded = seedFromLocation("demclock", url.slice(url.indexOf("?")));
      expect(seeded).toEqual(state);
      const output = text(first.root, "clock-output");
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(text(second.root, "clock-output")).toBe(output);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );

  it("leaves a blank row, a blank start event and a blank zone out of the link", async () => {
    const { root, handle } = await mount();
    choose(root, "zone", "");
    type(root, "at-2", "");
    choose(root, "type-2", "");
    const state = handle.getPermalinkState?.() as Record<string, string>;
    expect(state).not.toHaveProperty("zone");
    expect(state).not.toHaveProperty("startEvent");
    expect(state).not.toHaveProperty("type2");
    expect(state["eventCount"]).toBe("4");
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

  it.each(DEMURRAGE_PRESETS.map((p) => [p.id]))(
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
    const seen: string[] = [renderDemurrageClockTemplate()];
    for (const p of DEMURRAGE_PRESETS) {
      choose(root, "preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const s of seen) expect(s).not.toMatch(forbidden);
  });

  it("states the chosen clock in one hidden sentence", async () => {
    const { root } = await mount();
    expect(text(root, "summary")).toBe(
      "demurrage: discharged to gated out: from Fri 14 Jun 20:00 to Thu 20 Jun 15:30 on the Europe/London clock. It ran for 5 d 19 h 30 min.",
    );
    expect(q(root, "summary").getAttribute("aria-live")).toBe("polite");
    expect(q(root, "summary").classList.contains("gmt-ledger-sr")).toBe(true);
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderDemurrageClockTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountDemurrageClock(root, {}, controller.signal);
    expect(plate(root, "hero-ran")[0]).toBe("no result");
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

  it("draws again when the width changes", async () => {
    const spy = spyOnResizeObservers();
    const { root } = await mount();
    const before = q(root, "rail").innerHTML;
    expect(before).not.toBe("");
    q(root, "rail").innerHTML = "";
    // jsdom has no layout, so the observer only draws when the width differs.
    Object.defineProperty(q(root, "track"), "clientWidth", {
      configurable: true,
      value: 480,
    });
    spy.fire();
    expect(q(root, "rail").innerHTML).toBe(before);
    expect(spy.live.size).toBe(1);
    spy.restore();
  });
});
