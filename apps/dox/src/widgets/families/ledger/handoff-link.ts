/**
 * handoffLink: an anchor that looks like the kit's button and goes to another tool. The kit
 * `button` is a `<button>`, which cannot navigate. With no `href` the link is disabled: it
 * keeps its place, drops its link role and says `aria-disabled`, and the hint beside it says why.
 */
import { html, type SafeHtml } from "../../builders/html";
import styles from "./handoff-link.module.css";

interface HandoffLinkOptions {
  id: string;
  label: string;
  href?: string | undefined;
  describedBy?: string | undefined;
}

export function handoffLink(o: HandoffLinkOptions): SafeHtml {
  return html`<a
    class="${styles.link}"
    id="${o.id}"
    ${o.href === undefined ? html`aria-disabled="true"` : html`href="${o.href}"`}
    ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
  >${o.label}</a>`;
}
