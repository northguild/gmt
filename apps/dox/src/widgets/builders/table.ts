/**
 * table: a captioned data table.
 *
 * Pattern: WAI-ARIA APG Table, https://www.w3.org/WAI/ARIA/apg/patterns/table/
 * The native `<table>` carries the semantics: `<caption>`, `<th scope="col">`,
 * and an optional `<th scope="row">` column. It sits in a scrollable box that is a
 * named `region` with `tabindex="0"`, so a keyboard reader can scroll it (axe
 * `scrollable-region-focusable`). Columns are typed; alignment and numeric state
 * are written as classes on each cell.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type HtmlValue, type SafeHtml } from "./html";
import styles from "./table.module.css";

export interface Column<K extends string> {
  key: K;
  header: string;
  align: "start" | "end";
  numeric: boolean;
}

export interface TableOptions<K extends string> extends GateOption {
  /** The table's name. Required. */
  caption: string;
  columns: readonly Column<K>[];
  rows: readonly Record<K, HtmlValue>[];
  /** The column whose cells are row headers. */
  rowHeader?: K;
}

export function table<K extends string>(o: TableOptions<K>): SafeHtml {
  const cls = (c: Column<K>): string =>
    [
      c.align === "end" ? styles.end : styles.start,
      c.numeric ? styles.numeric : "",
    ]
      .filter(Boolean)
      .join(" ");
  return html`<div class="${styles.wrap}" role="region" ${gateAttr(o.gate)} aria-label="${o.caption}" tabindex="0"
    ><table class="${styles.table}"
      ><caption class="${styles.caption}">${o.caption}</caption
      ><thead
        ><tr>${o.columns.map(
          (c) =>
            html`<th class="${styles.head} ${cls(c)}" scope="col">${c.header}</th>`,
        )}</tr
      ></thead
      ><tbody
        >${o.rows.map(
          (row) =>
            html`<tr
              >${o.columns.map((c) =>
                c.key === o.rowHeader
                  ? html`<th class="${styles.cell} ${cls(c)}" scope="row">${row[c.key]}</th>`
                  : html`<td class="${styles.cell} ${cls(c)}">${row[c.key]}</td>`,
              )}</tr
            >`,
        )}</tbody
      ></table
    ></div
  >`;
}
