/**
 * The markup of a tensed phrase (CORE-89): both forms in one grid cell, so the box is the longer
 * form's and nothing moves when the tense flips. The form that is not true now is
 * `aria-hidden="true"` (the module hides it with `visibility`), so it stays out of the
 * accessibility tree and still sizes the box. `bindTense` in `clock-change-tense.ts` flips the
 * forms when a moment passes while the page is open; it finds a slot by `data-moment`.
 *
 * Which form is true, and the words of a moment, come from the lib module: this file only draws.
 */
import type { Tense, TenseView, Tensed } from "~/lib/clock-change-tense";
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import styles from "./tense-slot.module.css";

/**
 * Both forms in one cell. `block` is for a paragraph's worth of text; the default sits inside a
 * line. `key` names the moment that decides the form.
 */
export function tenseSlot(
  key: string,
  before: HtmlValue,
  after: HtmlValue,
  current: Tense,
  block = false,
): SafeHtml {
  return html`<span class="${block ? styles.block : styles.slot}" data-moment="${key}"
    ><span data-form="before" ${current === "after" ? html`aria-hidden="true"` : ""}>${before}</span
    ><span data-form="after" ${current === "before" ? html`aria-hidden="true"` : ""}>${after}</span
  ></span>`;
}

/** A phrase as markup: plain text when it has one form, otherwise a slot. */
export function tensedSlot(
  phrase: Tensed,
  view: TenseView,
  block = false,
): SafeHtml {
  if (phrase.key === null || phrase.before === phrase.after) {
    return html`${phrase.before}`;
  }
  return tenseSlot(
    phrase.key,
    phrase.before,
    phrase.after,
    view.tenseOf(phrase.key),
    block,
  );
}
