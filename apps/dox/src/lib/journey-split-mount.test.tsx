/**
 * @vitest-environment jsdom
 *
 * The Journey Split end to end: template -> mount -> interact -> assert, against
 * the real `@northguild/gmt`. Every preset's printed calls, results, plates,
 * ribbons and table rows are checked against values a real run of the library
 * gave, and the hand-off link both ways through the Delivery Scheduler's own
 * `readArgs`, so a drift in the library or the widget fails here.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  permalinkOf as deliveryPermalink,
  readArgs as readDeliveryArgs,
} from "./delivery-scheduler";
import { renderDeliverySchedulerTemplate } from "./delivery-scheduler-mount";
import { JOURNEY_PRESETS, TABLE_COLUMNS } from "./journey-split";
import {
  mountJourneySplit,
  renderJourneySplitTemplate,
} from "./journey-split-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "leg-count",
  "start-zone",
  ...[1, 2, 3, 4].flatMap((n) => [
    `leg-${n}`,
    `mode-${n}`,
    `duration-${n}`,
    `zone-${n}`,
    `departure-${n}`,
    `dwell-${n}`,
  ]),
  "frame",
  "heroes",
  "hero-eta",
  "hero-moving",
  "hero-waiting",
  "track-happens",
  "track-gathered",
  "badges",
  "bars-happens",
  "notes",
  "bars-gathered",
  "brackets",
  "empty-happens",
  "empty-gathered",
  "axis",
  "summary",
  "table-wrap",
  "table",
  "table-body",
  "empty-table",
  "handoff",
  "reason-aside",
  "call-journey",
  "copy-journey",
  "journey-output",
];

/** What a real run of the library gave for each preset. */
interface Expected {
  /** The results, one a line, in the order the calls are printed. */
  results: string[];
  /** The calls' names, in order. */
  calls: string[];
  plates: [string, string[]][];
  /** The hand-off table: one row of five cells for each hand-off. */
  rows: string[][];
  chips: string[];
  brackets: [string, string] | null;
  /** The segment kinds on each ribbon, in order. */
  kinds: string[];
}

const DIFFS = "diffUtcAsDuration";
const CALLS3 = ["multimodalETA", "scheduleDelivery", ...Array(7).fill(DIFFS)];

