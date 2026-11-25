/**
 * Where the Earth sits in the globe's stage and how large it can be (`frameSpace` in
 * `globe-mount.ts` adds the page-level placement on top). At rest the disc is centred and
 * fills `SPACE_FILL` of the stage's half-size. On a phone the zoom controls are a row along the
 * stage's foot and the stage is already the viewport less its 16px gutters
 * (globe-phone.module.css): there the atmosphere spans the stage's width, or the band above
 * that row where that is shorter, so the rim is drawn whole and only its glow reaches into the
 * gutters. It is not shrunk to clear the row from the stage's middle.
 */

/** The share of the stage's half-size the Earth fills at rest. */
const SPACE_FILL = 0.94;

/** The atmosphere's reach beyond the disc, as drawn by the renderers. */
export const ATMOSPHERE = 1.06;

/** Pixels kept clear between the atmosphere and the stage's edge. */
export const SPACE_CLEARANCE = 16;

/** Pixels kept clear between the Earth's disc and the zoom stack. */
export const STACK_CLEARANCE = 8;

interface StageBox {
  width: number;
  height: number;
}

interface StackBox {
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
}

/** The disc's centre, down from the stage's top, and the largest radius that fits at rest. */
export function frameBand(
  box: StageBox,
  stack: StackBox,
  wide: boolean,
): { mid: number; fit: number } {
  const half = Math.min(box.width, box.height) / 2;
  const row =
    !wide &&
    stack.offsetWidth > stack.offsetHeight &&
    stack.offsetTop + stack.offsetHeight >= box.height - 1;
  if (!row)
    return {
      mid: box.height / 2,
      fit: Math.min(half * SPACE_FILL, (half - SPACE_CLEARANCE) / ATMOSPHERE),
    };
  const above = stack.offsetTop - STACK_CLEARANCE;
  return {
    mid: above / 2,
    fit: Math.min(box.width, above) / 2 / ATMOSPHERE,
  };
}
