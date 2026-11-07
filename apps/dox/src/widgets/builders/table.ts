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
  /**
   * The column's name. A string is escaped; `SafeHtml` passes through, for a head of two lines (a
   * label and a note). A column of a table with `labelCells` takes a string, because its cells
   * write the name as an attribute.
   */
  header: string | SafeHtml;
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
  /**
   * `"fixed"` lays the columns out once, from the header row, so a cell's text (or a header that
   * changes with a drag) never moves a column edge. Columns share the width equally unless
   * `widths` states them. The default sizes every column from its content.
   */
  layout?: "auto" | "fixed";
  /** With a fixed layout, one width for each column (`"34%"`); the others share what is left. */
  widths?: readonly (string | null)[];
  /** The zero-based row that is the current one: it gets `aria-current="true"`. */
  currentRow?: number;
  /**
   * Write each cell's column header on the cell as `data-col`, so a sheet can turn the rows
   * into labelled blocks on a narrow box (`content: attr(data-col)`).
   */
  labelCells?: boolean;
  /**
   * Write an explicit ARIA role on the table and each part (`table`, `rowgroup`, `row`,
   * `columnheader`, `rowheader`, `cell`). Use it when a consumer changes a table part's `display`
   * (a stacked narrow layout), which drops the native semantics. See the APG Table pattern,
   * https://www.w3.org/WAI/ARIA/apg/patterns/table/; `families/stored/audit-table.ts` is the
   * hand-written precedent.
   */
  roles?: boolean;
}

export function table<K extends string>(o: TableOptions<K>): SafeHtml {
  const cls = (c: Column<K>): string =>
    [
      c.align === "end" ? styles.end : styles.start,
      c.numeric ? styles.numeric : "",
    ]
      .filter(Boolean)
      .join(" ");
  const fixed = o.layout === "fixed";
  const cols = fixed
    ? html`<colgroup
        >${o.columns.map((_, i) => {
          const width = o.widths?.[i] ?? null;
          return width === null
            ? html`<col />`
            : html`<col width="${width}" />`;
        })}</colgroup
      >`
    : html``;
  const role = (name: string): SafeHtml =>
    o.roles === true ? html` role="${name}"` : html``;
  const col = (c: Column<K>): SafeHtml => {
    if (o.labelCells !== true) return html``;
    if (typeof c.header !== "string")
      throw new TypeError(
        `table: column "${c.key}" needs a string header to label its cells`,
      );
    return html` data-col="${c.header}"`;
  };
  return html`<div class="${styles.wrap}" role="region" ${gateAttr(o.gate)} aria-label="${o.caption}" tabindex="0"
    ><table class="${fixed ? `${styles.table} ${styles.fixed}` : styles.table}"${role("table")}
      ><caption class="${styles.caption}">${o.caption}</caption
      >${cols}<thead${role("rowgroup")}
        ><tr${role("row")}>${o.columns.map(
          (c) =>
            html`<th class="${styles.head} ${cls(c)}" scope="col"${role("columnheader")}>${c.header}</th>`,
        )}</tr
      ></thead
      ><tbody${role("rowgroup")}
        >${o.rows.map(
          (row, i) =>
            html`<tr${role("row")}${i === o.currentRow ? html` aria-current="true"` : ""}
              >${o.columns.map((c) =>
                c.key === o.rowHeader
                  ? html`<th class="${styles.cell} ${cls(c)}" scope="row"${role("rowheader")}${col(c)}>${row[c.key]}</th>`
                  : html`<td class="${styles.cell} ${cls(c)}"${role("cell")}${col(c)}>${row[c.key]}</td>`,
              )}</tr
            >`,
        )}</tbody
      ></table
    ></div
  >`;
}
