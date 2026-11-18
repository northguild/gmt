/**
 * Scroll ticks: a scrolling list plays a list step (`listStep`, the servo tick) each time the
 * reader's own scroll carries the top of the view into another row, so a wheel, a swipe or the
 * scrollbar ticks through the rows the way the arrow keys step through them. The step goes down or
 * up with the scroll and is pitched by how far down the list the view sits.
 *
 * Only the reader's own scroll ticks. A `wheel`, `touchstart` or `pointerdown` on the scroller
 * arms it. Any `keydown`, or a `pointerdown` outside the scroller (both seen on the document,
 * capture), hands scrolling back to code, and so does `quiet()`. So a key that moves focus and
 * scrolls its row in (which ticks for the step itself), or a host scrolling to a choice, is
 * silent. With `keys`, a scroll key the browser scrolls the list by (pressed on the scroller or
 * on something inside it, not taken by a control and not typed into a field) arms it too.
 *
 * No clock is read: a tick is a row passed, not a time.
 */

import { listStep } from "./list-step";

/** The keys a focused scroll box scrolls by natively. */
const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  " ",
]);

export interface ScrollTicksOptions {
  /** The distance from one row to the next, in px; 0 or less while no row is laid out. */
  rowPitch(): number;
  /** True when the browser's own key scrolling (arrows, pages, Home, End, Space) moves the list. */
  keys?: boolean;
  signal: AbortSignal;
}

export interface ScrollTicks {
  /** Hand scrolling back to code: the next scroll is a host's, until the reader scrolls again. */
  quiet(): void;
}

/** Tick through the rows of `scroller` as the reader scrolls it. */
export function scrollTicks(
  scroller: HTMLElement,
  options: ScrollTicksOptions,
): ScrollTicks {
  const { rowPitch, keys = false, signal } = options;
  let reader = false;
  let row = 0;
  const arm = (): void => {
    reader = true;
  };
  for (const type of ["wheel", "touchstart", "pointerdown"])
    scroller.addEventListener(type, arm, { passive: true, signal });
  const disarm = (event: Event): void => {
    if (
      event.type === "keydown" ||
      !(event.target instanceof Node) ||
      !scroller.contains(event.target)
    )
      reader = false;
  };
  for (const type of ["keydown", "pointerdown"])
    scroller.ownerDocument.addEventListener(type, disarm, {
      capture: true,
      signal,
    });
  // Bubbling, so a control inside that takes the key for itself has said so by now.
  if (keys)
    scroller.addEventListener(
      "keydown",
      (event) => {
        if (
          !event.defaultPrevented &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          SCROLL_KEYS.has(event.key) &&
          !isTyping(event.target)
        )
          reader = true;
      },
      { signal },
    );
  scroller.addEventListener(
    "scroll",
    () => {
      const pitch = rowPitch();
      if (pitch <= 0) return;
      const now = Math.floor(scroller.scrollTop / pitch);
      if (now !== row && reader)
        listStep(
          now > row,
          scroller.scrollTop / (scroller.scrollHeight - scroller.clientHeight),
        );
      row = now;
    },
    { passive: true, signal },
  );
  return {
    quiet() {
      reader = false;
    },
  };
}

/** Whether keys pressed on `target` go into a field rather than scroll the page. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select") !== null)
  );
}

/**
 * The row pitch of a list: from the first row's top to the next row's top below it (rows side by
 * side in a grid share a top), or the first row's height when there is no row below.
 */
export function pitchOfRows(rows: readonly Element[]): number {
  const [first, ...rest] = rows;
  if (!first) return 0;
  const box = first.getBoundingClientRect();
  for (const row of rest) {
    const gap = row.getBoundingClientRect().top - box.top;
    if (gap >= 1) return gap;
  }
  return box.height;
}
