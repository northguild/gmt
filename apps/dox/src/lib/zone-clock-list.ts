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
import { readViewerDate, readZoneNow } from "./zone-clock";
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
// (and thus scrollbar/scrollToIndex math) isn't wildly off before that.
const ROW_HEIGHT_ESTIMATE = 54;
const OVERSCAN = 8;
// Mirrors --gmt-space-1 (gmt-tokens.css) — the virtualizer's `gap` is a plain
// number, it can't read a CSS custom property.
const ROW_GAP = 4;
const PAGE_STEP = 10;

/** Stable id for row `index` — computed independent of whether that row is
 * currently mounted (virtualized rows outside the overscan window don't
 * exist in the DOM yet), so `aria-activedescendant` can reference it
 * immediately and let the next render attach a real element with this id. */
export function zoneOptionId(panelId: string, index: number): string {
  return `${panelId}-opt-${index}`;
}

/** Pure keyboard-navigation reducer for the clock list — no DOM, no
 * virtualizer, easy to unit test in isolation. `count` is the total number
 * of zones (not just the currently-mounted/visible rows). Returns `current`
 * unchanged for any key this list doesn't handle. */
export function nextActiveIndex(
  key: string,
  current: number,
  count: number,
): number {
  if (count <= 0) return current;
  const clamp = (i: number) => Math.min(Math.max(i, 0), count - 1);
  switch (key) {
    case "ArrowDown":
      return clamp(current + 1);
    case "ArrowUp":
      return clamp(current - 1);
    case "PageDown":
      return clamp(current + PAGE_STEP);
    case "PageUp":
      return clamp(current - PAGE_STEP);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return current;
  }
}

export interface ZoneClockList {
  /** Replace the zones this list shows, keeping the selection if it survives. */
  setIds(ids: readonly string[]): void;
  /** Scroll the zone into view (centred) and mark it selected; null clears. */
  select(id: string | null): void;
  /** Refresh the ticking "now" text on every currently-rendered row. */
  tick(): void;
  destroy(): void;
}

