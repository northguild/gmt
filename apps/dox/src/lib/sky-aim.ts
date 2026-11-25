/**
 * Where to point the globe's camera so a body of the sky sits beside the Earth's limb, clear of the
 * page's copy, drawer and zoom stack. Pure: it uses only `sky-math`, and the rectangles arrive as
 * arguments.
 *
 * A body is one row of `AIM_BODIES`: where it is (`raDec`, given the camera when its place depends
 * on it, as the Moon's does through parallax) and how far its box reaches past its disc. A planet
 * is another row, and no code below changes.
 *
 * `aimBody` tries the largest lens zoom first (2, then 1.75 down to 1). For each zoom it tries
 * sixteen spots around the limb, nearest to where the body is now first, and moves the camera onto
 * a spot by Newton's method on the rotation `[lambda, phi]`.
 */
import { EARTH_HALF_ANGLE_DEG } from "./globe/pinhole";
import { GLARE_RADII } from "./sky-bodies";
import {
  bodyOnScreen,
  moonFromCamera,
  moonRaDec,
  siderealDeg,
  skyLens,
  sunRaDec,
  SUN_RADIUS,
  toUnit,
  viewMatrix,
  type RaDec,
} from "./sky-math";

/** A body the camera can be aimed at. Widen the union with a row in `AIM_BODIES`. */
export type SkyBodyId = "sun" | "moon";

interface AimBody {
  /** The body's place and angular radius, degrees, seen from the camera when it is given. */
  raDec(
    instantMs: number,
    rotation?: readonly [number, number],
  ): RaDec & { radius: number };
  /** The box reaches this many disc radii past the disc (the Sun's glare). */
  reach: number;
}

export const AIM_BODIES: Readonly<Record<SkyBodyId, AimBody>> = {
  sun: {
    raDec: (instantMs) => ({ ...sunRaDec(instantMs), radius: SUN_RADIUS }),
    reach: GLARE_RADII,
  },
  moon: {
    raDec: (instantMs, rotation) =>
      rotation ? moonFromCamera(instantMs, rotation) : moonRaDec(instantMs),
    reach: 0,
  },
};

/** An axis-aligned rectangle in the hero's CSS pixels. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** What `aimBody` needs of the camera, in the hero's CSS pixels. */
export interface AimLens {
  width: number;
  height: number;
  /** The Earth's centre. */
  centre: { x: number; y: number };
  /** The pinhole's focal length at zoom 1. */
  focalAtRest: number;
  /** Where the camera looks now, to try the spots nearest to the body first. */
  rotation: readonly [number, number];
}

/** The hero as the view sees it: its size, where the globe's pixels start in it, and what to keep clear of. */
export interface AimFrame {
  width: number;
  height: number;
  /** The globe surface's top-left in the hero's pixels. */
  shift: { x: number; y: number };
  /** In the hero's pixels. */
  rects: readonly Box[];
}

export interface Aim {
  rotation: [number, number];
  zoom: number;
}

const RAD = Math.PI / 180;
/** The lens zooms to try, largest first. */
export const AIM_ZOOMS = [2, 1.75, 1.5, 1.25, 1] as const;
const SPOTS = 16;
/** The body's box keeps this far inside the hero, px. */
const INSET = 16;
/** The body's disc sits this far past the limb, px. */
const GAP = 24;
const TOLERANCE = 2;
const STEPS = 8;
const MAX_LAT = 89;
const NUDGE_DEG = 10;
/** Finite-difference step of the Jacobian, degrees. */
const DELTA = 0.01;
/** A body off the hero still has a place: the lens is moved by this much so none counts as off screen. */
const PAD = 1e5;

const wrap180 = (degrees: number): number =>
  ((((degrees + 180) % 360) + 360) % 360) - 180;

/** The point on the Earth under a body: its longitude is its right ascension less the sidereal time. */
export function subBodyPoint(
  body: SkyBodyId,
  instantMs: number,
): [lng: number, lat: number] {
  const { ra, dec } = AIM_BODIES[body].raDec(instantMs);
  return [wrap180(ra - siderealDeg(instantMs)), dec];
}

interface Spot {
  x: number;
  y: number;
}

/** The body's disc on screen for a camera, or null while it is behind it. */
function place(
  body: SkyBodyId,
  instantMs: number,
  rotation: readonly [number, number],
  lens: AimLens,
  radius: number,
): { x: number; y: number; r: number } | null {
  const at = AIM_BODIES[body].raDec(instantMs, rotation);
  const shown = bodyOnScreen(
    skyLens(lens.width, lens.height, {
      x: lens.centre.x + PAD,
      y: lens.centre.y + PAD,
      radius,
    }),
    viewMatrix(rotation, instantMs),
    toUnit(at.ra, at.dec),
    at.radius,
    lens.width + 2 * PAD,
    lens.height + 2 * PAD,
    0,
  );
  return shown && { x: shown.x - PAD, y: shown.y - PAD, r: shown.r };
}

type Rotation = [number, number];

/** The Earth's radius on screen at a lens zoom, px. */
const earthRadius = (focalAtRest: number, zoom: number): number =>
  zoom * focalAtRest * Math.tan(EARTH_HALF_ANGLE_DEG * RAD);

