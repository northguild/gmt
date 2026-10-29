/**
 * dayColumns: a row of local-day columns on a ledger canvas.
 *
 * Each column is placed and sized by its day's real bounds on the canvas, so a 23- or
 * 25-hour day is narrower or wider. It is `role="listitem"` and its `aria-label` says
 * the date, an odd length, the tier and the state in words. The drawn label and chips
 * are `aria-hidden`: the label says it all. A column too narrow for its label loses the
 * weekday, then the label and chips, by a container query on the column itself, so the
 * fit follows the real box in the docs column and the chat rail alike.
 *
 * The list's own element is the lane's `cells` region; this builder writes its items.
 * Alternate columns take a builder-set `zebra` class. A column that falls outside the
 * canvas is left out.
 */
import { html, type SafeHtml } from "../../builders/html";
import { dayLabelParts, type DayMark } from "~/lib/ledger-widgets";
import type { DayCell } from "~/lib/dwell-ledger";
import styles from "./day-columns.module.css";

export interface DayCanvas {
  toPercent(ms: number): number;
}

/** The mark for a date no tool described: a bare column. */
const PLAIN: DayMark = { state: "plain" };

function ariaOf(cell: DayCell, mark: DayMark): string {
  const parts = dayLabelParts(cell.date);
  const odd = cell.hours !== 24;
  const word = mark.aria ?? mark.chip ?? "";
  return (
    `${parts.date}${parts.weekday === "" ? "" : ` ${parts.weekday}`}` +
    `${odd ? `, ${cell.hours} hours` : ""}` +
    `${mark.tier === undefined ? "" : `, tier ${mark.tier}`}` +
    `${word === "" ? "" : `, ${word}`}`
  );
}

function column(
  cell: DayCell,
  canvas: DayCanvas,
  mark: DayMark,
  zebra: boolean,
): SafeHtml | "" {
  const left = canvas.toPercent(cell.startMs);
  const width = Math.max(0, canvas.toPercent(cell.endMs) - left);
  if (!(width > 0)) return "";
  const parts = dayLabelParts(cell.date);
  const odd = cell.hours !== 24;
  const aria = ariaOf(cell, mark);
  const hasChip = mark.chip !== undefined && mark.chip !== "";
  const chips = hasChip || mark.tier !== undefined || odd;
  return html`<div
    class="${styles.day}${zebra ? ` ${styles.zebra}` : ""}"
    role="listitem"
    data-date="${cell.date}"
    data-hours="${String(cell.hours)}"
    data-state="${mark.state}"
    ${mark.kind === undefined ? "" : html`data-kind="${mark.kind}"`}
    ${mark.tier === undefined ? "" : html`data-tier="${String(mark.tier)}"`}
    ${mark.series === undefined ? "" : html`data-series="${String(mark.series)}"`}
    style="--gmt-day-at: ${String(left)}%; --gmt-day-span: ${String(width)}%"
    aria-label="${aria}"
    title="${aria}"
  ><span class="${styles.label}" aria-hidden="true"
    ><span class="${styles.date}">${parts.date}</span
    >${parts.weekday === "" ? "" : html`<span class="${styles.weekday}"> · ${parts.weekday}</span>`}</span
  >${
    chips
      ? html`<span class="${styles.chips}" aria-hidden="true"
          >${hasChip ? html`<span class="${styles.chip}">${mark.chip}</span>` : ""}${
            mark.tier === undefined
              ? ""
              : html`<span class="${styles.chip}">tier ${String(mark.tier)}</span>`
          }${
            odd
              ? html`<span class="${styles.chip} ${styles.odd}" data-dst="${cell.hours < 24 ? "short" : "long"}">${String(cell.hours)} h</span>`
              : ""
          }</span
        >`
      : ""
  }</div
  >`;
}

/** The items of the `cells` list. `states` maps a date to its mark. */
export function dayColumns(
  cells: readonly DayCell[],
  canvas: DayCanvas,
  states: Readonly<Record<string, DayMark | undefined>>,
): SafeHtml {
  let shown = 0;
  const items: (SafeHtml | "")[] = [];
  for (const cell of cells) {
    const item = column(
      cell,
      canvas,
      states[cell.date] ?? PLAIN,
      shown % 2 === 1,
    );
    if (item !== "") shown += 1;
    items.push(item);
  }
  return html`${items}`;
}
