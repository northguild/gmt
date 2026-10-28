/**
 * Starlight route middleware, registered as `routeMiddleware` in `astro.config.mjs`.
 *
 * Runs once per page, after Starlight has built the route's `head`, and applies the tags from
 * `src/lib/head-tags.ts` to it. The 404 page is left as Starlight made it.
 */
import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import { getCollection } from "astro:content";
import { gmtVersion } from "~/generated/versions";
import { headEntries, isHomeId, upsertHead } from "~/lib/head-tags";
import { markdownTwinSlug } from "~/lib/md-twin";
import { SITE_URL } from "~/lib/site";

/** The site's description, as `starlight({ description })` in `astro.config.mjs` sets it. */
const SITE_DESCRIPTION =
  "Date and time library for JavaScript and TypeScript, built on TC39 Temporal: time zones, DST, business days, ISO 8601 strings in and out. Never throws.";

type DocEntry = {
  id: string;
  filePath?: string;
  data: { title: string };
};

/** The docs collection by route id, read once per build. The home page is `""`. */
const docsById = getCollection("docs").then(
  (entries: DocEntry[]) =>
    new Map(
      entries.map((entry): [string, DocEntry] => [
        isHomeId(entry.id) ? "" : entry.id,
        entry,
      ]),
    ),
);

export const onRequest = defineRouteMiddleware(async (context) => {
  const route = context.locals.starlightRoute;
  if (route.id === "404") return;

  const docs = await docsById;
  const id = isHomeId(route.id) ? "" : route.id;
  const entry = docs.get(id);
  const data = route.entry.data;

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
    markdownSlug: entry
      ? markdownTwinSlug(entry.id, entry.filePath ?? "")
      : undefined,
    siteUrl: SITE_URL,
    gmtVersion,
  });

  let head = route.head;
  for (const tag of added) head = upsertHead(head, tag);
  route.head = head;
});
