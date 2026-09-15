/**
 * Rehype plugin: every external link in Markdown and MDX content opens in a new tab, so a reader
 * following a citation (TC39, an RFC, IANA) keeps the docs open behind it.
 *
 * "External" is the same test `ButtonLink.astro` uses: an absolute `http(s)://` or
 * protocol-relative `//` URL. Relative links, `#` anchors and `mailto:` stay in the same tab.
 * `rel="noopener noreferrer"` is appended to any `rel` the link already has, so a new tab
 * cannot reach back into this page through `window.opener`.
 */

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const EXTERNAL = /^(https?:)?\/\//;

function relTokens(rel: unknown): string[] {
  if (Array.isArray(rel)) return rel.map(String);
  if (typeof rel === "string") return rel.split(/\s+/).filter(Boolean);
  return [];
}

function visit(node: HastNode): void {
  if (node.type === "element" && node.tagName === "a") {
    const properties = (node.properties ??= {});
    const href = properties.href;
    if (typeof href === "string" && EXTERNAL.test(href)) {
      properties.target = "_blank";
      const rel = relTokens(properties.rel);
      for (const token of ["noopener", "noreferrer"]) {
        if (!rel.includes(token)) rel.push(token);
      }
      properties.rel = rel;
    }
  }
  for (const child of node.children ?? []) visit(child);
}

export default function rehypeExternalLinks() {
  return (tree: HastNode) => visit(tree);
}
