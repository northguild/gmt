/**
 * auditTable: one row for each pasted line, with its kind and every reading it allows.
 *
 * The table is fixed-layout, so a new kind or a longer reading never moves a column, and the
 * Kind column reserves the width of the longest label (`kindWidth`, in `ch`). Under a narrow
 * box each row stacks into labelled blocks, so the elements keep explicit table roles that
 * `display: block` would otherwise drop, and each cell names its column in `data-label`.
 *
 * Each row's first cell is a native radio named "Draw line N", with its bare number as the
 * visible face. A kind is always in words as well as in its pattern and colour, and a line the
 * library did not read shows the bracketed NO SIGNAL sentinel, apart from a legitimately empty
 * table, which says so in one row.
 */
import { html, type SafeHtml } from "../../builders/html";
import { srOnly } from "../../builders/sr-only";
import styles from "./audit-table.module.css";

/** What the Kind cell shows for a line that is not a stored time. */
export const LINE_NO_SIGNAL = "⟨ NO SIGNAL ⟩";

export type AuditKind =
  | "valid"
  | "validInOverlap"
  | "offsetMismatch"
  | "ambiguous"
  | "nonexistent";

interface AuditToken {
  name: string;
  value: string;
}

export interface AuditRow {
  /** The line's number, from 1. */
  n: number;
  selected: boolean;
  /** The stored string as read. */
  stored: string;
  /** The kind, or `null` when the library did not read the line. */
  kind: AuditKind | null;
  /** The kind in words. Ignored for a `null` kind. */
  kindText: string;
  /** A mismatch's stored and zone offsets, drawn as one pair before the other readings. */
  pair: { stored: string; zone: string } | null;
  tokens: readonly AuditToken[];
  sentence: string;
}

interface AuditTableOptions {
  /** The table's name. Required. */
  caption: string;
  /** The radios' shared name. */
  group: string;
  /** The longest kind label's length, in characters. */
  kindWidth: number;
  /** What the single row says when there is no line. */
  emptyText: string;
  rows: readonly AuditRow[];
}

/** The stored string, breaking only at the `T`, before the offset and before the `[`. */
function storedHtml(value: string): SafeHtml {
  const cuts: number[] = [];
  const t = value.indexOf("T");
  if (t >= 0) cuts.push(t + 1);
  const off = /(?<=\d)(?=[+-]\d{2}:\d{2})/.exec(value);
  if (off) cuts.push(off.index);
  const br = value.indexOf("[");
  if (br >= 0) cuts.push(br);
  cuts.sort((x, y) => x - y);
  const parts: string[] = [];
  let from = 0;
  for (const at of [...cuts, value.length]) {
    if (at > from) parts.push(value.slice(from, at));
    from = at;
  }
  return html`${parts.map((part, i) => html`${i === 0 ? "" : html`<wbr />`}${part}`)}`;
}

/**
 * A reading value, breaking only directly after the `T` that precedes a digit and directly
 * before the `.` of a fraction. Each stretch between those points is its own nowrap segment,
 * with a `<wbr>` between: Chromium also breaks after a hyphen and `word-break: keep-all` does
 * not stop that, so a hyphen inside a segment has to sit where nothing can break. No character
 * is added to the text.
 */
function readingHtml(value: string): SafeHtml {
  const cuts: number[] = [];
  const t = /T(?=\d)/.exec(value);
  if (t) cuts.push(t.index + 1);
  const dot = /(?<=\d)(?=\.\d)/.exec(value);
  if (dot) cuts.push(dot.index);
  cuts.sort((a, b) => a - b);
  const segs: string[] = [];
  let from = 0;
  for (const at of [...cuts, value.length]) {
    if (at > from) segs.push(value.slice(from, at));
    from = at;
  }
  return html`${segs.map(
    (seg, i) =>
      html`${i === 0 ? "" : html`<wbr />`}<span class="${styles.seg}">${seg}</span>`,
  )}`;
}

function token(name: string, value: string): SafeHtml {
  return html`<li class="${styles.token}"
    ><span class="${styles.tokenName}">${name}</span> <span class="${styles.tokenValue}">${readingHtml(value)}</span></li
  >`;
}

function readings(row: AuditRow): SafeHtml {
  const pair =
    row.pair === null
      ? ""
      : html`<li class="${styles.token}" data-pair="true"
          ><span class="${styles.tokenName}">storedOffset</span> <span class="${styles.tokenValue}">${readingHtml(row.pair.stored)}</span> → <span class="${styles.tokenName}">zoneOffset</span> <span class="${styles.tokenValue}">${readingHtml(row.pair.zone)}</span></li
        >`;
  return html`${
    row.kind === null
      ? ""
      : html`<ul class="${styles.tokens}" role="list">${pair}${row.tokens.map((t) => token(t.name, t.value))}</ul>`
  }<p class="${styles.sentence}">${row.sentence}</p>`;
}

function kindCell(row: AuditRow): SafeHtml {
  return row.kind === null
    ? html`<span class="${styles.nosignal}">${LINE_NO_SIGNAL}</span>`
    : html`<span class="${styles.badge}" data-kind="${row.kind}">${row.kindText}</span>`;
}

function rowHtml(row: AuditRow, group: string): SafeHtml {
  return html`<tr role="row" class="${styles.row}" data-selected="${String(row.selected)}"
    ><td role="cell" data-label="Line"
      ><label class="${styles.radio}"
        ><input
          class="${styles.input}"
          type="radio"
          name="${group}"
          value="${String(row.n)}"
          aria-label="Draw line ${String(row.n)}"
          ${row.selected ? html`checked` : ""}
        /><span class="${styles.face}">${String(row.n)}</span></label
      ></td
    ><td role="cell" data-label="Stored"><code class="${styles.stored}">${storedHtml(row.stored)}</code></td
    ><td role="cell" data-label="Kind">${kindCell(row)}</td
    ><td role="cell" data-label="Readings">${readings(row)}</td
  ></tr
  >`;
}

export function auditTable(o: AuditTableOptions): SafeHtml {
  return html`<div class="${styles.box}"
    ><table class="${styles.table}" role="table"
      ><caption>${srOnly(o.caption)}</caption
      ><thead role="rowgroup"
        ><tr role="row"
          ><th role="columnheader" scope="col" class="${styles.colLine}">Line</th
          ><th role="columnheader" scope="col" class="${styles.colStored}">Stored</th
          ><th role="columnheader" scope="col" class="${styles.colKind}" style="--kind-ch: ${String(o.kindWidth)}">Kind</th
          ><th role="columnheader" scope="col">Readings</th></tr
        ></thead
      ><tbody role="rowgroup"
        >${
          o.rows.length === 0
            ? html`<tr role="row" class="${styles.empty}"><td role="cell" colspan="4">${o.emptyText}</td></tr>`
            : o.rows.map((r) => rowHtml(r, o.group))
        }</tbody
      ></table
    ></div
  >`;
}
