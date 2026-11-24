/**
 * How much a transform scales a box as drawn: its drawn size (`getBoundingClientRect`) over its
 * layout size (`offsetWidth` or `offsetHeight`). A slide's fit box (`.gmt-stage-fit`) is laid out
 * at one size and drawn at another, so drawn pixels are turned back into layout pixels by this.
 * The layout size is rounded to a pixel, so a ratio within 1% of 1 is no scaling; a box with no
 * size is not scaled either.
 */
export function drawnScale(
  el: HTMLElement,
  axis: "inline" | "block" = "inline",
): number {
  const rect = el.getBoundingClientRect();
  const layout = axis === "inline" ? el.offsetWidth : el.offsetHeight;
  const drawn = axis === "inline" ? rect.width : rect.height;
  if (layout <= 0 || drawn <= 0) return 1;
  const ratio = drawn / layout;
  return Math.abs(ratio - 1) < 0.01 ? 1 : ratio;
}