const EXPECTED: Record<string, Expected> = {
  "scheduled-sailing": {
    results: [
      '{ eta: "2024-06-29T23:00:00-05:00[America/Chicago]", totalLegs: 3, totalTransit: "PT400H", totalDwell: "PT84H" }',
      '{ eta: "2024-06-29T23:00:00-05:00[America/Chicago]", legTimes: [{ arrival: "2024-06-10T06:00:00Z", localArrival: "2024-06-10T14:00:00+08:00[Asia/Shanghai]", dwellAfter: "PT6H", mode: "truck" }, { arrival: "2024-06-26T12:00:00Z", localArrival: "2024-06-26T05:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT36H", mode: "ship" }, { arrival: "2024-06-30T04:00:00Z", localArrival: "2024-06-29T23:00:00-05:00[America/Chicago]", dwellAfter: "PT0S", mode: "rail" }] }',
      '"PT6H"',
      '"PT48H"',
      '"PT42H"',
      '"PT36H"',
      '"PT36H"',
      '"PT0S"',
      '"PT484H"',
    ],
    calls: CALLS3,
    plates: [
      ["Sat 29 Jun 23:00", ["America/Chicago", "484 h door to door"]],
      ["16 d 16 h", ["PT400H"]],
      ["3 d 12 h", ["PT84H"]],
    ],
    rows: [
      [
        "Leg 1: Mon 10 Jun 14:00",
        "6 h",
        "Mon 10 Jun 20:00",
        "Wed 12 Jun 14:00",
        "2 d",
      ],
      [
        "Leg 2: Wed 26 Jun 05:00",
        "1 d 12 h",
        "Thu 27 Jun 17:00",
        "Thu 27 Jun 17:00",
        "1 d 12 h",
      ],
    ],
    chips: [
      "2 d: 6 h handling + 42 h for the scheduled departure",
      "1 d 12 h of handling",
    ],
    brackets: ["moving · PT400H", "waiting · PT84H"],
    kinds: ["moving", "handling", "scheduled", "moving", "handling", "moving"],
  },
  "no-schedule": {
    results: [
      '{ eta: "2024-06-28T05:00:00-05:00[America/Chicago]", totalLegs: 3, totalTransit: "PT400H", totalDwell: "PT42H" }',
      '{ eta: "2024-06-28T05:00:00-05:00[America/Chicago]", legTimes: [{ arrival: "2024-06-10T06:00:00Z", localArrival: "2024-06-10T14:00:00+08:00[Asia/Shanghai]", dwellAfter: "PT6H", mode: "truck" }, { arrival: "2024-06-24T18:00:00Z", localArrival: "2024-06-24T11:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT36H", mode: "ship" }, { arrival: "2024-06-28T10:00:00Z", localArrival: "2024-06-28T05:00:00-05:00[America/Chicago]", dwellAfter: "PT0S", mode: "rail" }] }',
      '"PT6H"',
      '"PT6H"',
      '"PT0S"',
      '"PT36H"',
      '"PT36H"',
      '"PT0S"',
      '"PT442H"',
    ],
    calls: CALLS3,
    plates: [
      ["Fri 28 Jun 05:00", ["America/Chicago", "442 h door to door"]],
      ["16 d 16 h", ["PT400H"]],
      ["1 d 18 h", ["PT42H"]],
    ],
    rows: [
      [
        "Leg 1: Mon 10 Jun 14:00",
        "6 h",
        "Mon 10 Jun 20:00",
        "Mon 10 Jun 20:00",
        "6 h",
      ],
      [
        "Leg 2: Mon 24 Jun 11:00",
        "1 d 12 h",
        "Tue 25 Jun 23:00",
        "Tue 25 Jun 23:00",
        "1 d 12 h",
      ],
    ],
    chips: ["6 h of handling", "1 d 12 h of handling"],
    brackets: ["moving · PT400H", "waiting · PT42H"],
    kinds: ["moving", "handling", "moving", "handling", "moving"],
  },
  "missed-connection": {
    results: ["null", "null"],
    calls: ["multimodalETA", "scheduleDelivery"],
    plates: [
      ["no result", ["", ""]],
      ["no result", [""]],
      ["no result", [""]],
    ],
    rows: [],
    chips: [],
    brackets: null,
    kinds: [],
  },
  "across-a-clock-change": {
    results: [
      '{ eta: "2024-03-10T12:00:00-04:00[America/New_York]", totalLegs: 2, totalTransit: "PT13H", totalDwell: "PT2H" }',
      '{ eta: "2024-03-10T12:00:00-04:00[America/New_York]", legTimes: [{ arrival: "2024-03-10T11:00:00Z", localArrival: "2024-03-10T07:00:00-04:00[America/New_York]", dwellAfter: "PT2H", mode: "rail" }, { arrival: "2024-03-10T16:00:00Z", localArrival: "2024-03-10T12:00:00-04:00[America/New_York]", dwellAfter: "PT0S", mode: "truck" }] }',
      '"PT2H"',
      '"PT2H"',
      '"PT0S"',
      '"PT15H"',
    ],
    calls: ["multimodalETA", "scheduleDelivery", ...Array(4).fill(DIFFS)],
    plates: [
      ["Sun 10 Mar 12:00", ["America/New_York", "15 h door to door"]],
      ["13 h", ["PT13H"]],
      ["2 h", ["PT2H"]],
    ],
    rows: [
      [
        "Leg 1: Sun 10 Mar 07:00",
        "2 h",
        "Sun 10 Mar 09:00",
        "Sun 10 Mar 09:00",
        "2 h",
      ],
    ],
    chips: ["2 h of handling"],
    brackets: ["moving · PT13H", "waiting · PT2H"],
    kinds: ["moving", "handling", "moving"],
  },
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderJourneySplitTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountJourneySplit(root, args, controller.signal);
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

/** A plate's value and its sub lines. */
const plate = (root: HTMLElement, role: string): [string, string[]] => [
  q(root, role).querySelector(".gmt-punct-hero-value")!.textContent!,
  [...q(root, role).querySelectorAll(".gmt-punct-hero-line")].map(
    (l) => l.textContent!,
  ),
];

const segments = (root: HTMLElement, role: string) => [
  ...q(root, role).querySelectorAll<HTMLElement>(".gmt-js-seg"),
];

const tableRows = (root: HTMLElement) =>
  [...q(root, "table-body").querySelectorAll("tr")].filter(
    (r) => !r.classList.contains("gmt-js-row--blank"),
  );

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("renderJourneySplitTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderJourneySplitTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderJourneySplitTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.className).toBe("gmt-journey-split gmt-widget not-content");
    expect(widget.getAttributeNames()).toEqual(["class"]);
    const cardClasses = [...root.querySelectorAll("[class]")]
      .flatMap((el) => [...el.classList])
      .filter((c) => c.includes("card"));
    expect(new Set(cardClasses)).toEqual(new Set(["gmt-widget-card"]));
  });

  it("renders three numbered sections, section 2 wide, with the plates and the table holding their boxes", () => {
    const root = document.createElement("div");
    root.innerHTML = renderJourneySplitTemplate();
    const sections = [...root.querySelectorAll(".gmt-widget-section")];
    expect(sections).toHaveLength(3);
    expect(sections.map((s) => s.querySelector("h4")!.textContent)).toEqual([
      "1. Set the legs",
      "2. Moving and waiting",
      "3. What multimodalETA returns",
    ]);
    expect(
      sections.map((s) => s.classList.contains("gmt-widget-section--wide")),
    ).toEqual([false, true, false]);
    expect(root.querySelectorAll(".gmt-punct-hero")).toHaveLength(3);
    expect(root.querySelectorAll("fieldset.gmt-transport-leg")).toHaveLength(4);
    // Three rows are reserved for the three possible hand-offs, and the header names five columns.
    expect(root.querySelectorAll('[data-role="table-body"] tr')).toHaveLength(
      3,
    );
    expect(
      [...root.querySelectorAll("th")].map((th) => th.textContent),
    ).toEqual([...TABLE_COLUMNS]);
    expect(root.querySelectorAll(".gmt-js-lane")).toHaveLength(2);
  });

  it("labels the stated dwellAfter 'Handling after' and never says dwell on screen", () => {
    const root = document.createElement("div");
    root.innerHTML = renderJourneySplitTemplate();
    const labels = [...root.querySelectorAll("label")].map((l) =>
      l.textContent!.replace(/\s+/g, " "),
    );
    expect(labels.filter((l) => l.startsWith("Handling after"))).toHaveLength(
      4,
    );
    expect(root.textContent).not.toMatch(/dwell/i);
  });

  it("escapes a hostile seed", () => {
    const root = document.createElement("div");
    root.innerHTML = renderJourneySplitTemplate({
      legs: [
        {
          departure: '"><img src=x onerror=alert(1)>',
          duration: "<script>x</script>",
          timeZone: '"><svg onload=alert(1)>',
          dwellAfter: "<b>x</b>",
          mode: '"><i>z</i>',
        },
      ],
      startTimeZone: "<u>y</u>",
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("svg[onload]")).toBeNull();
    expect(root.querySelector("b")).toBeNull();
    expect(root.querySelector("u")).toBeNull();
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      JOURNEY_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(JOURNEY_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const want = EXPECTED[id!]!;
    const sentinel = want.results[0] === "null";

    // The calls made and what they returned, in the same order.
    const printed = text(root, "call-journey").split("\n");
    expect(printed.map((l) => l.slice(0, l.indexOf("(")))).toEqual(want.calls);
    expect(q(root, "copy-journey").dataset["copyText"]).toBe(
      text(root, "call-journey"),
    );
    expect(text(root, "journey-output")).toBe(
      sentinel ? "NO SIGNAL" : want.results.join("\n"),
    );
    expect(isSentinel(root, "journey-output")).toBe(sentinel);
    expect(root.querySelectorAll(".gmt-playground-sentinel")).toHaveLength(
      sentinel ? 1 : 0,
    );

    // The plates.
    expect(plate(root, "hero-eta")).toEqual(want.plates[0]);
    expect(plate(root, "hero-moving")).toEqual(want.plates[1]);
    expect(plate(root, "hero-waiting")).toEqual(want.plates[2]);
    expect(q(root, "heroes").children).toHaveLength(3);

    // The ribbons: the same segments on both, moving then waiting.
    const happens = segments(root, "bars-happens");
    const gathered = segments(root, "bars-gathered");
    expect(happens.map((s) => s.dataset["kind"])).toEqual(want.kinds);
    expect(gathered.map((s) => s.dataset["kind"])).toEqual(want.kinds);
    expect(gathered.map((s) => s.dataset["ms"])).toEqual(
      happens.map((s) => s.dataset["ms"]),
    );

    // The chips under the waits and the brackets under the gathered ribbon.
    expect(
      [...q(root, "notes").querySelectorAll(".gmt-js-note")].map(
        (c) => c.textContent,
      ),
    ).toEqual(want.chips);
    expect(
      [...q(root, "brackets").querySelectorAll(".gmt-js-bracket-chip")].map(
        (c) => c.textContent,
      ),
    ).toEqual(want.brackets ?? []);

    // The table: one row for each hand-off, and the box of three rows always.
    expect(q(root, "table-body").children).toHaveLength(3);
    expect(
      tableRows(root).map((r) =>
        [...r.querySelectorAll("td")].map((td) => td.textContent),
      ),
    ).toEqual(want.rows);
    for (const row of tableRows(root)) {
      expect(
        [...row.querySelectorAll("td")].map((td) => td.dataset["label"]),
      ).toEqual([...TABLE_COLUMNS]);
    }
  });

  it("draws moving segments that add up to totalTransit and waiting ones to totalDwell, for every preset", async () => {
    const hours = (iso: string) => Number(/PT(\d+)H/.exec(iso)![1]) * 3_600_000;
    for (const p of JOURNEY_PRESETS) {
      const { root } = await mount();
      choose(root, "preset", p.id);
      if (isSentinel(root, "journey-output")) continue;
      const result = text(root, "journey-output").split("\n")[0]!;
      const transit = hours(/totalTransit: "(PT\d+H)"/.exec(result)![1]!);
      const dwell = hours(/totalDwell: "(PT\d+H)"/.exec(result)![1]!);
      for (const role of ["bars-happens", "bars-gathered"]) {
        const sum = (moving: boolean) =>
          segments(root, role)
            .filter((s) => (s.dataset["kind"] === "moving") === moving)
            .reduce((n, s) => n + Number(s.dataset["ms"]), 0);
        expect(sum(true), `${p.id} ${role} moving`).toBe(transit);
        expect(sum(false), `${p.id} ${role} waiting`).toBe(dwell);
      }
      // The widths in percent agree: moving and waiting fill the track together.
      const width = (kind: boolean) =>
        segments(root, "bars-gathered")
          .filter((s) => (s.dataset["kind"] === "moving") === kind)
          .reduce((n, s) => n + parseFloat(s.style.width), 0);
      expect(width(true) + width(false)).toBeCloseTo(100, 2);
      expect(width(true) / 100).toBeCloseTo(transit / (transit + dwell), 3);
    }
  });

  it("numbers the stems 1 to 3 and puts each on its leg's series", async () => {
    const { root } = await mount();
    const badges = [...q(root, "badges").querySelectorAll(".gmt-js-badge")];
    expect(badges.map((b) => b.textContent)).toEqual(["1", "2", "3"]);
    expect(badges.map((b) => b.getAttribute("data-series"))).toEqual([
      "1",
      "2",
      "3",
    ]);
    const stems = segments(root, "bars-happens").filter(
      (s) => s.dataset["kind"] === "moving",
    );
    expect(stems.map((s) => s.dataset["series"])).toEqual(["1", "2", "3"]);
  });
});

