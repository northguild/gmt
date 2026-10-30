/**
 * idRows: the table of what each decoder was called with and what it returned.
 *
 * A captioned table in a named, focusable region. A row's state (`pending`, `read`,
 * `sentinel`, `not-called`) is a `data-state` the style reads; the format cell is the row
 * header and says in words whether the row read. The call and returned cells are holds that
 * reserve the longest thing each can show, and the table is fixed, so a result never moves a
 * column. Below a container width each row becomes a labelled block.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import { hold, type Ghost } from "./hold";
import styles from "./id-rows.module.css";

type IdRowState = "pending" | "read" | "sentinel" | "not-called";

export interface IdRowView {
  fn: string;
  format: string;
  state: IdRowState;
  /** "Read", "Not read" or empty before the first reading. */
  status: string;
  call: HtmlValue;
  returned: HtmlValue;
}

interface IdRowsOptions extends GateOption {
  /** The table's name. Required. */
  caption: string;
  rows: readonly IdRowView[];
  /** The longest call a row can print. */
  callSamples: readonly Ghost[];
  /** The tallest thing a returned cell can show. */
  returnedSamples: readonly Ghost[];
}

export function idRows(o: IdRowsOptions): SafeHtml {
  return html`<div class="${styles.wrap}" role="region" ${gateAttr(o.gate)} aria-label="${o.caption}" tabindex="0"
    ><table class="${styles.table}"
      ><caption class="${styles.caption}">${o.caption}</caption
      ><thead
        ><tr
          ><th class="${styles.head} ${styles.colFormat}" scope="col">Format</th
          ><th class="${styles.head} ${styles.colCall}" scope="col">Call</th
          ><th class="${styles.head}" scope="col">Returned</th></tr
      ></thead
      ><tbody
        >${o.rows.map(
          (
            r,
          ) => html`<tr class="${styles.row}" data-fn="${r.fn}" data-state="${r.state}"
            ><th class="${styles.cell} ${styles.formatCell}" scope="row" data-label="Format"
              ><span class="${styles.format}">${r.format}</span
              ><span class="${styles.status}">${r.status}</span></th
            ><td class="${styles.cell}" data-label="Call">${hold(r.call, o.callSamples, { ghostClass: styles.text })}</td
            ><td class="${styles.cell}" data-label="Returned">${hold(r.returned, o.returnedSamples, { ghostClass: styles.text })}</td
          ></tr
          >`,
        )}</tbody
      ></table
    ></div
  >`;
}
