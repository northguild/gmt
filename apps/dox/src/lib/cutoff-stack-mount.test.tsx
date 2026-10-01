/**
 * @vitest-environment jsdom
 *
 * The Cut-off Stack widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Every preset's printed call
 * and result is an appendix Z row.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { STACK_PRESETS } from "./cutoff-stack";
import {
  mountCutoffStack,
  renderCutoffStackTemplate,
} from "./cutoff-stack-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "anchor",
  "time-zone",
  "cutoff-1",
  "cutoff-2",
  "cutoff-3",
  "cutoff-4",
  "name-1",
  "offset-1",
  "at-local-time-1",
  "closed-days",
  "calendar",
  "weekday-1",
  "weekday-7",
  "holidays",
  "roll",
  "stack-timeline",
  "stack-summary",
  "stack-table",
  "stack-table-body",
  "reason-aside",
  "call-stack",
  "copy-stack",
  "stack-output",
];

const EXPECTED: Record<string, [string, string | null]> = {
  "rotterdam-weekend": [
    '"2024-06-17T18:00:00+02:00[Europe/Amsterdam]", [{ name: "gate-in", offset: "P2D", atLocalTime: "17:00" }, { name: "documents", offset: "P3D", atLocalTime: "12:00" }], { timeZone: "Europe/Amsterdam", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" }, roll: "preceding" }',
    '[{ name: "documents", at: "2024-06-14T12:00:00+02:00[Europe/Amsterdam]" }, { name: "gate-in", at: "2024-06-14T17:00:00+02:00[Europe/Amsterdam]" }]',
  ],
  "rotterdam-following": [
    '"2024-06-17T18:00:00+02:00[Europe/Amsterdam]", [{ name: "gate-in", offset: "P2D", atLocalTime: "17:00" }, { name: "documents", offset: "P3D", atLocalTime: "12:00" }, { name: "VGM", offset: "P1D", atLocalTime: "10:00" }], { timeZone: "Europe/Amsterdam", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" }, roll: "following" }',
    '[{ name: "documents", at: "2024-06-14T12:00:00+02:00[Europe/Amsterdam]" }, { name: "VGM", at: "2024-06-17T10:00:00+02:00[Europe/Amsterdam]" }, { name: "gate-in", at: "2024-06-17T17:00:00+02:00[Europe/Amsterdam]" }]',
  ],
  holiday: [
    '"2024-05-10T18:00:00+02:00[Europe/Amsterdam]", [{ name: "gate-in", offset: "PT6H" }, { name: "documents", offset: "P1D", atLocalTime: "12:00" }], { timeZone: "Europe/Amsterdam", calendar: { weekend: [6, 7], holidays: ["2024-05-09"], timeZone: "Europe/Amsterdam" }, roll: "preceding" }',
    '[{ name: "documents", at: "2024-05-08T12:00:00+02:00[Europe/Amsterdam]" }, { name: "gate-in", at: "2024-05-10T12:00:00+02:00[Europe/Amsterdam]" }]',
  ],
  "no-roll": [
    '"2024-06-17T18:00:00+02:00[Europe/Amsterdam]", [{ name: "gate-in", offset: "P2D", atLocalTime: "17:00" }, { name: "documents", offset: "P3D", atLocalTime: "12:00" }], { timeZone: "Europe/Amsterdam", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" } }',
    null,
  ],
  "no-calendar": [
    '"2024-06-14T16:00:00Z", [{ name: "gate-in", offset: "P1D" }, { name: "document", offset: "P2D", atLocalTime: "17:00" }, { name: "VGM", offset: "P1D", atLocalTime: "10:00" }], { timeZone: "Europe/Amsterdam" }',
    '[{ name: "document", at: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]" }, { name: "VGM", at: "2024-06-13T10:00:00+02:00[Europe/Amsterdam]" }, { name: "gate-in", at: "2024-06-13T18:00:00+02:00[Europe/Amsterdam]" }]',
  ],
  "skipped-hour": [
    '"2024-03-11T22:00:00Z", [{ name: "gate-in", offset: "P1D" }, { name: "VGM", offset: "P1D", atLocalTime: "02:30" }], { timeZone: "America/New_York" }',
    null,
  ],
};

const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderCutoffStackTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountCutoffStack(root, args, controller.signal);
  return { root, handle, controller };
}

function choosePreset(root: HTMLElement, id: string) {
  const preset = q<HTMLSelectElement>(root, "preset");
  preset.value = id;
  preset.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderCutoffStackTemplate", () => {
  it("has the exact widget root", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCutoffStackTemplate();
    expect(
      root.firstElementChild?.outerHTML.startsWith(
        '<div class="gmt-cutoff-stack gmt-widget not-content">',
      ),
    ).toBe(true);
  });

  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCutoffStackTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });
});

describe("mountCutoffStack", () => {
  it.each(STACK_PRESETS.map((p) => [p.id]))(
    "prints the documented call and result for %s",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const [call, result] = EXPECTED[id]!;
      expect(q(root, "copy-stack").dataset.copyText).toBe(
        `cutoffSchedule(${call})`,
      );
      if (result === null) {
        expect(q(root, "stack-output").textContent).toBe("NO SIGNAL");
      } else {
        expect(
          q(root, "stack-output").textContent!.replace(/\n\s+/g, " "),
        ).toBe(result);
      }
    },
  );

  it("shows the table's Closes and Moved cells for the pill preset", async () => {
    const { root } = await mount();
    choosePreset(root, "rotterdam-weekend");
    const rows = [...q(root, "stack-table-body").querySelectorAll("tr")];
    expect(rows).toHaveLength(2);
    const [documents, gateIn] = rows.map((tr) =>
      [...tr.children].map((td) => td.textContent ?? ""),
    );
    expect(documents![0]).toBe("documents");
    expect(documents![4]).toBe("no");
    expect(gateIn![0]).toBe("gate-in");
    expect(gateIn![2]).toContain("Fri 14 Jun 17:00");
    expect(gateIn![4]).toContain("from Sat 15 Jun 17:00");
  });

  it("counts the two closed-day columns on the pill preset", async () => {
    const { root } = await mount();
    choosePreset(root, "rotterdam-weekend");
    const closed = q(root, "stack-timeline").querySelectorAll(
      ".gmt-cutoff-stack-day--closed",
    );
    expect(closed).toHaveLength(2);
  });

  it("the timeline is not a tab stop", async () => {
    const { root } = await mount();
    expect(q(root, "stack-timeline").getAttribute("tabindex")).toBe("-1");
  });

  it("draws day columns at their real width, not all equal, across New York's fall-back", async () => {
    // R1's own range: a departure on 4 November 2024, with an axis reaching
    // back across 3 November, the 25-hour fall-back day.
    const seed = {
      anchor: "2024-11-05T18:00:00-05:00[America/New_York]",
      timeZone: "America/New_York",
      cutoffs: [{ name: "gate-in", offset: "P2D", atLocalTime: "12:00" }],
    };
    const { root } = await mount(seed);
    const columns = [
      ...q(root, "stack-timeline").querySelectorAll(".gmt-cutoff-stack-day"),
    ];
    expect(columns.length).toBeGreaterThanOrEqual(3);
    const widths = columns.map((c) => {
      const style = c.getAttribute("style") ?? "";
      const m = /width:([\d.]+)%/.exec(style);
      return m ? Number(m[1]) : Number.NaN;
    });
    expect(widths.every((w) => !Number.isNaN(w))).toBe(true);
    // A 25-hour day and its 24-hour neighbours cannot all get an equal share
    // of the axis.
    expect(new Set(widths.map((w) => w.toFixed(3))).size).toBeGreaterThan(1);
  });

  it("shows the calendar-without-roll reason on no-roll", async () => {
    const { root } = await mount();
    choosePreset(root, "no-roll");
    expect(q(root, "stack-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain("no default");
  });

  it("shows the skipped-hour reason on skipped-hour", async () => {
    const { root } = await mount();
    choosePreset(root, "skipped-hour");
    expect(q(root, "stack-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(
      "Cut-off 2 lands on a local time the clock skipped",
    );
  });

  it("renders the chat seed as S1: gate-in moved from Sat 15 Jun, documents no", async () => {
    const seed = {
      anchor: "2024-06-17T18:00:00+02:00[Europe/Amsterdam]",
      timeZone: "Europe/Amsterdam",
      cutoffs: [
        { name: "gate-in", offset: "P2D", atLocalTime: "17:00" },
        { name: "documents", offset: "P3D", atLocalTime: "12:00" },
      ],
      weekend: [6, 7],
      roll: "preceding",
    };
    const { root } = await mount(seed);
    expect(q(root, "stack-output").textContent!.replace(/\n\s+/g, " ")).toBe(
      EXPECTED["rotterdam-weekend"]![1],
    );
    const rows = [...q(root, "stack-table-body").querySelectorAll("tr")];
    const gateIn = rows.find(
      (tr) => tr.children[0]?.textContent === "gate-in",
    )!;
    expect(gateIn.children[4]?.textContent).toContain("from Sat 15 Jun 17:00");
    const documents = rows.find(
      (tr) => tr.children[0]?.textContent === "documents",
    )!;
    expect(documents.children[4]?.textContent).toBe("no");
  });

  it("unticking the calendar gives roll-without-calendar and NO SIGNAL", async () => {
    const { root } = await mount();
    choosePreset(root, "rotterdam-weekend");
    const calendar = q<HTMLInputElement>(root, "calendar");
    calendar.checked = false;
    calendar.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q(root, "stack-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(
      "A roll convention needs a business calendar",
    );
  });

  it("choosing '(not given)' in the roll select gives calendar-without-roll", async () => {
    const { root } = await mount();
    choosePreset(root, "rotterdam-weekend");
    const roll = q<HTMLSelectElement>(root, "roll");
    roll.value = "";
    roll.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q(root, "stack-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(
      "A business calendar needs a roll convention",
    );
  });

  it("clearing every offset gives the empty state, not NO SIGNAL", async () => {
    const { root } = await mount();
    choosePreset(root, "rotterdam-weekend");
    for (const n of [1, 2, 3, 4]) {
      const offset = q<HTMLInputElement>(root, `offset-${n}`);
      offset.value = "";
      offset.dispatchEvent(new Event("input", { bubbles: true }));
    }
    expect(q(root, "stack-output").textContent).toBe("[]");
    expect(q(root, "stack-output").className).not.toContain("sentinel");
    expect(q(root, "reason-aside").textContent).toContain(
      "An empty list returns []",
    );
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of STACK_PRESETS) {
      const { root, handle } = await mount();
      choosePreset(root, preset.id);
      const state = handle.getPermalinkState?.() as Record<string, string>;
      expect(state).not.toBeNull();
      for (const value of Object.values(state))
        expect(typeof value).toBe("string");
      const url = encodeWidgetPermalink("cutoffstack", state);
      const seeded = seedFromLocation(
        "cutoffstack",
        url.slice(url.indexOf("?")),
      );
      const again = await mount(seeded);
      const [, result] = EXPECTED[preset.id]!;
      if (result === null) {
        expect(q(again.root, "stack-output").textContent).toBe("NO SIGNAL");
      } else {
        expect(
          q(again.root, "stack-output").textContent!.replace(/\n\s+/g, " "),
        ).toBe(result);
      }
      document.body.innerHTML = "";
    }
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderCutoffStackTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountCutoffStack(root, {}, controller.signal);
    expect(handle.getPermalinkState?.()).toBeNull();
  });

  it("can be destroyed twice", async () => {
    const { handle } = await mount();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });
});

describe("the stack's series, markers and gate", () => {
  const laneOf = (root: HTMLElement, name: string) =>
    [
      ...q(root, "stack-timeline").querySelectorAll<HTMLElement>(
        ".gmt-cutoff-stack-lane",
      ),
    ].find(
      (l) =>
        l.querySelector(".gmt-cutoff-stack-lane-label")?.textContent === name,
    )!;

  it("shares one series between a lane and its table swatch", async () => {
    const { root } = await mount();
    choosePreset(root, "rotterdam-weekend");
    const rows = [...q(root, "stack-table-body").querySelectorAll("tr")];
    expect(rows).toHaveLength(2);
    for (const tr of rows) {
      const swatch = tr.querySelector<HTMLElement>(
        ".gmt-cutoff-series-swatch",
      )!;
      expect(swatch.textContent).toBe("");
      expect(swatch.getAttribute("aria-hidden")).toBe("true");
      expect(laneOf(root, tr.children[0]!.textContent!).dataset.series).toBe(
        swatch.dataset.series,
      );
    }
  });

  it("draws a moved row with one hollow marker and one aria-hidden arc", async () => {
    const { root } = await mount();
    choosePreset(root, "rotterdam-weekend");
    const gateIn = laneOf(root, "gate-in");
    expect(gateIn.querySelectorAll(".gmt-cutoff-mark--hollow")).toHaveLength(1);
    const arcs = gateIn.querySelectorAll(".gmt-cutoff-stack-arc");
    expect(arcs).toHaveLength(1);
    expect(arcs[0]!.getAttribute("aria-hidden")).toBe("true");
    expect(gateIn.textContent).toContain("moved");
  });

  it("draws a row that did not move with neither", async () => {
    const { root } = await mount();
    choosePreset(root, "rotterdam-weekend");
    const documents = laneOf(root, "documents");
    expect(documents.querySelectorAll(".gmt-cutoff-mark--hollow")).toHaveLength(
      0,
    );
    expect(documents.querySelectorAll(".gmt-cutoff-stack-arc")).toHaveLength(0);
    expect(documents.textContent).not.toContain("moved");
  });

  it("draws the departure gate once, in the days layer, not once per lane", async () => {
    const { root } = await mount();
    choosePreset(root, "no-calendar");
    const timeline = q(root, "stack-timeline");
    expect(timeline.querySelectorAll(".gmt-cutoff-gate")).toHaveLength(1);
    expect(
      timeline.querySelectorAll(".gmt-cutoff-stack-days > .gmt-cutoff-gate"),
    ).toHaveLength(1);
    expect(
      timeline.querySelector(".gmt-cutoff-stack-gate-chip")?.textContent,
    ).toContain("departs 18:00");
  });

  it("holds no focusable descendant", async () => {
    const { root } = await mount();
    for (const id of ["rotterdam-weekend", "no-calendar", "skipped-hour"]) {
      choosePreset(root, id);
      expect(
        q(root, "stack-timeline").querySelectorAll(FOCUSABLE),
      ).toHaveLength(0);
    }
  });
});
