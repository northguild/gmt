/**
 * The one rule for where a link opens: an external link opens in a new tab, so a reader following
 * a filing or a citation keeps the page open behind it, and the new tab cannot reach back through
 * `window.opener`. Every link home reads it: `Link.astro`, `ask/Link.tsx`, the widgets' `link`
 * builder, `ButtonLink`, `HeroActions` and the Markdown plugin (`rehype-external-links.ts`).
 *
 * "External" is an absolute `http(s)://` or protocol-relative `//` URL. Relative links, `#`
 * anchors and `mailto:` stay in the same tab.
 */

const EXTERNAL = /^(https?:)?\/\//;

export const isExternalHref = (href: string | undefined): boolean =>
  href !== undefined && EXTERNAL.test(href);

/** `rel` tokens as a list, from a string, a list or nothing. */
export function relTokens(rel: unknown): string[] {
  if (Array.isArray(rel)) return rel.map(String);
  if (typeof rel === "string") return rel.split(/\s+/).filter(Boolean);
  return [];
}

/**
 * A link's `target` and `rel`: for an external `href`, `_blank` and the caller's `rel` with
 * `noopener noreferrer` added; otherwise the caller's `rel` as given. `isExternal` defaults from
 * the `href`; a caller sets it to treat a site link as external too, where following it in the same
 * tab would lose what is on screen (the chat's conversation).
 */
export function linkTarget(
  href: string | undefined,
  rel?: string,
  isExternal: boolean = isExternalHref(href),
): { target: "_blank" | undefined; rel: string | undefined } {
  if (!isExternal) return { target: undefined, rel: rel || undefined };
  const tokens = relTokens(rel);
  for (const token of ["noopener", "noreferrer"])
    if (!tokens.includes(token)) tokens.push(token);
  return { target: "_blank", rel: tokens.join(" ") };
}
