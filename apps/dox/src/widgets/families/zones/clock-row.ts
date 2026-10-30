/**
 * clockRow: one zone's row in the globe's clock list, and the sizer the rows sit in.
 *
 * A row is a `listboxOption` of the kit's `<gmt-listbox>`: a name over a line of day shift,
 * date and live time, with the offset and a DST mark on the name line. The list fills the
 * empty fields once a second; the builder writes them empty so the row is the same height
 * before and after its first reading. `data-field` names each one for the list's writes.
 *
 * The sizer is the box the virtualizer gives the full list height to, so the scroll bar is
 * right while only the rows in view exist.
 */
import { html, type SafeHtml } from "~/widgets/builders";
import {
  listboxOption,
  listboxOptionId,
} from "~/widgets/primitives/listbox/listbox";
import styles from "./clock-row.module.css";

interface ClockRowOptions {
  /** The id of the listbox the row belongs to. */
  listId: string;
  index: number;
  /** The IANA zone id; it is the option's value and the row's first line. */
  zone: string;
  selected?: boolean;
}

/** The fields a row's live readings are written to. */
const CLOCK_FIELDS = ["dst", "offset", "shift", "date", "time"] as const;
export type ClockField = (typeof CLOCK_FIELDS)[number];

export function clockRow(o: ClockRowOptions): SafeHtml {
  return listboxOption({
    id: listboxOptionId(o.listId, o.index),
    index: o.index,
    value: o.zone,
    selected: o.selected === true,
    className: styles.row,
    children: html`<span class="${styles.line}"
        ><span class="${styles.name}">${o.zone}</span
        ><span class="${styles.dst}" data-field="dst" data-gate="live"></span
        ><span class="${styles.offset}" data-field="offset" data-gate="live"></span></span
      ><span class="${styles.line}" data-gate="live"
        ><span class="${styles.shift}" data-field="shift" data-gate="live"></span
        ><span class="${styles.date}" data-field="date" data-gate="live"></span
        ><span class="${styles.time}" data-field="time" data-gate="live"></span
      ></span>`,
  });
}

/** The box that takes the list's full height; the rows are positioned inside it. */
export function clockSizer(): SafeHtml {
  return html`<div class="${styles.sizer}" data-clock-sizer></div>`;
}
