/**
 * The "How gmt helps" card of a dated tz-change checker, as HTML for the page and as Markdown and
 * plain text for the `.md` twin, the llms files and tests. The card's words are the checker's own
 * (`HelpCard`); the shape, the headings and the order are shared.
 */
import {
  HELP_HEADING,
  partsMarkdown,
  partsHtml,
  partsText,
} from "../data/clock-change-text";
import type { HelpCard } from "../data/clock-change-text";
import { withBase } from "./site";
import { escapeAttr, escapeHtml } from "./widget-ui";

/** The "How gmt helps" card: same panel as the other cards, no alert colour. */
export function helpCardHtml(idPrefix: string, card: HelpCard): string {
  const href = (value: string): string =>
    value.startsWith("/") ? withBase(value) : value;
  const cases = card.cases
    .map(
      (item) =>
        `<li class="gmt-clockcheck-help-case">` +
        `<span class="gmt-clockcheck-help-tag">${escapeHtml(item.tag)}</span>` +
        `<div class="gmt-clockcheck-help-io">` +
        `<code class="gmt-clockcheck-help-in">${escapeHtml(item.input)}</code>` +
        `<span class="gmt-clockcheck-help-arrow" aria-hidden="true">\u2192</span>` +
        `<code class="gmt-clockcheck-help-out">${escapeHtml(item.output)}</code>` +
        (item.outputNote
          ? `<span class="gmt-clockcheck-help-note">${escapeHtml(item.outputNote)}</span>`
          : "") +
        `</div>` +
        `<p class="gmt-clockcheck-help-why">${partsHtml(item.why, href)}</p>` +
        `</li>`,
    )
    .join("");
  return (
    `<section class="gmt-clockcheck-help" aria-labelledby="${idPrefix}-help-title">` +
    `<h4 id="${idPrefix}-help-title">${escapeHtml(HELP_HEADING)}</h4>` +
    `<p class="gmt-clockcheck-help-lede">${partsHtml(card.lede, href)}</p>` +
    `<p class="gmt-clockcheck-help-verified"><span class="gmt-clockcheck-help-badge"><span aria-hidden="true">\u2713</span> Verified</span> <span>${partsHtml(card.verified, href)}</span></p>` +
    `<p class="gmt-clockcheck-help-intro">${escapeHtml(card.intro)}</p>` +
    `<ul class="gmt-clockcheck-help-cases">${cases}</ul>` +
    `<p class="gmt-clockcheck-help-cta"><span>${escapeHtml(card.cta.lead)}</span> <a class="gmt-clockcheck-help-btn" href="${escapeAttr(href(card.cta.href))}">${escapeHtml(card.cta.link)} <span aria-hidden="true">\u2193</span></a></p>` +
    `</section>`
  );
}

/** The help card as Markdown, for the `.md` twin and the llms files. */
export function helpMarkdown(card: HelpCard): string {
  const lines = [
    "",
    `## ${HELP_HEADING}`,
    "",
    partsMarkdown(card.lede),
    "",
    partsMarkdown(card.verified),
    "",
    card.intro,
    "",
  ];
  for (const item of card.cases) {
    lines.push(`### ${item.tag}`, "");
    lines.push(
      `\`${item.input}\` \u2192 \`${item.output}\`${item.outputNote ? ` (${item.outputNote})` : ""}`,
      "",
    );
    lines.push(partsMarkdown(item.why), "");
  }
  lines.push(`${card.cta.lead} [${card.cta.link}](${card.cta.href})`, "");
  return lines.join("\n");
}

/** The whole help card as plain text, for a test to search. */
export function helpText(card: HelpCard): string {
  return [
    HELP_HEADING,
    partsText(card.lede),
    partsText(card.verified),
    card.intro,
    ...card.cases.flatMap((c) => [
      c.tag,
      c.input,
      c.output,
      c.outputNote ?? "",
      partsText(c.why),
    ]),
    `${card.cta.lead} ${card.cta.link}`,
  ].join("\n");
}
