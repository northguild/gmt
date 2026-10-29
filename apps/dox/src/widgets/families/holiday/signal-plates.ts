/**
 * signalPlates: a row of captioned results, like the kit's `plates`, where a plate the
 * library could not place reads "NO SIGNAL" in the amber family instead of a muted
 * "no result". Moving Feasts uses it because a date the library returned nothing for is the
 * signal-lost state (invariant 7), not an empty answer.
 *
 * A `<dl>`: each plate is a term (the caption) with its value and line. Caption and value
 * reserve the widest text they can show in one grid cell, so a plate holds still while the
 * year is dragged.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./signal-plates.module.css";

/** What a plate reads when the library placed nothing. */
export const SIGNAL_TEXT = "⟨ NO SIGNAL ⟩";

export interface SignalPlate {
  /** The term. Required. */
  caption: string;
  /** The answer in words, or `null` when the library returned nothing. */
  value: string | null;
  /** A line under the value; blank when there is no signal. */
  line: string;
  series: 1 | 2 | 3;
  /** The widest values the plate can show. */
  samples: readonly string[];
}

function plate(p: SignalPlate): SafeHtml {
  const lost = p.value === null;
  return html`<div
    class="${styles.plate}"
    data-state="${lost ? "signal" : "live"}"
    data-series="${String(p.series)}"
    ><dt class="${styles.caption}">${p.caption}</dt
    ><dd class="${styles.value}"
      ><span class="${styles.shown}">${lost ? SIGNAL_TEXT : p.value}</span
      >${[...new Set([...p.samples, SIGNAL_TEXT])].map(
        (sample) =>
          html`<span class="${styles.ghost}" aria-hidden="true">${sample}</span>`,
      )}</dd
    ><dd class="${styles.line}">${lost ? "" : p.line}</dd></div
  >`;
}

export function signalPlates(
  list: readonly SignalPlate[],
  o: GateOption = {},
): SafeHtml {
  return html`<dl class="${styles.row}" ${gateAttr(o.gate)}>${list.map(plate)}</dl>`;
}
