/**
 * Whether the sun is up where a zone is — the one thing a sun and a moon
 * honestly mean.
 *
 * Both glyphs used to stand for daylight saving, which was wrong twice over:
 * DST is a property of the clock and says nothing about the sky, and this list
 * sits beside a globe that draws the real day/night terminator. Here they mean
 * what they look like, and they agree with that terminator by construction
 * rather than by coincidence — both read the same `subsolarPoint`.
 *
 * The maths is the globe's own, not a second implementation: `globe/sun.ts`
 * gives the point on Earth the sun is directly over, and a zone's solar
 * elevation is 90° minus the great-circle angle to it. Pure trigonometry, no
 * `@js-temporal/polyfill` and no clock of its own, so unlike the DST scan this
 * is cheap enough to run for every zone on every tick.
 *
 * **It answers for a point, not a territory.** `TZ_COORDINATES` holds one
 * coordinate per zone — its principal city — and a zone spans country-sized
 * ground across which sunrise differs. The globe's own marker for that zone
 * makes the same assumption and sits at the same point, so the two never
 * disagree with each other; they are simply both answering for the city.
 */

import { ICON_STROKE } from "./widget-ui";
import { TWILIGHT_END_DEG } from "./globe/shading";
import { subsolarPoint } from "./globe/sun";

/** Where a zone's sun is, in the three bands the globe already shades. */
export type SkyState = "day" | "twilight" | "night";

const RAD = Math.PI / 180;

/**
 * Sunrise and sunset are conventionally the moment the sun's *upper limb*
 * touches the horizon, not its centre: refraction lifts the disc by about 34
 * arcminutes and its radius adds another 16, so the geometric elevation is
 * −0.833° when a published table says "sunrise". Using plain 0 here would call
 * it night for the last few minutes of visible daylight.
 */
const HORIZON = -0.833;

/**
 * Astronomical twilight ends 18° down — read from `globe/shading.ts`, which
 * eases its night wash across the same figure, so a row and the pixels behind
 * it change at the same instant.
 */
const NIGHT = -TWILIGHT_END_DEG;

/**
 * Solar elevation at a point, in degrees above the horizon.
 *
 * `sin(elevation) = sin φ sin δ + cos φ cos δ cos Δλ` — the cosine of the
 * great-circle angle to the subsolar point, which is what elevation is.
 */
export function solarElevation(
  lat: number,
  lng: number,
  sun: { lat: number; lng: number },
): number {
  const phi = lat * RAD;
  const delta = sun.lat * RAD;
  const deltaLng = (lng - sun.lng) * RAD;
  const cosAngle =
    Math.sin(phi) * Math.sin(delta) +
    Math.cos(phi) * Math.cos(delta) * Math.cos(deltaLng);
  // Clamped because rounding can push it a hair outside asin's domain.
  return Math.asin(Math.min(1, Math.max(-1, cosAngle))) / RAD;
}

/** The band an elevation falls in. */
export function skyStateFor(elevation: number): SkyState {
  if (elevation > HORIZON) return "day";
  if (elevation > NIGHT) return "twilight";
  return "night";
}

/**
 * The sky over a point at an instant.
 *
 * Polar day and polar night need no special case: at a high enough latitude the
 * elevation simply never crosses the horizon, and this returns `day` or `night`
 * for months on end, which is the truth.
 */
export function skyAt(lat: number, lng: number, instantMs: number): SkyState {
  return skyStateFor(solarElevation(lat, lng, subsolarPoint(instantMs)));
}

/** Wording for the tooltip and for assistive tech. */
export function skyLabel(state: SkyState): string {
  if (state === "day") return "daylight";
  if (state === "twilight") return "twilight";
  return "night";
}

/** Toggle wording — sentence case, since these label controls. */
export function skyFilterLabel(state: SkyState): string {
  if (state === "day") return "Daylight";
  if (state === "twilight") return "Twilight";
  return "Night";
}

/**
 * Glyphs for the sky toggles. The sun and the moon return here, standing for
 * daylight — the only thing they ever honestly meant. Twilight is the disc half
 * under the horizon.
 */
export const SKY_ICON_PATHS: Readonly<Record<SkyState, string>> = {
  day: `<g ${ICON_STROKE}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g>`,
  twilight: `<g ${ICON_STROKE}><path d="M3 18h18"/><path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 5v3M6.6 8.6l1.4 1.4M17.4 8.6 16 10"/></g>`,
  night: `<g ${ICON_STROKE}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z"/></g>`,
};
