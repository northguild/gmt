/**
 * The index pages of the reference: `/reference/`, `/reference/types/`, one per namespace
 * and one per module. Each lists its children with a one-line summary.
 *
 * Pure: what the generator extracted in, MDX out. A summary is the first sentence of the
 * child's own description. A child with no description is listed as a bare link; nothing is
 * written in its place.
 */

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
 * A declared industry: what the root page and its own namespace's index say about it. The
 * `id` is the industry's, and its hub is at `/industries/<id>/`. Everything else comes from
 * `src/data/industries.json` (through `src/lib/industry-tags.ts`), read by the caller so this
 * module stays pure.
 */
export interface IndexedIndustry {
  id: string;
  /** The word on its tag: `Intermodal`. */
  label: string;
  /** One line saying what the industry covers. */
  definition: string;
  /** A name in `Icon.astro`'s dictionary. */
  icon: string;
  /** The namespace it owns (equal to `id`), when it owns one. */
  namespace?: string;
  /** The modules it draws on: a whole namespace (`gnss`) or one sub-module (`timescale/convert`). */
  drawsOn: readonly string[];
}

export interface IndexInput {
  pages: readonly IndexedPage[];
  sharedTypes: readonly IndexedType[];
  inlineTypes: readonly IndexedInlineType[];
  /**
   * Every declared industry, in the order to show them. The root page lists each under "By
   * industry". The namespace an industry owns carries its tag and a pointer to its hub; every
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
export function listItem(item: {
  name: string;
  url: string;
  description: string;
}) {
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
    // A generated page has no source file to edit.
    `editUrl: false`,
    // The tag under the title (`PageTitle.astro`). A general page has none.
    ...(industry ? [`industries: [${industry}]`] : []),
    `sidebar:`,
    `  order: 0`,
    `---`,
    "",
  ];
}

/** The link to a module's index page: a namespace (`gnss`) or a sub-module (`timescale/convert`). */
function moduleLink(module: string): string {
  return `[${mdCodeSpan(module)}](/reference/${module})`;
}

const conjunction = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

/** The sentence that closes a definition, so the line after it reads as a new one. */
const endsSentence = (text: string): string =>
  /[.!?]$/.test(text) ? text : `${text}.`;

/**
 * One industry on the root page: its icon, its label as a link to its hub, its definition, then
 * the namespace it owns when it owns one, then the modules it draws on, each linked to its own
 * index.
 */
function industryItem(industry: IndexedIndustry): string {
  const parts = [
    `<Icon name=${JSON.stringify(industry.icon)} size="1.1em" class="gmt-ref-industry-icon" /> [${mdText(industry.label)}](/industries/${industry.id}/): ${mdText(endsSentence(industry.definition))}`,
  ];
  if (industry.namespace) {
    parts.push(`Its namespace is ${moduleLink(industry.namespace)}.`);
  }
  if (industry.drawsOn.length > 0) {
    parts.push(
      `Draws on ${conjunction.format(industry.drawsOn.map(moduleLink))}.`,
    );
  }
  return `- ${parts.join(" ")}`;
}

/** The line that replaces an industry's pain points on its own namespace's index: they live on its hub. */
function hubPointer(industry: IndexedIndustry): string {
  return `The ${mdText(industry.label)} industry's own namespace. What it solves, and the guides and tools that show it, are on [${mdText(industry.label)}](/industries/${industry.id}/).`;
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
    const industries = input.industries ?? [];
    const owned = new Set(industries.flatMap((i) => i.namespace ?? []));
    const general = namespaces.filter((ns) => !owned.has(ns));
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
        "Each industry has a namespace of its own, draws on the layers above it, or both.",
        "",
      );
      for (const i of industries) lines.push(industryItem(i));
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

    const industry = input.industries?.find((i) => i.namespace === ns);

    // /reference/<ns>/
    {
      const lines = frontmatter(
        ns,
        `The ${ns} namespace of @northguild/gmt, by module.`,
        `reference/${ns}`,
        industry?.id,
      );
      if (industry) lines.push(hubPointer(industry), "");
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
