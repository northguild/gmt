/**
 * hero: a captioned headline value.
 *
 * Markup is a `<figure>` whose `<figcaption>` names the value (HTML's own
 * labelling, no ARIA needed). The caption ink is set here against
 * `--gmt-surface-widget`, which is why no tool rule has to fix it (cause 7). Every
 * `samples` entry shares the value's grid cell, hidden, so the box keeps the width
 * of the widest value while the reader drags (invariant 14).
 *
 * `tone: "sentinel"` is the signal-lost state for invalid input, in amber; it is
 * the only amber (invariant 8). A legitimately empty result uses the default tone.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";
import styles from "./hero.module.css";

export interface HeroOptions extends GateOption {
  /** What the value is. Required. */
  caption: string;
  value: string;
  /** The widest values it will show, to reserve their width. */
  samples?: readonly string[];
  tone?: "default" | "sentinel";
}

export function hero(o: HeroOptions): SafeHtml {
  return html`<figure class="${styles.root}" data-tone="${o.tone ?? "default"}" ${gateAttr(o.gate)}
    ><figcaption class="${styles.caption}">${o.caption}</figcaption
    ><div class="${styles.values}"
      ><p class="${styles.value}">${o.value}</p
      >${(o.samples ?? []).map(
        (sample) =>
          html`<span class="${styles.ghost}" aria-hidden="true">${sample}</span>`,
      )}</div
    ></figure
  >`;
}
