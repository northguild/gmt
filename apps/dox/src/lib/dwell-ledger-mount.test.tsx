/**
 * @vitest-environment jsdom
 *
 * The Dwell Ledger end to end: template → mount → interact → assert, against
 * the real `@northguild/gmt`. Every preset's printed result is checked against
 * the literal `dwellTime` JSDoc example it draws, so a drift in the library or
 * the widget fails here.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { DWELL_PRESETS } from "./dwell-ledger";
import {
  mountDwellLedger,
  renderDwellLedgerTemplate,
} from "./dwell-ledger-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "zone",
  "compare-zone",
  "timeline",
  "row-dwell",
  "label-dwell",
  "track-dwell",
  "cells-dwell",
  "bar",
  "handle-entry",
  "handle-exit",
  "row-compare",
  "label-compare",
  "cells-compare",
  "bar-compare",
  "axis",
  "entry",
  "exit",
  "summary",
  "reason-aside",
  "call-dwell",
  "copy-dwell",
  "dwell-output",
  "compare-result",
  "call-compare",
  "copy-compare",
  "compare-output",
];

/** The `dwellTime` JSDoc examples the presets draw, verbatim. */
const EXPECTED: Record<string, string[]> = {
  "two-hours-two-days": [
    '{ duration: "PT2H",\n  enter: "2024-06-15T23:00:00-04:00[America/New_York]",\n  exit: "2024-06-16T01:00:00-04:00[America/New_York]",\n  calendarDays: 2 }',
  ],
  "exit-at-midnight": [
    '{ duration: "PT6H",\n  enter: "2024-06-15T18:00:00-04:00[America/New_York]",\n  exit: "2024-06-16T00:00:00-04:00[America/New_York]",\n  calendarDays: 1 }',
  ],
  "spring-forward": [
    '{ duration: "PT7H",\n  enter: "2024-03-10T00:00:00-05:00[America/New_York]",\n  exit: "2024-03-10T08:00:00-04:00[America/New_York]",\n  calendarDays: 1 }',
  ],
  "london-vs-amsterdam": [
    '{ duration: "PT2H30M",\n  enter: "2024-06-15T23:30:00+01:00[Europe/London]",\n  exit: "2024-06-16T02:00:00+01:00[Europe/London]",\n  calendarDays: 2 }',
    '{ duration: "PT2H30M",\n  enter: "2024-06-16T00:30:00+02:00[Europe/Amsterdam]",\n  exit: "2024-06-16T03:00:00+02:00[Europe/Amsterdam]",\n  calendarDays: 1 }',
  ],
  "no-zone": ["NO SIGNAL"],
};

function stubTrackGeometry(root: HTMLElement) {
  for (const track of root.querySelectorAll(".gmt-dwell-track")) {
    (track as HTMLElement).getBoundingClientRect = () =>
      ({
        left: 0,
        width: 1000,
        top: 0,
        height: 32,
        right: 1000,
        bottom: 32,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }
}

const q = <T extends HTMLElement = HTMLElement>(root: HTMLElement, role: string) =>
  root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderDwellLedgerTemplate(templateArgs);
  document.body.append(root);
  stubTrackGeometry(root);
  const controller = new AbortController();
  const handle = await mountDwellLedger(root, args, controller.signal);
  return { root, handle, controller };
}

const touchedDates = (root: HTMLElement, role: string) =>
  [...q(root, role).querySelectorAll<HTMLElement>('[data-touched="true"]')].map(
    (c) => c.dataset.date,
  );

function choosePreset(root: HTMLElement, id: string) {
  const preset = q<HTMLSelectElement>(root, "preset");
  preset.value = id;
  preset.dispatchEvent(new Event("change", { bubbles: true }));
}

function type(root: HTMLElement, role: string, value: string) {
  const input = q<HTMLInputElement>(root, role);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderDwellLedgerTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDwellLedgerTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(q(root, role), `missing [data-role="${role}"]`).not.toBeNull();
    }
  });

  it("opens on the first preset", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDwellLedgerTemplate();
    const first = DWELL_PRESETS[0]!;
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(first.id);
    expect(q<HTMLInputElement>(root, "entry").value).toBe(first.entry);
    expect(q<HTMLSelectElement>(root, "zone").value).toBe(first.zone);
    expect(q(root, "row-compare").hidden).toBe(true);
  });

  it("paints seeded arguments, adding an unlisted zone", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDwellLedgerTemplate({
      entry: "2024-06-15T22:30:00Z",
      exit: "2024-06-16T01:00:00Z",
      zone: "America/Halifax",
      compareZone: "Europe/Amsterdam",
    });
    expect(q<HTMLSelectElement>(root, "zone").value).toBe("America/Halifax");
    expect(q<HTMLSelectElement>(root, "compare-zone").value).toBe(
      "Europe/Amsterdam",
    );
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(q(root, "row-compare").hidden).toBe(false);
  });

  it("escapes what it interpolates", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDwellLedgerTemplate({
      entry: '"><img src=x onerror=alert(1)>',
      exit: "x",
      zone: "<b>Zone</b>",
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("b")).toBeNull();
    expect(q<HTMLInputElement>(root, "entry").value).toBe(
      '"><img src=x onerror=alert(1)>',
    );
  });
});

