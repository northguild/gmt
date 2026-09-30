/**
 * @vitest-environment jsdom
 *
 * Mounting the zone clock list, rather than only its pure helpers.
 *
 * There was no test that ran `mountZoneClockList` at all, and that gap let a
 * real breakage ship: the virtualizer renders its first rows synchronously from
 * `_willUpdate()`, so a `const` declared lower in the module than the render
 * path is still in its temporal dead zone when the first row is written, and the
 * entire mount throws. Nothing caught it, because the globe cannot mount under
 * jsdom (no canvas, no WebGPU) and every other test here calls pure functions.
 *
 * jsdom has no layout, so every element reports a zero-sized rect and the
 * virtualizer concludes that nothing is visible — which would make these tests
 * pass against the very breakage they exist for, since a row that is never
 * built is never written to. The scroll panel is therefore given a real
 * measured height, and the tests assert that rows actually appear.
 */
/// <reference types="vitest/globals" />

import { afterEach, describe, expect, it } from "vitest";
import { installJsdomShims } from "../test/jsdom-shims";
import { readViewerDate } from "./zone-clock";
import { mountZoneClockList, zoneOptionId } from "./zone-clock-list";
import {
  dayDelta,
  dayShift,
  dayShiftChip,
  dayShiftLabel,
} from "./zone-readout";

installJsdomShims();

const ZONES = [
  "Europe/London",
  "Asia/Tokyo",
  "America/New_York",
  "Australia/Sydney",
  "Africa/Cairo",
  "America/Sao_Paulo",
  /* Deliberately the two ends of the IANA offset range: Kiritimati (UTC+14)
     and Midway (UTC-11) are 25 hours apart, so they can never show the same
     calendar date as each other — which means whatever zone the test machine
     is in, at least one of them is always on a different day from the viewer.
     That is what makes the day-shift assertions below run their prev/next
     branches on every machine and at every hour, rather than passing vacuously
     the way they would on a fixture that happens to agree with "today". */
  "Pacific/Kiritimati",
  "Pacific/Midway",
];

const mounted: Array<{ destroy(): void }> = [];

function mount(ids: readonly string[] = ZONES) {
  const panel = document.createElement("div");
  panel.id = "test-clock-panel";
  document.body.appendChild(panel);
  /* The virtualizer measures its scroll element synchronously while mounting,
     and it reads `offsetWidth`/`offsetHeight` — not `getBoundingClientRect`.
     jsdom reports 0 for both, so without this it concludes nothing is visible
     and builds no rows at all. */
  for (const [property, value] of [
    ["offsetWidth", 300],
    ["offsetHeight", 400],
    ["clientWidth", 300],
    ["clientHeight", 400],
  ] as const) {
    Object.defineProperty(panel, property, { value, configurable: true });
  }
  const picked: string[] = [];
  const list = mountZoneClockList(panel, ids, (id) => picked.push(id));
  mounted.push(list);
  return { panel, list, picked };
}

afterEach(() => {
  for (const list of mounted.splice(0)) list.destroy();
  document.body.innerHTML = "";
});

