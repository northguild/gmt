/**
 * dstBadge and dstTable: the DST transitions of one zone and year.
 *
 * A badge names the kind of a transition in words (Gap or Overlap), so the colour is never
 * the only carrier. The table is the kit's `table`, with the badge and the offset arrow in
 * its cells. A zone with no transitions has no table to draw: it gets one sentence that is
 * a polite status, because the kit's table has no row that spans its columns.
 */
import { html, type SafeHtml } from "../../builders/html";
import { table, type Column } from "../../builders/table";
import styles from "./dst-table.module.css";

export type DstKind = "gap" | "overlap";

export interface DstRow {
  kind: DstKind;
  date: string;
  hour: string;
  instant: string;
  before: string;
  after: string;
}

export const DST_EMPTY_TEXT = "No DST transitions in this zone/year.";

export function dstBadge(kind: DstKind): SafeHtml {
  return html`<span class="${styles.badge}" data-kind="${kind}"
    >${kind === "gap" ? "Gap" : "Overlap"}</span
  >`;
}

type Key = "type" | "date" | "hour" | "instant" | "offset";

const COLUMNS: readonly Column<Key>[] = [
  { key: "type", header: "Type", align: "start", numeric: false },
  { key: "date", header: "Local Date", align: "start", numeric: false },
  { key: "hour", header: "Local Hour", align: "start", numeric: true },
  { key: "instant", header: "UTC Instant", align: "start", numeric: false },
  {
    key: "offset",
    header: "Offset Before → After",
    align: "start",
    numeric: false,
  },
];

export function dstTable(rows: readonly DstRow[]): SafeHtml {
  if (rows.length === 0) {
    return html`<p class="${styles.empty}" role="status">${DST_EMPTY_TEXT}</p>`;
  }
  return table({
    caption: "DST transitions",
    columns: COLUMNS,
    rows: rows.map((r) => ({
      type: dstBadge(r.kind),
      date: r.date,
      hour: r.hour,
      instant: html`<span class="${styles.mono}">${r.instant}</span>`,
      offset: html`<span class="${styles.mono}"
        >${r.before} <span class="${styles.arrow}" data-kind="${r.kind}">→</span> ${r.after}</span
      >`,
    })),
  });
}
