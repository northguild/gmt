/**
 * How wide the widget rail may be, and the arithmetic behind dragging it.
 *
 * Mirrors the rail's CSS in `gmt-hive.css` (`.gmt-hive-rail`), which clamps the
 * width on its own so a window resize never needs this code:
 *
 * - **Narrowest** is the rail's default, `clamp(22rem, 34vw, 34rem)`.
 * - **Widest** is half the page, but never so wide that the transcript keeps
 *   less than `CHAT_MIN_REM`. On a window too small for both, the default wins.
 */

/** The rail's default width: `clamp(22rem, 34vw, 34rem)`. */
const RAIL_MIN = { floorRem: 22, viewportShare: 0.34, ceilRem: 34 };
/** The widest the rail may grow, as a share of the page body. */
export const RAIL_MAX_SHARE = 0.5;
/** The transcript never gets narrower than this while the rail grows. */
export const CHAT_MIN_REM = 28;

/** One arrow press, and one with Shift held. */
export const KEY_STEP_PX = 16;
export const KEY_BIG_STEP_PX = 64;

export interface RailBounds {
  min: number;
  max: number;
}

/** The rail's narrowest and widest widths in pixels. */
export function railBounds({
  viewportWidth,
  bodyWidth,
  rem,
}: {
  viewportWidth: number;
  bodyWidth: number;
  rem: number;
}): RailBounds {
  const min = Math.min(
    Math.max(RAIL_MIN.floorRem * rem, viewportWidth * RAIL_MIN.viewportShare),
    RAIL_MIN.ceilRem * rem,
  );
  const max = Math.max(
    min,
    Math.min(bodyWidth * RAIL_MAX_SHARE, bodyWidth - CHAT_MIN_REM * rem),
  );
  return { min, max };
}

export function clampRailWidth(
  width: number,
  { min, max }: RailBounds,
): number {
  return Math.min(Math.max(width, min), max);
}

/**
 * The width a key asks for, or `undefined` for a key the handle ignores.
 *
 * The rail sits on the right, so its handle moves with the arrow: ← widens
 * it, → narrows it. Home and End jump to the narrowest and widest.
 */
export function railWidthForKey(
  key: string,
  shiftKey: boolean,
  width: number,
  bounds: RailBounds,
): number | undefined {
  const step = shiftKey ? KEY_BIG_STEP_PX : KEY_STEP_PX;
  switch (key) {
    case "ArrowLeft":
      return clampRailWidth(width + step, bounds);
    case "ArrowRight":
      return clampRailWidth(width - step, bounds);
    case "Home":
      return bounds.min;
    case "End":
      return bounds.max;
    default:
      return undefined;
  }
}
