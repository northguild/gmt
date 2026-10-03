/**
 * LLMs.txt surface rendering.
 *
 * Follows the llmstxt.org spec:
 * - H1 title
 * - `>` blockquote summary
 * - `##` sections, each containing a markdown list of `- [name](url): description`
 */

import type { CorpusEntry } from "~/reference-types";

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
 * The reference sections of `llms.txt`: a link to the reference index, then one section per
 * namespace, each entry linked to the `.md` twin of its page.
 *
 * A type documented on its function's page (`inlineOn`) has no page and so no twin; the
 * function's twin already holds it, and listing it would link the same file twice.
 */
export function referenceSections(
  corpus: readonly CorpusEntry[],
  base: string,
): LlmsSection[] {
  const byNs = new Map<string, CorpusEntry[]>();
  for (const entry of corpus) {
    if (entry.inlineOn !== undefined) continue;
    if (!byNs.has(entry.namespace)) byNs.set(entry.namespace, []);
    byNs.get(entry.namespace)!.push(entry);
  }
  const sections: LlmsSection[] = [
    {
      heading: "Reference",
      links: [
        {
          title: "API reference",
          url: `${base}/reference.md`,
          description:
            "Index of every namespace, with links to each module and to the shared types.",
        },
      ],
    },
  ];
  for (const [ns, entries] of byNs) {
    entries.sort((a, b) => a.name.localeCompare(b.name));
    sections.push({
      heading: `Reference — ${ns}`,
      links: entries.map((e) => ({
        title: e.name,
        url: `${base}${e.page}.md`,
        description: e.description,
      })),
    });
  }
  return sections;
}

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
 * Whether a page under `content/docs/`, named by its path without the extension, is one of
 * the reference's generated index pages: `reference/index`, `reference/types/index`,
 * `reference/plain/index`, `reference/plain/calculate/index`.
 */
export function isReferenceIndex(rel: string): boolean {
  return /^reference\/(?:.+\/)?index$/.test(rel);
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
