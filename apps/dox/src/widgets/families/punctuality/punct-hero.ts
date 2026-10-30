/**
 * punctHero: a captioned result plate with fixed sub lines, for the punctuality family.
 *
 * A `<figure>` whose `<figcaption>` names the value, then the value, then a fixed number of
 * lines of small text. Everything a drag can change holds still:
 *
 * - every `samples` entry shares the value's grid cell, hidden, so the plate keeps the width
 *   of the widest value (invariant 14);
 * - every line is one box that never wraps, and `lineSamples` reserve the widest text each
 *   line will hold, so an empty or a short line keeps its box;
 * - the caption has its own room above the value, so the text never meets the border.
 *
 * A plate takes a series for a 3px bottom edge in that series' colour, never a left-only
 * accent. A plate is `aria-hidden` through `punctHeroStrip`: the facts it shows are also in
 * the rate lines and the verdict.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./punct-hero.module.css";

interface PunctHeroOptions extends GateOption {
  /** What the value is. Required. */
  caption: string;
  value: string;
  /** A small picture before the value (a transport icon). */
  icon?: SafeHtml;
  /**
   * Keep the icon's room when there is no icon, so the value's box is the same whether the
   * picture is shown or not (a plate whose icon comes and goes with the value).
   */
  reserveIcon?: boolean;
  /** The widest values it will show, to reserve their width. */
  samples?: readonly string[];
  /** The sub lines, top to bottom. An empty string keeps the line's box. */
  lines?: readonly string[];
  /** The widest text each line will hold, by line. */
  lineSamples?: readonly (readonly string[])[];
  series?: 1 | 2 | 3 | 4;
  /** A secondary result beside a hero: a smaller value that may wrap. */
  quiet?: boolean;
}

/** An icon's box with nothing drawn in it. */
const EMPTY_ICON = html`<svg aria-hidden="true" focusable="false"></svg>`;

export function punctHero(o: PunctHeroOptions): SafeHtml {
  const lines = o.lines ?? [];
  return html`<figure
    class="${styles.root}"
    data-quiet="${String(o.quiet === true)}"
    ${o.series === undefined ? "" : html`data-series="${o.series}"`}
    ${gateAttr(o.gate)}
    ><figcaption class="${styles.caption}">${o.caption}</figcaption
    ><div class="${styles.values}"
      ><p class="${styles.value}">${o.icon ?? (o.reserveIcon === true ? EMPTY_ICON : "")}<span>${o.value}</span></p
      >${(o.samples ?? []).map(
        (sample) =>
          html`<span class="${styles.ghost}" aria-hidden="true">${sample}</span>`,
      )}</div
    >${
      lines.length === 0
        ? ""
        : html`<div class="${styles.lines}"
            >${lines.map(
              (text, i) =>
                html`<p class="${styles.line}"
                  ><span>${text}</span
                  >${(o.lineSamples?.[i] ?? []).map(
                    (sample) =>
                      html`<span class="${styles.ghost}" aria-hidden="true">${sample}</span>`,
                  )}</p
                >`,
            )}</div
          >`
    }</figure
  >`;
}

/** The row of plates at the top of a frame. Hidden from assistive technology. */
export function punctHeroStrip(
  children: SafeHtml,
  o: GateOption = {},
): SafeHtml {
  return html`<div class="${styles.strip}" aria-hidden="true" ${gateAttr(o.gate)}>${children}</div>`;
}
