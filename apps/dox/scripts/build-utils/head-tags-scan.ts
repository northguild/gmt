/**
 * Reads the `<head>` tags of one built HTML page that `scripts/head-tags.test.ts` checks.
 *
 * Pure: it takes the page's text and returns what it found. The tags are the ones Astro and
 * Starlight write, quoted attributes in any order, so a scan with a regular expression per tag is
 * enough and adds no HTML parser to the app.
 */

/** What a page's `<head>` says, and any edit link in its body. */
export type HeadScan = {
  /** Every `<title>` element's text; a page has exactly one. */
  titles: string[];
  description: string | undefined;
  canonical: string | undefined;
  /** The page asks not to be indexed (`<meta name="robots" content="noindex">`). */
  noindex: boolean;
  ogImage: string | undefined;
  twitterImage: string | undefined;
  ogTitle: string | undefined;
  /** The `href` of each `<link rel="alternate" type="text/markdown">`. */
  markdownAlternates: string[];
  /** The text of each `<script type="application/ld+json">`. */
  jsonLd: string[];
  /** The `href` of each link to a file's edit page on GitHub. The site carries none. */
  editLinks: string[];
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
};

/** Text with the entities Astro writes in an attribute or a title put back. */
export function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (e) => ENTITIES[e]);
}

/** The attributes of one start tag, by name. A bare attribute is the empty string. */
export function attributesOf(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern =
    /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const inside = tag.replace(/^<[a-zA-Z0-9-]+/, "").replace(/\/?>$/, "");
  for (const match of inside.matchAll(pattern)) {
    attrs[match[1].toLowerCase()] = decodeEntities(
      match[2] ?? match[3] ?? match[4] ?? "",
    );
  }
  return attrs;
}

/** A GitHub edit page, in any repository or branch. */
const EDIT_LINK = /^https:\/\/github\.com\/[^/]+\/[^/]+\/edit\//;

/** A start tag by name. A quoted attribute value may hold a `>`, so quotes are matched whole. */
function startTag(name: string): RegExp {
  return new RegExp(`<${name}\\b(?:"[^"]*"|'[^']*'|[^>"'])*>`, "g");
}

/** Read the tags of one built page. */
export function scanHead(html: string): HeadScan {
  const scan: HeadScan = {
    titles: [],
    description: undefined,
    canonical: undefined,
    noindex: false,
    ogImage: undefined,
    twitterImage: undefined,
    ogTitle: undefined,
    markdownAlternates: [],
    jsonLd: [],
    editLinks: [],
  };

  for (const match of html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/g)) {
    scan.titles.push(decodeEntities(match[1]).trim());
  }

  for (const match of html.matchAll(startTag("meta"))) {
    const attrs = attributesOf(match[0]);
    const content = attrs.content;
    if (content === undefined) continue;
    if (attrs.name === "description") scan.description = content;
    else if (attrs.name === "robots" && /noindex/i.test(content)) {
      scan.noindex = true;
    } else if (attrs.name === "twitter:image") scan.twitterImage = content;
    else if (attrs.property === "og:image") scan.ogImage = content;
    else if (attrs.property === "og:title") scan.ogTitle = content;
  }

  for (const match of html.matchAll(startTag("link"))) {
    const attrs = attributesOf(match[0]);
    if (attrs.rel === "canonical") scan.canonical = attrs.href;
    else if (attrs.rel === "alternate" && attrs.type === "text/markdown") {
      if (attrs.href !== undefined) scan.markdownAlternates.push(attrs.href);
    }
  }

  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g,
  )) {
    scan.jsonLd.push(match[1]);
  }

  for (const match of html.matchAll(/<a\b[^>]*>/g)) {
    const href = attributesOf(match[0]).href;
    if (href !== undefined && EDIT_LINK.test(href)) scan.editLinks.push(href);
  }

  return scan;
}
