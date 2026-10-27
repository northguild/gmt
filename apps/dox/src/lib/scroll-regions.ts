/**
 * Makes a code block or a table that scrolls reachable from the keyboard.
 *
 * A box that scrolls but cannot take focus leaves a keyboard reader no way to read the
 * clipped part (WCAG 2.1.1, axe `scrollable-region-focusable`). The Expressive Code blocks,
 * the scenario snippets and any table scroll inside their own box on a narrow
 * screen. This module gives such a box what it needs, and only while it overflows:
 *
 * - `tabindex="0"`, so the arrow keys scroll it.
 * - A name that says which way it scrolls. A code block gets `role="region"` and an
 *   `aria-label` ("Code, scrolls sideways"). A table keeps its own role, so a screen reader still
 *   announces its rows, columns and headers, and gets an `aria-label` ("Scrolls sideways") only
 *   when it has no name of its own (a caption, `aria-label`, `aria-labelledby` or `title`).
 * - `data-scroll-region`, which `gmt-a11y.css` turns into a visible focus ring. Its value lists
 *   the attributes this module added, and only those are removed when the box fits again: an
 *   author's own tab stop, role or name is kept.
 *
 * A box that fits gets none of them: a tab stop and a landmark with nothing to scroll is noise.
 *
 * Generated option and member tables have their own wiring (`ref-table.ts`). The `/dox/` rail
 * is React-owned and does the same in `DoxChat.tsx`.
 *
 * Plain DOM, no framework. The state is re-read when the box or its content changes size. A box
 * a widget renders after the mount, or renders again, is picked up by a `MutationObserver` on
 * the root, so the order of the mount scripts does not matter.
 */

const CANDIDATES = "pre, table";
const SLACK_PX = 1;

function labelFor(el: HTMLElement, sideways: boolean, upDown: boolean): string {
  const how =
    sideways && upDown
      ? "scrolls in both directions"
      : sideways
        ? "scrolls sideways"
        : "scrolls up and down";
  return el.tagName === "TABLE"
    ? how[0].toUpperCase() + how.slice(1)
    : `Code, ${how}`;
}

/** Whether a table has a name of its own; an `aria-label` this module set does not count. */
function namedTable(table: HTMLTableElement, owned: Set<string>): boolean {
  return Boolean(
    table.caption?.textContent?.trim() ||
    table.hasAttribute("aria-labelledby") ||
    table.title ||
    (table.hasAttribute("aria-label") && !owned.has("aria-label")),
  );
}

function update(el: HTMLElement): void {
  const sideways = el.scrollWidth > el.clientWidth + SLACK_PX;
  const upDown = el.scrollHeight > el.clientHeight + SLACK_PX;
  const owned = new Set(
    (el.dataset.scrollRegion ?? "").split(" ").filter(Boolean),
  );
  if (!sideways && !upDown) {
    if ("scrollRegion" in el.dataset) {
      for (const name of owned) el.removeAttribute(name);
      delete el.dataset.scrollRegion;
    }
    return;
  }
  // An author's own tab stop, role or name is kept.
  const set = (name: string, value: string) => {
    if (el.hasAttribute(name) && !owned.has(name)) return;
    el.setAttribute(name, value);
    owned.add(name);
  };
  set("tabindex", "0");
  if (el.tagName !== "TABLE") set("role", "region");
  if (el.tagName !== "TABLE" || !namedTable(el as HTMLTableElement, owned)) {
    set("aria-label", labelFor(el, sideways, upDown));
  }
  el.dataset.scrollRegion = [...owned].join(" ");
}

/** One observer for every box, made on first use; null where the browser has none. */
let resize: ResizeObserver | null | undefined;

function resizeObserver(): ResizeObserver | null {
  if (resize === undefined) {
    resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            for (const entry of entries) {
              const box = entry.target.closest<HTMLElement>(CANDIDATES);
              if (box) update(box);
            }
          });
  }
  return resize;
}

function isWired(box: HTMLElement): boolean {
  return "scrollRegionWired" in box.dataset;
}

function wire(box: HTMLElement): void {
  if (isWired(box)) return;
  box.dataset.scrollRegionWired = "";
  const observer = resizeObserver();
  observer?.observe(box);
  // Content that grows without the box resizing (a table body filled after mount).
  for (const child of Array.from(box.children)) observer?.observe(child);
  update(box);
}

function unwire(box: HTMLElement): void {
  if (!isWired(box)) return;
  delete box.dataset.scrollRegionWired;
  resize?.unobserve(box);
  for (const child of Array.from(box.children)) resize?.unobserve(child);
}

function boxesIn(el: Element): HTMLElement[] {
  const inside = Array.from(el.querySelectorAll<HTMLElement>(CANDIDATES));
  return el.matches(CANDIDATES) ? [el as HTMLElement, ...inside] : inside;
}

function onMutations(records: MutationRecord[]): void {
  for (const record of records) {
    // A wired box whose content was replaced: watch the new children, and re-read it now.
    const { target } = record;
    const parentBox =
      target instanceof HTMLElement && isWired(target) ? target : null;
    for (const node of Array.from(record.removedNodes)) {
      if (!(node instanceof Element) || node.isConnected) continue;
      resize?.unobserve(node);
      for (const box of boxesIn(node)) unwire(box);
    }
    for (const node of Array.from(record.addedNodes)) {
      if (!(node instanceof Element) || !node.isConnected) continue;
      if (parentBox) resize?.observe(node);
      for (const box of boxesIn(node)) wire(box);
    }
    if (parentBox) update(parentBox);
  }
}

let mutations: MutationObserver | undefined;

/**
 * Wires every scrolling code block and table under `root`, now and as widgets add them. Safe to
 * call twice.
 */
export function mountScrollRegions(root: ParentNode = document): void {
  for (const box of root.querySelectorAll<HTMLElement>(CANDIDATES)) wire(box);
  if (typeof MutationObserver === "undefined") return;
  mutations ??= new MutationObserver(onMutations);
  mutations.observe(root, { childList: true, subtree: true });
}
