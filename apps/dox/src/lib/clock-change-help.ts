/**
 * The "How gmt helps" card of a dated tz-change checker as Markdown and plain text, for the `.md`
 * twin, the llms files and tests. The card's words are the checker's own (`HelpCard`); the page's
 * markup is the `helpCard` builder in `widgets/families/clockcheck`.
 */
import {
  HELP_HEADING,
  partsMarkdown,
  partsText,
} from "../data/clock-change-text";
import type { HelpCard } from "../data/clock-change-text";

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
