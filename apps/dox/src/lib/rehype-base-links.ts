/**
 * Rehype plugin: puts the site base (`/gmt`) in front of every root-absolute URL in Markdown and
 * MDX content.
 *
 * Neither Astro nor Starlight does this: `base` reaches the links the framework writes (sidebar,
 * pagination, canonical) but not a link an author typed
 * ([Astro `base`](https://docs.astro.build/en/reference/configuration-reference/#base)). The
 * content source stays base-less, so the routes, the corpus and the generators do not change.
 *
 * One rule: a URL that starts with `/` but not `//` becomes `withBase(url)`. Absolute URLs,
 * protocol-relative URLs, `#` anchors, `mailto:` and relative paths are left alone, and a path
 * already under the base is not doubled.
 */
import { withBase } from "./site";

interface HastNode {
  type: string;
  tagName?: string;
  name?: string;
  properties?: Record<string, unknown>;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: HastNode[];
}

const HREF_TAGS = new Set(["a", "area"]);
const SRC_TAGS = new Set([
  "img",
  "source",
  "video",
  "audio",
  "track",
  "iframe",
]);
const SRCSET_TAGS = new Set(["img", "source"]);

/** Root-absolute: `/x`, not `//host`. */
function isRootAbsolute(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

function prefix(value: string): string {
  return isRootAbsolute(value) ? withBase(value) : value;
}

function prefixSrcset(value: string): string {
  return value
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      const space = trimmed.search(/\s/);
      const url = space === -1 ? trimmed : trimmed.slice(0, space);
      const rest = space === -1 ? "" : trimmed.slice(space);
      return `${prefix(url)}${rest}`;
    })
    .join(", ");
}

function visit(node: HastNode): void {
  if (node.type === "element" && node.tagName && node.properties) {
    const properties = node.properties;
    if (HREF_TAGS.has(node.tagName) && typeof properties.href === "string") {
      properties.href = prefix(properties.href);
    }
    if (SRC_TAGS.has(node.tagName) && typeof properties.src === "string") {
      properties.src = prefix(properties.src);
    }
    if (
      SRCSET_TAGS.has(node.tagName) &&
      typeof properties.srcSet === "string"
    ) {
      properties.srcSet = prefixSrcset(properties.srcSet);
    }
  } else if (
    node.type === "mdxJsxFlowElement" ||
    node.type === "mdxJsxTextElement"
  ) {
    for (const attribute of node.attributes ?? []) {
      if (
        attribute.type === "mdxJsxAttribute" &&
        (attribute.name === "href" || attribute.name === "src") &&
        typeof attribute.value === "string"
      ) {
        attribute.value = prefix(attribute.value);
      }
    }
  }
  for (const child of node.children ?? []) visit(child);
}

export default function rehypeBaseLinks() {
  return (tree: HastNode) => visit(tree);
}
