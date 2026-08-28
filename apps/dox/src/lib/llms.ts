/**
 * LLMs.txt surface rendering.
 *
 * Follows the llmstxt.org spec:
 * - H1 title
 * - `>` blockquote summary
 * - `##` sections, each containing a markdown list of `- [name](url): description`
 */

export type LlmsLink = {
  title: string;
  url: string;
  description?: string;
};

export type LlmsSection = {
  heading: string;
  links: LlmsLink[];
};

/**
 * Render an `llms.txt` file from sections of links.
 */
export function renderLlmsTxt(o: {
  title: string;
  summary: string;
  sections: LlmsSection[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${o.title}`);
  lines.push("");
  lines.push(`> ${o.summary}`);
  lines.push("");

  for (const section of o.sections) {
    lines.push(`## ${section.heading}`);
    lines.push("");
    for (const link of section.links) {
      const desc = link.description ? `: ${link.description}` : "";
      lines.push(`- [${link.title}](${link.url})${desc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Render an `llms-full.txt` file with full page markdown bodies.
 */
export function renderLlmsFull(o: {
  title: string;
  summary: string;
  pages: { title: string; url: string; markdown: string }[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${o.title}`);
  lines.push("");
  lines.push(`> ${o.summary}`);
  lines.push("");

  for (const page of o.pages) {
    lines.push(`## ${page.title}`);
    lines.push("");
    lines.push(`> source: ${page.url}`);
    lines.push("");
    lines.push(page.markdown);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}
