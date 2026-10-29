/**
 * handoffTable: the hand-offs of a journey, one row for each, in a table that keeps its height.
 *
 * It reserves `reserve` rows. A row with no hand-off is blank: `aria-hidden` and invisible, but
 * it holds its box, so a preset with fewer hand-offs does not move what is under the table. When
 * there is nothing to show, `empty` says why over the reserved rows.
 *
 * The roles are written out (`table`, `row`, `cell`, ...). A narrow container stacks each row as
 * "label: value" lines with `display: block`, which would drop a native table's semantics; the
 * explicit roles keep them. The wrapper is a named, focusable region so a table wider than its
 * container scrolls by keyboard.
 */
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import styles from "./handoff-table.module.css";

const NBSP = " ";

export interface HandoffTableOptions {
  /** The table's name, read by the region and the table. Required. */
  caption: string;
  columns: readonly string[];
  /** Each row's cells, in column order. */
  rows: readonly (readonly HtmlValue[])[];
  /** The number of rows to hold, shown or blank. */
  reserve: number;
  /** The words for a table with no row to show; blank for none. */
  empty?: string;
  /** The id of the body, so the widget can redraw the rows. */
  bodyId: string;
  /** The id of the empty message. */
  emptyId: string;
}

function blankRow(columns: readonly string[]): SafeHtml {
  return html`<div role="row" class="${styles.row}" data-blank aria-hidden="true">${columns.map(
    (c) =>
      html`<span role="cell" class="${styles.cell}" data-label="${c}">${NBSP}</span>`,
  )}</div>`;
}

/** The body rows alone: the part the widget redraws. */
export function handoffRows(
  columns: readonly string[],
  rows: readonly (readonly HtmlValue[])[],
  reserve: number,
): SafeHtml {
  return html`${Array.from({ length: reserve }, (_, i) => {
    const cells = rows[i];
    if (cells === undefined) return blankRow(columns);
    return html`<div role="row" class="${styles.row}">${columns.map(
      (c, k) =>
        html`<span role="cell" class="${styles.cell}" data-label="${c}">${cells[k] ?? ""}</span>`,
    )}</div>`;
  })}`;
}

export function handoffTable(o: HandoffTableOptions): SafeHtml {
  return html`<div class="${styles.wrap}" role="region" aria-label="${o.caption}" tabindex="0"
    ><div class="${styles.table}" role="table" aria-label="${o.caption}"
      ><div role="rowgroup" class="${styles.head}"
        ><div role="row" class="${styles.row}">${o.columns.map(
          (c) =>
            html`<span role="columnheader" class="${styles.heading}">${c}</span>`,
        )}</div></div
      ><div role="rowgroup" id="${o.bodyId}">${handoffRows(o.columns, o.rows, o.reserve)}</div></div
    ><div id="${o.emptyId}" class="${styles.slot}">${handoffEmpty(o.empty ?? "")}</div></div
  >`;
}

/** The words that stand over the reserved rows. */
export function handoffEmpty(text: string): SafeHtml {
  return text === "" ? html`` : html`<p class="${styles.empty}">${text}</p>`;
}
