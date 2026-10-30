/**
 * The layout builders: `widget`, `card`, `section`, `fieldGrid`, `field`, `hint`.
 *
 * Pure string functions returning `SafeHtml`. Every argument that gives something
 * an accessible name is required in the type, so a nameless region, field or
 * section does not compile.
 *
 * - `widget` writes the root the gates and `findWidget` read: `data-widget`, `data-scope`,
 *   `role="region"`, `aria-label`.
 *   Region pattern: https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/region.html
 * - `section` is `<section aria-labelledby>` over its own heading.
 * - `field` joins a label, an optional hint and a control. The control is a function
 *   of the ids, so `aria-describedby` and `for` are wired by construction.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, raw, type SafeHtml } from "./html";
import styles from "./layout.module.css";

export interface WidgetRoot {
  /** The slug that gates and the identity key read, such as `gnss-week-decoder`. */
  name: string;
  /** The region's accessible name: the tool's `<h1>`. */
  label: string;
  /**
   * The template's `idPrefix`. Written as `data-scope` so `findWidget` can rebuild `idScope`
   * without guessing the prefix from an id.
   */
  scope: string;
}

export function widget(root: WidgetRoot, children: SafeHtml): SafeHtml {
  return html`<div
    class="${styles.widget} not-content"
    data-widget="${root.name}"
    data-scope="${root.scope}"
    role="region"
    aria-label="${root.label}"
  >${children}</div>`;
}

export interface CardOptions extends GateOption {
  /**
   * The card's place in its widget's entrance, from 0. The stylesheet delays the entrance by
   * this many `--gmt-motion-stagger` steps. Written at render time, so a server-rendered card
   * paints in place on its first frame and needs no script.
   */
  enter?: number;
}

export function card(children: SafeHtml, o: CardOptions = {}): SafeHtml {
  const step =
    o.enter === undefined
      ? ""
      : html`style="--gmt-enter-i: ${String(Math.max(0, Math.trunc(o.enter)))}"`;
  return html`<div class="${styles.card}" data-enter ${step} ${gateAttr(o.gate)}>${children}</div>`;
}

export interface SectionOptions extends GateOption {
  /** Unique within the page: the heading's id derives from it. */
  id: string;
  heading: string;
  level: 2 | 3 | 4;
}

export function section(o: SectionOptions, children: SafeHtml): SafeHtml {
  const headingId = `${o.id}-heading`;
  const tag = raw(`h${o.level}`);
  return html`<section class="${styles.section}" ${gateAttr(o.gate)} aria-labelledby="${headingId}"
    ><${tag} class="${styles.heading}" id="${headingId}">${o.heading}</${tag}
    >${children}</section
  >`;
}

export function fieldGrid(children: SafeHtml): SafeHtml {
  return html`<div class="${styles.grid}">${children}</div>`;
}

export interface Hint {
  /** Join this to the control's `aria-describedby`. */
  id: string;
  html: SafeHtml;
}

export function hint(id: string, text: string): Hint {
  return { id, html: html`<p class="${styles.hint}" id="${id}">${text}</p>` };
}

export interface FieldControlIds {
  /** The control's own id; `<label for>` points at it. */
  id: string;
  /** The hint's id, or undefined when the field has none. */
  describedBy: string | undefined;
}

export interface FieldOptions {
  id: string;
  /** The visible label and the control's name. Required. */
  label: string;
  hint?: Hint;
  control: (ids: FieldControlIds) => SafeHtml;
}

export function field(o: FieldOptions): SafeHtml {
  const control = o.control({ id: o.id, describedBy: o.hint?.id });
  return html`<div class="${styles.field}"
    ><label class="${styles.label}" for="${o.id}">${o.label}</label>${control}${o.hint?.html ?? ""}</div
  >`;
}
