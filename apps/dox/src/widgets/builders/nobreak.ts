/**
 * nobreak: text that must not break across lines (a date wraps after its hyphen otherwise).
 *
 * `gmt-nobreak` is a global class: Markdown pages carry the same span (`gmt-content.css`), so
 * one definition serves both.
 */
import { html, type SafeHtml } from "./html";

export function nobreak(inner: SafeHtml): SafeHtml {
  return html`<span class="gmt-nobreak">${inner}</span>`;
}