describe("a null result", () => {
  it("shows NO SIGNAL with the library's sentence, plates that read no result, and ribbons and a table that say so in words", async () => {
    const { root } = await mount();
    choose(root, "preset", "missed-connection");
    expect(isSentinel(root, "journey-output")).toBe(true);
    expect(text(root, "reason-aside")).toContain(
      "Missed connection: leg 2 is scheduled to leave at",
    );
    expect(text(root, "reason-aside")).toContain("needs PT2H at the handoff");
    for (const hero of ["hero-eta", "hero-moving", "hero-waiting"]) {
      expect(plate(root, hero)[0]).toBe("no result");
    }
    for (const role of ["empty-happens", "empty-gathered", "empty-table"]) {
      expect(q(root, role).hidden, role).toBe(false);
      expect(text(root, role)).toContain("No journey to draw");
    }
    expect(segments(root, "bars-happens")).toHaveLength(0);
    expect(q(root, "axis").children).toHaveLength(0);
    // Every region keeps its box, and the link still opens the same legs.
    expect(q(root, "heroes").children).toHaveLength(3);
    expect(root.querySelectorAll(".gmt-js-lane")).toHaveLength(2);
    expect(q(root, "table-body").children).toHaveLength(3);
    expect(q<HTMLAnchorElement>(root, "handoff").getAttribute("href")).toMatch(
      /^\/tools\/delivery-scheduler\/\?w=delivery&wa=/,
    );
  });

  it("is a different sentence for each reason the library refuses", async () => {
    const { root } = await mount();
    type(root, "duration-1", "6 hours");
    expect(text(root, "reason-aside")).toContain(
      "Leg 1's duration is not one transitTime accepts",
    );
    type(root, "duration-1", "PT6H");
    expect(text(root, "reason-aside")).toBe("");
    type(root, "dwell-1", "soon");
    expect(text(root, "reason-aside")).toContain(
      "Leg 1's handling time is not a duration of time units, or it is negative.",
    );
    expect(isSentinel(root, "journey-output")).toBe(true);
  });
});

