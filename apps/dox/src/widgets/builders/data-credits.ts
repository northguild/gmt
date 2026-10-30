/**
 * dataCredits: the info button on a drawing of third-party data and the popup of its sources
 * (CORE-88). Each source is a row, label left, credit right.
 *
 * The button is a native `<button popovertarget>` named "Data credits"; the popup is a native
 * `popover`, so Escape, outside click and focus return are the browser's
 * (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/). `watchDataCredits` in `lib/data-credits`
 * keeps `aria-expanded` true to the popup in browsers that do not expose it themselves.
 *
 * `stack`: the button is one of a control stack and takes the stack's button styling.
 * `corner`: a glass square in the drawing's bottom-end corner; the popup opens above it.
 * `corner-start`: the same square in the top-start corner, for a drawing whose land fills the
 * bottom-end one; the popup opens below it.
 */
import { html, raw, type SafeHtml } from "./html";
import styles from "./data-credits.module.css";

export interface DataCredit {
  readonly label: string;
  readonly parts: readonly (string | { text: string; href: string })[];
}

export type DataCreditsPlacement = "stack" | "corner" | "corner-start";

export interface DataCreditsOptions {
  /** Unique in the document: two mounts of one drawing each pass their own. Required. */
  id: string;
  placement: DataCreditsPlacement;
  credits: readonly DataCredit[];
}

const ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9.25"/><path d="M12 11v5.5"/><circle cx="12" cy="7.75" r=".5" fill="currentColor"/></svg>';

function part(p: DataCredit["parts"][number]): SafeHtml | string {
  if (typeof p === "string") return p;
  return html`<a href="${p.href}" rel="noopener">${p.text}</a>`;
}

/** Nothing for an empty list, so a drawing with nothing to credit gets no button. */
export function dataCredits(o: DataCreditsOptions): SafeHtml {
  if (o.credits.length === 0) return html``;
  const rows = o.credits.map(
    (c) => html`<dt>${c.label}</dt><dd>${c.parts.map(part)}</dd>`,
  );
  return html`<button type="button" class="${styles.button}" data-placement="${o.placement}" popovertarget="${o.id}" aria-label="Data credits" aria-expanded="false">${raw(ICON)}</button
    ><div id="${o.id}" class="gmt-glass ${styles.panel}" data-placement="${o.placement}" data-credits-panel popover><dl>${rows}</dl></div>`;
}
