/**
 * windowRows: the window editor for one weekday or one override.
 *
 * A group named by `label` ("Monday", "Override 2") holding one row per window, each a pair of
 * native text inputs ("Monday window 1 from" / "to") and a Remove button, and one Add button.
 * The text is passed as typed: nothing here parses, trims or repairs a time. A refused part is
 * marked in words ("Refused on its own") and by a full bevelled border in the signal tone, never
 * by a left edge alone.
 *
 * Native controls only, so the keyboard model is the browser's: Tab walks the inputs and
 * buttons, Enter and Space press a button. The mount decides where focus goes after a Remove.
 * The list's row count follows the preset, so it carries `data-grow="slot"`.
 */
import { button } from "../../builders/button";
import { html, type SafeHtml } from "../../builders/html";
import { field } from "../../builders/layout";
import { textInput } from "../../builders/text-input";
import styles from "./window-rows.module.css";

/** One window as the reader typed it. */
interface WindowRow {
  from: string;
  to: string;
}

export interface WindowRowsOptions {
  /** Unique within the page: the ids of the group's inputs and buttons derive from it. */
  id: string;
  /** The group's accessible name, and the first words of every control's name. */
  label: string;
  windows: readonly WindowRow[];
  /** The whole group is refused on its own. */
  refused?: boolean;
  /** Indexes of the windows refused on their own. */
  refusedWindows?: readonly number[];
}

/** Longest text either box takes; a time is five characters, and the library says what it takes. */
const WINDOW_TEXT_MAX = 32;

const REFUSED_WORDS = "Refused on its own";

/** The ids the mount finds a group's controls by. */
export const windowIds = (id: string, index: number) => ({
  from: `${id}-from-${index}`,
  to: `${id}-to-${index}`,
  remove: `${id}-remove-${index}`,
});
export const addWindowId = (id: string): string => `${id}-add`;

function windowRow(o: WindowRowsOptions, w: WindowRow, i: number): SafeHtml {
  const ids = windowIds(o.id, i);
  const refused = o.refusedWindows?.includes(i) === true;
  const name = `${o.label} window ${i + 1}`;
  const box = (key: "from" | "to", value: string) =>
    field({
      id: ids[key],
      label: `${name} ${key}`,
      control: (c) =>
        textInput({
          id: c.id,
          value,
          spellcheck: false,
          autocomplete: "off",
          maxLength: WINDOW_TEXT_MAX,
        }),
    });
  return html`<div class="${styles.row}" data-window="${String(i)}" ${refused ? html`data-refused` : ""}>
    ${box("from", w.from)}${box("to", w.to)}
    ${button({ id: ids.remove, label: `Remove ${name}` })}
    <p class="${styles.marker}" data-marker ${refused ? "" : html`hidden`}>${REFUSED_WORDS}</p>
  </div>`;
}

/**
 * Marks a group's refused parts after the library answered, without redrawing the inputs, so
 * the caret and an IME composition stay where they are. The state is a `data-refused`
 * attribute and the marker's `hidden`, which this sets and the stylesheet reads.
 */
export function markRefused(
  group: HTMLElement,
  refused: boolean,
  refusedWindows: readonly number[] = [],
): void {
  const set = (el: Element, on: boolean): void => {
    el.toggleAttribute("data-refused", on);
    const marker = el.querySelector<HTMLElement>(":scope > [data-marker]");
    if (marker) marker.hidden = !on;
  };
  set(group, refused);
  group.querySelectorAll<HTMLElement>("[data-window]").forEach((row) => {
    set(row, refusedWindows.includes(Number(row.dataset["window"])));
  });
}

export function windowRows(o: WindowRowsOptions): SafeHtml {
  return html`<div
    class="${styles.root}"
    role="group"
    aria-label="${o.label}"
    data-grow="slot"
    ${o.refused === true ? html`data-refused` : ""}
  >
    <p class="${styles.title}" aria-hidden="true">${o.label}</p>
    <p class="${styles.marker}" data-marker ${o.refused === true ? "" : html`hidden`}>${REFUSED_WORDS}</p>
    ${html`${o.windows.map((w, i) => windowRow(o, w, i))}`}
    ${button({ id: addWindowId(o.id), label: `Add ${o.label} window` })}
  </div>`;
}
