/**
 * storedTable: the Worker's answer for the saved-events section, one row to a line: a status pill,
 * the value as saved, and what to do. Wide, it is a table. Narrow, each row stacks into a small
 * card (the header row stays for screen readers), and no box is wider than the column, so the
 * page never scrolls sideways at 375 px.
 *
 * A line the library did not read shows the bracketed NO SIGNAL sentinel, never a blank pill. A
 * line in a zone the checking data is stale for gets no verdict and no advice. The mount hides a
 * row with the `hidden` property for the "Only moved" filter, so a row's state is never read
 * back from the markup. Rows with readings carry a kit disclosure; the mount wires each
 * (`[data-disclosure]`).
 */
import {
  storedAdvice,
  storedBadge,
  storedFix,
  storedZoneOf,
} from "~/lib/clock-change-stored-lines";
import type { StoredRow } from "~/lib/clock-change-stored-lines";
import { codeBreakClass, codeBreakHtml } from "~/lib/code-break";
import type { readingsOf } from "~/lib/stored-time-audit";
import { badge, type BadgeTone } from "../../builders/badge";
import { disclosure } from "../../builders/disclosure";
import { gateAttr } from "../../builders/gate";
import { html, raw, type SafeHtml } from "../../builders/html";
import { idScope } from "../../builders/ids";
import { copy } from "../../primitives/copy/copy";
import { noSignal } from "./marks";
import styles from "./stored-table.module.css";

const TONES: Record<ReturnType<typeof storedBadge>["tone"], BadgeTone> = {
  ok: "cyan",
  bad: "danger",
  unknown: "neutral",
  none: "neutral",
};

interface StoredTableOptions {
  idPrefix: string;
  rows: readonly StoredRow[];
  /** `readingsOf` from the audit module, which loads on the first answer. */
  readings: typeof readingsOf;
  /** Zones the checking data is stale for. */
  staleZones: ReadonlySet<string>;
}

/** The status text of a row, as the pill says it. */
function pill(row: StoredRow, stale: boolean): SafeHtml {
  if (row.result === null) {
    return noSignal();
  }
  const b = storedBadge(row.result, stale);
  return badge({
    text: b.mark === "" ? b.label : `${b.mark} ${b.label}`,
    tone: TONES[b.tone],
    dim: b.tone === "unknown",
  });
}

function todo(row: StoredRow, stale: boolean): SafeHtml {
  if (stale)
    return html`<p class="${styles.alt}">Try again after the update.</p>`;
  const fix = storedFix(row.value, row.result);
  if (fix === null)
    return html`<p>${storedAdvice(row.value, row.result).todo}</p>`;
  return html`<p class="${styles.fix}"
      ><span>Keep ${fix.localHm} local: store <code>${fix.keepLocal}</code></span
      >${copy({ label: `Copy ${fix.keepLocal}`, text: fix.keepLocal })}</p
    >${
      fix.oldLocal === null
        ? ""
        : html`<p class="${styles.alt}">Or keep the old instant (that is ${fix.oldLocal} local).</p>`
    }`;
}

function readingsOfRow(
  o: StoredTableOptions,
  row: StoredRow,
  index: number,
): SafeHtml {
  if (row.result === null) return html``;
  const id = idScope(o.idPrefix);
  return disclosure({
    id: id(`stored-readings-${String(index)}`),
    label: "Readings",
    className: styles.readings ?? "",
    children: html`<dl class="${styles.dl}"
      >${o
        .readings(row.result)
        .map(
          ({ name, value }) =>
            html`<div><dt><code>${name}</code></dt><dd>${value}</dd></div>`,
        )}</dl
    >`,
  });
}

function rowHtml(
  o: StoredTableOptions,
  row: StoredRow,
  index: number,
): SafeHtml {
  const zone = storedZoneOf(row.value);
  const stale = row.result !== null && zone !== null && o.staleZones.has(zone);
  const breakClass = codeBreakClass(row.input);
  return html`<tr
    ><td class="${styles.result}">${pill(row, stale)}</td
    ><td class="${styles.input}"
      ><code class="${breakClass ?? ""}" title="${row.input}">${raw(codeBreakHtml(row.input))}</code></td
    ><td class="${styles.says}">${todo(row, stale)}${stale ? "" : readingsOfRow(o, row, index)}</td
  ></tr
  >`;
}

/** Whether a row, once judged, shows the wrong time: the filter "Only moved" keeps these. */
export function rowMoved(
  row: StoredRow,
  staleZones: ReadonlySet<string>,
): boolean {
  if (row.result === null) return false;
  const zone = storedZoneOf(row.value);
  if (zone !== null && staleZones.has(zone)) return false;
  return !storedAdvice(row.value, row.result).ok;
}

export function storedTable(o: StoredTableOptions): SafeHtml {
  return html`<div class="${styles.box}" ${gateAttr("stored-table")}
    ><table class="${styles.table}"
      ><caption class="${styles.caption}">Saved events, checked</caption
      ><thead
        ><tr
          ><th scope="col">Status</th><th scope="col">Saved event</th><th scope="col">What to do</th></tr
        ></thead
      ><tbody>${o.rows.map((row, i) => rowHtml(o, row, i))}</tbody></table
    ></div
  >`;
}
