/**
 * Where the landing hero puts the Earth: its centre and radius in the globe surface's pixels, kept
 * clear of the hero's copy and the zoom stack. `globe-mount.ts` hands `frameSpace` to the engine as
 * its `framing`.
 */
import {
  ATMOSPHERE,
  frameBand,
  SPACE_CLEARANCE,
  STACK_CLEARANCE,
} from "./globe-frame";

/**
 * The right edge of the copy's words and buttons: the union of its descendants' boxes. In carousel
 * mode the column holds pages of different widths and only one shows, so the edge is the
 * column's own content box, and the Earth stays where it is as the pages change.
 */
function copyEnd(copy: HTMLElement): number {
  if (document.documentElement.dataset["homeCarousel"] !== undefined) {
    const box = copy.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return -Infinity;
    return (
      box.right - (parseFloat(getComputedStyle(copy).paddingInlineEnd) || 0)
    );
  }
  let end = -Infinity;
  for (const el of copy.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width !== 0 && r.height !== 0) end = Math.max(end, r.right);
  }
  return end;
}

/**
 * Where the Earth sits in the hero, in the surface's pixels. Its centre-y is the globe area's
 * middle and its radius fills most of the area's shorter side, leaving the atmosphere clear of
 * the area's edge. The disc shrinks only as far as it must to keep the zoom stack off it, so a
 * narrow hero, where the stack sits against the square's corner, never has the Earth under
 * the buttons. When the hero stacks (narrower than 64rem, or portrait) its centre-x is the area's.
 * Side by side it is the page's centre,
 * or, where the copy reaches too far for that, the nearest x that keeps the atmosphere 16 px
 * clear of the copy's end (never left of the page's centre).
 */
export function frameSpace(
  stage: HTMLElement,
  surface: HTMLElement,
  stack: HTMLElement,
  copy: HTMLElement | null,
  wide: boolean,
  width: number,
  height: number,
): { cx: number; cy: number; radius: number } {
  const box = stage.getBoundingClientRect();
  const origin = surface.getBoundingClientRect();
  if (box.width === 0 || box.height === 0)
    return {
      cx: width / 2,
      cy: height / 2,
      radius: Math.min(width, height) / 2,
    };
  const band = frameBand(box, stack, wide);
  const cy = box.top - origin.top + band.mid;
  const fit = band.fit;
  /* The stack's laid-out box in the stage, not where its entrance transform has it now. */
  const left = box.left - origin.left + stack.offsetLeft;
  const top = box.top - origin.top + stack.offsetTop;
  const radiusAt = (cx: number): number => {
    if (stack.offsetWidth === 0 || stack.offsetHeight === 0) return fit;
    const nearX = Math.max(left, Math.min(cx, left + stack.offsetWidth));
    const nearY = Math.max(top, Math.min(cy, top + stack.offsetHeight));
    const reach = Math.hypot(nearX - cx, nearY - cy) - STACK_CLEARANCE;
    return Math.max(0, Math.min(fit, reach));
  };
  let cx = box.left - origin.left + box.width / 2;
  if (wide) {
    const page = document.documentElement.clientWidth / 2 - origin.left;
    cx = page;
    if (copy) {
      const end = copyEnd(copy) - origin.left;
      if (Number.isFinite(end)) {
        /* The radius depends on where the centre is (the zoom stack), and the centre on the
           radius: a few passes settle it, and the last one fixes the centre to the final radius. */
        let radius = radiusAt(page);
        for (let pass = 0; pass < 4; pass++) {
          cx = Math.max(page, end + SPACE_CLEARANCE + ATMOSPHERE * radius);
          radius = radiusAt(cx);
        }
        cx = Math.max(page, end + SPACE_CLEARANCE + ATMOSPHERE * radius);
      }
    }
  }
  return { cx, cy, radius: radiusAt(cx) };
}
