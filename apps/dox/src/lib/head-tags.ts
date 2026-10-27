/**
 * The `<head>` tags a docs page adds to Starlight's own: the title with its suffix, the share
 * tags, the link to the page's Markdown twin and the JSON-LD blocks.
 *
 * Pure and free of `astro:` imports, so Vitest reads it. `src/route-data.ts` is the only caller:
 * Starlight's default `<Head>` renders `starlightRoute.head` and writes `og:type`, `og:title` and
 * the title itself, so every edit goes through the route data and not through `Head.astro`, where
 * it would repeat them.
 */
import { Temporal } from "@js-temporal/polyfill";

/** One entry of a page's `<head>`, in the shape Starlight's `head` config uses. */
export type HeadEntry = {
  tag:
    | "title"
    | "meta"
    | "link"
    | "script"
    | "style"
    | "base"
    | "noscript"
    | "template";
  attrs?: Record<string, string | boolean | undefined>;
  content?: string;
};

/** What follows a page's title in `<title>`. The home page is the one title without it. */
export const TITLE_SUFFIX = " · GMT";

/** The name of the site in a breadcrumb and a share card. */
export const SITE_NAME = "GMT";

/** Where the source of the package lives. */
export const CODE_REPOSITORY = "https://github.com/northguild/gmt";

/** The share image's size in pixels (`og:image:width`, `og:image:height`). */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** The namespaces' reference pages get an image each; a function's page shares its namespace's. */
const REFERENCE_NAMESPACE = /^(reference\/[^/]+)(?:\/|$)/;

/** The sections whose pages each have a share image of their own. */
const OWN_IMAGE_SECTIONS = [
  "guides",
  "tools",
  "scenarios",
  "migrate",
  "compare",
] as const;

/**
 * The name of the share image for a page: `/og/<key>.png`. A guide, a tool, a scenario, a migration
 * page and a comparison page each have one; a reference page uses its namespace's; every other page uses `site`.
 */
export function ogImageKey(id: string): string {
  for (const section of OWN_IMAGE_SECTIONS) {
    if (id === section || id.startsWith(`${section}/`)) return id;
  }
  const namespace = REFERENCE_NAMESPACE.exec(id);
  return namespace ? namespace[1] : "site";
}

/** Whether a route id is the home page. Starlight names it `""`; the collection names it `index`. */
export function isHomeId(id: string): boolean {
  return id === "" || id === "index";
}

/** What `hasEntry` finds for an id: the title of the docs page that has it. */
export type EntryRef = { title: string };

export type HeadInput = {
  /** The route id: `""` for the home page, else the slug (`guides/concepts/plain-vs-zoned`). */
  id: string;
  /** The page's frontmatter fields that the tags read. */
  data: {
    title: string;
    headTitle?: string;
    description?: string;
  };
  /** The site's description, used where a page has none of its own. */
  siteDescription: string;
  /** When the page was last committed, if Starlight found out. */
  lastUpdated?: { valueOf(): number };
  /** The docs page with this id, or undefined. Ancestors that do not exist are left out of a breadcrumb. */
  hasEntry: (id: string) => EntryRef | undefined;
  /** The path of the page's Markdown twin without `.md`; undefined for a page that is not in the docs collection. */
  markdownSlug?: string;
  /** The site's address without a trailing slash. */
  siteUrl: string;
  /** The version of `@northguild/gmt`. */
  gmtVersion: string;
};

