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
 *
 * The scroll container is the kit `<gmt-listbox>`, which owns the listbox keyboard model and
 * `aria-activedescendant`; this module gives it `count` and `valueAt`, draws the rows with
 * `clockRow`, and calls `sync()` after each draw.
 */

import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  Virtualizer,
} from "@tanstack/virtual-core";
import { html, setHtml, srOnly } from "~/widgets/builders";
import { defineElements } from "~/widgets/define";
import {
  clockRow,
  clockSizer,
  type ClockField,
} from "~/widgets/families/zones/clock-row";
import { type GmtListbox } from "~/widgets/primitives/listbox/listbox";
import { readViewerDate, readZoneNow } from "./zone-clock";
import { createSlicer } from "./yield-to-main";
import {
  dayDelta,
  dayShift,
  dayShiftChip,
  dayShiftLabel,
  dstBadge,
  dstLabel,
  dstState,
} from "./zone-readout";

// Corrected by real measurement (via measureElement) after each row's first
// paint — only needs to be in the right ballpark so the initial totalSize
// (and thus scrollbar/scrollToIndex math) isn't wildly off before that. The row's rendered
// height at the default text size: an estimate this close leaves the first measure nothing to
// correct, so the jump to the reader's zone does not re-aim (each re-aim reads layout) before
// it settles.
const ROW_HEIGHT_ESTIMATE = 59.1875;
const OVERSCAN = 8;
// Most rows ever mounted at once. A panel taller than any screen (a missing
// stylesheet, a layout that lost its bound) would otherwise make every zone
// "visible" and mount thousands of rows.
const MAX_MOUNTED_ROWS = 80;
// Re-render passes one change may trigger: measuring a row can move the rows
// after it, and one follow-up pass settles that.
const MAX_SETTLE_PASSES = 3;
// Mirrors --gmt-space-1 (gmt-tokens.css) — the virtualizer's `gap` is a plain
// number, it can't read a CSS custom property.
const ROW_GAP = 4;

interface ZoneClockList {
  /** Replace the zones this list shows, keeping the selection if it survives. */
  setIds(ids: readonly string[]): void;
  /** Scroll the zone into view (centred) and mark it selected; null clears. */
  select(id: string | null): void;
  /** Refresh the ticking "now" text on every currently-rendered row; resolves once all are written. */
  tick(): Promise<void>;
  destroy(): void;
}

type Fields = Record<ClockField, HTMLElement | null>;

/**
 * Mount the clock list onto a kit `<gmt-listbox>` in virtual mode.
 *
 * The listbox owns the keys, the active option, `aria-activedescendant` and the choice;
 * this module owns which rows exist. It reacts to the listbox's `active` event by scrolling
 * that row in, and to `change` by calling `onPick`. The zone driving the globe is the
 * listbox's value, so it is `aria-selected`.
 */
