/**
 * countdownFace: the headline reading of a countdown, the time left (or gone) to a cut-off.
 *
 * A `<figure>` named by its caption, holding a `<gmt-readout>` and the ISO duration the
 * library returned. The readout reserves the width of its widest `samples` in tabular
 * figures, so a face that changes every second never resizes its box. The mount writes the
 * text by setting the readout's `value` and never sends it a `change` or calls `announce()`,
 * so a once-a-second tick is silent; a separate, visually hidden summary speaks once a minute.
 *
 * An empty `value` is the sentinel (amber, "NO SIGNAL"), as the readout draws it.
 * `data-live` is `"true"` while the clock is the reader's own.
 */
import { html, type SafeHtml } from "../../builders/html";
import { readout } from "../../primitives/readout/readout";
import styles from "./countdown-face.module.css";

export interface CountdownFaceOptions {
  /** The figure's id; the ISO line is `<id>-iso`. */
  id: string;
  /** What the value is, such as "Time to cut-off". Required. */
  caption: string;
  /** The text shown; an empty string is the sentinel. */
  value: string;
  /** The ISO duration `timeToCutoff` returned, or an empty string. */
  iso: string;
  /** The widest values it will show. */
  samples: readonly string[];
  live: boolean;
  gate?: string;
}

export function countdownFace(o: CountdownFaceOptions): SafeHtml {
  return html`<figure class="${styles.root}" id="${o.id}" data-live="${String(o.live)}"
    ><figcaption class="${styles.caption}">${o.caption}</figcaption
    >${readout({ label: o.caption, value: o.value, samples: o.samples, ...(o.gate === undefined ? {} : { gate: o.gate }) })}<p class="${styles.iso}" id="${o.id}-iso">${o.iso}</p></figure
  >`;
}