describe("a legitimately empty result is not a sentinel", () => {
  it("says a single leg has no hand-off, in words, with no NO SIGNAL", async () => {
    const { root } = await mount();
    choose(root, "leg-count", "1");
    expect(isSentinel(root, "journey-output")).toBe(false);
    expect(root.querySelectorAll(".gmt-playground-sentinel")).toHaveLength(0);
    expect(q(root, "empty-table").hidden).toBe(false);
    expect(text(root, "empty-table")).toBe("A single leg has no hand-off.");
    expect(tableRows(root)).toHaveLength(0);
    expect(q(root, "empty-happens").hidden).toBe(true);
    expect(plate(root, "hero-waiting")).toEqual(["0 h", ["PT0S"]]);
  });
});

describe("the form", () => {
  it("opens on the first preset", async () => {
    const { root } = await mount();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(
      "scheduled-sailing",
    );
    expect(q<HTMLSelectElement>(root, "leg-count").value).toBe("3");
    expect(text(root, "preset-description")).toBe(
      JOURNEY_PRESETS[0]!.description,
    );
    expect(q(root, "leg-4").hidden).toBe(true);
    expect(q(root, "leg-3").hidden).toBe(false);
  });

  it("makes the preset custom when a field changes, and keeps the description's height", async () => {
    const { root } = await mount();
    type(root, "dwell-1", "PT8H");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(text(root, "preset-description")).toBe("");
    // The new handling shows in the chip. The ship still sails when it was
    // scheduled to, so the waiting total does not change.
    expect(
      [...q(root, "notes").querySelectorAll(".gmt-js-note")][0]!.textContent,
    ).toBe("2 d: 8 h handling + 40 h for the scheduled departure");
    expect(plate(root, "hero-waiting")[1]).toEqual(["PT84H"]);
  });

  it("leaves a blank scheduled departure and handling out of the printed call", async () => {
    const { root } = await mount();
    choose(root, "preset", "no-schedule");
    const call = text(root, "call-journey").split("\n")[0]!;
    expect(call).not.toContain('dwellAfter: ""');
    expect(call).not.toContain('departure: ""');
    expect(call).toContain(
      '{ duration: "PT52H", timeZone: "America/Chicago", mode: "rail" }',
    );
  });

  it("passes the start zone to the library as an option", async () => {
    const { root } = await mount();
    choose(root, "leg-count", "1");
    type(root, "departure-1", "2024-06-10T08:00:00");
    expect(isSentinel(root, "journey-output")).toBe(true);
    expect(text(root, "reason-aside")).toContain("no offset or zone");
    choose(root, "start-zone", "Asia/Shanghai");
    expect(isSentinel(root, "journey-output")).toBe(false);
    expect(text(root, "call-journey").split("\n")[0]).toContain(
      '{ startTimeZone: "Asia/Shanghai" })',
    );
  });

  it("refreshes a leg's legend as its mode, duration and zone change", async () => {
    const { root } = await mount();
    type(root, "duration-2", "P3D");
    expect(text(root, "leg-legend-2")).toContain("P3D");
    choose(root, "zone-2", "Asia/Tokyo");
    expect(text(root, "leg-legend-2")).toContain("Tokyo");
  });
});

