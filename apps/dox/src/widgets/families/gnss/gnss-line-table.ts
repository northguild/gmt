/**
 * gnssLineTable: one row for each clock or counter, every cell two lines.
 *
 * The first line of a cell is its value and the second is a note under it (a "derived" tag,
 * a "written as" line, "your receiver"). Both lines are always drawn and the second reserves
 * two lines of height, so a row keeps one height whether or not the note has words. A blank
 * line is a no-break space.
 *
 * `table-layout: fixed` is load-bearing (see `gnssCounterTable`): the module sets it. Under a
 * container width the table stacks into rows, each cell carrying its column's name from
 * `data-label`, so the explicit roles stay on the elements. The reading's own row has a tint
 * and a hatch, and its words ("your reading") come from the note the caller writes.
 */
import { html, raw, type SafeHtml } from "../../builders/html";
import { srOnly } from "../../builders/sr-only";
import styles from "./gnss-line-table.module.css";

export interface LineCell {
  text: string;
  /** The note under it; empty keeps the line's height. */
  sub: string;
}

export interface LineRow {
  /** The row header's two lines. */
  name: LineCell;
  /** This row is the reading's own. */
  yours: boolean;
  /** One cell for each column after the first. */
  cells: readonly LineCell[];
}

export interface GnssLineTableOptions {
  /** The table's name. Required. */
  caption: string;
  /** Every column header, the row header's first. */
  columns: readonly string[];
  rows: readonly LineRow[];
}

const BLANK = raw("&nbsp;");

function lines(cell: LineCell): SafeHtml {
  return html`<span class="${styles.line}">${cell.text === "" ? BLANK : cell.text}</span> <span class="${styles.sub}">${cell.sub === "" ? BLANK : cell.sub}</span>`;
}

/** The two lines of a cell with nothing in them. */
export const BLANK_LINE_CELL: LineCell = { text: "", sub: "" };

export function gnssLineTable(o: GnssLineTableOptions): SafeHtml {
  const [first = "", ...rest] = o.columns;
  return html`<div class="${styles.box}" role="region" aria-label="${o.caption}" tabindex="0"
    ><table class="${styles.table}" role="table"
      ><caption>${srOnly(o.caption)}</caption
      ><thead role="rowgroup"
        ><tr role="row">${o.columns.map(
          (c) => html`<th role="columnheader" scope="col">${c}</th>`,
        )}</tr></thead
      ><tbody role="rowgroup"
        >${o.rows.map(
          (row) =>
            html`<tr role="row" data-reading="${String(row.yours)}"
              ><th role="rowheader" scope="row" data-label="${first}">${lines(row.name)}</th
              >${rest.map(
                (column, i) =>
                  html`<td role="cell" data-label="${column}">${lines(row.cells[i] ?? BLANK_LINE_CELL)}</td>`,
              )}</tr
            >`,
        )}</tbody
      ></table
    ></div
  >`;
}