/** Serialise a JSON-LD object for a `<script>`: a `<` becomes `<`, so no text can close the tag. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function jsonLdEntry(value: unknown): HeadEntry {
  return {
    tag: "script",
    attrs: { type: "application/ld+json" },
    content: jsonLd(value),
  };
}

/** The ids above a page, nearest the root first: `a/b/c` gives `a`, `a/b`. */
function ancestorIds(id: string): string[] {
  const parts = id.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** The text of `<title>`: the full title on the home page, else the page's name and the suffix. */
export function pageTitle(input: Pick<HeadInput, "id" | "data">): string {
  if (isHomeId(input.id)) return input.data.title;
  return `${input.data.headTitle ?? input.data.title}${TITLE_SUFFIX}`;
}

/**
 * The tags to set on a docs page. Each replaces a tag of the same kind Starlight wrote
 * (`upsertHead`), except the JSON-LD blocks and the Markdown link, which are added.
 */
export function headEntries(input: HeadInput): HeadEntry[] {
  const { id, data, siteUrl } = input;
  const home = isHomeId(id);
  const shareTitle = data.headTitle ?? data.title;
  const description = data.description || input.siteDescription;
  const image = `${siteUrl}/og/${ogImageKey(id)}.png`;
  const pageUrl = home ? `${siteUrl}/` : `${siteUrl}/${id}/`;

  const entries: HeadEntry[] = [
    { tag: "title", content: pageTitle(input) },
    { tag: "meta", attrs: { property: "og:title", content: shareTitle } },
    {
      tag: "meta",
      attrs: { property: "og:type", content: home ? "website" : "article" },
    },
    { tag: "meta", attrs: { property: "og:image", content: image } },
    {
      tag: "meta",
      attrs: {
        property: "og:image:width",
        content: String(OG_IMAGE_SIZE.width),
      },
    },
    {
      tag: "meta",
      attrs: {
        property: "og:image:height",
        content: String(OG_IMAGE_SIZE.height),
      },
    },
    { tag: "meta", attrs: { property: "og:image:alt", content: shareTitle } },
    { tag: "meta", attrs: { name: "twitter:image", content: image } },
    {
      tag: "meta",
      attrs: { name: "twitter:card", content: "summary_large_image" },
    },
  ];

  if (input.markdownSlug !== undefined) {
    entries.push({
      tag: "link",
      attrs: {
        rel: "alternate",
        type: "text/markdown",
        href: `${siteUrl}/${input.markdownSlug}.md`,
      },
    });
  }

  if (home) {
    entries.push(
      jsonLdEntry({
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: "@northguild/gmt",
        alternateName: SITE_NAME,
        description,
        url: `${siteUrl}/`,
        codeRepository: CODE_REPOSITORY,
        programmingLanguage: ["TypeScript", "JavaScript"],
        license: "https://spdx.org/licenses/MIT.html",
        version: input.gmtVersion,
        runtimePlatform: "JavaScript",
      }),
    );
  } else if (input.markdownSlug !== undefined) {
    const trail = ancestorIds(id).flatMap((ancestor) => {
      const found = input.hasEntry(ancestor);
      return found
        ? [{ name: found.title, item: `${siteUrl}/${ancestor}/` }]
        : [];
    });
    const crumbs = [
      { name: SITE_NAME, item: `${siteUrl}/` },
      ...trail,
      { name: data.title },
    ];
    entries.push(
      jsonLdEntry({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, i) => ({
          "@type": "ListItem",
          position: i + 1,
          ...crumb,
        })),
      }),
    );
  }

  if (
    id.startsWith("guides/") ||
    (id.startsWith("migrate/") && id !== "migrate/index")
  ) {
    const article: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: shareTitle,
      description,
      url: pageUrl,
    };
    if (input.lastUpdated) {
      article.dateModified = Temporal.Instant.fromEpochMilliseconds(
        input.lastUpdated.valueOf(),
      ).toString();
    }
    entries.push(jsonLdEntry(article));
  }

  return entries;
}

/** The key two entries share when one replaces the other, or undefined when an entry is only added. */
function replaceKey(entry: HeadEntry): string | undefined {
  const attrs = entry.attrs ?? {};
  if (entry.tag === "title") return "title";
  if (entry.tag === "meta") {
    if (typeof attrs.name === "string") return `meta:name:${attrs.name}`;
    if (typeof attrs.property === "string")
      return `meta:property:${attrs.property}`;
    return undefined;
  }
  if (entry.tag === "link" && attrs.rel === "alternate") {
    return `link:alternate:${String(attrs.type)}`;
  }
  return undefined;
}

/**
 * Put `entry` in `head`: it takes the place of an entry with the same `title` tag, `meta[name]`,
 * `meta[property]` or alternate-link type, and is added after the others when there is none. An
 * identical entry already there is not repeated.
 */
export function upsertHead(head: HeadEntry[], entry: HeadEntry): HeadEntry[] {
  const key = replaceKey(entry);
  if (key !== undefined) {
    const at = head.findIndex((existing) => replaceKey(existing) === key);
    if (at !== -1) {
      return head.map((existing, i) => (i === at ? entry : existing));
    }
  } else if (head.some((existing) => sameEntry(existing, entry))) {
    return head;
  }
  return [...head, entry];
}

function sameEntry(a: HeadEntry, b: HeadEntry): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
