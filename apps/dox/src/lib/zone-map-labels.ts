/**
 * The place labels of the zone map: the text of a label, its size, and the point it sits at.
 * Pure functions, so a test can place every label without a browser. `zone-map.ts` draws them.
 *
 * A label is HTML over the drawing, not SVG text: its type stays 12 CSS px at every frame
 * width, and the browser draws the halo.
 */

/** Height of one label (the city line and the offset line), in CSS px. */
export const LABEL_HEIGHT_PX = 30;
/**
 * The offset line holds this many characters at least (`+00:00` is 6), so a new offset never
 * changes the label's width.
 */
const LABEL_OFFSET_CHARS = 6;
/**
 * The widths of one character, in CSS px, an upper bound measured from the display face and the
 * mono face in a browser (the layout check compares the estimate with the real box).
 */
const CITY_CHAR_PX = 13.1;
const OFFSET_CHAR_PX = 7.4;
/** Width of the amber `NO SIGNAL` mark with its brackets, in CSS px. */
const SIGNAL_LOST_PX = 92;

/** The city part of an IANA id, with `_` as a space: `Africa/El_Aaiun` is `El Aaiun`. */
export function cityOf(id: string): string {
  return id.slice(id.lastIndexOf("/") + 1).replaceAll("_", " ");
}

/** A label's size in CSS px, from its city and its offset text (`null`: the NO SIGNAL mark). */
export function labelSize(
  city: string,
  offset: string | null,
): { width: number; height: number } {
  const cityWidth = city.length * CITY_CHAR_PX;
  const offsetWidth =
    offset === null
      ? SIGNAL_LOST_PX
      : Math.max(offset.length, LABEL_OFFSET_CHARS) * OFFSET_CHAR_PX;
  return {
    width: Math.ceil(Math.max(cityWidth, offsetWidth)),
    height: LABEL_HEIGHT_PX,
  };
}

type Point = readonly [number, number];

/** Distance from `p` to the segment `a`-`b`, squared. */
function segmentDistance2(p: Point, a: Point, b: Point): number {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Signed distance from `p` to the polygon's edge: positive inside (even-odd across the rings). */
function signedDistance(
  p: Point,
  rings: readonly (readonly Point[])[],
): number {
  let inside = false;
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]!;
      const b = ring[j]!;
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        inside = !inside;
      best = Math.min(best, segmentDistance2(p, a, b));
    }
  }
  const distance = Math.sqrt(best);
  return inside ? distance : -distance;
}

/**
 * The point of a polygon (in drawing px, rings projected) farthest from its edge, found on a grid
 * that narrows around the best cell, and kept inside `box`. `null` when no point of the polygon
 * lies in the box. A centroid would do for a convex shape; this is also inside a concave one.
 */
export function poleOfInaccessibility(
  rings: readonly (readonly Point[])[],
  box: { width: number; height: number },
): Point | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of rings[0] ?? []) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  minX = Math.max(minX, 0);
  minY = Math.max(minY, 0);
  maxX = Math.min(maxX, box.width);
  maxY = Math.min(maxY, box.height);
  if (!(maxX > minX) || !(maxY > minY)) return null;
  let best: Point | null = null;
  let bestDistance = -Infinity;
  let halfX = (maxX - minX) / 2;
  let halfY = (maxY - minY) / 2;
  let centres: Point[] = [];
  const steps = 16;
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < steps; j++)
      centres.push([
        minX + ((i + 0.5) * (maxX - minX)) / steps,
        minY + ((j + 0.5) * (maxY - minY)) / steps,
      ]);
  halfX /= steps;
  halfY /= steps;
  for (let round = 0; round < 6; round++) {
    for (const centre of centres) {
      const distance = signedDistance(centre, rings);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = centre;
      }
    }
    if (best === null) return null;
    const [bx, by] = best;
    centres = [];
    for (const dx of [-0.5, 0.5])
      for (const dy of [-0.5, 0.5])
        centres.push([bx + dx * halfX, by + dy * halfY]);
    centres.push([bx, by]);
    halfX /= 2;
    halfY /= 2;
  }
  return bestDistance > 0 ? best : null;
}

/** A label's box on screen, in CSS px. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Clear space kept between two labels' boxes, in CSS px. */
const LABEL_GAP_PX = 2;

/** Slack when a label is held to its card, for sub-pixel rounding, in CSS px. */
const FIT_SLACK_PX = 0.5;

/**
 * The least move, in CSS px, that brings a label's box whole inside its card (an inset), or
 * `null` when the box is wider or taller than the card and no move would. An island near its
 * card's edge keeps its label, pushed in just far enough.
 */
export function nudgeInto(
  box: Box,
  card: Box,
): { dx: number; dy: number } | null {
  const along = (lo: number, hi: number, min: number, max: number) =>
    lo < min ? min - lo : hi > max ? max - hi : 0;
  if (
    box.right - box.left > card.right - card.left + FIT_SLACK_PX ||
    box.bottom - box.top > card.bottom - card.top + FIT_SLACK_PX
  )
    return null;
  return {
    dx: along(box.left, box.right, card.left, card.right),
    dy: along(box.top, box.bottom, card.top, card.bottom),
  };
}

/**
 * Which labels stay shown on a frame too small for all of them: greedy in priority order, a
 * label stays when its box keeps `LABEL_GAP_PX` clear of every label kept before it, and lies
 * whole inside its `within` box (an inset's card) when it has one. A box with no size (not laid
 * out) meets nothing. The type never shrinks below 12px; a crowded label goes.
 */
export function clearLabels(
  boxes: readonly (Box & { within?: Box })[],
): boolean[] {
  const kept: Box[] = [];
  return boxes.map((box) => {
    const sized = box.right > box.left && box.bottom > box.top;
    const card = box.within;
    if (
      sized &&
      card !== undefined &&
      (box.left < card.left - FIT_SLACK_PX ||
        box.right > card.right + FIT_SLACK_PX ||
        box.top < card.top - FIT_SLACK_PX ||
        box.bottom > card.bottom + FIT_SLACK_PX)
    )
      return false;
    if (
      sized &&
      kept.some(
        (k) =>
          box.left < k.right + LABEL_GAP_PX &&
          k.left < box.right + LABEL_GAP_PX &&
          box.top < k.bottom + LABEL_GAP_PX &&
          k.top < box.bottom + LABEL_GAP_PX,
      )
    )
      return false;
    if (sized) kept.push(box);
    return true;
  });
}
