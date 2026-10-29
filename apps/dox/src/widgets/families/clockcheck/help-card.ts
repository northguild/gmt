/**
 * helpCard: the "How gmt helps" card of a dated clock-change checker.
 *
 * A lede, a Verified line, two cases (a tag, `input -> output`, one line of why) and a link to the
 * saved-times section. The words are the checker's own (`HelpCard`); the shape is shared. The `.md`
 * twin and the llms files use `helpMarkdown` in `lib/clock-change-help.ts`, which has the same words.
 */
import { HELP_HEADING, partsHtml } from "~/data/clock-change-text";
import type { HelpCard } from "~/data/clock-change-text";
import { withBase } from "~/lib/site";
import { html, raw, type SafeHtml } from "../../builders/html";
import { gateAttr } from "../../builders/gate";
import styles from "./help-card.module.css";

/** A path on this site goes under the site's base; an absolute address is left as written. */
const resolve = (value: string): string =>
  value.startsWith("/") ? withBase(value) : value;

export function helpCard(idPrefix: string, card: HelpCard): SafeHtml {
  const titleId = `${idPrefix}-help-title`;
  const cases = card.cases.map(
    (item) => html`<li class="${styles.case}">
      <span class="${styles.tag}">${item.tag}</span>
      <div class="${styles.io}">
        <code class="${styles.in}">${item.input}</code>
        <span class="${styles.arrow}" aria-hidden="true">→</span>
        <code class="${styles.out}">${item.output}</code>
        ${
          item.outputNote
            ? html`<span class="${styles.note}">${item.outputNote}</span>`
            : null
        }
      </div>
      <p class="${styles.why}">${raw(partsHtml(item.why, resolve))}</p>
    </li>`,
  );
  return html`<section
    class="${styles.card}"
    ${gateAttr("help")}
    aria-labelledby="${titleId}"
  >
    <h4 class="${styles.title}" id="${titleId}">${HELP_HEADING}</h4>
    <p class="${styles.lede}">${raw(partsHtml(card.lede, resolve))}</p>
    <p class="${styles.verified}">
      <span class="${styles.badge}"
        ><span aria-hidden="true">✓</span> Verified</span
      >
      <span class="${styles.verifiedText}"
        >${raw(partsHtml(card.verified, resolve))}</span
      >
    </p>
    <p class="${styles.intro}">${card.intro}</p>
    <ul class="${styles.cases}">
      ${cases}
    </ul>
    <p class="${styles.cta}">
      <span>${card.cta.lead}</span>
      <a class="${styles.button}" href="${resolve(card.cta.href)}"
        >${card.cta.link} <span aria-hidden="true">↓</span></a
      >
    </p>
  </section>`;
}
