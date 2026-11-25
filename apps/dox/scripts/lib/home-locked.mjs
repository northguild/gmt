/**
 * Whether the landing is locked: a landscape screen 64rem wide and up, where the carousel pages
 * and the zone drawer is a slide-over. Elsewhere the landing stacks.
 *
 * `HOME_LOCKED_QUERY` (src/lib/home-carousel.ts) is the query's home. A gate runs in Node, where
 * the site's TypeScript does not load, so this is its one copy for the gates, and
 * `home-locked.test.ts` holds the two equal.
 */
export const LOCKED_QUERY = "(width >= 64rem) and (orientation: landscape)";

/** True when the landing in `page` is locked at its viewport. */
export const isLocked = (page) =>
  page.evaluate((query) => matchMedia(query).matches, LOCKED_QUERY);
