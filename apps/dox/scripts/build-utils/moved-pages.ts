/**
 * Pages of a released version that moved, each with the site path it had and the one it has
 * now. `buildRedirects` writes a 301 from the old path to the new page (the bare path, the
 * path with a trailing slash and the `.md` twin), so links from outside (search results, older
 * copies of the docs) keep working.
 *
 * A function that moved or was renamed is in `renamed-functions.ts`, which names the function
 * and gets its page from the generator. This list is for the pages with no function behind
 * them: an index page, or a guide.
 *
 * Add an entry only for a page a release published. The new path must stay a live page or
 * route, and the old path must no longer be one, or the generation fails. Remove an entry only
 * when the old URL no longer needs to resolve.
 *
 * A leaf data module: it imports nothing.
 */

export interface MovedPage {
  /** The path the page had, with no trailing slash: `/reference/duty`. */
  from: string;
  /** The path it has now, with no trailing slash: `/reference/workforce`. */
  to: string;
}

export const MOVED_PAGES: readonly MovedPage[] = [
  // The `duty` namespace became the `workforce` industry layer.
  { from: "/reference/duty", to: "/reference/workforce" },
  { from: "/reference/duty/calculate", to: "/reference/workforce/calculate" },
  { from: "/reference/duty/validate", to: "/reference/workforce/validate" },
  // The hours-of-work pages became the Workforce industry's guide and mistakes page.
  {
    from: "/guides/intervals/hours-of-work",
    to: "/guides/industries/workforce-hours-of-work",
  },
  { from: "/mistakes/duty", to: "/mistakes/workforce" },
];
