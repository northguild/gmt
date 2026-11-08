/**
 * Starlight route middleware, registered as `routeMiddleware` in `astro.config.mjs`.
 *
 * Runs once per page, after Starlight has built the route's `head`, and applies the tags from
 * `src/lib/head-tags.ts` to it. It also gives a directory index the industry tags of the pages
 * under it (`src/lib/page-industries.ts`), which `PageTitle.astro` shows. The 404 page gets no
 * share tags; it loses its canonical link and carries `noindex`: Starlight's canonical for it is
 * `/gmt/404/`, which redirects to `/gmt/404`, and a page that answers 404 is not one to index.
 * Starlight's 404 route uses the `splash` template, which renders no sidebar, so the 404 early
 * return below skips the lean sidebar too.
 *
 * The sidebar is trimmed here (`src/lib/lean-sidebar.ts`): the divider pagination fix runs first, on
 * the full tree, then every namespace but the page's own is cut to its Overview link.
 */
import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import { getCollection } from "astro:content";
import { gmtVersion } from "~/generated/versions";
import {
  headEntries,
  isHomeId,
  ogImageKey,
  removeHead,
  upsertHead,
} from "~/lib/head-tags";
import { leanSidebar, skipDividers } from "~/lib/lean-sidebar";
import { docsRelPath, markdownTwinSlugs } from "~/lib/md-twin";
import { ogCards, ogImageAlt } from "~/lib/og-cards";
import { pageIndustries, type PageEntry } from "~/lib/page-industries";
import { SITE_URL } from "~/lib/site";

/** The site's description, as `starlight({ description })` in `astro.config.mjs` sets it. */
const SITE_DESCRIPTION =
  "Date and time library for JavaScript and TypeScript, built on TC39 Temporal: time zones, DST, business days, ISO 8601 strings in and out. Never throws.";

type DocEntry = {
  id: string;
  filePath?: string;
  data: { title: string; industries?: string[]; template?: string };
};

/**
 * Each page's Markdown twin path, keyed by its path under `content/docs/`. Starlight's schema drops
 * the frontmatter `slug:` from `entry.data`, so the rule reads the raw sources, as the twin route does.
 */
const TWINS = markdownTwinSlugs(
  import.meta.glob("./content/docs/**/*.{md,mdx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
);

/** The docs collection, read once per build. */
const docsEntries = getCollection("docs") as Promise<DocEntry[]>;

/** The docs collection by route id. The home page is `""`. */
const docsById = docsEntries.then(
  (entries) =>
    new Map(
      entries.map((entry): [string, DocEntry] => [
        isHomeId(entry.id) ? "" : entry.id,
        entry,
      ]),
    ),
);

/** The share cards, built from the same collection as the `/og/…` route, once per build. */
const shareCards = docsEntries.then((entries) => ogCards(entries));

/** Every entry as the industry tags read it, built once per build. */
const pageEntries = docsEntries.then((entries): PageEntry[] =>
  entries.map((entry) => ({
    id: entry.id,
    industries: entry.data.industries,
    template: entry.data.template,
  })),
);

export const onRequest = defineRouteMiddleware(async (context) => {
  const route = context.locals.starlightRoute;
  if (route.id === "404") {
    route.head = upsertHead(
      removeHead(route.head, "link", { rel: "canonical" }),
      {
        tag: "meta",
        attrs: { name: "robots", content: "noindex" },
      },
    );
    return;
  }

  route.pagination = skipDividers(route.sidebar, route.pagination);
  route.sidebar = leanSidebar(route.sidebar, route.id);

  const docs = await docsById;
  const id = isHomeId(route.id) ? "" : route.id;
  const entry = docs.get(id);
  const data = route.entry.data;

  // A directory index declares no tags of its own; it shows those of the pages under it.
  const tags = pageIndustries(route.id, data.industries, await pageEntries);
  if (tags.length > 0) data.industries = tags;

  const key = ogImageKey(id);
  const card = (await shareCards)[key];
  if (!card) throw new Error(`[route-data] no share card for "${key}"`);

  const added = headEntries({
    id,
    data: {
      title: data.title,
      headTitle: (data as { headTitle?: string }).headTitle,
      description: data.description,
    },
    siteDescription: SITE_DESCRIPTION,
    lastUpdated: route.lastUpdated,
    hasEntry: (ancestor) => {
      const found = docs.get(ancestor);
      return found ? { title: found.data.title } : undefined;
    },
    markdownSlug: entry?.filePath
      ? TWINS.get(docsRelPath(entry.filePath))
      : undefined,
    shareAlt: ogImageAlt(card),
    siteUrl: SITE_URL,
    gmtVersion,
  });

  let head = route.head;
  for (const tag of added) head = upsertHead(head, tag);
  route.head = head;
});
