/**
 * The rule for a link to a Dox page: it ends in a slash.
 *
 * The static host serves a page at `/gmt/<path>/`. A link without the slash costs a redirect, and a
 * search engine crawls and reports the page under both URLs. The build scanners
 * (`scripts/build-utils/dist-base.ts`) and the `rendered-links` gate (`scripts/rendered-links.mjs`)
 * use this one predicate, so the two checks cannot disagree.
 */

/** The site's origin; equal to `SITE_ORIGIN` in `src/lib/site.ts`. */
export const ORIGIN = "https://northguild.dev";
/** The site's base path; equal to `SITE_BASE` in `src/lib/site.ts`. */
export const BASE = "/gmt";

/** `/gmt` or `/gmt/…`, and not a doubled `/gmt/gmt`. */
export function underBase(pathname) {
  if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) return false;
  return !(pathname === `${BASE}/gmt` || pathname.startsWith(`${BASE}/gmt/`));
}

/**
 * Whether a URL links to a Dox page without the trailing slash: root-absolute or on the site's
 * origin, under `/gmt`, and with no dot in its last path segment (a dot names a file).
 */
export function isPageLinkWithoutSlash(value) {
  let pathname;
  if (value.startsWith("/") && !value.startsWith("//"))
    pathname = value.split(/[?#]/)[0];
  else if (value.startsWith(`${ORIGIN}/`))
    pathname = value.slice(ORIGIN.length).split(/[?#]/)[0];
  else return false;
  if (!underBase(pathname) || pathname.endsWith("/")) return false;
  return !pathname.slice(pathname.lastIndexOf("/") + 1).includes(".");
}

/**
 * An `href` attribute as written, made a root-absolute path when it is relative (`./x`, `../x`, `x`,
 * `?q`) by resolving it against the URL of the page that holds it. A root-absolute, protocol-
 * relative, absolute-URL or hash-only value is returned as it is.
 */
export function resolveHref(value, pageUrl) {
  if (
    value === "" ||
    value.startsWith("/") ||
    value.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return value;
  }
  const resolved = new URL(value, pageUrl);
  return resolved.pathname + resolved.search + resolved.hash;
}
