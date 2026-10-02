/**
 * The casing both renderers draw under the globe's overlay (#293).
 *
 * Every marker, selection ring, label and region outline sits on a dark
 * casing, on every globe. Behind them the globe runs from night-side black to
 * the lit limb's cyan haze to the photo's ice-cap white, and no ink holds its
 * contrast over all of that on its own; over its casing it only has to clear
 * the casing. `globe-contrast.test.ts` measures that.
 *
 * The sizes live here so the WebGPU renderer and the canvas-2D fallback draw
 * the same casing round the same shapes — the fallback is what a browser
 * without WebGPU shows, and it needs the contrast as much.
 */

/** How far the casing reaches past a marker, a ring or an outline, in CSS pixels. */
export const CASING_CSS = 1;

/**
 * Width of the halo round each label glyph, in CSS pixels: a stroke twice this
 * wide, centred on the outline.
 */
export const LABEL_HALO_CSS = 2;

/** Where a label's text starts, right of its marker's centre, in CSS pixels. */
export const LABEL_OFFSET_X = 6;

/** Space left between a selection ring and the halo of its label, in CSS pixels. */
export const LABEL_RING_GAP_CSS = 1;

/**
 * How far right a marker's label moves so that its halo clears the marker's
 * selection ring, in CSS pixels. The ring is the one signal of which zone is
 * selected, and a halo laid over its right half would hide it.
 */
export function labelRingShift(
  ring: { radius: number; width: number } | undefined,
): number {
  if (!ring) return 0;
  const ringEdge = ring.radius + ring.width / 2;
  return Math.max(
    0,
    ringEdge + LABEL_RING_GAP_CSS + LABEL_HALO_CSS - LABEL_OFFSET_X,
  );
}
