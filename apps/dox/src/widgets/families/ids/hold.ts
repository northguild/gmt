/**
 * hold: a live region that keeps the box of the largest thing it can show.
 *
 * The live content and every ghost share one grid cell, so the cell is as wide and as tall
 * as the widest and tallest of them and a result that changes never moves a neighbour. A
 * ghost is hidden from sight and from assistive technology. A plain string ghost writes its
 * text in a `data-sample` attribute and a pseudo-element draws it, so the text is in no node
 * a reader or a test can find twice. A markup ghost (an instant, with its break points)
 * carries real nodes so that it wraps as the live one does.
 *
 * `ghostClass` is the live content's own class, so a ghost sets in the same type.
 */
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import styles from "./hold.module.css";

export type Ghost = string | SafeHtml;

export interface HoldOptions {
  /** A class from the caller's module that gives a ghost the live content's type. */
  ghostClass?: string;
}

export function hold(
  live: HtmlValue,
  ghosts: readonly Ghost[],
  o: HoldOptions = {},
): SafeHtml {
  const cls = o.ghostClass ?? "";
  return html`<div class="${styles.root}" data-gate="hold"><div class="${styles.live}">${live}</div>${ghosts.map(
    (g) =>
      typeof g === "string"
        ? html`<span class="${styles.ghost} ${cls}" aria-hidden="true" data-sample="${g}"></span>`
        : html`<span class="${styles.ghost} ${cls}" aria-hidden="true">${g}</span>`,
  )}</div>`;
}
