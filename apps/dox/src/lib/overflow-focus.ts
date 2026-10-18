/**
 * Gives a scroll region a tab stop only while it has something to scroll.
 *
 * A box with `overflow-x: auto` must be focusable for a keyboard reader to scroll it, so the
 * server HTML ships `tabindex="0"` and the region works with no JavaScript, and on a narrow screen
 * where the table overflows. Where the content fits (a desktop width) the same tab stop lands the
 * reader on a box that does not move, so this module removes it there and puts it back when the
 * region overflows again.
 *
 * Only `tabindex` changes. The region's `role` and `aria-label` stay, because a named landmark is
 * harmless at any width. `ref-table.ts` does the same job for the generated Options and Members
 * tables and also drops the role, because it also adds that role itself.
 *
 * Plain DOM, no framework. With no `ResizeObserver` the server's tab stop is left alone.
 */

/** Sub-pixel layout makes `scrollWidth` exceed `clientWidth` by a fraction. */
const SLACK_PX = 1;

function update(region: HTMLElement): void {
  if (region.scrollWidth > region.clientWidth + SLACK_PX) region.tabIndex = 0;
  else region.removeAttribute("tabindex");
}

/**
 * Keeps the tab stop of every `selector` match under `root` in step with whether it overflows.
 * Returns a function that stops watching.
 */
export function mountOverflowFocus(
  root: ParentNode,
  selector: string,
): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  const regions = [...root.querySelectorAll<HTMLElement>(selector)];
  const observer = new ResizeObserver(() => regions.forEach(update));
  for (const region of regions) {
    // The region resizes with the window; its table is also watched, because a web font arriving
    // or a row wrapping changes how wide the content is without the region changing size.
    observer.observe(region);
    const table = region.querySelector("table");
    if (table) observer.observe(table);
    update(region);
  }
  return () => observer.disconnect();
}