describe("mountDwellLedger", () => {
  it.each(DWELL_PRESETS.map((p) => [p.id]))(
    "prints dwellTime's documented result for %s",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const [primary, compare] = EXPECTED[id]!;
      expect(q(root, "dwell-output").textContent).toBe(primary);
      if (compare) {
        expect(q(root, "compare-result").hidden).toBe(false);
        expect(q(root, "compare-output").textContent).toBe(compare);
      } else {
        expect(q(root, "compare-result").hidden).toBe(true);
      }
    },
  );

  it("shades the two dates a 23:00 → 01:00 dwell touches, and says so", async () => {
    const { root } = await mount();
    expect(touchedDates(root, "cells-dwell")).toEqual([
      "2024-06-15",
      "2024-06-16",
    ]);
    expect(q(root, "summary").textContent).toBe(
      "PT2H elapsed · 2 local days in America/New_York",
    );
    expect(q(root, "dwell-output").classList).toContain("gmt-playground-live");
  });

  it("drops to one day when the exit is typed as local midnight", async () => {
    const { root } = await mount();
    type(root, "exit", "2024-06-16T00:00:00-04:00[America/New_York]");
    expect(touchedDates(root, "cells-dwell")).toEqual(["2024-06-15"]);
    expect(q(root, "dwell-output").textContent).toContain("calendarDays: 1 }");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("draws the spring-forward day as 23 hours and notes it", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    const cell = q(root, "cells-dwell").querySelector<HTMLElement>(
      '[data-date="2024-03-10"]',
    )!;
    expect(cell.dataset.hours).toBe("23");
    expect(cell.dataset.touched).toBe("true");
    expect(q(root, "reason-aside").textContent).toContain("had 23 hours");
  });

  it("shows two days in London and one in Amsterdam on one canvas", async () => {
    const { root } = await mount();
    choosePreset(root, "london-vs-amsterdam");
    expect(touchedDates(root, "cells-dwell")).toEqual([
      "2024-06-15",
      "2024-06-16",
    ]);
    expect(touchedDates(root, "cells-compare")).toEqual(["2024-06-16"]);
    expect(q(root, "bar-compare").style.left).toBe(q(root, "bar").style.left);
    expect(q(root, "bar-compare").style.width).toBe(q(root, "bar").style.width);
    expect(q(root, "summary").textContent).toBe(
      "PT2H30M elapsed · 2 local days in Europe/London · 1 local day in Europe/Amsterdam",
    );
  });

  it("renders the sentinel and the reason when no zone is given", async () => {
    const { root } = await mount();
    choosePreset(root, "no-zone");
    const out = q(root, "dwell-output");
    expect(out.textContent).toBe("NO SIGNAL");
    expect(out.classList).toContain("gmt-playground-sentinel");
    expect(q(root, "reason-aside").textContent).toContain(
      "no place to count days in",
    );
    expect(q(root, "cells-dwell").children).toHaveLength(0);
    expect(q(root, "bar").hidden).toBe(false);
    expect(q(root, "call-dwell").textContent).toBe(
      'dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z")',
    );
  });

  it("marks an inverted dwell and shades nothing", async () => {
    const { root } = await mount();
    type(root, "entry", "2024-06-16T02:00:00-04:00[America/New_York]");
    expect(q(root, "dwell-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain("exit is before the entry");
    expect(q(root, "bar").classList).toContain("gmt-dwell-bar--invalid");
    expect(touchedDates(root, "cells-dwell")).toEqual([]);
  });

  it("moves the exit when its handle is dragged", async () => {
    const { root } = await mount();
    const handle = q(root, "handle-exit");
    const before = q<HTMLInputElement>(root, "exit").value;
    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
    root.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: 900 }),
    );
    root.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    const after = q<HTMLInputElement>(root, "exit").value;
    expect(after).not.toBe(before);
    expect(after).toMatch(/\[America\/New_York\]$/);
  });

  it("keeps the entry from passing the exit", async () => {
    const { root } = await mount();
    const handle = q(root, "handle-entry");
    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
    root.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: 1000 }),
    );
    expect(q<HTMLInputElement>(root, "entry").value).toBe(
      q<HTMLInputElement>(root, "exit").value,
    );
  });

  it("ignores a pointermove no handle started", async () => {
    const { root } = await mount();
    const before = q<HTMLInputElement>(root, "exit").value;
    root.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 900 }));
    expect(q<HTMLInputElement>(root, "exit").value).toBe(before);
  });

  it("steps a handle with the keyboard", async () => {
    const { root } = await mount();
    const handle = q(root, "handle-exit");
    const key = (k: string, shiftKey = false) =>
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true }));
    key("ArrowRight");
    expect(q<HTMLInputElement>(root, "exit").value).toBe(
      "2024-06-16T01:15:00-04:00[America/New_York]",
    );
    key("ArrowLeft", true);
    expect(q<HTMLInputElement>(root, "exit").value).toBe(
      "2024-06-16T00:15:00-04:00[America/New_York]",
    );
    key("Home");
    // The exit cannot pass the entry.
    expect(q<HTMLInputElement>(root, "exit").value).toBe(
      q<HTMLInputElement>(root, "entry").value,
    );
    expect(handle.getAttribute("aria-valuetext")).toBe("15 Jun 23:00");
  });

  it("counts days in the chosen zone when the zone changes", async () => {
    const { root } = await mount();
    const zone = q<HTMLSelectElement>(root, "zone");
    zone.value = "Asia/Tokyo";
    zone.dispatchEvent(new Event("change", { bubbles: true }));
    // 23:00 → 01:00 in New York is 12:00 → 14:00 on 16 June in Tokyo.
    expect(touchedDates(root, "cells-dwell")).toEqual(["2024-06-16"]);
    expect(q(root, "call-dwell").textContent).toContain('"Asia/Tokyo"');
  });

  it("reads a zoneless wall time from the chat in the named zone", async () => {
    const { root } = await mount({
      entry: "2024-06-15T23:00:00",
      exit: "2024-06-16T01:00:00",
      zone: "America/New_York",
    });
    expect(q<HTMLInputElement>(root, "entry").value).toBe(
      "2024-06-15T23:00:00-04:00[America/New_York]",
    );
    expect(q(root, "dwell-output").textContent).toBe(EXPECTED["two-hours-two-days"]![0]);
    // Resolved, it is exactly the first preset, and the picker says so.
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("two-hours-two-days");
  });

  it("round-trips its state as a permalink, omitting empty zones", async () => {
    const { root, handle } = await mount();
    expect(handle.getPermalinkState?.()).toEqual({
      entry: "2024-06-15T23:00:00-04:00[America/New_York]",
      exit: "2024-06-16T01:00:00-04:00[America/New_York]",
      zone: "America/New_York",
    });
    choosePreset(root, "no-zone");
    expect(handle.getPermalinkState?.()).toEqual({
      entry: "2024-06-15T22:30:00Z",
      exit: "2024-06-16T01:00:00Z",
    });
    // And a link with no zone key reproduces the no-zone state.
    const again = await mount({ entry: "2024-06-15T22:30:00Z", exit: "2024-06-16T01:00:00Z" });
    expect(q(again.root, "dwell-output").textContent).toBe("NO SIGNAL");
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderDwellLedgerTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountDwellLedger(root, {}, controller.signal);
    expect(q(root, "dwell-output").textContent).toBe(" ");
    expect(handle.getPermalinkState?.()).toBeNull();
  });

  it("can be destroyed twice, mid-drag", async () => {
    const { root, handle } = await mount();
    q(root, "handle-exit").dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });
});
