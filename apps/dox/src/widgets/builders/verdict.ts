/**
 * verdict: the one-line answer under a result ("on time", "misses the cut-off").
 *
 * A `<p>` with a bold title and its detail. It has no live behaviour of its own:
 * put it inside the `<gmt-readout>` or the live region that already announces
 * the result. The tone is drawn as a full bevelled border with a tinted fill and
 * a heavier bottom edge, never a one-sided left stripe (invariant 13). The word
 * in `title` carries the meaning, so the colour is never alone.
 */
import { html, type SafeHtml } from "./html";
import styles from "./verdict.module.css";

export type VerdictTone = "neutral" | "good" | "bad";

export interface VerdictOptions {
  tone: VerdictTone;
  /** The answer in a few words. Required. */
  title: string;
  /** The reason, in a sentence. */
  detail: string;
}

export function verdict(o: VerdictOptions): SafeHtml {
  return html`<p class="${styles.root}" data-tone="${o.tone}"
    ><strong class="${styles.title}">${o.title}</strong
    > <span class="${styles.detail}">${o.detail}</span></p
  >`;
}

/**
 * Writes a new tone, title and detail into a verdict `verdict` already put on the page, in place,
 * so a live readout replaces no node. `el` is the verdict's `<p>`.
 */
export function paintVerdict(el: Element, o: VerdictOptions): void {
  el.setAttribute("data-tone", o.tone);
  const [title, detail] = Array.from(el.children);
  if (title && title.textContent !== o.title) title.textContent = o.title;
  if (detail && detail.textContent !== o.detail) detail.textContent = o.detail;
}
