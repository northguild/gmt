/**
 * The index pages of the reference: `/reference/`, `/reference/types/`, one per namespace
 * and one per module. Each lists its children with a one-line summary.
 *
 * Pure: what the generator extracted in, MDX out. A summary is the first sentence of the
 * child's own description. A child with no description is listed as a bare link; nothing is
 * written in its place.
 */

import type { PainPoint } from "../../src/lib/industry-overview";
import { mdCodeSpan, mdText } from "./render-table";
import { TYPES_SECTION } from "./reference-urls";

/** One function or regex page. */
export interface IndexedPage {
  namespace: string;
  module: string;
  name: string;
  url: string;
  description: string;
}

/** One public type: where it is documented, and what it is. */
export interface IndexedType {
  name: string;
  /** Its own page, or its anchor on its function's page. */
  url: string;
  description: string;
}

/** A type documented on a function's page, with the module that page is in. */
export interface IndexedInlineType extends IndexedType {
  namespace: string;
  module: string;
}

/**
 * An industry namespace: what the root page and its own overview say about it. The id is
 * the namespace. Everything else comes from `src/lib/industry-tags.ts` and
 * `src/lib/industry-overview.ts`, read by the caller so this module stays pure.
 */
export interface IndexedIndustry {
  id: string;
  /** The word on its tag: `Intermodal`. */
  label: string;
  /** One line saying what the industry covers. */
  definition: string;
  /** A name in `Icon.astro`'s dictionary. */
  icon: string;
  /** The guide that introduces it, as a site path. */
  guide?: string;
  /** The guide's title. */
  guideTitle: string;
  /** What the industry is, in plain words. */
  about: string;
  solves: readonly PainPoint[];
}

export interface IndexInput {
  pages: readonly IndexedPage[];
  sharedTypes: readonly IndexedType[];
  inlineTypes: readonly IndexedInlineType[];
  /**
   * The namespaces that are industries, in the order to show them. A namespace named here
   * is listed under "By industry" and its overview carries the industry text and tag; every
   * other namespace is general. Empty or absent: every namespace is general.
   */
  industries?: readonly IndexedIndustry[];
}

/** One generated index page. */
export interface IndexPage {
  /** Path under the reference tree: `plain/calculate/index.mdx`. */
  file: string;
  /** The route it serves, with no trailing slash: `/reference/plain/calculate`. */
  route: string;
  mdx: string;
}

/** Abbreviations whose full stop does not end a sentence. */
const ABBREVIATION = /(?:\be\.g|\bi\.e|\bvs|\betc|\bcf)\.$/;

/**
 * The first sentence of a description: up to the first `.`, `!` or `?` that is followed by
 * white space or ends the text, and is not inside a code span or part of an abbreviation.
 * A description with no such mark is returned whole.
 */
export function firstSentence(description: string): string {
  const text = description.replace(/\s+/g, " ").trim();
  let inCode = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "`") inCode = !inCode;
    if (inCode || !".!?".includes(ch)) continue;
    const next = text[i + 1];
    if (next !== undefined && next !== " ") continue;
    const sentence = text.slice(0, i + 1);
    if (ABBREVIATION.test(sentence)) continue;
    return sentence;
  }
  return text;
}

