/**
 * @vitest-environment jsdom
 *
 * The filter accordion's own DOM behaviour — which toggles are on screen, what
 * a click reports, and that refreshing never disturbs a control the reader is
 * using. The globe cannot mount under jsdom (no canvas, no WebGPU), so this is
 * the only place any of it runs.
 */
/// <reference types="vitest/globals" />

import { afterEach, describe, expect, it, vi } from "vitest";
import type { BucketCounts } from "./zone-filter";
import { mountZoneFilters } from "./zone-filter-ui";

function counts(over: Partial<BucketCounts> = {}): BucketCounts {
  return {
    days: { prev: 2, same: 400, next: 16 },
    dst: { dst: 60, standard: 12, none: 346 },
    sky: { day: 210, twilight: 30, night: 178 },
    ...over,
  };
}

const mounted: Array<{ destroy(): void }> = [];

function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const changes: unknown[] = [];
  const ui = mountZoneFilters(host, (filter) => changes.push(filter));
  mounted.push(ui);
  return { host, ui, changes };
}

const box = (host: HTMLElement, axis: string, key: string) =>
  host.querySelector<HTMLInputElement>(
    `input[data-filter-axis="${axis}"][data-filter-key="${key}"]`,
  );

const labelOf = (input: HTMLInputElement) =>
  input.closest<HTMLLabelElement>("label");

const trigger = (host: HTMLElement) =>
  host.querySelector<HTMLButtonElement>(".gmt-globe-filter-summary")!;
const panel = (host: HTMLElement) =>
  host.querySelector<HTMLElement>(".gmt-globe-filter-body")!;
const isPanelOpen = (host: HTMLElement) => !panel(host).hidden;
const openPanel = (host: HTMLElement) => {
  if (!isPanelOpen(host)) trigger(host).click();
};
const closePanel = (host: HTMLElement) => {
  if (isPanelOpen(host)) trigger(host).click();
};

afterEach(() => {
  for (const ui of mounted.splice(0)) ui.destroy();
  document.body.innerHTML = "";
});

