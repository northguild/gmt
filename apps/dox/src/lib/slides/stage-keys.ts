/**
 * The deck's free-flight keys, for a deck whose stage has a camera to fly: W A S D tilt and turn,
 * Q E zoom, Shift doubles the rate. `keys.ts` listens for them and holds the key table; this
 * turns the held keys into the rate `actions.fly` hands the stage.
 */

/** A camera rate: degrees per second east and north, zoom units per second. */
export interface FlyVector {
  lng: number;
  lat: number;
  zoom: number;
}

/** Degrees per second a held direction key turns the camera, and zoom units per second Q and E give. */
const FLY_RATE_DEG = 60;
const ZOOM_RATE = 1;
/** Shift multiplies every rate by this. */
const FLY_SHIFT_FACTOR = 2;

/** What each flight key adds to the vector, by lower-case key. */
export const FLY_KEYS: Readonly<Record<string, Partial<FlyVector>>> = {
  w: { lat: FLY_RATE_DEG },
  s: { lat: -FLY_RATE_DEG },
  a: { lng: -FLY_RATE_DEG },
  d: { lng: FLY_RATE_DEG },
  q: { zoom: -ZOOM_RATE },
  e: { zoom: ZOOM_RATE },
};

/** The vector of the held keys: opposite keys cancel, Shift scales it. */
export function flyVector(
  held: ReadonlySet<string>,
  shift: boolean,
): FlyVector {
  const v: FlyVector = { lng: 0, lat: 0, zoom: 0 };
  for (const key of held) {
    const add = FLY_KEYS[key];
    if (!add) continue;
    v.lng += add.lng ?? 0;
    v.lat += add.lat ?? 0;
    v.zoom += add.zoom ?? 0;
  }
  const k = shift ? FLY_SHIFT_FACTOR : 1;
  return { lng: v.lng * k + 0, lat: v.lat * k + 0, zoom: v.zoom * k + 0 };
}
