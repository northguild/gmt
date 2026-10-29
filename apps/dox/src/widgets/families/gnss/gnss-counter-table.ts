/**
 * gnssCounterTable: the same moment on every counter (or RINEX system), one row each.
 *
 * Every row is always drawn, so the table holds one height from the first paint. A cell the
 * library gave nothing for reads "no result" in the first reading column and is blank in the
 * rest; the reading's own row has a tint and a hatch and says "(your reading)" in words.
 *
 * `table-layout: fixed` is load-bearing: the first column must not shrink to its padding
 * (the content-table rule gives it `width: 1%`), so the module sets it and the first cell's
 * width explicitly. Under a container width the table stacks into rows, each cell carrying its
 * column's name from `data-label`, so the explicit roles stay on the elements: `display: block`
 * would otherwise drop the table semantics.
 */
import { html, raw, type SafeHtml } from "../../builders/html";
import { srOnly } from "../../builders/sr-only";
import styles from "./gnss-counter-table.module.css";

export interface GnssCounterRow {
  /** The counter or system. */
  name: string;
  /** This row is the reading's own. */
  yours: boolean;
  /** One text for each column after the first. An empty string is a blank cell. */
  cells: readonly string[];
}

export interface GnssCounterTableOptions {
  /** The table's name. Required. */
  caption: string;
  /** Every column header, the row header's first. */
  columns: readonly string[];
  rows: readonly GnssCounterRow[];
}

const BLANK = raw("&nbsp;");

export function gnssCounterTable(o: GnssCounterTableOptions): SafeHtml {
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
              ><th role="rowheader" scope="row" data-label="${first}"
                >${row.name}${row.yours ? " (your reading)" : ""}</th
              >${rest.map(
                (column, i) =>
                  html`<td role="cell" data-label="${column}"
                    >${row.cells[i] ? row.cells[i] : BLANK}</td
                  >`,
              )}</tr
            >`,
        )}</tbody
      ></table
    ></div
  >`;
}
