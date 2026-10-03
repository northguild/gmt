/**
 * Where each reference page lives, and where each public type is documented.
 *
 * Pure: names and the usage graph in, URLs out. Every link the generator emits to a type
 * goes through `typeUrl`, so a type that moves between its own page and a function's page
 * moves in one place.
 *
 * Every URL is root-absolute. A bare-relative `reference/...` link resolves against the
 * current page's directory and doubles the path.
 */

import type { TypeUsage } from "./type-usage";

/** The section shared types live in: `/reference/types/<Name>`, with no module level. */
export const TYPES_SECTION = "types";

/** The page of a function or regex, from its key (`${ns}/${mod}/${name}`). */
export function functionUrl(key: string): string {
  return `/reference/${key}`;
}

/** The page of a type that two or more public functions reach. */
export function typePageUrl(name: string): string {
  return `/reference/${TYPES_SECTION}/${name}`;
}

/** Starlight `slug:` frontmatter of a shared type's page: relative, no leading slash. */
export function typePageSlug(name: string): string {
  return `reference/${TYPES_SECTION}/${name}`;
}

/**
 * Where a type's page used to be, when every type had a page beside its source file:
 * `/reference/<ns>/<mod>/<Name>`. A pure function of the source path, so the redirects are
 * derived and no list of old URLs is kept.
 */
export function legacyTypeUrl(
  namespace: string,
  module: string,
  name: string,
): string {
  return `/reference/${namespace}/${module}/${name}`;
}

/** The route that serves a type: its own page, or the page of the function that holds it. */
export function typeRoute(usage: TypeUsage, name: string): string | undefined {
  const node = usage.types.get(name);
  if (!node) return undefined;
  return node.placement.kind === "page"
    ? typePageUrl(name)
    : functionUrl(node.placement.owner);
}

/**
 * The URL of a public type's documentation, or undefined when the name is not a public type.
 * A shared type has a page; a single-use type is a heading on its function's page.
 *
 * `from` is the key of the function page the link is written on: a link to a type on that
 * same page is the bare `#anchor`.
 */
export function typeUrl(
  usage: TypeUsage,
  name: string,
  from?: string,
): string | undefined {
  const node = usage.types.get(name);
  if (!node) return undefined;
  if (node.placement.kind === "page") return typePageUrl(name);
  const { owner, anchor } = node.placement;
  return owner === from ? `#${anchor}` : `${functionUrl(owner)}#${anchor}`;
}

/**
 * The index routes above a set of page routes: every proper prefix of a page path, from
 * `/reference` down. `/reference/plain/calculate/addDate` yields `/reference`,
 * `/reference/plain` and `/reference/plain/calculate`.
 */
export function indexRoutes(pages: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const page of pages) {
    const parts = page.split("/").filter(Boolean);
    for (let depth = 1; depth < parts.length; depth++) {
      out.add(`/${parts.slice(0, depth).join("/")}`);
    }
  }
  return [...out].sort();
}
