/**
 * toolLinks: links from a result to another tool.
 *
 * Pattern: WAI-ARIA APG Link, https://www.w3.org/WAI/ARIA/apg/patterns/link/
 * Each link starts without an `href` and `aria-disabled="true"`; `setToolLink`
 * (lib/widget-ui.ts) gives it one once the widget has a result to send. The row is
 * a named group, so a screen reader announces what the links are for.
 */
import { html, type SafeHtml } from "./html";
import styles from "./tool-links.module.css";

export interface ToolLinkItem {
  text: string;
  /** Omit for a link that is not ready yet. */
  href?: string;
}

export interface ToolLinksOptions {
  /** The group's name, such as "Open this result in another tool". Required. */
  label: string;
  links: readonly ToolLinkItem[];
}

export function toolLinks(o: ToolLinksOptions): SafeHtml {
  return html`<div class="${styles.root}" role="group" aria-label="${o.label}"
    >${o.links.map((link) =>
      link.href === undefined
        ? html`<a class="${styles.link}" aria-disabled="true">${link.text}</a>`
        : html`<a class="${styles.link}" href="${link.href}">${link.text}</a>`,
    )}</div
  >`;
}
