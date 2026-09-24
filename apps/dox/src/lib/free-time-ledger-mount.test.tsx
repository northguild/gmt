/**
 * @vitest-environment jsdom
 *
 * The Free Time Ledger end to end: template → mount → interact → assert,
 * against the real `@northguild/gmt`. Every preset's printed results are
 * checked against the literal `freeTimeExpiry` and `chargeableDays` JSDoc
 * examples they draw, and the coloured cells against the library's own counts,
 * so a drift in the library or the widget fails here.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { FREE_TIME_PRESETS } from "./free-time-ledger";
import {
  mountFreeTimeLedger,
  renderFreeTimeLedgerTemplate,
} from "./free-time-ledger-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "zone",
  "free-days",
  "first-day",
  "basis",
  "tiers",
  "working-terms",
  "weekend",
  "holidays",
  "timeline",
  "row",
  "label",
  "track",
  "cells",
  "expiry-marker",
  "bar",
  "handle-start",
  "handle-end",
  "axis",
  "clock-start",
  "clock-end",
  "summary",
  "reason-aside",
  "call-expiry",
  "copy-expiry",
  "expiry-output",
  "call-charges",
  "copy-charges",
  "charges-output",
];

const FRIDAY_EXPIRY =
  '{ freeTimeStart: "2024-06-14",\n  lastFreeDay: "2024-06-16",\n  expiresAt: "2024-06-17T04:00:00Z" }';

/** The JSDoc examples the presets draw, verbatim: [freeTimeExpiry, chargeableDays]. */
const EXPECTED: Record<string, [string, string]> = {
  "friday-three-days": [
    FRIDAY_EXPIRY,
    '{ freeDaysUsed: 3,\n  chargeableDays: 1,\n  expiresAt: "2024-06-17T04:00:00Z",\n  chargedDates: ["2024-06-17"],\n  byTier: [{ from: 1, to: null, days: 1 }] }',
  ],
  "read-as-next-day": [
    '{ freeTimeStart: "2024-06-15",\n  lastFreeDay: "2024-06-17",\n  expiresAt: "2024-06-18T04:00:00Z" }',
    '{ freeDaysUsed: 3,\n  chargeableDays: 0,\n  expiresAt: "2024-06-18T04:00:00Z",\n  chargedDates: [],\n  byTier: [{ from: 1, to: null, days: 0 }] }',
  ],
  "out-at-expiry": [
    FRIDAY_EXPIRY,
    '{ freeDaysUsed: 3,\n  chargeableDays: 0,\n  expiresAt: "2024-06-17T04:00:00Z",\n  chargedDates: [],\n  byTier: [{ from: 1, to: null, days: 0 }] }',
  ],
  "working-days": [
    '{ freeTimeStart: "2024-06-14",\n  lastFreeDay: "2024-06-18",\n  expiresAt: "2024-06-19T04:00:00Z" }',
    '{ freeDaysUsed: 3,\n  chargeableDays: 3,\n  expiresAt: "2024-06-19T04:00:00Z",\n  chargedDates: ["2024-06-19", "2024-06-20", "2024-06-21"],\n  byTier: [{ from: 1, to: null, days: 3 }] }',
  ],
  "terminal-holiday": [
    '{ freeTimeStart: "2024-06-14",\n  lastFreeDay: "2024-06-18",\n  expiresAt: "2024-06-19T04:00:00Z" }',
    '{ freeDaysUsed: 3,\n  chargeableDays: 3,\n  expiresAt: "2024-06-19T04:00:00Z",\n  chargedDates: ["2024-06-20", "2024-06-21", "2024-06-24"],\n  byTier: [{ from: 1, to: null, days: 3 }] }',
  ],
  tiers: [
    FRIDAY_EXPIRY,
    '{ freeDaysUsed: 3,\n  chargeableDays: 12,\n  expiresAt: "2024-06-17T04:00:00Z",\n  chargedDates: ["2024-06-17", "2024-06-18", "2024-06-19", "2024-06-20", "2024-06-21", "2024-06-22", "2024-06-23", "2024-06-24", "2024-06-25", "2024-06-26", "2024-06-27", "2024-06-28"],\n  byTier: [{ from: 1, to: 5, days: 5 }, { from: 6, to: 10, days: 5 }, { from: 11, to: null, days: 2 }] }',
  ],
  "no-free-time": [
    "NO SIGNAL",
    '{ freeDaysUsed: 0,\n  chargeableDays: 3,\n  expiresAt: "2024-06-14T04:00:00Z",\n  chargedDates: ["2024-06-14", "2024-06-15", "2024-06-16"],\n  byTier: [{ from: 1, to: null, days: 3 }] }',
  ],
};

