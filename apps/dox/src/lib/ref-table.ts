/**
 * Makes a generated Options or Members table that scrolls sideways reachable and visible.
 *
 * `renderOptionsTable` and `renderMembersTable` are wrapped by the generator in
 * `<div class="gmt-ref-table">` (see `scripts/build-utils/render-table.ts`). The stylesheet
 * lays the table out to fit its column and stacks it on a narrow one, so it rarely overflows.
 * When a cell does hold something wider than the column (an unbreakable token in a narrow
 * viewport), the wrapper is the box that scrolls, and this module gives it what a scrolling
 * box needs:
 *
 * - `tabindex="0"`, `role="region"` and an `aria-label`, so a keyboard reader can focus it and
 *   the arrow keys scroll it. A region that does not overflow gets none of them: a focus stop
 *   and a landmark with nothing to scroll is noise.
 * - `data-overflow` and `data-scroll` (`start` | `middle` | `end`), which the stylesheet turns
 *   into a fade on the edge that has more, and a one-line hint above the table.
 *
 * Plain DOM, no framework, no gmt import. The state is re-read on resize, on a change to the
 * table's size, and on scroll.
 */

const WRAPPER = ".gmt-ref-table";
const HINT_CLASS = "gmt-ref-table-hint";
/** Sub-pixel layout makes `scrollWidth` exceed `clientWidth` by a fraction. */
const SLACK_PX = 1;

const KIND_LABEL: Record<string, string> = {
  options: "Options",
  members: "Members",
};

/** The text of the heading a table sits under, without Starlight's anchor-link text. */
function headingBefore(el: Element): string | undefined {
  for (let prev = el.previousElementSibling; prev;) {
    const heading = prev.matches("h2, h3, h4, h5, h6")
      ? prev
      : prev.querySelector(
          ":scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6",
        );
    if (heading) {
      const copy = heading.cloneNode(true) as Element;
      copy.querySelectorAll(".sl-anchor-link").forEach((a) => a.remove());
      return copy.textContent?.trim() || undefined;
    }
    prev = prev.previousElementSibling;
  }
  return undefined;
}

/** What a screen reader announces for a scrolling table: "Members of Foo, table, scrolls sideways". */
function accessibleName(wrapper: HTMLElement): string {
  // A table the author wrote in a behaviour note belongs to no section of its own.
  if (wrapper.dataset.kind === "notes") {
    return "Table in the description, scrolls sideways";
  }
  const kind = KIND_LABEL[wrapper.dataset.kind ?? ""] ?? "Table";
  const heading = headingBefore(wrapper);
  const subject = heading && heading !== kind ? `${kind} of ${heading}` : kind;
  return `${subject}, table, scrolls sideways`;
}

function update(wrapper: HTMLElement): void {
  const overflowing = wrapper.scrollWidth > wrapper.clientWidth + SLACK_PX;
  const hint = wrapper.previousElementSibling?.classList.contains(HINT_CLASS)
    ? (wrapper.previousElementSibling as HTMLElement)
    : null;

  if (!overflowing) {
    delete wrapper.dataset.overflow;
    delete wrapper.dataset.scroll;
    wrapper.removeAttribute("tabindex");
    wrapper.removeAttribute("role");
    wrapper.removeAttribute("aria-label");
    hint?.remove();
    return;
  }

  wrapper.dataset.overflow = "";
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", accessibleName(wrapper));
  const max = wrapper.scrollWidth - wrapper.clientWidth;
  // `scrollLeft` is negative in a right-to-left page; its size is what the position is.
  const at = Math.abs(wrapper.scrollLeft);
  wrapper.dataset.scroll =
    at <= SLACK_PX ? "start" : at >= max - SLACK_PX ? "end" : "middle";

  if (!hint) {
    const el = document.createElement("p");
    el.className = HINT_CLASS;
    el.setAttribute("aria-hidden", "true");
    el.textContent = "Scroll sideways to see every column";
    wrapper.before(el);
  }
}

/** Wires every `.gmt-ref-table` under `root`. Safe to call twice on the same root. */
export function mountRefTables(root: ParentNode = document): void {
  const wrappers = root.querySelectorAll<HTMLElement>(WRAPPER);
  if (wrappers.length === 0) return;

  const observer =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          for (const entry of entries) {
            const target = entry.target;
            update(
              target.matches(WRAPPER)
                ? (target as HTMLElement)
                : (target.closest(WRAPPER) as HTMLElement),
            );
          }
        });

  for (const wrapper of wrappers) {
    if (wrapper.dataset.refTableWired) continue;
    wrapper.dataset.refTableWired = "";
    wrapper.addEventListener("scroll", () => update(wrapper), {
      passive: true,
    });
    observer?.observe(wrapper);
    // A table that grows or shrinks without the wrapper resizing (a font arriving, a wrap
    // changing) is seen through the table itself.
    const table = wrapper.querySelector("table");
    if (table) observer?.observe(table);
    update(wrapper);
  }
}
