/**
 * A timed fly-to along the great circle between two globe orientations.
 *
 * A flight is a pure function of the time since it started, so it covers the
 * same path at any frame rate. Along the arc the distance travelled follows an
 * unhurried curve: from rest it gathers speed gently, peaks before halfway and
 * spends the longer second part settling, ending with no speed, push or jolt on
 * the goal. A globe already moving keeps that motion at the start. Any sideways part
 * of the starting velocity (a retarget in mid-flight, or a flick that points
 * away from the goal) is carried as a lateral drift that fades to nothing by
 * the landing, so a second pick never jolts the globe.
 *
 * Rotation is `[λ, φ]` in degrees. A flight treats it as a point on the unit
 * sphere, which is what makes the path a great circle that takes the short way
 * across the antimeridian and never leaves ±90° of latitude.
 */

import { clampLat, wrapLng } from "./camera";

/** A short hop of a few degrees takes about this long. */
export const FLIGHT_MIN_MS = 900;

/** A half-turn (180°) takes this long. */
export const FLIGHT_HALF_TURN_MS = 3000;

/**
 * How long a flight of `distance` radians takes, in ms. The time grows with the square root of the
 * distance, so a short hop is not rushed and a long one does not drag: about 1.4 s for 10°, 2.4 s
 * for 90° and 3 s for a half-turn.
 */
export function flightMs(distance: number): number {
  return (
    FLIGHT_MIN_MS +
    (FLIGHT_HALF_TURN_MS - FLIGHT_MIN_MS) *
      Math.sqrt(Math.min(Math.abs(distance) / Math.PI, 1))
  );
}

/** Under this many radians (about 0.006°) of distance and speed, there is nothing to fly. */
const NEGLIGIBLE = 1e-4;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

type Vec = readonly [number, number, number];

function dot(a: Vec, b: Vec): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec, b: Vec): Vec {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function scale(a: Vec, k: number): Vec {
  return [a[0] * k, a[1] * k, a[2] * k];
}

function add(a: Vec, b: Vec): Vec {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function norm(a: Vec): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function toVec(lambda: number, phi: number): Vec {
  const l = lambda * RAD;
  const p = phi * RAD;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

/** Unit vectors for "towards +λ" and "towards +φ" at `[λ, φ]`. */
function basis(lambda: number, phi: number): { east: Vec; north: Vec } {
  const l = lambda * RAD;
  const p = phi * RAD;
  return {
    east: [-Math.sin(l), Math.cos(l), 0],
    north: [
      -Math.sin(p) * Math.cos(l),
      -Math.sin(p) * Math.sin(l),
      Math.cos(p),
    ],
  };
}

/** Where a flight is at one moment. */
export interface FlightSample {
  /** `[λ, φ]` in degrees. */
  rotation: [number, number];
  /** Rate of change of `[λ, φ]` in degrees per millisecond. */
  rate: [number, number];
  /** True once the flight has reached its goal and stopped. */
  done: boolean;
}

export interface Flight {
  /** The goal as given, with its latitude clamped. */
  readonly goal: readonly [number, number];
  readonly durationMs: number;
  /** The state `elapsedMs` after the flight began. */
  at(elapsedMs: number): FlightSample;
}

/**
 * Plan a flight, or return null when the globe is already at the goal and not
 * moving.
 *
 * `rate` is how fast `[λ, φ]` is changing right now, in degrees per millisecond.
 */
export function planFlight(
  from: readonly [number, number],
  rate: readonly [number, number],
  goalIn: readonly [number, number],
): Flight | null {
  const goal: [number, number] = [wrapLng(goalIn[0]), clampLat(goalIn[1])];
  const p0 = toVec(from[0], from[1]);
  const g = toVec(goal[0], goal[1]);
  const { east, north } = basis(from[0], from[1]);

  // Starting velocity as a tangent vector in rad/ms. East speed is λ-rate times cosφ.
  const v = add(
    scale(east, rate[0] * RAD * Math.cos(from[1] * RAD)),
    scale(north, rate[1] * RAD),
  );
  const speed0 = norm(v);

  // Heading of the arc: towards the goal, or any tangent when the goal is
  // here or opposite, where every heading is as short as another.
  const towards = add(g, scale(p0, -dot(p0, g)));
  const towardsLen = norm(towards);
  const distance = Math.atan2(towardsLen, dot(p0, g));
  if (distance < NEGLIGIBLE && speed0 < NEGLIGIBLE / FLIGHT_MIN_MS) return null;

  let e1: Vec;
  if (towardsLen > 1e-9) e1 = scale(towards, 1 / towardsLen);
  else if (speed0 > 1e-12) e1 = scale(v, 1 / speed0);
  else e1 = east;
  const e2 = cross(p0, e1);

  const durationMs = flightMs(distance);

  // Start speed along and across the arc, in radians over the whole flight. The
  // carry term never overshoots on its own; the cap only keeps a hard flick
  // towards the goal from rushing the landing.
  const along = Math.min(dot(v, e1) * durationMs, 1.5 * distance);
  const across = dot(v, e2) * durationMs;

  function at(elapsedMs: number): FlightSample {
    const u = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
    if (u >= 1)
      return { rotation: [goal[0], goal[1]], rate: [0, 0], done: true };

    // `go` carries the globe from rest to the goal: speed 60u²(1−u)³ peaks at
    // 40% of the time, so the landing is longer and softer than the start, and
    // speed, push and jolt are all zero at both ends. `carry` holds the start
    // speed (slope 1 at u = 0) and fades it out with the same soft landing; it
    // is never negative, so carry plus go never passes the goal.
    const w = 1 - u;
    const w3 = w * w * w;
    const u2 = u * u;
    const go = u2 * u * (20 - 45 * u + 36 * u2 - 10 * u2 * u);
    const dgo = 60 * u2 * w3;
    const carry = u * w3 * w;
    const dcarry = w3 * (1 - 5 * u);

    const s = carry * along + go * distance;
    const l = carry * across;
    const ds = (dcarry * along + dgo * distance) / durationMs;
    const dl = (dcarry * across) / durationMs;

    const cosS = Math.cos(s);
    const sinS = Math.sin(s);
    const q = add(scale(p0, cosS), scale(e1, sinS));
    const dq = scale(add(scale(p0, -sinS), scale(e1, cosS)), ds);
    const cosL = Math.cos(l);
    const sinL = Math.sin(l);
    const pos = add(scale(q, cosL), scale(e2, sinL));
    const vel = add(
      add(scale(dq, cosL), scale(q, -sinL * dl)),
      scale(e2, cosL * dl),
    );

    const phi = Math.asin(Math.min(1, Math.max(-1, pos[2]))) * DEG;
    const lambda = Math.atan2(pos[1], pos[0]) * DEG;
    const b = basis(lambda, phi);
    const cosPhi = Math.max(Math.cos(phi * RAD), 1e-3);
    return {
      rotation: [wrapLng(lambda), clampLat(phi)],
      rate: [(dot(vel, b.east) / cosPhi) * DEG, dot(vel, b.north) * DEG],
      done: false,
    };
  }

  return { goal, durationMs, at };
}
