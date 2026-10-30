/**
 * codeToken: a syntax-token span in a call line the mounts build. The colours are the global
 * `gmt-code-*` classes (gmt-widget-reset.css), sampled from the site's own Shiki output so a
 * built call line matches every static code fence.
 * Quotes stay as typed, so a call line reads the same in the markup as on screen.
 */
import { html, raw, type SafeHtml } from "./html";

export function codeToken(kind: "fn" | "str" | "num", text: string): SafeHtml {
  return html`<span class="gmt-code-${kind}">${raw(text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))}</span>`;
}
