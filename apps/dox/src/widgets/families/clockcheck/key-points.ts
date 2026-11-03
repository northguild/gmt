/**
 * keyPoints: the Key points above a dated clock-change checker (the page has them, the chat does
 * not). A heading and a card for each entry of the checker's list.
 */
import { KEY_POINTS_HEADING, partsHtml } from "~/data/clock-change-text";
import type { KeyCard, KeyPart } from "~/data/clock-change-text";
import { gateAttr } from "../../builders/gate";
import { html, raw, type SafeHtml } from "../../builders/html";
import styles from "./key-points.module.css";

const run = (parts: KeyPart[]): SafeHtml => raw(partsHtml(parts));

export function keyPoints(
  idPrefix: string,
  cards: readonly KeyCard[],
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
              ? html`<p>${run(block.parts)}</p>`
              : html`<ol>${block.items.map((item) => html`<li>${run(item)}</li>`)}</ol>`,
          )}
        </div>`,
    )}</div>
  </section>`;
}