describe("the hand-off to the Delivery Scheduler", () => {
  it("is the Delivery Scheduler's permalink under the other kind, with an href in every state", async () => {
    for (const p of JOURNEY_PRESETS) {
      const { root } = await mount();
      choose(root, "preset", p.id);
      const link = q<HTMLAnchorElement>(root, "handoff");
      expect(link.textContent).toBe(
        "Open these legs in the Delivery Scheduler",
      );
      expect(link.hasAttribute("aria-disabled")).toBe(false);
      const href = link.getAttribute("href")!;
      const state = readDeliveryArgs({
        legs: p.legs as never,
        ...(p.startTimeZone === "" ? {} : { startTimeZone: p.startTimeZone }),
      });
      expect(href, p.id).toBe(
        encodeWidgetPermalink("delivery", deliveryPermalink(state)),
      );
      document.body.innerHTML = "";
    }
  });

  it("opens the same legs in the Delivery Scheduler: every leg key, legCount and startTimeZone survive", async () => {
    const { root } = await mount();
    choose(root, "preset", "scheduled-sailing");
    choose(root, "start-zone", "Asia/Shanghai");
    const href = q<HTMLAnchorElement>(root, "handoff").getAttribute("href")!;
    const seeded = seedFromLocation("delivery", href.slice(href.indexOf("?")));
    const state = readDeliveryArgs(seeded);
    expect(state.legCount).toBe("3");
    expect(state.startTimeZone).toBe("Asia/Shanghai");
    expect(deliveryPermalink(state)).toEqual(seeded);
    // The tool the link opens shows the same values.
    const target = document.createElement("div");
    target.innerHTML = renderDeliverySchedulerTemplate(seeded);
    const value = (role: string) =>
      target.querySelector<HTMLInputElement>(`[data-role="${role}"]`)!.value;
    expect(value("start-zone")).toBe("Asia/Shanghai");
    expect(value("leg-count")).toBe("3");
    for (const [i, leg] of JOURNEY_PRESETS[0]!.legs.entries()) {
      const n = i + 1;
      expect(value(`departure-${n}`)).toBe(leg.departure);
      expect(value(`duration-${n}`)).toBe(leg.duration);
      expect(value(`zone-${n}`)).toBe(leg.timeZone);
      expect(value(`dwell-${n}`)).toBe(leg.dwellAfter);
      expect(value(`mode-${n}`)).toBe(leg.mode);
    }
  });

  it("opens from the Delivery Scheduler's link: its permalink seeds this tool with every key", async () => {
    const legs = JOURNEY_PRESETS[0]!.legs;
    const state = readDeliveryArgs({
      legs: legs as never,
      startTimeZone: "Asia/Shanghai",
    });
    const href = encodeWidgetPermalink(
      "journeysplit",
      deliveryPermalink(state),
    );
    const seeded = seedFromLocation(
      "journeysplit",
      href.slice(href.indexOf("?")),
    );
    const { root, handle } = await mount(seeded);
    expect(q<HTMLSelectElement>(root, "start-zone").value).toBe(
      "Asia/Shanghai",
    );
    expect(q<HTMLSelectElement>(root, "leg-count").value).toBe("3");
    expect(handle.getPermalinkState?.()).toEqual(deliveryPermalink(state));
  });
});

