/**
 * The globe's dawn: how far the Earth has woken, as a function of time since the dawn began.
 *
 * Pure, so the engine's clock stays the only clock. Exposure is 0 (a dark disc that hides the
 * stars) until `DAWN_DELAY_MS`, rises to 1 over `DAWN_RAMP_MS` on `cubic-bezier(.3, 0, .2, 1)`,
 * and is exactly 1 from `DAWN_END_MS`.
 */

/** The wait before the Earth starts to light. */
export const DAWN_DELAY_MS = 350;
/** How long the light takes to come up. */
export const DAWN_RAMP_MS = 2050;
/** When the dawn is over: exposure is exactly 1 and the spin may begin. */
export const DAWN_END_MS = DAWN_DELAY_MS + DAWN_RAMP_MS;
/** The canvas-2D fallback fades in over this long instead. */
export const FALLBACK_FADE_MS = 800;

/** A CSS cubic-bezier easing: the y for a progress x, both 0..1. */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (x: number) => number {
  const axis = (a: number, b: number, t: number): number =>
    3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let low = 0;
    let high = 1;
    let t = x;
    for (let i = 0; i < 40; i += 1) {
      t = (low + high) / 2;
      if (axis(x1, x2, t) < x) low = t;
      else high = t;
    }
    return axis(y1, y2, t);
  };
}

const ease = cubicBezier(0.3, 0, 0.2, 1);

/** The Earth's exposure `elapsedMs` after the dawn began. */
export function dawnExposure(elapsedMs: number): number {
  if (elapsedMs >= DAWN_END_MS) return 1;
  return ease((elapsedMs - DAWN_DELAY_MS) / DAWN_RAMP_MS);
}

/** The fallback canvas's opacity `elapsedMs` after the dawn began. */
export function fallbackOpacity(elapsedMs: number): number {
  return ease(elapsedMs / FALLBACK_FADE_MS);
}
