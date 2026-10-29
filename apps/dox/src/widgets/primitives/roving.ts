/**
 * A roving tab stop over a list of controls: the WAI-ARIA APG toolbar and list keyboard model.
 *
 * Exactly one item is in the tab order (`tabindex="0"`), the rest are `-1`. ArrowDown and
 * ArrowRight move to the next item, ArrowUp and ArrowLeft to the previous (both wrap), Home and
 * End go to the ends. Enter and Space stay with the native button, so a click pins as usual. The
 * stop follows focus and follows a click, so a pointer user and a keyboard user share one place.
 *
 * `roving(list, { items, signal })` wires one `keydown` and one `focusin` listener on `list`
 * (both with `{ signal }`) and returns `{ set, current }`: `set(item)` makes an item the tab stop
 * (and focuses it when `focus` is true), `current()` the item that is the stop now. `items()` is
 * read at each key press, so a list that redraws needs no re-wiring.
 *
 * No gmt import, no DOM beyond the elements it is given.
 */

export interface RovingOptions {
  /** The controls in reading order, read at each key press. */
  items: () => readonly HTMLElement[];
  signal: AbortSignal;
}

export interface Roving {
  /** Make `item` the one tab stop, and move focus to it when `focus` is true. */
  set(item: HTMLElement, focus?: boolean): void;
  /** The item that is the tab stop now, or `null` for an empty list. */
  current(): HTMLElement | null;
}

const STEP: Readonly<Record<string, 1 | -1>> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

export function roving(list: HTMLElement, options: RovingOptions): Roving {
  const { items, signal } = options;

  const set = (item: HTMLElement, focus = false): void => {
    for (const other of items()) {
      other.tabIndex = other === item ? 0 : -1;
    }
    if (focus) item.focus();
  };

  const current = (): HTMLElement | null =>
    items().find((item) => item.tabIndex === 0) ?? null;

  /* The pressed item is the stop, or the first when none is: a native button starts at 0. */
  const start =
    items().find((item) => item.getAttribute("aria-pressed") === "true") ??
    items()[0];
  if (start !== undefined) set(start);

  list.addEventListener(
    "keydown",
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const all = items();
      const from = all.findIndex(
        (item) => item === event.target || item.contains(event.target as Node),
      );
      if (from === -1 || all.length === 0) return;
      let to: number;
      if (event.key === "Home") to = 0;
      else if (event.key === "End") to = all.length - 1;
      else {
        const step = STEP[event.key];
        if (step === undefined) return;
        to = (from + step + all.length) % all.length;
      }
      event.preventDefault();
      const target = all[to];
      if (target !== undefined) set(target, true);
    },
    { signal },
  );

  list.addEventListener(
    "focusin",
    (event) => {
      const item = items().find(
        (candidate) =>
          candidate === event.target ||
          candidate.contains(event.target as Node),
      );
      if (item !== undefined && item.tabIndex !== 0) set(item);
    },
    { signal },
  );

  return { set, current };
}
