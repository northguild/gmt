/**
 * Rehype plugin: every external link in Markdown and MDX content opens in a new tab, by the site's
 * one rule (`external-link.ts`), so a reader following a citation (TC39, an RFC, IANA) keeps the
 * docs open behind it. The link's own `rel` tokens stay.
 */
import { linkTarget, relTokens } from "./external-link";

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function visit(node: HastNode): void {
  if (node.type === "element" && node.tagName === "a") {
    const properties = (node.properties ??= {});
    const href = properties.href;
    if (typeof href === "string") {
      const opens = linkTarget(href, relTokens(properties.rel).join(" "));
      if (opens.target) {
        properties.target = opens.target;
        properties.rel = relTokens(opens.rel);
      }
    }
  }
  for (const child of node.children ?? []) visit(child);
}

export default function rehypeExternalLinks() {
  return (tree: HastNode) => visit(tree);
}
