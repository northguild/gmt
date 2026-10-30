/**
 * keyPoints: the Key points above a dated clock-change checker (the page has them, the chat does
 * not). A heading and a card for each entry of the checker's list. A run with a tensed part is
 * written whole in both forms, so a sentence keeps its flow when the tense flips.
 */
import {
  KEY_POINTS_HEADING,
  partsHtml,
  partsInForm,
  tenseKeyOf,
} from "~/data/clock-change-text";
import type { KeyCard, KeyPart } from "~/data/clock-change-text";
import type { TenseView } from "~/lib/clock-change-tense";
import { gateAttr } from "../../builders/gate";
import { html, raw, type SafeHtml } from "../../builders/html";
import { tenseSlot } from "./tense-slot";
import styles from "./key-points.module.css";

function run(parts: KeyPart[], view: TenseView): SafeHtml {
  const key = tenseKeyOf(parts);
  if (key === null) return raw(partsHtml(parts));
  return tenseSlot(
    key,
    raw(partsHtml(partsInForm(parts, "before"))),
    raw(partsHtml(partsInForm(parts, "after"))),
    view.tenseOf(key),
    true,
  );
}

export function keyPoints(
  idPrefix: string,
  cards: readonly KeyCard[],
  view: TenseView,
): SafeHtml {
  const titleId = `${idPrefix}-keypoints-heading`;
  return html`<section class="${styles.points}" ${gateAttr("keypoints")} aria-labelledby="${titleId}">
    <h2 class="${styles.title}" id="${titleId}">${KEY_POINTS_HEADING}</h2>
    <div class="${styles.grid}">${cards.map(
      (card) =>
        html`<div class="${styles.card}" ${gateAttr("keypoints-card")} ${card.id ? html`id="${card.id}"` : ""}>
          <h3 class="${styles.heading}">${card.heading}</h3>
          ${card.blocks.map((block) =>
            block.kind === "p"
              ? html`<p>${run(block.parts, view)}</p>`
              : html`<ol>${block.items.map((item) => html`<li>${run(item, view)}</li>`)}</ol>`,
          )}
        </div>`,
    )}</div>
  </section>`;
}
