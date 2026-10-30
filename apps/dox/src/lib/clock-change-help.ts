/**
 * The "How gmt helps" card of a dated tz-change checker as Markdown and plain text, for the `.md`
 * twin, the llms files and tests. The card's words are the checker's own (`HelpCard`); the page's
 * markup is the `helpCard` builder in `widgets/families/clockcheck`.
 */
import { HELP_HEADING, partsMarkdown } from "../data/clock-change-text";
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