describe("the scenario's seed", () => {
  it("opens the scenario's own legs: handling of two days, the ship leaving at 10:00 on the 13th", async () => {
    const seed = {
      legCount: "3",
      departure1: "2024-06-10T08:00:00+08:00[Asia/Shanghai]",
      duration1: "PT6H",
      timeZone1: "Asia/Shanghai",
      dwellAfter1: "P2D",
      mode1: "truck",
      departure2: "2024-06-13T10:00:00+08:00[Asia/Shanghai]",
      duration2: "P14DT6H",
      timeZone2: "America/Los_Angeles",
      dwellAfter2: "PT36H",
      mode2: "ship",
      duration3: "PT52H",
      timeZone3: "America/Chicago",
      mode3: "rail",
    };
    const href = encodeWidgetPermalink("journeysplit", seed);
    const { root } = await mount(
      seedFromLocation("journeysplit", href.slice(href.indexOf("?"))),
    );
    expect(text(root, "journey-output").split("\n")[0]).toBe(
      '{ eta: "2024-06-30T19:00:00-05:00[America/Chicago]", totalLegs: 3, totalTransit: "PT400H", totalDwell: "PT104H" }',
    );
    expect(plate(root, "hero-moving")).toEqual(["16 d 16 h", ["PT400H"]]);
    expect(plate(root, "hero-waiting")).toEqual(["4 d 8 h", ["PT104H"]]);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });
});

