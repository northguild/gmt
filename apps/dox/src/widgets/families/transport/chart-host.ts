/**
 * The empty box a third-party chart draws into. The chart library writes its own DOM, which a
 * module class cannot reach, so the host carries the named global sheet's `gmt-chart` class
 * (`gmt-charts.css`); the widget's module styles the box around it.
 */
import { html, type SafeHtml } from "../../builders/html";

export function chartHost(id: string): SafeHtml {
  return html`<div class="gmt-chart" id="${id}"></div>`;
}
