/* The origin and base path Dox is served from. Plain constants, not
   `import.meta.env.BASE_URL`: the Worker, Node scripts and Vitest (where
   `BASE_URL` is "/") import them too. Routes inside the site stay base-less;
   `/gmt` is added only where a URL leaves the code. */

/** The origin shared with the organisation landing page. */
export const SITE_ORIGIN = "https://northguild.dev";

/** The path Dox is served under. No trailing slash. */
export const SITE_BASE = "/gmt";

/** The site root without a trailing slash: `${SITE_URL}/install/`. */
export const SITE_URL = `${SITE_ORIGIN}${SITE_BASE}`;

/** The organisation landing page, one level above Dox. The header's NorthGuild mark links here. */
export const LANDING_URL = `${SITE_ORIGIN}/`;

/**
 * Whether a pathname is the base itself or sits below it. A segment match:
 * `/gmtx` is not under the base.
 */
export function isUnderBase(pathname: string): boolean {
  return pathname === SITE_BASE || pathname.startsWith(`${SITE_BASE}/`);
}

/**
 * Put a root-absolute site path under the base. Search and hash are kept.
 * A path already under the base is returned unchanged, so it cannot be doubled.
 * Throws `TypeError` for anything that is not a root-absolute path
 * (empty, relative, protocol-relative, a scheme or a fragment).
 */
export function withBase(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError(
      `withBase expects a root-absolute path such as "/install/", got ${JSON.stringify(path)}`,
    );
  }
  const end = path.search(/[?#]/);
  const pathname = end === -1 ? path : path.slice(0, end);
  if (isUnderBase(pathname)) return path;
  return `${SITE_BASE}${path}`;
}

/**
 * The inverse of `withBase`, for code that reads the current URL.
 * `/gmt` and `/gmt/` give `/`. A pathname not under the base is returned unchanged.
 */
export function stripBase(pathname: string): string {
  if (!isUnderBase(pathname)) return pathname;
  return pathname.slice(SITE_BASE.length) || "/";
}