export function mountZoneClockList(
  panel: HTMLElement,
  allIds: readonly string[],
  onPick: (id: string) => void,
): ZoneClockList {
  /* The zones currently on screen, which the filter accordion narrows. Every
     read below goes through this rather than the full set the caller passed:
     the virtualizer indexes into it, so the two must never disagree. */
  let ids: readonly string[] = allIds;

  const sizer = document.createElement("div");
  sizer.className = "gmt-globe-clocks-sizer";
  panel.appendChild(sizer);

  let selectedId: string | null = null;
  // The very first `select()` call is initGlobe seeding the viewer's own
  // zone before anything has painted — jump straight there. Only later,
  // user-driven selections (search, click, globe pick) should animate.
  let hasSelectedOnce = false;
  const rows = new Map<number, HTMLButtonElement>();

  /**
   * The two text nodes each row updates, found once when the row is built.
   *
   * Looked up per tick before, which meant two `querySelector` calls per visible
   * row per second for elements that never move.
   *
   * Declared here, above the virtualizer, and not beside `writeReading` where it
   * is used: `_willUpdate()` below renders the first rows synchronously, so a
   * declaration further down the file is still in its temporal dead zone when
   * `writeReading` first runs, and the whole mount throws.
   */
  const fields = new WeakMap<
    HTMLButtonElement,
    {
      time: HTMLElement | null;
      offset: HTMLElement | null;
      date: HTMLElement | null;
      dst: HTMLElement | null;
      shift: HTMLElement | null;
    }
  >();

  // Keyboard-browsed row, distinct from `selectedId` (the zone actually
  // driving the globe/URL) — ArrowUp/Down/Home/End/PageUp/PageDown only move
  // this (a standard "browse, then Enter to commit" listbox), so a user can
  // arrow through the list without the globe jumping on every keystroke.
  let activeIndex = 0;
  /* Pending follow-up render after a filter change — see `setIds`. */
  let settleFrame: number | null = null;
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
    onChange: (instance: Virtualizer<HTMLElement, HTMLButtonElement>) =>
      renderRows(instance),
  };

  const virtualizer: Virtualizer<HTMLElement, HTMLButtonElement> =
    new Virtualizer(virtualizerOptions);

  const unmount = virtualizer._didMount();
  virtualizer._willUpdate();

  function buildRow(index: number): HTMLButtonElement {
    const id = ids[index] as string;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "gmt-clock-entry";
    row.id = zoneOptionId(panelId, index);
    row.setAttribute("role", "option");
    row.dataset.index = String(index);
    row.dataset.tzId = id;
    row.style.position = "absolute";
    row.style.top = "0";
    row.style.left = "0";
    row.style.right = "0";
    /* Two lines, same as before — the date joins the existing second line
       rather than opening a third, so ROW_HEIGHT_ESTIMATE stays honest and the
       virtualizer's measurements are undisturbed. */
    row.innerHTML = `
      <span class="gmt-clock-row1">
        <span class="gmt-clock-name">${id}</span>
        <span class="gmt-clock-dst" data-tz-field="dst"></span>
        <span class="gmt-clock-offset" data-tz-field="offset"></span>
      </span>
      <span class="gmt-clock-row2">
        <span class="gmt-clock-shift" data-tz-field="shift"></span>
        <span class="gmt-clock-date" data-tz-field="date"></span>
        <span class="gmt-clock-time" data-tz-field="time"></span>
      </span>`;
    return row;
  }

  /* `viewerDate` is the viewer's own local day, passed in rather than read
     here: every visible row would otherwise recompute the same answer, once a
     second. `tick()` reads it once and hands it to every row. */
  function writeReading(
    row: HTMLButtonElement,
    id: string,
    viewerDate: string,
  ): void {
    let found = fields.get(row);
    if (!found) {
      found = {
        time: row.querySelector<HTMLElement>("[data-tz-field='time']"),
        offset: row.querySelector<HTMLElement>("[data-tz-field='offset']"),
        date: row.querySelector<HTMLElement>("[data-tz-field='date']"),
        dst: row.querySelector<HTMLElement>("[data-tz-field='dst']"),
        shift: row.querySelector<HTMLElement>("[data-tz-field='shift']"),
      };
      fields.set(row, found);
    }
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
      found.offset.classList.toggle("gmt-signal-lost", !reading.ok);
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
         channel — it is gone entirely under forced-colors. The full word rides
         along for assistive tech, which has no use for "+1d". */
      found.shift.innerHTML = chip
        ? `${chip}<span class="gmt-clock-visually-hidden"> ${dayShiftLabel(delta)}</span>`
        : "";
    }
    /* Day shift paints the row's background only. Its border and ring belong
       to hover / aria-selected / .selected, so the two can never collide. */
    row.classList.toggle("gmt-day-prev", shift === "prev");
    row.classList.toggle("gmt-day-next", shift === "next");

    /* Three letters, not a glyph: a sun beside a globe that draws its own
       day/night terminator read as "daytime here" rather than as daylight
       saving. Only the `dst` state marks the row at all. The visually hidden
       wording is what a screen reader gets, since "DST" alone is terse. */
    const state = reading.ok ? dstState(reading) : "none";
    if (found.dst && found.dst.dataset.dst !== state) {
      found.dst.dataset.dst = state;
      const badge = dstBadge(state);
      found.dst.innerHTML = badge
        ? `${badge}<span class="gmt-clock-visually-hidden"> ${dstLabel(state)}</span>`
        : "";
    }
  }

  function renderRows(
    instance: Virtualizer<HTMLElement, HTMLButtonElement>,
  ): void {
    const viewerDate = readViewerDate();
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
      row.setAttribute("aria-selected", String(item.index === activeIndex));
      writeReading(row, id, viewerDate);
      instance.measureElement(row);
    }
  }

  panel.addEventListener("click", (event) => {
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-tz-id]",
    );
    if (row?.dataset.tzId) onPick(row.dataset.tzId);
  });

  // Arrow/Page/Home/End browse `activeIndex` (aria-activedescendant) without
  // touching the globe; Enter/Space commits the active row via `onPick`, same
  // as a click. `activeIndex`'s row may not be mounted yet when this runs —
  // `zoneOptionId` is computed from the index alone, so `aria-activedescendant`
  // can point at it immediately and the next `renderRows` (triggered by
  // `scrollToIndex` below) attaches the real element under that id.
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const id = ids[activeIndex];
      if (id) {
        event.preventDefault();
        onPick(id);
      }
      return;
    }
    const next = nextActiveIndex(event.key, activeIndex, ids.length);
    if (next === activeIndex) return;
    event.preventDefault();
    activeIndex = next;
    panel.setAttribute("aria-activedescendant", zoneOptionId(panelId, next));
    // `align: "auto"` is TanStack's "nearest" — scroll the minimum distance
    // needed to bring the row into view, not always to the center.
    virtualizer.scrollToIndex(next, { align: "auto", behavior: "auto" });
    renderRows(virtualizer);
  });

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
      virtualizer.setOptions({ ...virtualizerOptions, count: ids.length });
      /* Browsing restarts at the top, because the list does too (below). The
         old position means nothing here: row ids come from the index, so it
         could name a row the new list will never mount, and even clamped into
         range it would name one scrolled out of the DOM — either way
         `aria-activedescendant` would point at nothing a screen reader can
         find. Row 0 is the one row certain to be mounted after the reset. With
         no zones left there is nothing to name at all. */
      activeIndex = 0;
      if (ids.length === 0) panel.removeAttribute("aria-activedescendant");
      else {
        panel.setAttribute("aria-activedescendant", zoneOptionId(panelId, 0));
      }
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
      selectedId = id;
      if (id !== null) {
        const index = ids.indexOf(id);
        // Keep keyboard browsing picking up from wherever the selection last
        // landed (search, a globe click, this list's own Enter) rather than
        // wherever an ArrowUp/Down session was left mid-browse.
        if (index !== -1) {
          activeIndex = index;
          panel.setAttribute(
            "aria-activedescendant",
            zoneOptionId(panelId, index),
          );
        }
      }
      renderRows(virtualizer);
      if (id === null) return;
      const index = ids.indexOf(id);
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
         globe's biggest source of dropped frames: it stalled the main thread for
         tens of milliseconds every second, which reads as a stutter in a drag or
         an ambient spin. Scrolling still goes through `onChange` -> `renderRows`
         as before. */
      /* Once per tick, not once per row: every visible row measures its day
         shift against the same viewer day, and reading it 30 times a second
         would undo the point of the caches in zone-clock.ts. */
      const viewerDate = readViewerDate();
      for (const [index, row] of rows) {
        const id = ids[index];
        if (id) writeReading(row, id, viewerDate);
      }
    },
    destroy() {
      if (settleFrame !== null) cancelAnimationFrame(settleFrame);
      unmount();
      rows.clear();
      sizer.remove();
    },
  };
}
