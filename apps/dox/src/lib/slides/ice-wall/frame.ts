/**
 * One frame of the ice wall, as data: the polygons to draw, projected with the globe's own lens.
 *
 * Pure. `buildFrame` takes the lens (`GlobeEngine.getView`), the wall's depth, each pane's time
 * since its impact and the cells, and returns what both renderers draw (`draw-canvas2d.ts`,
 * `draw-webgpu.ts`), so the two look the same. A pane with no impact is one quad; a broken pane is
 * its shards, in flight or pinned to a zone.
 *
 * Coordinates. The wall hangs in camera space, a grid of 16:10 panes perpendicular to the view
 * axis. A point on a pane is `(X, Y)` pixels from the wall's centre, as it would measure at depth
 * `z = 1`; `z` scales the wall's distance from the camera (`z = 0.3` is 3.3 times as close), and a
 * shard's lift towards the camera is a further `Z` pixels. The pinhole projects it:
 * `screen = centre + (X, Y) * f / (f * z - Z)`.
 */
import {
  CRACK_FADE_MS,
  CRACK_MS,
  PIN_START_MS,
  crackPose,
  pinnedPose,
  shardPose,
  type ShardPose,
} from "./shards";
import type { Cell, Point } from "./voronoi";

export const PANE_ASPECT = 10 / 16;
/** A point this close to the camera, as a fraction of the focal length, is not drawn. */
const NEAR_PLANE = 0.05;

export interface Lens {
  cx: number;
  cy: number;
  /** The focal length in CSS pixels. */
  focalPx: number;
}

export interface PaneRect {
  /** Top-left from the wall's centre, pixels at `z = 1`; y down. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The grid's columns, and where it sits on the stage, in stage units (the stage is 100 wide). */
const PANE_COLUMNS = 3;
const GRID_LEFT = 6;
const GRID_WIDTH = 58;
const GRID_TOP = 12;
const GRID_GAP = 1.2;

/**
 * The panes of a stage `width` pixels wide, as a grid of three columns in the left two thirds of
 * the stage: the slide's content box, clear of the Earth in the right third. The first row starts
 * 12 units below the top (under the slide's title) and the slide's other content, the agent's
 * answer, sits under the last row. Panes fill the rows left to right. Rectangles are measured from
 * the wall's centre (the lens centre), so `cx` and `cy` are the lens centre's place on the stage, in
 * pixels from the stage's top left. Every figure is in stage units, and the DOM captions use the
 * same numbers (`slides.css`, `.gmt-wall-figures`).
 */
export function paneLayout(
  count: number,
  width: number,
  cy: number = (width * 9) / 32,
  cx: number = width / 2,
): PaneRect[] {
  const unit = width / 100;
  const gap = GRID_GAP * unit;
  const w = (GRID_WIDTH * unit - (PANE_COLUMNS - 1) * gap) / PANE_COLUMNS;
  const h = w * PANE_ASPECT;
  return Array.from({ length: count }, (_, i) => ({
    x: GRID_LEFT * unit + (i % PANE_COLUMNS) * (w + gap) - cx,
    y: GRID_TOP * unit + Math.floor(i / PANE_COLUMNS) * (h + gap) - cy,
    w,
    h,
  }));
}

export interface PaneModel {
  id: string;
  seed: number;
  cells: readonly Cell[];
  rect: PaneRect;
  /** The cells that become clock pins, with the zone each one lands on. */
  pins: readonly {
    cell: number;
    zone: string;
    arriveMs: number;
    bow: number;
  }[];
}

export interface Drawable {
  pane: number;
  /** Which cell this is, or -1 for a whole pane. */
  cell: number;
  /** Screen corners, x then y, in CSS pixels. */
  pts: number[];
  /** The matching spots on the pane image, as fractions: u then v. */
  uvs: number[];
  alpha: number;
  /** For reduced motion: the cell outlines (screen pixels) to draw as cracks over a whole pane. */
  cracks?: { strength: number; edges: number[][] };
}

export interface FrameInput {
  lens: Lens;
  /** The wall's depth: 1 at rest, smaller is nearer. */
  z: number;
  panes: readonly PaneModel[];
  /** Milliseconds since each pane's impact, or `null` while whole. */
  times: readonly (number | null)[];
  /** Where each pane was hit, in pane units. */
  impacts: readonly Point[];
  reduced: boolean;
  /** Where a zone's point is on screen now, or `null` when the globe cannot say. */
  target(zone: string): Point | null;
}

export interface FrameOutput {
  drawables: Drawable[];
  /** Zones whose shard has arrived by this frame. */
  arrived: string[];
  /** Whether any pane is still in motion, so another frame is needed. */
  moving: boolean;
}

/** Projects a wall point, or returns `null` behind the near plane. */
export function projectWall(
  lens: Lens,
  z: number,
  X: number,
  Y: number,
  lift = 0,
): Point | null {
  const depth = lens.focalPx * z - lift;
  if (depth <= lens.focalPx * NEAR_PLANE) return null;
  const s = lens.focalPx / depth;
  return [lens.cx + X * s, lens.cy + Y * s];
}

/** Rotates `v` about the unit `axis` by `angle` (Rodrigues' formula). */
function rotate(
  v: readonly [number, number, number],
  axis: readonly [number, number, number],
  angle: number,
): [number, number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dot = axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2];
  return [
    v[0] * c + (axis[1] * v[2] - axis[2] * v[1]) * s + axis[0] * dot * (1 - c),
    v[1] * c + (axis[2] * v[0] - axis[0] * v[2]) * s + axis[1] * dot * (1 - c),
    v[2] * c + (axis[0] * v[1] - axis[1] * v[0]) * s + axis[2] * dot * (1 - c),
  ];
}

