/**
 * keyPoints: the Key points above a dated clock-change checker (the page has them, the chat does
 * not). A heading and a card for each entry of the checker's list. A checker passes no `heading`.
 */
import { KEY_POINTS_HEADING, partsHtml } from "~/data/clock-change-text";
import type { KeyCard, KeyPart } from "~/data/clock-change-text";
import { gateAttr } from "../../builders/gate";
import { withBase } from "~/lib/site";
import { html, raw, type SafeHtml } from "../../builders/html";
import styles from "./key-points.module.css";

/** A path on this site goes under the site's base; an absolute address is left as written. */
const resolve = (value: string): string =>
  value.startsWith("/") ? withBase(value) : value;

const run = (parts: KeyPart[]): SafeHtml => raw(partsHtml(parts, resolve));

export function keyPoints(
  idPrefix: string,
  cards: readonly KeyCard[],
  heading: string = KEY_POINTS_HEADING,
): SafeHtml {
  const titleId = `${idPrefix}-keypoints-heading`;
  return html`<section class="${styles.points}" ${gateAttr("keypoints")} aria-labelledby="${titleId}">
    <h2 class="${styles.title}" id="${titleId}">${heading}</h2>
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