export function mountZoneClockList(
  panel: GmtListbox,
  allIds: readonly string[],
  onPick: (id: string) => void,
): ZoneClockList {
  defineElements();
  /* The zones currently on screen, which the filter accordion narrows. Every
     read below goes through this rather than the full set the caller passed:
     the virtualizer indexes into it, so the two must never disagree. */
  let ids: readonly string[] = allIds;

  setHtml(panel, clockSizer());
  const sizer = panel.querySelector<HTMLElement>("[data-clock-sizer]")!;
  panel.count = ids.length;
  panel.valueAt = (index) => ids[index];

  // The very first `select()` call is initGlobe seeding the viewer's own
  // zone before anything has painted — jump straight there. Only later,
  // user-driven selections (search, click, globe pick) should animate.
  let hasSelectedOnce = false;
  const rows = new Map<number, HTMLElement>();

  /**
   * The text nodes each row updates, found once when the row is built.
   *
   * Declared here, above the virtualizer, and not beside `writeReading` where it
   * is used: `_willUpdate()` below renders the first rows synchronously, so a
   * declaration further down the file is still in its temporal dead zone when
   * `writeReading` first runs, and the whole mount throws.
   */
  const fields = new WeakMap<HTMLElement, Fields>();
  /** The zone each row shows, for the readings taken after the row is built. */
  const rowZones = new WeakMap<HTMLElement, string>();

  /* Rows waiting for a reading, in the order they were asked for. Declared above the
     virtualizer for the same reason as `fields`. */
  const pending = new Set<HTMLElement>();
  let filling = false;
  let filled: Promise<void> = Promise.resolve();
  /* Set by every request for readings, so a tick that joins a run already going is written
     against the viewer's date as it is now, not as it was when the run started. */
  let dateStale = true;
  /* Not `signal` below: the first rows are read during `_willUpdate()`, before it exists. */
  let destroyed = false;

  /* Pending follow-up render after a filter change — see `setIds`. */
  let settleFrame: number | null = null;
  let rendering = false;
  let renderAgain = false;
  const panelId = panel.id || "gmt-globe-clocks";

  /* Kept whole because `setOptions` merges what it is given over the library's
     own defaults rather than over the current options — handing it only
     `{ count }` would quietly reset overscan, gap and the observers. */
  const virtualizerOptions = {
    count: ids.length,
    getScrollElement: () => panel,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: OVERSCAN,
    gap: ROW_GAP,
    getItemKey: (index: number) => ids[index] as string,
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    onChange: (instance: Virtualizer<GmtListbox, HTMLElement>) =>
      renderRows(instance),
  };

  const virtualizer: Virtualizer<GmtListbox, HTMLElement> = new Virtualizer(
    virtualizerOptions,
  );

  const unmount = virtualizer._didMount();
  virtualizer._willUpdate();

  const abort = new AbortController();
  const { signal } = abort;

  function buildRow(index: number): HTMLElement {
    const holder = document.createElement("div");
    setHtml(
      holder,
      clockRow({
        listId: panelId,
        index,
        zone: ids[index] as string,
        selected: panel.value !== "" && ids[index] === panel.value,
      }),
    );
    const row = holder.firstElementChild as HTMLElement;
    rowZones.set(row, ids[index] as string);
    fields.set(row, {
      time: row.querySelector<HTMLElement>("[data-field='time']"),
      offset: row.querySelector<HTMLElement>("[data-field='offset']"),
      date: row.querySelector<HTMLElement>("[data-field='date']"),
      dst: row.querySelector<HTMLElement>("[data-field='dst']"),
      shift: row.querySelector<HTMLElement>("[data-field='shift']"),
    });
    return row;
  }

  /* `viewerDate` is the viewer's own local day, passed in rather than read
     here: every visible row would otherwise recompute the same answer, once a
     second. `tick()` reads it once and hands it to every row. */
  function writeReading(
    row: HTMLElement,
    id: string,
    viewerDate: string,
  ): void {
    const found = fields.get(row);
    if (!found) return;
    const reading = readZoneNow(id);
    const text = reading.ok ? reading.time : "— — —";
    const offsetText = reading.ok ? `UTC${reading.offset}` : "no signal";
    const dateText = reading.ok ? reading.date : "";
    const shift =
      reading.ok && viewerDate ? dayShift(reading.date, viewerDate) : "same";
    /* The signed difference, not the clamped bucket: the chip has to agree with
       the date printed beside it, and at the extremes of the offset range that
       difference reaches two days. */
    const delta =
      reading.ok && viewerDate ? dayDelta(reading.date, viewerDate) : 0;
    const chip = dayShiftChip(delta);
    /* Compared before writing: an unchanged `textContent` assignment still
       dirties the node and costs layout, and most rows change only their
       seconds. Every field below is written once per second for every visible
       row, so each one earns the same guard. */
    if (found.time && found.time.textContent !== text)
      found.time.textContent = text;
    if (found.offset && found.offset.textContent !== offsetText) {
      found.offset.textContent = offsetText;
      if (reading.ok) delete found.offset.dataset.lost;
      else found.offset.dataset.lost = "";
    }
    if (found.date && found.date.textContent !== dateText) {
      found.date.textContent = dateText;
    }
    /* Keyed on the delta, not the bucket: a row moving from one day behind to
       two keeps its bucket and must still relabel. */
    const shiftKey = String(delta);
    if (found.shift && found.shift.dataset.shift !== shiftKey) {
      found.shift.dataset.shift = shiftKey;
      /* The chip carries the direction in text, so the wash is never the only
         channel. The full word rides along for assistive tech, which has no
         use for "+1d". */
      setHtml(
        found.shift,
        chip ? html`${chip}${srOnly(` ${dayShiftLabel(delta)}`)}` : html``,
      );
    }
    /* Day shift paints the row's background only. */
    if (shift === "same") delete row.dataset.day;
    else row.dataset.day = shift;

    /* Three letters, not a glyph. Only the `dst` state marks the row at all. The
       visually hidden wording is what a screen reader gets, since "DST" alone
       is terse. */
    const state = reading.ok ? dstState(reading) : "none";
    if (found.dst && found.dst.dataset.dst !== state) {
      found.dst.dataset.dst = state;
      const badge = dstBadge(state);
      setHtml(
        found.dst,
        badge ? html`${badge}${srOnly(` ${dstLabel(state)}`)}` : html``,
      );
    }
  }

  /**
   * Takes the readings for these rows, a slice at a time.
   *
   * A reading costs a few milliseconds, most of it the daylight-time rule reading the zone's
   * transitions, and a jump down the list mounts some twenty rows at once. Read in one go, that
   * was the landing page's longest task. The first slice is written at once and the rest after
   * the thread has been handed back. A row is built with its fields empty at its full height
   * (clock-row.module.css holds the empty time's line), so a row still waiting moves nothing.
   * A row removed before its turn is skipped.
   */
  function queueReadings(queued: Iterable<HTMLElement>): Promise<void> {
    for (const row of queued) pending.add(row);
    dateStale = true;
    if (!filling && pending.size > 0) filled = fillReadings();
    return filled;
  }

  async function fillReadings(): Promise<void> {
    filling = true;
    try {
      const slicer = createSlicer();
      let viewerDate = "";
      for (const row of pending) {
        if (destroyed) return;
        if (dateStale) {
          viewerDate = readViewerDate();
          dateStale = false;
        }
        pending.delete(row);
        const id = rowZones.get(row);
        if (id !== undefined && row.isConnected)
          writeReading(row, id, viewerDate);
        await slicer.turn();
      }
    } finally {
      /* Reached in the same turn as the loop's last check, so a row queued after that check
         starts a new run rather than waiting on one that has ended. */
      filling = false;
    }
  }

  /* Called at the end of every render, the one place the set of mounted rows changes: the
     listbox re-marks the selected and the active option and points
     `aria-activedescendant` only at a row that is in the DOM. */
  function renderRows(instance: Virtualizer<GmtListbox, HTMLElement>): void {
    /* `measureElement` reports a changed size through `onChange`, which lands
       back here. Nested, that cost one full render per row. Instead the change
       is noted and the loop below runs again once the current pass ends. */
    if (rendering) {
      renderAgain = true;
      return;
    }
    rendering = true;
    try {
      for (let pass = 0; pass < MAX_SETTLE_PASSES; pass++) {
        renderAgain = false;
        renderPass(instance);
        if (!renderAgain) break;
      }
    } finally {
      rendering = false;
    }
    panel.sync();
  }

  function renderPass(instance: Virtualizer<GmtListbox, HTMLElement>): void {
    sizer.style.height = `${instance.getTotalSize()}px`;
    const items = instance.getVirtualItems().slice(0, MAX_MOUNTED_ROWS);
    const visible = new Set(items.map((item) => item.index));
    for (const [index, row] of rows) {
      if (!visible.has(index)) {
        row.remove();
        rows.delete(index);
        pending.delete(row);
      }
    }
    /* Only a new row is read here. A row already on screen keeps its reading, which `tick`
       refreshes: re-reading every row on each render cost a full reading per row per scroll. */
    const built: HTMLElement[] = [];
    for (const item of items) {
      let row = rows.get(item.index);
      if (!row) {
        row = buildRow(item.index);
        rows.set(item.index, row);
        sizer.appendChild(row);
        built.push(row);
      }
      row.style.transform = `translateY(${item.start}px)`;
    }
    /* Measured after every row is written: a measure straight after each write forced a layout
       per row (80 of them, up to three passes), the page's longest task on the landing. */
    for (const item of items) {
      const row = rows.get(item.index);
      if (row) instance.measureElement(row);
    }
    void queueReadings(built);
  }

  // The listbox moved its active option: bring that row in view and draw it.
  // `align: "auto"` is TanStack's "nearest" — scroll the minimum distance
  // needed, not always to the center.
  panel.addEventListener(
    "active",
    (event) => {
      const { index } = (event as CustomEvent<{ index: number }>).detail;
      virtualizer.scrollToIndex(index, { align: "auto", behavior: "auto" });
      renderRows(virtualizer);
    },
    { signal },
  );

  panel.addEventListener(
    "change",
    (event) => {
      const { value } = (event as CustomEvent<{ value: string }>).detail;
      onPick(value);
    },
    { signal },
  );

  return {
    setIds(next: readonly string[]) {
      ids = next;
      /* Every mounted row is dropped rather than reconciled: after a filter
         change a given index almost certainly means a different zone, and a
         row reused in place would show one zone's name against another's
         clock until the next tick. Item *sizes* survive regardless — the
         virtualizer caches those against `getItemKey`, which is the zone id,
         so this does not trigger a re-measure flash. */
      for (const [, row] of rows) row.remove();
      rows.clear();
      pending.clear();
      virtualizer.setOptions({ ...virtualizerOptions, count: ids.length });
      /* Browsing restarts at the top, because the list does too (below). Row 0
         is the one row certain to be mounted after the reset; with no zones
         left there is nothing to name at all. */
      panel.count = ids.length;
      panel.activeIndex = 0;
      /* Through the virtualizer rather than `panel.scrollTop = 0`, so the
         library records the intent instead of being silently overtaken. */
      virtualizer.scrollToOffset(0, { behavior: "instant" });
      renderRows(virtualizer);
      /* And then again on the next frame. The virtualizer only learns where it
         is scrolled from an async observer, so the render above can still be
         working from the offset the list had *before* the reset — on a list
         scrolled well down, that offset is past the end of the new, shorter
         one, and the first paint comes back short or completely empty. This is
         a user action, not a tick, so one extra render costs nothing. */
      if (settleFrame !== null) cancelAnimationFrame(settleFrame);
      settleFrame = requestAnimationFrame(() => {
        settleFrame = null;
        renderRows(virtualizer);
      });
    },
    select(id: string | null) {
      panel.value = id ?? "";
      const index = id === null ? -1 : ids.indexOf(id);
      // Keep keyboard browsing picking up from wherever the selection last
      // landed (search, a globe click, this list's own Enter) rather than
      // wherever an ArrowUp/Down session was left mid-browse.
      if (index !== -1) panel.activeIndex = index;
      renderRows(virtualizer);
      if (index === -1) return;
      // "instant" bypasses the panel's CSS `scroll-behavior: smooth` outright
      // (unlike "auto", which defers to it) — the initial reveal must not
      // visibly scroll from the top. A jump of more than one viewport is
      // instant too: rows measured on the way in move the target off the
      // estimate, and the virtualizer re-aims every frame, restarting the
      // native smooth scroll each time — so a long smooth jump crawls and
      // stops short. A short hop stays smooth.
      const target = virtualizer.getOffsetForIndex(index, "center")?.[0];
      const far =
        target === undefined ||
        Math.abs(target - panel.scrollTop) > panel.clientHeight;
      const behavior = hasSelectedOnce && !far ? "auto" : "instant";
      hasSelectedOnce = true;
      virtualizer.scrollToIndex(index, { align: "center", behavior });
    },
    tick() {
      /* Only the readings, not a full `renderRows`. Time passing does not move a
         row, so re-running the virtualizer would rewrite every transform and
         then call `measureElement` on each row — a layout read straight after a
         write, once a second, for every visible clock. That thrash was the
         globe's biggest source of dropped frames. Scrolling still goes through
         `onChange` -> `renderRows`. */
      return queueReadings(rows.values());
    },
    destroy() {
      destroyed = true;
      abort.abort();
      if (settleFrame !== null) cancelAnimationFrame(settleFrame);
      unmount();
      rows.clear();
      pending.clear();
      sizer.remove();
    },
  };
}
