/**
 * edgeControl: a tall, narrow button with a chevron, for a panel's edge or a pager.
 *
 * Pattern: Button https://www.w3.org/WAI/ARIA/apg/patterns/button/. `label` is the button's
 * name and is required; the chevron is decoration. `direction` 1 points toward the inline end,
 * -1 toward the inline start, and the chevron nudges two pixels that way on hover and focus.
 * `caption` adds a visible word beside the chevron; the name stays `label`. `controls` names
 * the element the button operates, when it operates one.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";
import styles from "./edge-control.module.css";

export interface EdgeControlOptions extends GateOption {
  /** The button's name. Required. */
  label: string;
  /** 1 points toward the inline end, -1 toward the inline start. */
  direction: 1 | -1;
  id?: string;
  /** The id of the element this button operates. */
  controls?: string;
  /** A visible word beside the chevron. */
  caption?: string;
  /** Extra class, from the caller's own module. */
  className?: string;
}

export function edgeControl(o: EdgeControlOptions): SafeHtml {
  const points = o.direction === 1 ? "3,2 13,20 3,38" : "13,2 3,20 13,38";
  return html`<button
    class="${styles.root} ${o.className ?? ""}"
    type="button"
    data-step="${String(o.direction)}"
    aria-label="${o.label}"
    ${o.id === undefined ? "" : html`id="${o.id}"`}
    ${o.controls === undefined ? "" : html`aria-controls="${o.controls}"`}
    ${gateAttr(o.gate)}
    ><svg class="${styles.chevron}" viewBox="0 0 16 40" aria-hidden="true" focusable="false"
      ><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.25"
        stroke-linecap="round" stroke-linejoin="round"
    /></svg
    >${o.caption === undefined ? "" : html`<span class="${styles.caption}" aria-hidden="true">${o.caption}</span>`}</button
  >`;
}
