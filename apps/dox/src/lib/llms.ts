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
 * A description as plain text: `[text](url)` becomes `text`. A list entry in `llms.txt` is
 * itself a link, and a source citation inside its description would be a second, nested link
 * to a page that is not on this site.
 */
export function withoutLinks(description: string): string {
  return description.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

/** The `types` namespace: its file is titled differently and holds one `Types` section. */
const TYPES_NAMESPACE = "types";

/** One namespace of the reference: the entries that have a page, sorted as the reference index sorts them. */
export type NamespaceEntries = {
  namespace: string;
  /** Module names in the reference index's order; `types` has the one module `Types`. */
  modules: { module: string; entries: CorpusEntry[] }[];
};

/**
 * The corpus grouped by namespace, then module, each entry list sorted by name: the one grouping
 * the root file and the namespace files both read.
 *
 * A type documented on its function's page (`inlineOn`) has no page and so no twin; the
 * function's twin already holds it, and listing it would link the same file twice.
 */
export function namespaceEntries(
  corpus: readonly CorpusEntry[],
): NamespaceEntries[] {
  const byNs = new Map<string, Map<string, CorpusEntry[]>>();
  for (const entry of corpus) {
    if (entry.inlineOn !== undefined) continue;
    if (!byNs.has(entry.namespace)) byNs.set(entry.namespace, new Map());
    const mods = byNs.get(entry.namespace)!;
    const module = entry.namespace === TYPES_NAMESPACE ? "Types" : entry.module;
    if (!mods.has(module)) mods.set(module, []);
    mods.get(module)!.push(entry);
  }
  return [...byNs].map(([namespace, mods]) => ({
    namespace,
    modules: [...mods.keys()].sort().map((module) => ({
      module,
      entries: mods.get(module)!.sort((a, b) => a.name.localeCompare(b.name)),
    })),
  }));
}

/** The `Reference` section of the root file: the index, then one line per namespace file. */
export function namespaceIndexLinks(
  namespaces: readonly NamespaceEntries[],
  base: string,
  summary: (namespace: string) => string,
): LlmsLink[] {
  return [
    {
      title: "API reference",
      url: `${base}/reference.md`,
      description:
        "Index of every namespace, with links to each module and to the shared types.",
    },
    ...namespaces.map(({ namespace }) => ({
      title: namespace,
      url: `${base}/reference/${namespace}/llms.txt`,
      description: summary(namespace),
    })),
  ];
}

/** The `##` sections of one namespace's file: a module each, every entry linked to its `.md` twin. */
export function namespaceSections(
  ns: NamespaceEntries,
  base: string,
): LlmsSection[] {
  return ns.modules.map(({ module, entries }) => ({
    heading: module,
    links: entries.map((e) => ({
      title: e.name,
      url: `${base}${e.page}.md`,
      description: withoutLinks(e.description),
    })),
  }));
}

/** The H1 of a namespace's file. */
export function namespaceTitle(namespace: string): string {
  return namespace === TYPES_NAMESPACE
    ? "@northguild/gmt shared types"
    : `@northguild/gmt/${namespace}`;
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