describe("mountZoneFilters", () => {
  it("builds a summary and one checkbox per bucket", () => {
    const { host } = mount();
    expect(trigger(host)).not.toBeNull();
    expect(host.querySelectorAll("input[type='checkbox']")).toHaveLength(9);
    // Three axes: local day, daylight saving, local sky.
    expect(host.querySelectorAll("fieldset")).toHaveLength(3);
    // Every group is named, not just visually grouped.
    for (const fieldset of host.querySelectorAll("fieldset")) {
      expect(fieldset.querySelector("legend")?.textContent).toBeTruthy();
    }
  });

  it("presents each control as a switch, with the glyph of what it filters", () => {
    const { host } = mount();
    for (const input of host.querySelectorAll<HTMLInputElement>("input")) {
      expect(input.getAttribute("role")).toBe("switch");
      const label = labelOf(input);
      expect(label?.querySelector(".gmt-globe-filter-track")).not.toBeNull();
      expect(label?.querySelector("svg.gmt-globe-filter-icon")).not.toBeNull();
    }
    /* The DST switches are clocks, not sun and moon: daylight saving shifts a
       clock and says nothing about the sky, and this panel sits beside a globe
       that draws the real day/night terminator. */
    const dstIconMarkup = labelOf(box(host, "dst", "dst")!)?.querySelector(
      "svg",
    )?.innerHTML;
    expect(dstIconMarkup).toContain("circle");
    expect(dstIconMarkup).toContain("M12 7.5V12l3 1.5");
  });

  it("opens from an icon that still carries a name", () => {
    const { host } = mount();
    const button = trigger(host);
    expect(button.querySelector("svg.gmt-globe-filter-gear")).not.toBeNull();
    // Icon-only to the eye, but never to a screen reader.
    expect(button.textContent).toContain("Filters");
    // The standard disclosure pairing, in place of <details>'s own semantics.
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe(panel(host).id);
  });

  it("reflects open state on the trigger for assistive tech", () => {
    const { host } = mount();
    openPanel(host);
    expect(trigger(host).getAttribute("aria-expanded")).toBe("true");
    closePanel(host);
    expect(trigger(host).getAttribute("aria-expanded")).toBe("false");
  });

  it("starts with everything on", () => {
    const { ui, host } = mount();
    const filter = ui.get();
    expect(filter.days).toEqual({ prev: true, same: true, next: true });
    expect(filter.dst).toEqual({ dst: true, standard: true, none: true });
    for (const input of host.querySelectorAll<HTMLInputElement>("input")) {
      expect(input.checked).toBe(true);
    }
  });

  it("reports the new filter when a box is cleared", () => {
    const { host, changes, ui } = mount();
    const next = box(host, "day", "next")!;
    next.checked = false;
    next.dispatchEvent(new Event("change", { bubbles: true }));

    expect(changes).toHaveLength(1);
    expect((changes[0] as { days: Record<string, boolean> }).days.next).toBe(
      false,
    );
    expect(ui.get().days.next).toBe(false);
    // The other axis is untouched.
    expect(ui.get().dst.dst).toBe(true);
  });

  it("hands out a copy, so a caller cannot reach in and mutate it", () => {
    const { ui } = mount();
    ui.get().days.same = false;
    expect(ui.get().days.same).toBe(true);
  });

  it("hides an empty bucket but keeps an unchecked one reachable", () => {
    const { host, ui } = mount();
    ui.update(counts({ days: { prev: 0, same: 400, next: 16 } }), 416, 416);
    expect(labelOf(box(host, "day", "prev")!)?.hidden).toBe(true);
    expect(labelOf(box(host, "day", "next")!)?.hidden).toBe(false);

    // Switch the empty one off; it must come back so it can be undone.
    const prev = box(host, "day", "prev")!;
    prev.checked = false;
    prev.dispatchEvent(new Event("change", { bubbles: true }));
    ui.update(counts({ days: { prev: 0, same: 400, next: 16 } }), 416, 416);
    expect(labelOf(prev)?.hidden).toBe(false);
  });

  it("keeps checked state and focus across a refresh", () => {
    /* The reason the toggles are built once and only ever relabelled: buckets
       change availability about once a minute as zones cross midnight, so a
       re-render would yank the control out from under a keyboard user. */
    const { host, ui } = mount();
    const dst = box(host, "dst", "standard")!;
    dst.checked = false;
    dst.dispatchEvent(new Event("change", { bubbles: true }));
    dst.focus();

    ui.update(counts(), 404, 416);

    expect(document.activeElement).toBe(dst);
    expect(dst.checked).toBe(false);
    expect(ui.get().dst.standard).toBe(false);
  });

  it("reports how much is showing, and says so plainly when nothing is hidden", () => {
    const { host, ui } = mount();
    const status = host.querySelector(".gmt-globe-filter-status");
    expect(status?.getAttribute("role")).toBe("status");

    ui.update(counts(), 416, 416);
    expect(status?.textContent).toBe("Showing all 416 zones");

    ui.update(counts(), 60, 416);
    expect(status?.textContent).toBe("Showing 60 of 416 zones");
  });

  it("labels each toggle with its bucket's count", () => {
    const { host, ui } = mount();
    ui.update(counts(), 416, 416);
    const label = labelOf(box(host, "dst", "dst")!);
    expect(label?.textContent).toContain("In DST");
    expect(label?.textContent).toContain("60");
  });

  it("tracks whether the accordion is open", () => {
    const { host, ui } = mount();
    expect(ui.isOpen()).toBe(false);
    openPanel(host);
    expect(ui.isOpen()).toBe(true);
  });

  it("calls back when opened, and not when closed again", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const opened = vi.fn();
    const ui = mountZoneFilters(host, () => {}, opened);
    mounted.push(ui);

    trigger(host).click();
    expect(opened).toHaveBeenCalledTimes(1);
    /* Closing must not re-fire it: `globe.ts` answers this by rescanning all
       ~420 zones, and doing that on the way out would be pure waste. */
    trigger(host).click();
    expect(opened).toHaveBeenCalledTimes(1);
  });

  describe("as a popup", () => {
    it("closes on a press outside, and stays open on one inside", () => {
      const { host } = mount();
      openPanel(host);

      host
        .querySelector("input")
        ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      expect(isPanelOpen(host)).toBe(true);

      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      expect(isPanelOpen(host)).toBe(false);
    });

    it("closes on Escape and puts focus back on the gear", () => {
      const { host } = mount();
      openPanel(host);
      const input = host.querySelector("input")!;
      input.focus();

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );

      expect(isPanelOpen(host)).toBe(false);
      expect(document.activeElement).toBe(trigger(host));
    });

    it("ignores Escape while already closed, so it cannot steal focus", () => {
      const { host } = mount();
      expect(isPanelOpen(host)).toBe(false);
      const outside = document.createElement("button");
      document.body.appendChild(outside);
      outside.focus();

      host.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );

      expect(document.activeElement).toBe(outside);
    });

    it("closes when focus leaves the panel entirely", () => {
      const { host } = mount();
      openPanel(host);
      const outside = document.createElement("button");
      document.body.appendChild(outside);

      host
        .querySelector("input")
        ?.dispatchEvent(
          new FocusEvent("focusout", { bubbles: true, relatedTarget: outside }),
        );

      expect(isPanelOpen(host)).toBe(false);
    });

    it("stays open when a click inside blurs to nothing", () => {
      /* The bug this pins: clicking a switch's label blurs the gear and the
         browser reports `focusout` with a null `relatedTarget`, because a
         <label> is not focusable. Read as "focus left the panel", that shut
         the popup on every single click. */
      const { host } = mount();
      openPanel(host);

      trigger(host).dispatchEvent(
        new FocusEvent("focusout", { bubbles: true, relatedTarget: null }),
      );

      expect(isPanelOpen(host)).toBe(true);
    });

    it("stays open while focus moves between its own switches", () => {
      const { host } = mount();
      openPanel(host);
      const inputs = host.querySelectorAll<HTMLInputElement>("input");

      inputs[0]?.dispatchEvent(
        new FocusEvent("focusout", { bubbles: true, relatedTarget: inputs[1] }),
      );

      expect(isPanelOpen(host)).toBe(true);
    });

    it("moves focus to the gear rather than dropping it when a switch hides", () => {
      const { host, ui } = mount();
      openPanel(host);
      const prev = box(host, "day", "prev")!;
      prev.focus();
      expect(document.activeElement).toBe(prev);

      // Its bucket empties while it is focused and still checked, so it hides.
      ui.update(counts({ days: { prev: 0, same: 400, next: 16 } }), 416, 416);

      expect(labelOf(prev)?.hidden).toBe(true);
      expect(document.activeElement).toBe(trigger(host));
    });

    it("stops listening to the document once destroyed", () => {
      /* The light-dismiss handler is on `document`, so it outlives the widget
         unless it is taken off. Held by reference, because `destroy` detaches
         the panel from the host: a leaked handler would still flip this. */
      const { host, ui } = mount();
      openPanel(host);
      const body = panel(host);
      expect(body.hidden).toBe(false);

      ui.destroy();
      mounted.length = 0;
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));

      expect(body.hidden).toBe(false);
    });
  });

  it("empties its host on destroy", () => {
    const { host, ui } = mount();
    ui.destroy();
    mounted.length = 0;
    expect(host.children).toHaveLength(0);
  });
});
