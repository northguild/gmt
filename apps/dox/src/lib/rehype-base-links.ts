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

export interface HastNode {
  type: string;
  tagName?: string;
  name?: string | null;
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

const POSTER_TAGS = new Set(["video"]);

/** MDX JSX attribute names whose string value is a URL, and how to rewrite it. */
const MDX_URL_ATTRS: Record<string, (value: string) => string> = {
  href: prefix,
  src: prefix,
  poster: prefix,
  srcset: prefixSrcset,
  srcSet: prefixSrcset,
};

/** A plain string literal in expression text: `"/x.png"` or `'/x.png'`, no escapes. */
const STRING_LITERAL = /^(\s*)(["'])([^"'\\\n]*)\2(\s*)$/;

interface EstreeNode {
  type?: string;
  value?: unknown;
  raw?: string;
  body?: EstreeNode[];
  expression?: EstreeNode;
}

/**
 * Rewrite `{"/x.png"}`: both the expression text and the estree Literal the MDX compiler reads,
 * so the compiled output carries the prefixed URL. Any other expression is left alone.
 */
function prefixExpression(
  expression: { value?: unknown; data?: unknown },
  rewrite: (value: string) => string,
): void {
  if (typeof expression.value !== "string") return;
  const m = STRING_LITERAL.exec(expression.value);
  if (m === null) return;
  const next = rewrite(m[3]);
  if (next === m[3]) return;
  expression.value = `${m[1]}${m[2]}${next}${m[2]}${m[4]}`;
  const estree = (expression.data as { estree?: EstreeNode } | undefined)
    ?.estree;
  const literal = estree?.body?.[0]?.expression;
  if (literal?.type === "Literal" && typeof literal.value === "string") {
    literal.value = next;
    literal.raw = `${m[2]}${next}${m[2]}`;
  }
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
      POSTER_TAGS.has(node.tagName) &&
      typeof properties.poster === "string"
    ) {
      properties.poster = prefix(properties.poster);
    }
    if (SRCSET_TAGS.has(node.tagName)) {
      for (const key of ["srcSet", "srcset"]) {
        if (typeof properties[key] === "string") {
          properties[key] = prefixSrcset(properties[key]);
        }
      }
    }
  } else if (
    node.type === "mdxJsxFlowElement" ||
    node.type === "mdxJsxTextElement"
  ) {
    for (const attribute of node.attributes ?? []) {
      if (attribute.type !== "mdxJsxAttribute" || attribute.name === undefined)
        continue;
      const rewrite = MDX_URL_ATTRS[attribute.name];
      if (rewrite === undefined) continue;
      if (typeof attribute.value === "string") {
        attribute.value = rewrite(attribute.value);
      } else if (
        typeof attribute.value === "object" &&
        attribute.value !== null
      ) {
        prefixExpression(attribute.value, rewrite);
      }
    }
  }
  for (const child of node.children ?? []) visit(child);
}

export default function rehypeBaseLinks() {
  return (tree: HastNode) => visit(tree);
}