describe("seeding", () => {
  it("seeds the chat's legs array and paints it on the first frame", async () => {
    const args = {
      legs: [
        {
          departure: "2024-06-15T00:00:00Z",
          duration: "PT10H",
          timeZone: "UTC",
          dwellAfter: "PT2H",
        },
        { duration: "PT5H", timeZone: "Asia/Tokyo" },
      ],
    };
    const { root } = await mount(args, args);
    expect(q<HTMLInputElement>(root, "duration-2").value).toBe("PT5H");
    expect(q<HTMLSelectElement>(root, "leg-count").value).toBe("2");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(plate(root, "hero-eta")[0]).toBe("Sun 16 Jun 02:00");
    expect(text(root, "journey-output").split("\n")[0]).toContain(
      'totalDwell: "PT2H"',
    );
  });

  it("seeds an unlisted mode and zone without dropping them", async () => {
    const { root } = await mount({
      legs: [
        {
          departure: "2024-06-15T00:00:00Z",
          duration: "PT1H",
          timeZone: "Pacific/Chatham",
          mode: "barge",
        },
      ],
    });
    expect(q<HTMLSelectElement>(root, "mode-1").value).toBe("barge");
    expect(q<HTMLSelectElement>(root, "zone-1").value).toBe("Pacific/Chatham");
  });
});

describe("permalinks", () => {
  it.each(JOURNEY_PRESETS.map((p) => [p.id]))(
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
      const url = encodeWidgetPermalink("journeysplit", state);
      expect(url).toMatch(/^\/tools\/journey-split\/\?w=journeysplit&wa=/);
      const seeded = seedFromLocation(
        "journeysplit",
        url.slice(url.indexOf("?")),
      );
      expect(seeded).toEqual(state);
      const output = text(first.root, "journey-output");
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(text(second.root, "journey-output")).toBe(output);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );

  it("leaves a blank departure, handling, mode and start zone out of the link", async () => {
    const { handle } = await mount();
    const state = handle.getPermalinkState?.() as Record<string, string>;
    expect(state).not.toHaveProperty("startTimeZone");
    expect(state).not.toHaveProperty("departure3");
    expect(state).not.toHaveProperty("dwellAfter3");
    expect(state["legCount"]).toBe("3");
  });
});

describe("on-screen words", () => {
  function screenText(root: HTMLElement): string {
    const clone = root.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('.gmt-codeframe, output[data-role$="output"]')
      .forEach((e) => e.remove());
    // The library's own sentence for a refusal says "returns null" in words.
    clone
      .querySelectorAll('[data-role="reason-aside"], [data-role="summary"]')
      .forEach((e) => e.remove());
    const labels = [...clone.querySelectorAll("[aria-label]")].map((e) =>
      e.getAttribute("aria-label"),
    );
    return `${clone.textContent}\n${labels.join("\n")}`;
  }

  it.each(JOURNEY_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null, undefined or 'dwell' outside the printed call and output",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      const shown = screenText(root);
      expect(shown).not.toMatch(/\b(null|undefined)\b/);
      expect(shown).not.toMatch(/dwell/i);
    },
  );

  it("names no law, regulator, carrier or court", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|court)\w*/i;
    const { root } = await mount();
    const seen: string[] = [renderJourneySplitTemplate()];
    for (const p of JOURNEY_PRESETS) {
      choose(root, "preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const s of seen) expect(s).not.toMatch(forbidden);
  });

  it("states the split in one hidden sentence", async () => {
    const { root } = await mount();
    expect(text(root, "summary")).toBe(
      "Moving 16 d 16 h and waiting 3 d 12 h. ETA Sat 29 Jun 23:00 in America/Chicago, 484 h door to door.",
    );
    expect(q(root, "summary").getAttribute("aria-live")).toBe("polite");
    expect(q(root, "summary").classList.contains("gmt-ledger-sr")).toBe(true);
  });

  it("names each ribbon for a screen reader, and nothing inside a chart takes focus", async () => {
    const { root } = await mount();
    for (const role of ["track-happens", "track-gathered"]) {
      expect(q(root, role).getAttribute("role")).toBe("img");
      expect(q(root, role).getAttribute("aria-label")).toContain(
        "Gathered: moving 16 d 16 h, then waiting 3 d 12 h.",
      );
      expect(
        q(root, role).querySelectorAll(
          "a, button, input, select, textarea, [tabindex]",
        ),
      ).toHaveLength(0);
    }
  });

  it("has no drag handle or slider", async () => {
    const { root } = await mount();
    expect(
      root.querySelectorAll(
        '[role="slider"], input[type="range"], .gmt-handle',
      ),
    ).toHaveLength(0);
  });
});

