/* oxlint-disable dox-src/no-hand-markup -- the old string markup, deleted by L15e with its last caller */
/**
 * Old markup: L15e removes this file once the mounts and `zone-map.ts` use `tenseSlot` and
 * `tensedSlot` (`widgets/families/clockcheck/tense-slot.ts`).
 */
import type { Tense, TenseView, Tensed } from "./clock-change-tense";
import { escapeAttr, escapeHtml } from "./widget-ui";

/**
 * Both forms in one grid cell. The one that is not true now is `aria-hidden="true"` (the sheet
 * hides it with `visibility`), so it stays out of the accessibility tree and still sizes the box.
 * `block` is for a paragraph's worth of text; the default sits inside a line.
 */
export function slotHtml(
  key: string,
  beforeHtml: string,
  afterHtml: string,
  current: Tense,
  block = false,
): string {
  const hidden = ' aria-hidden="true"';
  return (
    `<span class="gmt-tense${block ? " gmt-tense--block" : ""}" data-moment="${escapeAttr(key)}">` +
    `<span data-form="before"${current === "after" ? hidden : ""}>${beforeHtml}</span>` +
    `<span data-form="after"${current === "before" ? hidden : ""}>${afterHtml}</span>` +
    `</span>`
  );
}

/** A phrase as HTML: plain text when it has one form, otherwise a slot. */
export function tensedHtml(
  phrase: Tensed,
  view: TenseView,
  block = false,
): string {
  if (phrase.key === null || phrase.before === phrase.after) {
    return escapeHtml(phrase.before);
  }
  return slotHtml(
    phrase.key,
    escapeHtml(phrase.before),
    escapeHtml(phrase.after),
    view.tenseOf(phrase.key),
    block,
  );
}
