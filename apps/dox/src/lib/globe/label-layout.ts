/**
 * Where each marker's label goes, so that no two drawn labels overlap and no label
 * covers another pin's dot.
 *
 * Both renderers draw labels with no collision check of their own. This is the one
 * shared, pure step they call first. It has no DOM and no clock, so the canvas-2D
 * painter (which may run in a worker) and the WebGPU renderer get the same answer.
 *
 * ## How it decides
 *
 * Labels are tried in a fixed order: a marker with a selection ring first (the ring
 * is the "this one is selected" signal, so its name must stay), then every other
 * marker in the order the caller gave. Each label is tried on the right of its dot,
 * then on the left, and is hidden when both would overlap a label already kept or
 * any dot. Nothing depends on the previous frame, so the same view always gives the
 * same labels, and a label never flickers between two answers while the globe turns.
 */

import { project, type Camera } from "./camera";
import { LABEL_OFFSET_X, labelRingShift } from "./casing";
import type { GlobeMarker } from "./types";

/** Which side of its dot a label sits on; the layout gives `null` for a label it hides. */
type LabelSide = "right" | "left";

/** Extra clear space kept round every label box and dot, in CSS pixels. */
const LABEL_CLEARANCE = 1;

/**
 * The ink of a label, in CSS pixels relative to its dot's centre: the letters run
 * from just above the cap line to just under the baseline, and the halo reaches
 * a little past. The font's full line box is taller than that, so the layout keeps
 * apart only what is drawn, and two labels on dots 12 px apart both fit.
 */
const LABEL_INK_TOP = -5;
const LABEL_INK_HEIGHT = 10;

/** A marker's dot on screen and the width of its label text, in CSS pixels. */
export interface LabelSpot {
  /** Dot centre. */
  x: number;
  y: number;
  /** Dot radius. */
  radius: number;
  /** Text width; 0 when the marker has no label. */
  width: number;
  /** How far the label moves away from the dot to clear a selection ring. */
  ringShift: number;
  /** True when the marker has a selection ring, which gives its label first pick. */
  ringed?: boolean;
}

/** An axis-aligned box, in CSS pixels. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The box a label's text fills when drawn on `side` of its dot. */
export function labelBox(spot: LabelSpot, side: LabelSide): Box {
  const gap = LABEL_OFFSET_X + spot.ringShift;
  const top = spot.y + LABEL_INK_TOP;
  const bottom = top + LABEL_INK_HEIGHT;
  return side === "right"
    ? {
        left: spot.x + gap,
        top,
        right: spot.x + gap + spot.width,
        bottom,
      }
    : {
        left: spot.x - gap - spot.width,
        top,
        right: spot.x - gap,
        bottom,
      };
}

function dotBox(spot: LabelSpot): Box {
  /* The dot itself: `overlaps` already adds the clearance. */
  const reach = spot.radius;
  return {
    left: spot.x - reach,
    top: spot.y - reach,
    right: spot.x + reach,
    bottom: spot.y + reach,
  };
}

function overlaps(a: Box, b: Box): boolean {
  const pad = LABEL_CLEARANCE;
  return !(
    a.right + pad <= b.left ||
    b.right + pad <= a.left ||
    a.bottom + pad <= b.top ||
    b.bottom + pad <= a.top
  );
}

/**
 * Pick a side for each label, or hide it.
 *
 * `spots` holds every marker that is on screen, labelled or not, because an
 * unlabelled dot still has to stay uncovered. The result lines up with `spots`.
 */
export function placeLabels(spots: readonly LabelSpot[]): (LabelSide | null)[] {
  const result: (LabelSide | null)[] = spots.map(() => null);
  const dots = spots.map(dotBox);

  // Ringed markers first, then the given order; the sort is stable.
  const order = spots
    .map((spot, index) => index)
    .filter((index) => spots[index].width > 0)
    .sort(
      (a, b) => Number(!!spots[b].ringed) - Number(!!spots[a].ringed) || a - b,
    );

  const kept: Box[] = [];
  for (const index of order) {
    const spot = spots[index];
    for (const side of ["right", "left"] as const) {
      const box = labelBox(spot, side);
      if (kept.some((other) => overlaps(box, other))) continue;
      if (dots.some((dot, i) => i !== index && overlaps(box, dot))) continue;
      kept.push(box);
      result[index] = side;
      break;
    }
  }
  return result;
}

/**
 * Sides for a whole marker list under one camera; the result lines up with
 * `markers`. A marker on the far side of the globe, or without a label, gets `null`
 * and takes no part in the layout. `measure` returns a label's text width the way the
 * calling renderer will draw it.
 */
export function layoutMarkerLabels(
  markers: readonly GlobeMarker[],
  camera: Camera,
  measure: (label: string) => number,
): (LabelSide | null)[] {
  const indexes: number[] = [];
  const spots: LabelSpot[] = [];
  markers.forEach((marker, index) => {
    const at = project(camera, marker.position[0], marker.position[1]);
    if (!at.visible) return;
    const width = marker.label ? measure(marker.label) : 0;
    indexes.push(index);
    spots.push({
      x: at.x,
      y: at.y,
      radius: marker.radius,
      width,
      ringShift: labelRingShift(marker.ring),
      ringed: marker.ring !== undefined,
    });
  });
  const placed = placeLabels(spots);
  const out: (LabelSide | null)[] = markers.map(() => null);
  indexes.forEach((markerIndex, i) => {
    out[markerIndex] = placed[i];
  });
  return out;
}