describe("the hand-off table", () => {
  it("has a header row of five columns and rows that name them for the stacked view", async () => {
    const { root } = await mount();
    expect(q(root, "table").getAttribute("role")).toBe("table");
    expect(
      [...q(root, "table").querySelectorAll("th")].map((th) =>
        th.getAttribute("role"),
      ),
    ).toEqual(Array(5).fill("columnheader"));
    expect(tableRows(root).every((r) => r.getAttribute("role") === "row")).toBe(
      true,
    );
  });

  it("hides its blank rows from assistive technology and keeps their box", async () => {
    const { root } = await mount();
    const blank = [
      ...q(root, "table-body").querySelectorAll("tr.gmt-js-row--blank"),
    ];
    expect(blank).toHaveLength(1);
    expect(blank[0]!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderJourneySplitTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountJourneySplit(root, {}, controller.signal);
    expect(plate(root, "hero-eta")[0]).toBe("no result");
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

  it("fits the badges and chips again when the width changes", async () => {
    const spy = spyOnResizeObservers();
    const { root } = await mount();
    const track = q(root, "bars-happens");
    Object.defineProperty(track, "offsetWidth", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(track, "clientWidth", {
      configurable: true,
      value: 600,
    });
    spy.fire();
    const badges = [
      ...q(root, "badges").querySelectorAll<HTMLElement>(".gmt-js-badge"),
    ];
    expect(badges.every((b) => b.style.left.endsWith("px"))).toBe(true);
    const lefts = badges.map((b) => parseFloat(b.style.left));
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i]! - lefts[i - 1]!).toBeGreaterThanOrEqual(24);
    }
    expect(spy.live.size).toBe(1);
    spy.restore();
  });
});

describe("the two bracket totals cannot overlap", () => {
  it("draws both chips in one flowing row, not at two absolute edges", async () => {
    const { root } = await mount();
    const row = q(root, "brackets").querySelector(".gmt-js-bracket-chips")!;
    const chips = [...row.querySelectorAll(".gmt-js-bracket-chip")];
    expect(chips.map((c) => c.getAttribute("data-side"))).toEqual([
      "moving",
      "waiting",
    ]);
    for (const chip of chips) {
      expect((chip as HTMLElement).style.left).toBe("");
      expect((chip as HTMLElement).style.position).toBe("");
    }
  });

  it("wraps the row, pushes the waiting total to the end, and reserves the second line in the lane", () => {
    const css = readFileSync(
      path.resolve(import.meta.dirname, "../styles/gmt-journey-split.css"),
      "utf8",
    );
    const rule = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      expect(start, `${selector} has a rule`).toBeGreaterThanOrEqual(0);
      return css.slice(start, css.indexOf("}", start));
    };
    expect(rule(".gmt-js-bracket-chips")).toMatch(/display:\s*flex/);
    expect(rule(".gmt-js-bracket-chips")).toMatch(/flex-wrap:\s*wrap/);
    // A chip is never absolutely placed, so two of them cannot share a spot.
    expect(rule(".gmt-js-bracket-chip")).not.toMatch(/position:\s*absolute/);
    expect(rule('.gmt-js-bracket-chip[data-side="waiting"]')).toMatch(
      /margin-inline-start:\s*auto/,
    );
    // The lane is two chip rows tall wherever the row can wrap.
    const narrow = css.slice(
      css.indexOf("@container gmt-ledger-frame (max-width: 30rem)"),
    );
    expect(narrow).toMatch(/--gmt-js-chip-rows:\s*2/);
    expect(rule('.gmt-js-lane[data-lane="gathered"]')).toMatch(
      /--gmt-js-chip-rows:\s*1/,
    );
  });
});
