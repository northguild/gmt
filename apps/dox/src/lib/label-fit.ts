/**
 * Keeps the text of a drawn timeline (axis ticks, lane times, bar labels) from
 * colliding, by measuring it and thinning or flipping rather than shrinking
 * the type below the 12px floor. The geometry is pure and unit-tested; the DOM
 * helpers only measure and toggle attributes.
 *
 * No gmt import, no `dox-tools`, no `zod`, no `ai`.
 */

/** A horizontal extent in px, in any one coordinate space. */
export interface Span {
  left: number;
  right: number;
}

/**
 * Which spans may stay visible. Greedy from the left: a span stays when it
 * starts at least `gap` past the last kept span's right edge and ends inside
 * `limit`. Input order is by position, as ticks are written.
 */
export function thinSpans(
  spans: readonly Span[],
  gap = 8,
  limit = Number.POSITIVE_INFINITY,
): boolean[] {
  let lastRight = Number.NEGATIVE_INFINITY;
  return spans.map((s) => {
    if (s.right > limit + 0.5 || s.left < -2.5) return false;
    if (s.left < lastRight + gap) return false;
    lastRight = s.right;
    return true;
  });
}

export interface PlaceOptions {
  /** x of the thing the label belongs to (a marker), in px from the track's left. */
  atPx: number;
  labelPx: number;
  trackPx: number;
  /** Clear space between the marker and the label. */
  offsetPx?: number;
  /** x positions the label must not cross (a departure rule, say). */
  blockers?: readonly number[];
  gap?: number;
}

/**
 * Which side of its marker a label sits on. `start` (to the right) is the
 * default; it flips to `end` when the label would run past the track or cross
 * a blocker, and stays `start` when neither side is clear (nothing better).
 */
export function placeLabel(o: PlaceOptions): "start" | "end" {
  const offset = o.offsetPx ?? 6;
  const gap = o.gap ?? 2;
  const clear = (left: number, right: number) =>
    left >= -0.5 &&
    right <= o.trackPx + 0.5 &&
    !(o.blockers ?? []).some((b) => b > left - gap && b < right + gap);
  const startLeft = o.atPx + offset;
  if (clear(startLeft, startLeft + o.labelPx)) return "start";
  const endRight = o.atPx - offset;
  if (clear(endRight - o.labelPx, endRight)) return "end";
  return "start";
}

/**
 * The first candidate left edge at which a label of `labelPx` stays inside the
 * track and clear of every blocker (a rule it must not be struck through by).
 * Falls back to the first candidate when none is clear.
 */
export function pickLabelLeft(
  candidates: readonly number[],
  labelPx: number,
  trackPx: number,
  blockers: readonly number[] = [],
  gap = 2,
): number {
  const clear = (left: number) =>
    left >= -0.5 &&
    left + labelPx <= trackPx + 0.5 &&
    !blockers.some((b) => b > left - gap && b < left + labelPx + gap);
  return candidates.find(clear) ?? candidates[0] ?? 0;
}

// ---------------------------------------------------------------------------
// DOM helpers (measure, then toggle). Both skip an element with no layout, so
// jsdom and a hidden widget keep every label.
// ---------------------------------------------------------------------------

/**
 * An element's width in layout pixels, which is what a track's `clientWidth` is
 * measured in.
 *
 * `getBoundingClientRect().width` is the width after any transform on the
 * element or an ancestor, and a widget's numbered cards enter by scaling from
 * 92% (`widget-enter.ts`) just as the first render is fitting its labels. A
 * label measured at 92% fits where it will not once the card is full size, and
 * nothing refits when the entrance ends. `offsetWidth` ignores transforms; the
 * rect is the fallback for an element with no layout box of its own.
 */
export function layoutWidth(el: HTMLElement): number {
  return el.offsetWidth || el.getBoundingClientRect().width;
}

/** Hide the tick labels in `row` that would collide with an earlier one or
 *  run past the row's edge. Re-measures from scratch each call. */
export function thinTickLabels(
  row: HTMLElement,
  selector = ".gmt-cutoff-axis-tick",
  gap = 8,
): void {
  const ticks = [...row.querySelectorAll<HTMLElement>(selector)];
  for (const t of ticks) t.hidden = false;
  if (row.clientWidth === 0) return;
  const rowRect = row.getBoundingClientRect();
  /* Rects are in screen pixels; the row's `clientWidth` and the gap are layout
     pixels. Any transform on the row's ancestors (an entrance in progress)
     scales both rects equally, so the row's own ratio undoes it. */
  const scale = rowRect.width > 0 ? rowRect.width / row.clientWidth : 1;
  const spans = ticks.map((t) => {
    const r = t.getBoundingClientRect();
    return {
      left: (r.left - rowRect.left) / scale,
      right: (r.right - rowRect.left) / scale,
    };
  });
  thinSpans(spans, gap, row.clientWidth).forEach((keep, i) => {
    ticks[i]!.hidden = !keep;
  });
}

/**
 * Call `fn` when `el`'s width changes; stops once `el` leaves the document.
 * Returns a disposer, which a mount calls from its `destroy` so the observer
 * does not outlive the widget while the element is still attached (a rail that
 * keeps the host between widgets, a StrictMode remount). Safe to call twice.
 */
export function onWidthChange(el: HTMLElement, fn: () => void): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  let last = el.clientWidth;
  const observer = new ResizeObserver(() => {
    if (!el.isConnected) {
      observer.disconnect();
      return;
    }
    const width = el.clientWidth;
    if (width === last) return;
    last = width;
    fn();
  });
  observer.observe(el);
  return () => observer.disconnect();
}
