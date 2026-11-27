/**
 * The globe's control stack as one toolbar (WAI-ARIA APG toolbar): Tab enters it at one button
 * and leaves it with the next Tab; the arrow keys move between its buttons and wrap at either end,
 * Home and End go to the ends (`roving`, widgets/primitives/roving.ts).
 *
 * Its buttons are its own: the zoom buttons, Find a zone, Go to my time zone, Look at and the
 * credits button. A button that does not show (Go to my time zone before a zone is known, Reset on
 * a narrow phone) is skipped. The Look at bar and the credits popup are not part of it: Tab goes
 * into them from their button, as before.
 *
 * `aria-orientation` follows the layout: the stack is a column, except the hero's on a screen
 * where the landing is not locked (`HOME_LOCKED_QUERY`), where globe-phone.module.css lays it in
 * a row. Either pair of arrow keys works in both.
 */
import { roving } from "~/widgets/primitives/roving";
import { HOME_LOCKED_QUERY } from "./home-carousel";

const ITEMS = ":scope > button, :scope > [data-disclosure] > button";

export function wireGlobeToolbar(
  stack: HTMLElement,
  space: boolean,
  signal: AbortSignal,
): void {
  const win = stack.ownerDocument.defaultView;
  roving(stack, {
    items: () =>
      [...stack.querySelectorAll<HTMLElement>(ITEMS)].filter(
        (button) => win?.getComputedStyle(button).display !== "none",
      ),
    signal,
  });

  const locked = space ? win?.matchMedia?.(HOME_LOCKED_QUERY) : undefined;
  const orient = (): void =>
    stack.setAttribute(
      "aria-orientation",
      locked && !locked.matches ? "horizontal" : "vertical",
    );
  orient();
  locked?.addEventListener?.("change", orient, { signal });
}
