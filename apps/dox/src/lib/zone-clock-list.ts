/**
 * DOX-E1a — virtualized zone-clock list for the globe's pinned/clock panel.
 *
 * The panel lists every plottable IANA zone (~300). Rendering all of them as
 * real DOM nodes and scrolling to the selected one via raw `offsetTop` math
 * (the previous approach) drifted once the page's web fonts swapped in after
 * first paint, shifting every row's offset out from under the already-computed
 * scroll target — the scroll would fire but land on the wrong row, or on a
 * very long list, appear to "scroll forever" hunting for one that no longer
 * lined up. `@tanstack/virtual-core` (the framework-agnostic core — this app
 * has no React runtime) renders only the rows in or near the viewport, measures
 * each one's real height once it's mounted, and derives `scrollToIndex` from
 * its own measurements rather than a stale DOM read.
 *
 * Vanilla usage pattern (no framework adapter): construct `Virtualizer`, call
 * `_didMount()` once for cleanup wiring and `_willUpdate()` once to attach the
 * scroll/resize observers, then react to `onChange` by re-rendering the
 * current `getVirtualItems()` into the scroll container.
 */

import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  Virtualizer,
} from "@tanstack/virtual-core";
import { readZoneNow } from "./zone-clock";

// Corrected by real measurement (via measureElement) after each row's first
// paint — only needs to be in the right ballpark so the initial totalSize
// (and thus scrollbar/scrollToIndex math) isn't wildly off before that.
const ROW_HEIGHT_ESTIMATE = 52;
const OVERSCAN = 8;
// Mirrors --gmt-space-1 (gmt-tokens.css) — the virtualizer's `gap` is a plain
// number, it can't read a CSS custom property.
const ROW_GAP = 4;

export interface ZoneClockList {
  /** Scroll the zone into view (centred) and mark it selected; null clears. */
  select(id: string | null): void;
  /** Refresh the ticking "now" text on every currently-rendered row. */
  tick(): void;
  destroy(): void;
}

export function mountZoneClockList(
  panel: HTMLElement,
  ids: readonly string[],
  onPick: (id: string) => void,
): ZoneClockList {
  const sizer = document.createElement("div");
  sizer.className = "gmt-globe-clocks-sizer";
  panel.appendChild(sizer);

  let selectedId: string | null = null;
  // The very first `select()` call is initGlobe seeding the viewer's own
  // zone before anything has painted — jump straight there. Only later,
  // user-driven selections (search, click, globe pick) should animate.
  let hasSelectedOnce = false;
  const rows = new Map<number, HTMLButtonElement>();

  const virtualizer: Virtualizer<HTMLElement, HTMLButtonElement> =
    new Virtualizer({
      count: ids.length,
      getScrollElement: () => panel,
      estimateSize: () => ROW_HEIGHT_ESTIMATE,
      overscan: OVERSCAN,
      gap: ROW_GAP,
      getItemKey: (index) => ids[index] as string,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: (instance) => renderRows(instance),
    });

  const unmount = virtualizer._didMount();
  virtualizer._willUpdate();

  function buildRow(index: number): HTMLButtonElement {
    const id = ids[index] as string;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "gmt-clock-entry";
    row.dataset.index = String(index);
    row.dataset.tzId = id;
    row.style.position = "absolute";
    row.style.top = "0";
    row.style.left = "0";
    row.style.right = "0";
    row.innerHTML = `
      <span class="gmt-clock-row1">
        <span class="gmt-clock-name">${id}</span>
        <span class="gmt-clock-offset" data-tz-field="offset"></span>
      </span>
      <span class="gmt-clock-time" data-tz-field="time"></span>`;
    return row;
  }

  function writeReading(row: HTMLButtonElement, id: string): void {
    const reading = readZoneNow(id);
    const timeEl = row.querySelector<HTMLElement>("[data-tz-field='time']");
    const offsetEl = row.querySelector<HTMLElement>("[data-tz-field='offset']");
    if (timeEl) timeEl.textContent = reading.ok ? reading.time : "— — —";
    if (offsetEl) {
      offsetEl.textContent = reading.ok ? `UTC${reading.offset}` : "no signal";
      offsetEl.classList.toggle("gmt-signal-lost", !reading.ok);
    }
  }

  function renderRows(
    instance: Virtualizer<HTMLElement, HTMLButtonElement>,
  ): void {
    sizer.style.height = `${instance.getTotalSize()}px`;
    const items = instance.getVirtualItems();
    const visible = new Set(items.map((item) => item.index));
    for (const [index, row] of rows) {
      if (!visible.has(index)) {
        row.remove();
        rows.delete(index);
      }
    }
    for (const item of items) {
      let row = rows.get(item.index);
      if (!row) {
        row = buildRow(item.index);
        rows.set(item.index, row);
        sizer.appendChild(row);
      }
      row.style.transform = `translateY(${item.start}px)`;
      const id = ids[item.index] as string;
      row.classList.toggle("selected", id === selectedId);
      writeReading(row, id);
      instance.measureElement(row);
    }
  }

  panel.addEventListener("click", (event) => {
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-tz-id]",
    );
    if (row?.dataset.tzId) onPick(row.dataset.tzId);
  });

  return {
    select(id: string | null) {
      selectedId = id;
      renderRows(virtualizer);
      if (id === null) return;
      const index = ids.indexOf(id);
      if (index === -1) return;
      // "instant" bypasses the panel's CSS `scroll-behavior: smooth` outright
      // (unlike "auto", which defers to it) — the initial reveal must not
      // visibly scroll from the top.
      const behavior = hasSelectedOnce ? "auto" : "instant";
      hasSelectedOnce = true;
      virtualizer.scrollToIndex(index, { align: "center", behavior });
    },
    tick() {
      renderRows(virtualizer);
    },
    destroy() {
      unmount();
      rows.clear();
      sizer.remove();
    },
  };
}