/** The body's disc on screen for the lens's own camera (or `rotation`) at a lens zoom, or null while it is behind it. */
export const bodyAt = (
  body: SkyBodyId,
  instantMs: number,
  lens: AimLens,
  zoom: number,
  rotation: readonly [number, number] = lens.rotation,
) =>
  place(body, instantMs, rotation, lens, earthRadius(lens.focalAtRest, zoom));

/** One Newton step of the rotation towards `goal` on screen; null when the body is lost or the Jacobian is singular. */
function step(
  body: SkyBodyId,
  instantMs: number,
  lens: AimLens,
  radius: number,
  rotation: Rotation,
  goal: Spot,
): Rotation | null {
  const here = place(body, instantMs, rotation, lens, radius);
  const east = place(
    body,
    instantMs,
    [rotation[0] + DELTA, rotation[1]],
    lens,
    radius,
  );
  const north = place(
    body,
    instantMs,
    [rotation[0], rotation[1] + DELTA],
    lens,
    radius,
  );
  if (!here || !east || !north) return null;
  const a = (east.x - here.x) / DELTA;
  const b = (north.x - here.x) / DELTA;
  const c = (east.y - here.y) / DELTA;
  const d = (north.y - here.y) / DELTA;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) return null;
  const ex = goal.x - here.x;
  const ey = goal.y - here.y;
  return [
    wrap180(rotation[0] + (d * ex - b * ey) / det),
    rotation[1] + (a * ey - c * ex) / det,
  ];
}

/** Newton's method from `start` until the body sits within `TOLERANCE` px of `goal`. */
function solve(
  body: SkyBodyId,
  instantMs: number,
  lens: AimLens,
  radius: number,
  start: Rotation,
  goal: Spot,
): Rotation | null {
  let rotation = start;
  for (let i = 0; i <= STEPS; i++) {
    const here = place(body, instantMs, rotation, lens, radius);
    if (!here) return null;
    if (Math.hypot(goal.x - here.x, goal.y - here.y) <= TOLERANCE)
      return Math.abs(rotation[1]) < MAX_LAT ? rotation : null;
    if (i === STEPS) return null;
    const next = step(body, instantMs, lens, radius, rotation, goal);
    if (!next) return null;
    rotation = next;
  }
  return null;
}

/** Whether a circle at `spot` reaches into `box`. */
const meets = (spot: Spot, r: number, box: Box): boolean =>
  Math.hypot(
    spot.x - Math.max(box.left, Math.min(spot.x, box.right)),
    spot.y - Math.max(box.top, Math.min(spot.y, box.bottom)),
  ) < r;

/** Whether the body's box at `spot` is inside the hero and clear of every rectangle. */
export function isClear(
  spot: Spot,
  r: number,
  lens: AimLens,
  avoid: readonly Box[],
): boolean {
  if (
    spot.x - r < INSET ||
    spot.y - r < INSET ||
    spot.x + r > lens.width - INSET ||
    spot.y + r > lens.height - INSET
  )
    return false;
  return !avoid.some((box) => meets(spot, r, box));
}

/** The camera that antipodes the body: it sits straight behind the Earth's centre. */
export function behindEarth(body: SkyBodyId, instantMs: number): Rotation {
  const [lng, lat] = subBodyPoint(body, instantMs);
  return [wrap180(-lng - 180), lat];
}

/** The box radius of a body's disc `r`: the disc and whatever reaches past it. */
export const boxRadius = (body: SkyBodyId, r: number): number =>
  r * (1 + AIM_BODIES[body].reach);

/**
 * The camera rotation and lens zoom that put the body beside the Earth's limb, or null when no
 * spot at any zoom is inside the hero and clear of `avoid`.
 */
export function aimBody(
  body: SkyBodyId,
  instantMs: number,
  lens: AimLens,
  avoid: readonly Box[],
): Aim | null {
  const behind = behindEarth(body, instantMs);
  const now = bodyAt(body, instantMs, lens, 1);
  const heading = now
    ? Math.atan2(now.y - lens.centre.y, now.x - lens.centre.x)
    : 0;
  for (const zoom of AIM_ZOOMS) {
    const earth = earthRadius(lens.focalAtRest, zoom);
    const start = place(body, instantMs, behind, lens, earth);
    if (!start) continue;
    const reach = earth + start.r + GAP;
    const spots = Array.from({ length: SPOTS }, (_, k) => {
      const angle = (k / SPOTS) * 2 * Math.PI;
      const turn = Math.abs(wrap180((angle - heading) / RAD));
      return {
        turn,
        x: lens.centre.x + reach * Math.cos(angle),
        y: lens.centre.y + reach * Math.sin(angle),
      };
    }).sort((p, q) => p.turn - q.turn);
    for (const spot of spots) {
      if (!isClear(spot, boxRadius(body, start.r), lens, avoid)) continue;
      /* Nudge the camera so the body leaves the centre towards the spot, then close in on it. */
      const length = Math.hypot(spot.x - lens.centre.x, spot.y - lens.centre.y);
      const push = zoom * lens.focalAtRest * Math.tan(NUDGE_DEG * RAD);
      const nudge = step(body, instantMs, lens, earth, behind, {
        x: start.x + ((spot.x - lens.centre.x) / length) * push,
        y: start.y + ((spot.y - lens.centre.y) / length) * push,
      });
      const rotation = solve(
        body,
        instantMs,
        lens,
        earth,
        nudge ?? behind,
        spot,
      );
      if (rotation) return { rotation, zoom };
    }
  }
  return null;
}