function stubTrackGeometry(root: HTMLElement) {
  for (const track of root.querySelectorAll(".gmt-freetime-track")) {
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

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderFreeTimeLedgerTemplate(templateArgs);
  document.body.append(root);
  stubTrackGeometry(root);
  const controller = new AbortController();
  const handle = await mountFreeTimeLedger(root, args, controller.signal);
  return { root, handle, controller };
}

const datesIn = (root: HTMLElement, state: string) =>
  [
    ...q(root, "cells").querySelectorAll<HTMLElement>(
      `[data-state="${state}"]`,
    ),
  ].map((c) => c.dataset.date);

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

function select(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLSelectElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderFreeTimeLedgerTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderFreeTimeLedgerTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("opens on the first preset with the working-day terms hidden", () => {
    const root = document.createElement("div");
    root.innerHTML = renderFreeTimeLedgerTemplate();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(
      "friday-three-days",
    );
    expect(q<HTMLInputElement>(root, "clock-start").value).toBe(
      "2024-06-14T19:00:00Z",
    );
    expect(q<HTMLInputElement>(root, "free-days").value).toBe("3");
    expect(q(root, "working-terms").hidden).toBe(true);
    expect(q(root, "preset-description").textContent).toContain(
      "Monday is a charged day",
    );
  });

  it("paints seeded arguments, adding an unlisted zone and showing working terms", () => {
    const root = document.createElement("div");
    root.innerHTML = renderFreeTimeLedgerTemplate({
      clockStart: "2024-06-14T19:00:00Z",
      clockEnd: "2024-06-24T15:00:00Z",
      freeDays: 2,
      firstDay: "nextDay",
      basis: "working",
      zone: "Europe/Amsterdam",
      weekend: [5, 6],
      holidays: ["2024-06-19"],
      tiers: [5, 10],
    });
    expect(q<HTMLSelectElement>(root, "zone").value).toBe("Europe/Amsterdam");
    expect(q<HTMLSelectElement>(root, "first-day").value).toBe("nextDay");
    expect(q<HTMLSelectElement>(root, "basis").value).toBe("working");
    expect(q(root, "working-terms").hidden).toBe(false);
    expect(
      [...root.querySelectorAll<HTMLInputElement>('[data-role="weekend"]')]
        .filter((el) => el.checked)
        .map((el) => el.value),
    ).toEqual(["5", "6"]);
    expect(q<HTMLTextAreaElement>(root, "holidays").value).toBe("2024-06-19");
    expect(q<HTMLInputElement>(root, "tiers").value).toBe("5, 10");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("escapes what it interpolates", () => {
    const root = document.createElement("div");
    root.innerHTML = renderFreeTimeLedgerTemplate({
      clockStart: '"><img src=x onerror=alert(1)>',
      clockEnd: "2024-06-17T04:00:01Z",
      zone: "America/New_York",
    });
    expect(root.querySelector("img")).toBeNull();
    expect(q<HTMLInputElement>(root, "clock-start").value).toBe(
      '"><img src=x onerror=alert(1)>',
    );
  });
});

describe("mountFreeTimeLedger", () => {
  it.each(FREE_TIME_PRESETS.map((p) => [p.id]))(
    "prints the documented results for %s and colours exactly the library's days",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const [expiry, charges] = EXPECTED[id]!;
      expect(q(root, "expiry-output").textContent).toBe(expiry);
      expect(q(root, "charges-output").textContent).toBe(charges);

      // The drawing agrees with the library: chargeable cells are chargedDates,
      // and free cells are the free days the dwell touched.
      const listed = /chargedDates: \[([^\]]*)\]/.exec(charges)![1]!;
      const chargedDates = [...listed.matchAll(/"(\d{4}-\d{2}-\d{2})"/g)].map(
        (m) => m[1],
      );
      expect(datesIn(root, "chargeable")).toEqual(chargedDates);
      const used = Number(/freeDaysUsed: (\d+)/.exec(charges)![1]);
      expect(datesIn(root, "free")).toHaveLength(used);
    },
  );

  it("shades Friday to Sunday free and Monday chargeable for the first preset", async () => {
    const { root } = await mount();
    expect(datesIn(root, "free")).toEqual([
      "2024-06-14",
      "2024-06-15",
      "2024-06-16",
    ]);
    expect(datesIn(root, "chargeable")).toEqual(["2024-06-17"]);
    expect(q(root, "summary").textContent).toBe(
      "3 free days used · 1 chargeable day",
    );
    expect(q(root, "charges-output").classList).toContain(
      "gmt-playground-live",
    );
    expect(q(root, "expiry-marker").hidden).toBe(false);
    expect(q(root, "call-charges").textContent).toBe(
      'chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:01Z", 3, { basis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" })',
    );
  });

  it("charges nothing when the end is typed as exactly the expiry, and notes why", async () => {
    const { root } = await mount();
    type(root, "clock-end", "2024-06-17T04:00:00Z");
    expect(datesIn(root, "chargeable")).toEqual([]);
    expect(q(root, "charges-output").textContent).toContain(
      "chargeableDays: 0",
    );
    expect(q(root, "reason-aside").textContent).toContain("half-open");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("out-at-expiry");
  });

  it("slides the free window a day when the start-day convention changes", async () => {
    const { root } = await mount();
    select(root, "first-day", "nextDay");
    expect(datesIn(root, "event")).toEqual(["2024-06-14"]);
    expect(datesIn(root, "free")).toEqual([
      "2024-06-15",
      "2024-06-16",
      "2024-06-17",
    ]);
    expect(datesIn(root, "chargeable")).toEqual([]);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("read-as-next-day");
  });

  it("hatches the weekend and a holiday on the working basis", async () => {
    const { root } = await mount();
    choosePreset(root, "terminal-holiday");
    expect(q(root, "working-terms").hidden).toBe(false);
    expect(datesIn(root, "closed")).toEqual([
      "2024-06-15",
      "2024-06-16",
      "2024-06-19",
      "2024-06-22",
      "2024-06-23",
    ]);
    expect(datesIn(root, "free")).toEqual([
      "2024-06-14",
      "2024-06-17",
      "2024-06-18",
    ]);
    expect(datesIn(root, "chargeable")).toEqual([
      "2024-06-20",
      "2024-06-21",
      "2024-06-24",
    ]);
    expect(q(root, "call-charges").textContent).toContain(
      'calendar: { weekend: [6, 7], holidays: ["2024-06-19"], timeZone: "America/New_York" }',
    );
  });

  it("draws a tier boundary after the fifth and tenth charged days", async () => {
    const { root } = await mount();
    choosePreset(root, "tiers");
    const ends = [
      ...q(root, "cells").querySelectorAll<HTMLElement>(
        ".gmt-freetime-cell--tier-end",
      ),
    ].map((c) => c.dataset.date);
    expect(ends).toEqual(["2024-06-21", "2024-06-26"]);
    expect(q(root, "call-charges").textContent).toContain("tiers: [5, 10]");
  });

  it("renders the expiry sentinel with a note, not a caution, for zero free days", async () => {
    const { root } = await mount();
    choosePreset(root, "no-free-time");
    expect(q(root, "expiry-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "expiry-output").classList).toContain(
      "gmt-playground-sentinel",
    );
    expect(
      q(root, "reason-aside").querySelector(".starlight-aside--note"),
    ).not.toBeNull();
    expect(q(root, "reason-aside").textContent).toContain("no last free day");
    expect(datesIn(root, "chargeable")).toEqual([
      "2024-06-14",
      "2024-06-15",
      "2024-06-16",
    ]);
  });

  it("marks an inverted dwell, prints both sentinels and colours nothing", async () => {
    const { root } = await mount();
    type(root, "clock-start", "2024-06-18T19:00:00Z");
    expect(q(root, "charges-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(
      "before the clock start",
    );
    expect(q(root, "bar").classList).toContain("gmt-freetime-bar--invalid");
    expect(datesIn(root, "chargeable")).toEqual([]);
    // freeTimeExpiry does not read the end, so its answer stands.
    expect(q(root, "expiry-output").textContent).toContain("2024-06-18");
  });

  it("refuses a working-day count when the calendar has no working day", async () => {
    const { root } = await mount();
    choosePreset(root, "working-days");
    for (const box of root.querySelectorAll<HTMLInputElement>(
      '[data-role="weekend"]',
    )) {
      box.checked = true;
      box.dispatchEvent(new Event("change", { bubbles: true }));
    }
    expect(q(root, "charges-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(
      "at least one working day",
    );
  });

  it("refuses tiers that do not ascend and says so", async () => {
    const { root } = await mount();
    type(root, "tiers", "10, 5");
    expect(q(root, "charges-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(
      "larger than the last",
    );
    // The expiry does not take tiers, so it still answers.
    expect(q(root, "expiry-output").textContent).toBe(FRIDAY_EXPIRY);
  });

  it("moves the end when its handle is dragged, and keeps it after the start", async () => {
    const { root } = await mount();
    const handle = q(root, "handle-end");
    handle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
    root.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 990,
      }),
    );
    root.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
    );
    expect(q<HTMLInputElement>(root, "clock-end").value).not.toBe(
      "2024-06-17T04:00:01Z",
    );
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");

    const start = q(root, "handle-start");
    start.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 2 }),
    );
    root.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 2,
        clientX: 1000,
      }),
    );
    root.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 2 }),
    );
    expect(q(root, "charges-output").textContent).not.toBe("NO SIGNAL");
  });

  it("steps a handle with the keyboard", async () => {
    const { root } = await mount();
    const before = q<HTMLInputElement>(root, "clock-end").value;
    q(root, "handle-end").dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    const after = q<HTMLInputElement>(root, "clock-end").value;
    expect(after).not.toBe(before);
    expect(after).toContain("[America/New_York]");
  });

  it("reads a zoneless wall time from the chat in the named zone", async () => {
    const { root } = await mount({
      clockStart: "2024-06-14T15:00:00",
      clockEnd: "2024-06-17T00:00:01",
      freeDays: 3,
      firstDay: "eventDay",
      basis: "calendar",
      zone: "America/New_York",
    });
    expect(q<HTMLInputElement>(root, "clock-start").value).toBe(
      "2024-06-14T15:00:00-04:00[America/New_York]",
    );
    expect(q(root, "charges-output").textContent).toContain(
      'chargedDates: ["2024-06-17"]',
    );
  });

  it("round-trips its state as a permalink of strings", async () => {
    const { root, handle } = await mount();
    expect(handle.getPermalinkState?.()).toEqual({
      clockStart: "2024-06-14T19:00:00Z",
      clockEnd: "2024-06-17T04:00:01Z",
      freeDays: "3",
      firstDay: "eventDay",
      basis: "calendar",
      zone: "America/New_York",
    });
    choosePreset(root, "terminal-holiday");
    const state = handle.getPermalinkState?.() as Record<string, string>;
    expect(state).toMatchObject({
      basis: "working",
      weekend: "6,7",
      holidays: "2024-06-19",
    });
    // And a link made of those strings reproduces the preset.
    const again = await mount(state);
    expect(q<HTMLSelectElement>(again.root, "preset").value).toBe(
      "terminal-holiday",
    );
    expect(q(again.root, "charges-output").textContent).toBe(
      EXPECTED["terminal-holiday"]![1],
    );
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderFreeTimeLedgerTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountFreeTimeLedger(root, {}, controller.signal);
    expect(q(root, "charges-output").textContent).toBe("\u00a0");
    expect(handle.getPermalinkState?.()).toBeNull();
  });

  it("can be destroyed twice, mid-drag", async () => {
    const { root, handle } = await mount();
    q(root, "handle-end").dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });
});
