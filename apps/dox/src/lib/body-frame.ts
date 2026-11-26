/**
 * Where a body's surface faces. `bodyFrame` is any body's pole and prime meridian from its IAU
 * WGCCRE rotational elements (Archinal et al. 2018; the rows are in `body-rotation.ts`), in the
 * equatorial axes of date that `sky-math.ts` draws the Sun, the Moon and the planets in.
 */
import type { BodyRotation } from "./body-rotation";
import { RAD } from "./globe/pinhole";
import { DAY_MS, J2000_JD, UNIX_EPOCH_JD } from "./globe/sun";
import { dot, precessToDate, toUnit, type Unit } from "./sky-math";

/** A body's north pole and the direction of its prime meridian, unit vectors in the equatorial axes of date. */
export interface BodyFrame {
  pole: Unit;
  prime: Unit;
}

export const cross = (a: Unit, b: Unit): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * A body's pole (right ascension and declination, J2000 axes) and prime-meridian angle W at a
 * Unix instant in milliseconds, degrees. The instant is taken as TDB: UTC is under 70 s behind,
 * 0.01 degree of the Moon's rotation.
 */
function elements(
  { ra, dec, w, args = [], raTerms, decTerms, wTerms }: BodyRotation,
  instantMs: number,
): [ra: number, dec: number, w: number] {
  const d = instantMs / DAY_MS + UNIX_EPOCH_JD - J2000_JD;
  const t = d / 36_525;
  const sum = (terms: BodyRotation["raTerms"] = [], f: (x: number) => number) =>
    terms.reduce(
      (total, [index, k]) =>
        total + k * f((args[index - 1]![0] + args[index - 1]![1] * d) * RAD),
      0,
    );
  return [
    ra[0] + ra[1] * t + sum(raTerms, Math.sin),
    dec[0] + dec[1] * t + sum(decTerms, Math.cos),
    w[0] + w[1] * d + (w[2] ?? 0) * d * d + sum(wTerms, Math.sin),
  ];
}

/** A body's north pole at a Unix instant in milliseconds, a unit vector in the equatorial axes of date. */
export function bodyPole(rotation: BodyRotation, instantMs: number): Unit {
  const [ra, dec] = elements(rotation, instantMs);
  return precessToDate(toUnit(ra, dec), instantMs);
}

/**
 * A body's pole and prime meridian at a Unix instant in milliseconds, in the equatorial axes of
 * date. The prime meridian is the node of the body's equator on the equator of J2000, turned by
 * W along the body's equator, then both precessed to date.
 */
export function bodyFrame(
  rotation: BodyRotation,
  instantMs: number,
): BodyFrame {
  const [ra, dec, w] = elements(rotation, instantMs);
  const pole = toUnit(ra, dec);
  const node = toUnit(ra + 90, 0);
  const along = cross(pole, node);
  const [c, s] = [Math.cos(w * RAD), Math.sin(w * RAD)];
  return {
    pole: precessToDate(pole, instantMs),
    prime: precessToDate(
      node.map((n, i) => c * n + s * along[i]!) as [number, number, number],
      instantMs,
    ),
  };
}

/**
 * Where a unit direction (equatorial axes of date) meets a body's surface: east longitude from the
 * prime meridian and north latitude, radians. East is the pole crossed with the prime meridian,
 * so longitude grows to the right when the body is seen from outside with its north up.
 */
export function surfaceAt(
  { pole, prime }: BodyFrame,
  [x, y, z]: Unit,
): [number, number] {
  const at: Unit = [x, y, z];
  return [
    Math.atan2(dot(at, cross(pole, prime)), dot(at, prime)),
    Math.asin(Math.max(-1, Math.min(1, dot(at, pole)))),
  ];
}
