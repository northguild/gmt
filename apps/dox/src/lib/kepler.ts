/**
 * A body on a two-body orbit: the Minor Planet Center's osculating elements, solved with Newton's
 * method on Kepler's equation. Elliptic orbits only (`e` under 1). Pure; `ephemeris.ts` turns the
 * position into the camera's view (the frame turn and light time live there, once).
 */
import { RAD, type Vec3 } from "./globe/pinhole";

/** The elements of the Minor Planet Center's orbit format: angles in degrees, J2000 ecliptic. */
export interface KeplerElements {
  /** Semi-major axis, au. */
  a: number;
  /** Eccentricity, under 1. */
  e: number;
  /** Inclination. */
  i: number;
  /** Longitude of the ascending node. */
  node: number;
  /** Argument of perihelion. */
  peri: number;
  /** Mean anomaly at `epoch`. */
  M: number;
  /** Mean motion, degrees a day. */
  n: number;
  /** The Julian date of the elements. */
  epoch: number;
}

/** Newton stops when a step moves the eccentric anomaly by less than this, radians. */
const TOLERANCE = 1e-12;

/**
 * The eccentric anomaly `E` (radians) of a mean anomaly `M` (radians) on an orbit of eccentricity
 * `e`, by at most `steps` Newton steps. It starts at pi for a high eccentricity, where `M` itself
 * is a poor guess near perihelion.
 */
export function solveKepler(M: number, e: number, steps = 50): number {
  const m = M - 2 * Math.PI * Math.round(M / (2 * Math.PI));
  let E = e < 0.8 ? m : Math.PI;
  for (let step = 1; steps-- && Math.abs(step) > TOLERANCE;)
    E -= step = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
  return E;
}

/** The heliocentric position of a body at Julian date `jd`: au, axes of the J2000 ecliptic. */
export function keplerPosition(elements: KeplerElements, jd: number): Vec3 {
  const { a, e } = elements;
  const E = solveKepler(
    (elements.M + elements.n * (jd - elements.epoch)) * RAD,
    e,
  );
  /* The orbit's own plane: x toward perihelion. */
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt((1 - e) * (1 + e)) * Math.sin(E);
  const [w, i, o] = [elements.peri, elements.i, elements.node].map(
    (d) => d * RAD,
  ) as Vec3;
  const [u, v] = [
    x * Math.cos(w) - y * Math.sin(w),
    x * Math.sin(w) + y * Math.cos(w),
  ];
  return [
    u * Math.cos(o) - v * Math.cos(i) * Math.sin(o),
    u * Math.sin(o) + v * Math.cos(i) * Math.cos(o),
    v * Math.sin(i),
  ];
}
