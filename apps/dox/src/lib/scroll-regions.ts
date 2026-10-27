/**
 * Makes a code block or a table that scrolls reachable from the keyboard.
 *
 * A box that scrolls but cannot take focus leaves a keyboard reader no way to read the
 * clipped part (WCAG 2.1.1, axe `scrollable-region-focusable`). The Expressive Code blocks,
 * the scenario snippets and any table scroll inside their own box on a narrow
 * screen. This module gives such a box what it needs, and only while it overflows:
 *
 * - `tabindex="0"`, `role="region"` and an `aria-label`, so the arrow keys scroll it and a
 *   screen reader names it. A box that fits gets none of them: a tab stop and a landmark with
 *   nothing to scroll is noise.
 * - `data-scroll-region`, which `gmt-a11y.css` turns into a visible focus ring.
 *
 * Generated option and member tables have their own wiring (`ref-table.ts`). The `/dox/` rail
 * is React-owned and does the same in `DoxChat.tsx`.
 *
 * Plain DOM, no framework. The state is re-read when the box or its content changes size.
 */

const CANDIDATES = "pre, table";
const SLACK_PX = 1;

function labelFor(el: HTMLElement): string {
  return el.tagName === "TABLE"
    ? "Table, scrolls sideways"
    : "Code, scrolls sideways";
}

function update(el: HTMLElement): void {
  const overflowing =
    el.scrollWidth > el.clientWidth + SLACK_PX ||
    el.scrollHeight > el.clientHeight + SLACK_PX;
  if (!overflowing) {
    if ("scrollRegion" in el.dataset) {
      delete el.dataset.scrollRegion;
      el.removeAttribute("tabindex");
      el.removeAttribute("role");
      el.removeAttribute("aria-label");
    }
    return;
  }
  // An author's own tab stop, role or name is kept.
  if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
  if (!el.hasAttribute("role")) el.setAttribute("role", "region");
  if (!el.hasAttribute("aria-label")) {
    el.setAttribute("aria-label", labelFor(el));
  }
  el.dataset.scrollRegion = "";
}

/** Wires every scrolling code block and table under `root`. Safe to call twice. */
export function mountScrollRegions(root: ParentNode = document): void {
  const boxes = root.querySelectorAll<HTMLElement>(CANDIDATES);
  if (boxes.length === 0) return;
  const observer =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          for (const entry of entries) {
            const target = entry.target as HTMLElement;
            update(
              target.matches(CANDIDATES)
                ? target
                : (target.closest(CANDIDATES) as HTMLElement),
            );
          }
        });
  for (const box of boxes) {
    if (box.dataset.scrollRegionWired) continue;
    box.dataset.scrollRegionWired = "";
    observer?.observe(box);
    // Content that grows without the box resizing (a table body filled after mount).
    for (const child of Array.from(box.children)) observer?.observe(child);
    update(box);
  }
}
