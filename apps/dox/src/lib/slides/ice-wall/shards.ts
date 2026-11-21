/**
 * How a shard moves, as pure functions of the time since the impact.
 *
 * There is no integration state: `shardPose` and `pinnedPose` take `t` (milliseconds after the
 * impact) and return where the shard is, so a replay is exact and a reset is simply a `t0` of
 * null. Distances are in pane widths (the cell's own unit), screen positions in CSS pixels.
 *
 * The ballistic flight: out from the impact and towards the camera, spinning about a seeded axis,
 * with the velocity decaying as `e^(-t / 600)`, so the position is `v * 600 * (1 - e^(-t / 600))`.
 * It fades out by `FADE_END_MS`. A pinned shard flies the same way until `PIN_START_MS`, then
 * takes a curve to its zone's point, shrinks into a dot and ends there (`pinnedPose`).
 */
import { mulberry32, type Cell, type Point } from "./voronoi";

const DECAY_MS = 600;
const FADE_START_MS = 700;
export const FADE_END_MS = 1400;
/** A pinned shard leaves its ballistic path at this moment. */
export const PIN_START_MS = 500;
/** The latest a pinned shard arrives. Each arrives at a seeded moment between the two. */
export const PIN_LAST_MS = FADE_END_MS;
export const PIN_FIRST_MS = 900;
/** The reduced-motion break: cracks over the whole pane, then the pane fades. */
export const CRACK_MS = 150;
export const CRACK_FADE_MS = 200;

export interface ShardPose {
  /** Displacement of the cell's centre, in pane widths: right, down, towards the camera. */
  dx: number;
  dy: number;
  dz: number;
  /** Spin about `axis` (a unit vector), radians. */
  angle: number;
  axis: readonly [number, number, number];
  opacity: number;
}

/** The shard's own random numbers: the same for a given pane seed and cell. */
function randoms(cell: Cell, seed: number): () => number {
  const mix =
    (seed ^
      Math.imul(Math.round(cell.site[0] * 65536) + 1, 0x9e3779b1) ^
      Math.imul(Math.round(cell.site[1] * 65536) + 7, 0x85ebca6b)) >>>
    0;
  return mulberry32(mix);
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

const smooth = (x: number): number => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};

/** How far along its decaying flight a shard is at `t`, in units of `DECAY_MS`. */
const travel = (t: number): number => 1 - Math.exp(-Math.max(0, t) / DECAY_MS);

/** Where a shard is `t` ms after a break at `impact` (pane-unit coordinates). */
export function shardPose(
  cell: Cell,
  seed: number,
  t: number,
  impact: Point = [0.5, 0.5],
): ShardPose {
  const random = randoms(cell, seed);
  const ox = cell.centroid[0] - impact[0];
  const oy = cell.centroid[1] - impact[1];
  const length = Math.hypot(ox, oy) || 1;
  const bend = (random() - 0.5) * 0.7;
  const dirX = (ox / length) * Math.cos(bend) - (oy / length) * Math.sin(bend);
  const dirY = (ox / length) * Math.sin(bend) + (oy / length) * Math.cos(bend);
  const speed = (0.55 + length * 1.5) * (0.7 + random() * 0.6);
  const lift = (0.45 + random() * 0.6) * (1.2 - length * 0.5);
  const spin = (random() - 0.5) * 2 * Math.PI * 2.4;
  const ax = random() - 0.5;
  const ay = random() - 0.5;
  const az = random() - 0.5 + 0.2;
  const norm = Math.hypot(ax, ay, az) || 1;
  const k = (DECAY_MS / 1000) * travel(t);
  return {
    dx: dirX * speed * k,
    dy: dirY * speed * k,
    dz: lift * k,
    angle: spin * k,
    axis: [ax / norm, ay / norm, az / norm],
    opacity: 1 - smooth((t - FADE_START_MS) / (FADE_END_MS - FADE_START_MS)),
  };
}

/** The reduced-motion break: the pane stays put, cracked, then fades. */
export function crackPose(t: number): { cracks: number; opacity: number } {
  return {
    cracks: clamp01(t / CRACK_MS),
    opacity: 1 - clamp01((t - CRACK_MS) / CRACK_FADE_MS),
  };
}

interface PinnedPose {
  x: number;
  y: number;
  /** 1 at the pinning moment, down to a dot at arrival. */
  scale: number;
  opacity: number;
  /** Whether the shard has reached its zone and handed over to the marker. */
  arrived: boolean;
}

/** The moment a shard arrives, a seeded value between `PIN_FIRST_MS` and `PIN_LAST_MS`. */
export function arrivalMs(cell: Cell, seed: number): number {
  return (
    PIN_FIRST_MS + randoms(cell, seed ^ 0x51ed)() * (PIN_LAST_MS - PIN_FIRST_MS)
  );
}

/** The dot a shard shrinks into, as a fraction of its size. */
export const DOT_SCALE = 0.06;

/**
 * A pinned shard's position from `PIN_START_MS` on: a quadratic curve from where it was (`from`,
 * screen pixels) to its zone's point (`to`), bowed to one side by a seeded amount. At `arriveMs`
 * it is exactly on `to`.
 */
export function pinnedPose(
  from: Point,
  to: Point,
  t: number,
  arriveMs: number,
  bow: number,
): PinnedPose {
  const u = clamp01((t - PIN_START_MS) / Math.max(1, arriveMs - PIN_START_MS));
  const e = u * u * (3 - 2 * u);
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const cx = mx - dy * bow;
  const cy = my + dx * bow;
  const a = (1 - e) * (1 - e);
  const b = 2 * (1 - e) * e;
  const c = e * e;
  return {
    x: a * from[0] + b * cx + c * to[0],
    y: a * from[1] + b * cy + c * to[1],
    scale: 1 + (DOT_SCALE - 1) * e,
    opacity: u >= 1 ? 0 : 1,
    arrived: u >= 1,
  };
}