/** A cell's corners on screen under a pose; `null` when any corner is behind the near plane. */
function shardPoints(
  cell: Cell,
  rect: PaneRect,
  pose: ShardPose,
  lens: Lens,
  z: number,
): number[] | null {
  const pts: number[] = [];
  const lift = pose.dz * rect.w;
  const cx = rect.x + cell.centroid[0] * rect.w + pose.dx * rect.w;
  const cy = rect.y + cell.centroid[1] * rect.h + pose.dy * rect.w;
  for (const [u, v] of cell.poly) {
    const local: [number, number, number] = [
      (u - cell.centroid[0]) * rect.w,
      (v - cell.centroid[1]) * rect.h,
      0,
    ];
    const r = rotate(local, pose.axis, pose.angle);
    const p = projectWall(lens, z, cx + r[0], cy + r[1], lift + r[2]);
    if (!p) return null;
    pts.push(p[0], p[1]);
  }
  return pts;
}

const flat = (poly: readonly Point[]): number[] =>
  poly.flatMap((p) => [p[0], p[1]]);

const centroidOf = (pts: readonly number[]): Point => {
  let x = 0;
  let y = 0;
  const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) {
    x += pts[i]!;
    y += pts[i + 1]!;
  }
  return [x / n, y / n];
};

export function buildFrame(input: FrameInput): FrameOutput {
  const { lens, z, panes, times, impacts } = input;
  const drawables: Drawable[] = [];
  const arrived: string[] = [];
  let moving = false;
  panes.forEach((pane, index) => {
    const t = times[index] ?? null;
    const { rect } = pane;
    if (t === null || t < 0) {
      const corners = [
        projectWall(lens, z, rect.x, rect.y),
        projectWall(lens, z, rect.x + rect.w, rect.y),
        projectWall(lens, z, rect.x + rect.w, rect.y + rect.h),
        projectWall(lens, z, rect.x, rect.y + rect.h),
      ];
      if (corners.every((c): c is Point => c !== null))
        drawables.push({
          pane: index,
          cell: -1,
          pts: corners.flatMap((c) => [c[0], c[1]]),
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          alpha: 1,
        });
      return;
    }
    if (input.reduced) {
      const { cracks, opacity } = crackPose(t);
      if (opacity <= 0) {
        for (const pin of pane.pins)
          if (t >= CRACK_MS + CRACK_FADE_MS) arrived.push(pin.zone);
        return;
      }
      moving = true;
      const corners = [
        projectWall(lens, z, rect.x, rect.y),
        projectWall(lens, z, rect.x + rect.w, rect.y),
        projectWall(lens, z, rect.x + rect.w, rect.y + rect.h),
        projectWall(lens, z, rect.x, rect.y + rect.h),
      ];
      if (!corners.every((c): c is Point => c !== null)) return;
      const edges = pane.cells.map((cell) => {
        const out: number[] = [];
        for (const [u, v] of cell.poly) {
          const p = projectWall(
            lens,
            z,
            rect.x + u * rect.w,
            rect.y + v * rect.h,
          );
          if (p) out.push(p[0], p[1]);
        }
        return out;
      });
      drawables.push({
        pane: index,
        cell: -1,
        pts: corners.flatMap((c) => [c[0], c[1]]),
        uvs: [0, 0, 1, 0, 1, 1, 0, 1],
        alpha: opacity,
        cracks: { strength: cracks, edges },
      });
      return;
    }
    const impact = impacts[index] ?? [0.5, 0.5];
    const pinOf = new Map(pane.pins.map((p) => [p.cell, p]));
    pane.cells.forEach((cell, c) => {
      const pin = pinOf.get(c);
      const pose = shardPose(
        cell,
        pane.seed,
        Math.min(t, pin ? PIN_START_MS : t),
        impact,
      );
      if (!pin) {
        if (pose.opacity <= 0) return;
        const pts = shardPoints(cell, rect, pose, lens, z);
        if (!pts) return;
        moving = true;
        drawables.push({
          pane: index,
          cell: c,
          pts,
          uvs: flat(cell.poly),
          alpha: pose.opacity,
        });
        return;
      }
      const base = shardPoints(cell, rect, pose, lens, z);
      if (!base) return;
      if (t < PIN_START_MS) {
        moving = true;
        drawables.push({
          pane: index,
          cell: c,
          pts: base,
          uvs: flat(cell.poly),
          alpha: 1,
        });
        return;
      }
      const from = centroidOf(base);
      const to = input.target(pin.zone) ?? from;
      const at = pinnedPose(from, to, t, pin.arriveMs, pin.bow);
      if (at.arrived) {
        arrived.push(pin.zone);
        return;
      }
      moving = true;
      const pts = base.map((value, i) =>
        i % 2 === 0
          ? at.x + (value - from[0]) * at.scale
          : at.y + (value - from[1]) * at.scale,
      );
      drawables.push({
        pane: index,
        cell: c,
        pts,
        uvs: flat(cell.poly),
        alpha: at.opacity,
      });
    });
  });
  return { drawables, arrived, moving };
}
