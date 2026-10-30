/**
 * codeFrame: a code block with a copy button (`<gmt-copy>`).
 *
 * The frame is a named `group`. A line that can scroll is a keyboard stop:
 * `scrollable` (default true, because a call line is rarely short) writes
 * `tabindex="0"` on the `<pre>`, as axe's `scrollable-region-focusable` requires.
 * Pass `scrollable: false` for a frame whose content is known to fit.
 *
 * `code` is the initial content as `SafeHtml` (highlight spans from a builder);
 * the mount fills it after that with `setHtml`.
 */
import { copy } from "../primitives/copy/copy";
import styles from "./code-frame.module.css";
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";

export interface CodeFrameOptions extends GateOption {
  /** The frame's name, such as "Live call". Required. */
  label: string;
  /** What the copy button copies. */
  copyText: string;
  /** The copy button's name. Defaults to "Copy". */
  copyLabel?: string;
  code?: SafeHtml;
  scrollable?: boolean;
  /**
   * The most lines the mount will ever fill. The frame holds that many lines of height, so a
   * call list that grows or shrinks with a drag never moves what sits below it.
   */
  minLines?: number;
}

export function codeFrame(o: CodeFrameOptions): SafeHtml {
  return html`<div class="${styles.root}" role="group" ${gateAttr(o.gate)} aria-label="${o.label}"
    ><span class="${styles.copy}"
      >${copy({ label: o.copyLabel ?? "Copy", text: o.copyText })}</span
    ><pre class="${styles.pre}" ${(o.scrollable ?? true) ? html`tabindex="0"` : ""}
      ><code class="${styles.code}" ${o.minLines === undefined ? "" : html`style="--min-lines: ${String(Math.max(1, Math.floor(o.minLines)))}"`}>${o.code ?? ""}</code></pre
    ></div
  >`;
}