describe("mountZoneClockList", () => {
  it("mounts without throwing", () => {
    // The regression this file exists for: a ReferenceError from the first
    // synchronous render would surface right here.
    expect(() => mount()).not.toThrow();
  });

  it("builds its scroll sizer and renders rows", () => {
    const { panel } = mount();
    expect(panel.querySelector(".gmt-globe-clocks-sizer")).not.toBeNull();
    /* Load-bearing: without rows, nothing below actually exercises the render
       path, and this whole file would pass against a broken mount. */
    expect(panel.querySelectorAll("[data-tz-id]").length).toBeGreaterThan(0);
  });

  it("ticks without throwing, repeatedly", () => {
    const { list } = mount();
    expect(() => {
      list.tick();
      list.tick();
      list.tick();
    }).not.toThrow();
  });

  it("selects a zone, and clears the selection", () => {
    const { list } = mount();
    expect(() => {
      list.select("Asia/Tokyo");
      list.select("Europe/London");
      list.select(null);
    }).not.toThrow();
  });

  it("survives a tick after a selection", () => {
    const { list } = mount();
    list.select("Asia/Tokyo");
    expect(() => list.tick()).not.toThrow();
  });

  it("is safe to destroy twice", () => {
    const { list } = mount();
    list.destroy();
    expect(() => list.destroy()).not.toThrow();
  });

  it("handles an empty zone list", () => {
    expect(() => mount([])).not.toThrow();
  });

  it("writes a live reading into every row", () => {
    const { panel, list } = mount();
    list.tick();
    const rows = panel.querySelectorAll("[data-tz-id]");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const time = row.querySelector("[data-tz-field='time']");
      const offset = row.querySelector("[data-tz-field='offset']");
      expect(time, "a row has a time field").not.toBeNull();
      expect(offset, "a row has an offset field").not.toBeNull();
      // `HH:MM:SS`, or the sentinel the design system shows for a lost signal.
      expect(time?.textContent ?? "").toMatch(/^(\d{2}:\d{2}:\d{2}|— — —)$/);
      expect(offset?.textContent ?? "").toMatch(
        /^(UTC[+-]\d{2}:\d{2}|no signal)$/,
      );
    }
  });

  it("writes the local date into every row", () => {
    const { panel, list } = mount();
    list.tick();
    const rows = panel.querySelectorAll("[data-tz-id]");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const date = row.querySelector("[data-tz-field='date']");
      expect(date, "a row has a date field").not.toBeNull();
      // `YYYY-MM-DD`, or empty when the reading hit its sentinel.
      expect(date?.textContent ?? "").toMatch(/^(\d{4}-\d{2}-\d{2})?$/);
    }
  });

  it("marks a row's day shift, and only when the day really differs", () => {
    /* The invariant, not a fixed expectation: which of these zones is on
       another day depends on the wall clock and on the machine's own zone, so
       the test derives the answer the same way the widget does and checks the
       two agree. */
    const { panel, list } = mount();
    list.tick();
    const viewerDate = readViewerDate();
    const rows = panel.querySelectorAll<HTMLElement>("[data-tz-id]");
    expect(rows.length).toBeGreaterThan(0);
    let shifted = 0;
    for (const row of rows) {
      const date =
        row.querySelector("[data-tz-field='date']")?.textContent ?? "";
      if (!date || !viewerDate) continue;
      const shift = dayShift(date, viewerDate);
      const delta = dayDelta(date, viewerDate);
      expect(row.classList.contains("gmt-day-prev")).toBe(shift === "prev");
      expect(row.classList.contains("gmt-day-next")).toBe(shift === "next");
      const chip = row.querySelector("[data-tz-field='shift']");
      /* The row states the real difference, which at the extremes of the
         offset range is two days, not the three-way bucket the filter uses. */
      expect(chip?.getAttribute("data-shift")).toBe(String(delta));
      // The direction is carried in text, never by the wash alone.
      expect(chip?.textContent ?? "").toBe(
        delta === 0 ? "" : `${dayShiftChip(delta)} ${dayShiftLabel(delta)}`,
      );
      if (shift !== "same") shifted += 1;
    }
    /* Guards the guard: without this the loop above passes just as happily on a
       list where nothing is day-shifted at all. */
    expect(shifted, "at least one zone is on another day").toBeGreaterThan(0);
  });

  it("marks only a zone actually on summer time, in text", () => {
    const { panel, list } = mount();
    list.tick();
    const slotFor = (id: string) =>
      panel.querySelector(`[data-tz-id="${id}"] [data-tz-field='dst']`);

    /* Asia/Tokyo has had no DST since 1951 — nothing to mark. Europe/London
       observes it, so it is marked on one side of the transition and not the
       other. No glyph either way: a sun beside a globe drawing its own
       day/night terminator read as "daytime", not as a shifted clock. */
    const tokyo = slotFor("Asia/Tokyo");
    expect(tokyo?.getAttribute("data-dst")).toBe("none");
    expect(tokyo?.textContent).toBe("");

    const london = slotFor("Europe/London");
    const state = london?.getAttribute("data-dst");
    expect(["dst", "standard"]).toContain(state);
    expect(london?.querySelector("svg")).toBeNull();
    if (state === "dst") {
      expect(london?.textContent).toContain("DST");
      // Terse on screen, spelled out for assistive tech.
      expect(london?.textContent).toContain("in DST");
    } else {
      expect(london?.textContent).toBe("");
    }
  });

  it("narrows to a filtered set, and restores the full one", () => {
    const { panel, list } = mount();
    const idsOf = () =>
      [...panel.querySelectorAll<HTMLElement>("[data-tz-id]")].map(
        (row) => row.dataset.tzId,
      );
    expect(idsOf().length).toBeGreaterThan(2);

    list.setIds(["Asia/Tokyo", "Europe/London"]);
    expect(idsOf()).toEqual(["Asia/Tokyo", "Europe/London"]);
    // Rows are rebuilt, not reused in place: index 0 must now *be* Tokyo, not
    // carry Tokyo's name over the previous zone's clock.
    const first = panel.querySelector<HTMLElement>("[data-tz-id]");
    expect(first?.querySelector(".gmt-clock-name")?.textContent).toBe(
      "Asia/Tokyo",
    );

    list.setIds(ZONES);
    expect(idsOf().length).toBeGreaterThan(2);
  });

  it("keeps ticking after a filter change", () => {
    const { panel, list } = mount();
    list.setIds(["Europe/London"]);
    expect(() => list.tick()).not.toThrow();
    const time = panel.querySelector("[data-tz-field='time']");
    expect(time?.textContent ?? "").toMatch(/^(\d{2}:\d{2}:\d{2}|— — —)$/);
  });

  it("survives filtering the selected zone out of the list", () => {
    /* The globe keeps its selection and its tooltip when a filter hides that
       zone, so `select` has to cope with an id that is no longer listed. */
    const { list } = mount();
    list.select("Asia/Tokyo");
    expect(() => list.setIds(["Europe/London"])).not.toThrow();
    expect(() => list.select("Asia/Tokyo")).not.toThrow();
    expect(() => list.tick()).not.toThrow();
  });

  it("handles being filtered down to nothing", () => {
    const { panel, list } = mount();
    expect(() => list.setIds([])).not.toThrow();
    expect(panel.querySelectorAll("[data-tz-id]")).toHaveLength(0);
    expect(() => list.tick()).not.toThrow();
    expect(() => list.setIds(ZONES)).not.toThrow();
    expect(panel.querySelectorAll("[data-tz-id]").length).toBeGreaterThan(0);
  });

  it("points aria-activedescendant at a mounted row after a filter", () => {
    /* Row ids come from the row's index, not its zone, so after a filter the
       id the listbox pointed at can name a row that no longer exists — or,
       clamped into range, one scrolled out of the DOM. ARIA requires the
       active descendant to name a real option; a missing one leaves a screen
       reader with no position, and nothing visible gives it away. A filter
       scrolls the list to the top, so browsing restarts there too. */
    const { panel, list } = mount();
    const active = () => panel.getAttribute("aria-activedescendant");
    panel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    expect(active()).toBe(zoneOptionId(panel.id, ZONES.length - 1));

    list.setIds(ZONES.slice(0, 3));
    expect(active()).toBe(zoneOptionId(panel.id, 0));
    expect(document.getElementById(active() as string)).not.toBeNull();

    // And browsing carries on from there, not from the old position.
    panel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(active()).toBe(zoneOptionId(panel.id, 1));

    list.setIds([]);
    expect(panel.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("leaves row positions alone on a tick", () => {
    /* A tick used to re-run the virtualizer's full render, rewriting every row's
       transform and then reading its size back — a layout read straight after a
       write, once a second, for every visible clock. That thrash stalled the
       main thread for tens of milliseconds a second, which reads as a stutter in
       a drag or an ambient spin. Time passing moves no row, so the transforms
       must come out unchanged. */
    const { panel, list } = mount();
    const positions = () =>
      [...panel.querySelectorAll<HTMLElement>("[data-tz-id]")].map(
        (row) => row.style.transform,
      );
    const before = positions();
    expect(before.length).toBeGreaterThan(0);
    list.tick();
    expect(positions()).toEqual(before);
  });
});
