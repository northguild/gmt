/**
 * reservedText: a short word or date that changes in place and never changes the width or
 * height of what holds it. The live text and every text it can say sit in one grid cell, the
 * others hidden, so the cell is as wide and as tall as the longest.
 *
 * `signal` is the library's no-result state (amber, in words); `off` keeps the room and shows
 * nothing, for a slot that comes and goes. Amber is the sentinel's alone.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./reserved-text.module.css";

type ReservedState = "live" | "signal" | "off";

interface ReservedTextOptions extends GateOption {
  text: string;
  state?: ReservedState;
  /** Every text this slot can say, to reserve the widest and tallest. */
  samples: readonly string[];
}

export function reservedText(o: ReservedTextOptions): SafeHtml {
  const state = o.state ?? "live";
  return html`<span class="${styles.held}" ${gateAttr(o.gate)}
    ><span class="${styles.shown}" data-state="${state}">${o.text}</span
    >${[...new Set(o.samples)].map(
      (sample) =>
        html`<span class="${styles.ghost}" aria-hidden="true" data-pagefind-ignore>${sample}</span>`,
    )}</span
  >`;
}
