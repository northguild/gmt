/**
 * logTable: one row for each pasted log line, with the instant its label names.
 *
 * Composes the kit's `table`: sized from its content, so no word is ever cut, and a box too
 * narrow for the columns scrolls. It has explicit table roles and a `data-col` on each cell so a
 * narrow box can stack each row into labelled blocks (`log-table.module.css`).
 *
 * Each row's first cell is a native radio named "Read line N", with its bare number as the
 * visible face. The label, the instant and the offset never wrap. The whole row is the click
 * target (the mount forwards a click on it to the radio; the radio stays the keyboard path). The
 * TAI reading is not a column: the selected line's details show it. A line the library did not
 * read says so in words (a badge) and shows the bracketed NO SIGNAL sentinel in its value cells.
 * The selected row is the table's current row (`aria-current`), which the mount moves in
 * place when the radio changes, so the keyboard focus stays on the radio.
 */
import { badge } from "../../builders/badge";
import { html, type SafeHtml } from "../../builders/html";
import { instant } from "../../builders/instant";
import { table, type Column } from "../../builders/table";
import styles from "./log-table.module.css";

/** What a value cell shows for a line the library did not read. */
export const LINE_NO_SIGNAL = "⟨ NO SIGNAL ⟩";

export interface LogRow {
  /** The line's number, from 1. */
  n: number;
  selected: boolean;
  /** The token, as split. May be empty. */
  token: string;
  message: string;
  /** Whether the library read the token. */
  read: boolean;
  utc: string;
  /** TAI minus UTC, as printed ("37 s"). */
  offset: string;
  /** The instant is an inserted second. */
  inserted: boolean;
}

interface LogTableOptions {
  /** The table's name. Required. */
  caption: string;
  /** The radios' shared name. */
  group: string;
  /** What the box says when there is no line. */
  emptyText: string;
  /** The badges' words. */
  noLabelText: string;
  insertedText: string;
  rows: readonly LogRow[];
}

type Key = "line" | "label" | "utc" | "offset" | "message";

const COLUMNS: readonly Column<Key>[] = [
  { key: "line", header: "Line", align: "start", numeric: false },
  { key: "label", header: "Label", align: "start", numeric: false },
  { key: "utc", header: "UTC instant", align: "start", numeric: false },
  { key: "offset", header: "TAI − UTC", align: "end", numeric: true },
  { key: "message", header: "Message", align: "start", numeric: false },
];

function lost(): SafeHtml {
  return html`<span class="${styles.nosignal}">${LINE_NO_SIGNAL}</span>`;
}

function radio(row: LogRow, group: string): SafeHtml {
  return html`<label class="${styles.radio}"
    ><input
      class="${styles.input}"
      type="radio"
      name="${group}"
      value="${String(row.n)}"
      aria-label="Read line ${String(row.n)}"
      ${row.selected ? html`checked` : ""}
    /><span class="${styles.face}">${String(row.n)}</span></label
  >`;
}

export function logTable(o: LogTableOptions): SafeHtml {
  if (o.rows.length === 0) {
    return html`<div class="${styles.box}"><p class="${styles.empty}">${o.emptyText}</p></div>`;
  }
  const current = o.rows.findIndex((r) => r.selected);
  return html`<div class="${styles.box}"
    >${table<Key>({
      caption: o.caption,
      columns: COLUMNS,
      rows: o.rows.map((r) => ({
        line: radio(r, o.group),
        label: html`<code class="${styles.token}">${r.token}</code>${
          r.read
            ? ""
            : html`<span class="${styles.tag}">${badge({ text: o.noLabelText, tone: "neutral", wrap: true })}</span>`
        }`,
        utc:
          r.utc !== ""
            ? html`${instant(r.utc)}${
                r.inserted
                  ? html`<span class="${styles.tag}">${badge({ text: o.insertedText, tone: "cyan", wrap: true })}</span>`
                  : ""
              }`
            : lost(),
        offset: r.offset !== "" ? r.offset : lost(),
        message: r.message,
      })),
      ...(current === -1 ? {} : { currentRow: current }),
      labelCells: true,
      roles: true,
    })}</div
  >`;
}
