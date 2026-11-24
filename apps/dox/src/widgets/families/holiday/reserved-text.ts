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
  /**
   * Writes a text as markup that can break, such as `instant`. The live text and every sample go
   * through it, so the held cell wraps where a plate does and keeps the tallest sample's height.
   */
  format?: (text: string) => SafeHtml;
}

export function reservedText(o: ReservedTextOptions): SafeHtml {
  const state = o.state ?? "live";
  const write = o.format ?? ((text: string) => html`${text}`);
  const held = o.format ? `${styles.held} ${styles.wraps}` : styles.held;
  return html`<span class="${held}" ${gateAttr(o.gate)}
    ><span class="${styles.shown}" data-state="${state}">${write(o.text)}</span
    >${[...new Set(o.samples)].map(
      (sample) =>
        html`<span class="${styles.ghost}" aria-hidden="true" data-pagefind-ignore>${write(sample)}</span>`,
    )}</span
  >`;
}