const byName = <T extends { name: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

/** `- [`name`](url): summary`, or the bare link when there is no summary. */
function listItem(item: { name: string; url: string; description: string }) {
  const link = `[${mdCodeSpan(item.name)}](${item.url})`;
  const summary = firstSentence(item.description);
  return summary ? `- ${link}: ${mdText(summary)}` : `- ${link}`;
}

/**
 * The frontmatter of an index page. `sidebar.order` is written in the block form, the only
 * one `ensure-sidebar-order.mjs` recognises: given the inline `sidebar: { order: 0 }` it
 * rewrites the file on every run, and the generator would write it back.
 */
function frontmatter(
  title: string,
  description: string,
  slug: string,
  industry?: string,
) {
  return [
    `---`,
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `slug: ${JSON.stringify(slug)}`,
    // The tag under the title (`PageTitle.astro`). A general page has none.
    ...(industry ? [`industries: [${industry}]`] : []),
    `sidebar:`,
    `  order: 0`,
    `---`,
    "",
  ];
}

/**
 * One "What these functions solve" item: the problem sentence with each `{{name}}` turned
 * into a link to that function's page, then the pages that show it. The text ends its own sentence. A name the namespace
 * does not export stops the generator, so a renamed function cannot leave a dead link.
 */
function painPointItem(
  industry: IndexedIndustry,
  point: PainPoint,
  pages: readonly IndexedPage[],
): string {
  const pieces = point.answer.split(/\{\{(\w+)\}\}/);
  const answer = pieces
    .map((piece, i) => {
      if (i % 2 === 0) return mdText(piece);
      const target = pages.find((p) => p.name === piece);
      if (!target) {
        throw new Error(
          `[reference] the ${industry.id} overview names ${piece}, which ${industry.id} does not export. Fix src/lib/industry-overview.ts.`,
        );
      }
      return `[${mdCodeSpan(piece)}](${target.url})`;
    })
    .join("");
  const see = point.see.map((l) => `[${mdText(l.label)}](${l.href})`);
  return `- **${mdText(point.problem)}** ${answer}${see.length ? ` See ${see.join(", ")}.` : ""}`;
}

/** The overview of an industry namespace, above its per-module lists. */
function industryIntro(
  industry: IndexedIndustry,
  pages: readonly IndexedPage[],
): string[] {
  const lines = [
    mdText(industry.about),
    "",
    `## What these functions solve`,
    "",
  ];
  for (const point of industry.solves) {
    lines.push(painPointItem(industry, point, pages));
  }
  lines.push("");
  if (industry.guide) {
    lines.push(
      `Start with the guide: [${mdText(industry.guideTitle)}](${industry.guide}).`,
      "",
    );
  }
  return lines;
}

function page(file: string, slug: string, lines: string[]): IndexPage {
  return { file, route: `/${slug}`, mdx: lines.join("\n") };
}

/**
 * Every index page, in a stable order: the root, the types section, then each namespace
 * followed by its modules. A namespace or a module gets an index only when it has at least
 * one page; the types section only when there is a type to list.
 */
export function renderIndexPages(input: IndexInput): IndexPage[] {
  const modules = new Map<string, Map<string, IndexedPage[]>>();
  for (const p of input.pages) {
    if (!modules.has(p.namespace)) modules.set(p.namespace, new Map());
    const mods = modules.get(p.namespace)!;
    if (!mods.has(p.module)) mods.set(p.module, []);
    mods.get(p.module)!.push(p);
  }
  const namespaces = [...modules.keys()].sort();
  const hasTypes = input.sharedTypes.length + input.inlineTypes.length > 0;

  const out: IndexPage[] = [];

  // /reference/
  {
    const lines = frontmatter(
      "API reference",
      "Every function, regular expression and type @northguild/gmt exports.",
      "reference",
    );
    const industries = (input.industries ?? []).filter((i) =>
      namespaces.includes(i.id),
    );
    const industryIds = new Set(industries.map((i) => i.id));
    const general = namespaces.filter((ns) => !industryIds.has(ns));
    if (industries.length) {
      // The icon is a component, so the page imports it. The text surfaces strip the
      // import and the tag (`stripMdx`).
      lines.push(`import Icon from "../../../components/Icon.astro";`, "");
    }
    lines.push(`## For any industry`, "");
    lines.push(
      "These namespaces work in any industry. Each is named for the kind of value it works on.",
      "",
    );
    for (const ns of general) {
      lines.push(`- [${mdCodeSpan(ns)}](/reference/${ns})`);
    }
    lines.push("");
    if (industries.length) {
      lines.push(`## By industry`, "");
      lines.push(
        "Each of these adds the operations of one industry, built on the namespaces above.",
        "",
      );
      for (const i of industries) {
        lines.push(
          `- <Icon name=${JSON.stringify(i.icon)} size="1.1em" class="gmt-ref-industry-icon" /> [${mdText(i.label)}](/reference/${i.id}): ${mdText(i.definition)}`,
        );
      }
      lines.push("");
    }
    if (hasTypes) {
      lines.push(`## Types`, "");
      lines.push(`- [Types](/reference/${TYPES_SECTION})`);
      lines.push("");
    }
    out.push(page("index.mdx", "reference", lines));
  }

  // /reference/types/
  if (hasTypes) {
    const lines = frontmatter(
      "Types",
      "The public types of @northguild/gmt.",
      `reference/${TYPES_SECTION}`,
    );
    if (input.sharedTypes.length) {
      lines.push(`## Shared types`, "");
      for (const t of byName(input.sharedTypes)) lines.push(listItem(t));
      lines.push("");
    }
    if (input.inlineTypes.length) {
      lines.push(`## Documented with their function`, "");
      for (const t of byName(input.inlineTypes)) lines.push(listItem(t));
      lines.push("");
    }
    out.push(
      page(`${TYPES_SECTION}/index.mdx`, `reference/${TYPES_SECTION}`, lines),
    );
  }

  for (const ns of namespaces) {
    const mods = modules.get(ns)!;
    const modNames = [...mods.keys()].sort();

    const industry = input.industries?.find((i) => i.id === ns);

    // /reference/<ns>/
    {
      const lines = frontmatter(
        ns,
        `The ${ns} namespace of @northguild/gmt, by module.`,
        `reference/${ns}`,
        industry?.id,
      );
      if (industry) {
        const own = input.pages.filter((p) => p.namespace === ns);
        lines.push(...industryIntro(industry, own));
      }
      for (const mod of modNames) {
        lines.push(`## [${mod}](/reference/${ns}/${mod})`, "");
        for (const p of byName(mods.get(mod)!)) lines.push(listItem(p));
        lines.push("");
      }
      out.push(page(`${ns}/index.mdx`, `reference/${ns}`, lines));
    }

    // /reference/<ns>/<mod>/
    for (const mod of modNames) {
      const lines = frontmatter(
        `${ns}/${mod}`,
        `The ${mod} module of the ${ns} namespace of @northguild/gmt.`,
        `reference/${ns}/${mod}`,
        industry?.id,
      );
      for (const p of byName(mods.get(mod)!)) lines.push(listItem(p));
      lines.push("");
      const held = input.inlineTypes.filter(
        (t) => t.namespace === ns && t.module === mod,
      );
      if (held.length) {
        lines.push(`## Types`, "");
        for (const t of byName(held)) lines.push(listItem(t));
        lines.push("");
      }
      out.push(page(`${ns}/${mod}/index.mdx`, `reference/${ns}/${mod}`, lines));
    }
  }

  return out;
}
