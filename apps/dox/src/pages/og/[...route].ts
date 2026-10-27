/**
 * The share images, one PNG per guide, tool and scenario, per reference namespace, and `site` for
 * every other page: about 140 files, never one per reference page. `ogImageKey` in
 * `src/lib/head-tags.ts` says which image a page points at.
 */
import { getCollection } from "astro:content";
import { OGImageRoute } from "astro-og-canvas";
import { ogImageKey } from "~/lib/head-tags";
import { ogImageOptions } from "~/lib/og-art";

const SITE_DESCRIPTION =
  "Date and time library for JavaScript and TypeScript, built on TC39 Temporal: time zones, DST, business days, ISO 8601 strings in and out. Never throws.";

type Card = { title: string; description: string };

type DocEntry = { id: string; data: { title: string; description?: string } };

const docs: DocEntry[] = await getCollection("docs");
const pages: Record<string, Card> = {
  site: { title: "GMT", description: SITE_DESCRIPTION },
};

for (const entry of docs) {
  const key = ogImageKey(entry.id);
  if (key === "site" || key in pages) continue;
  if (key.startsWith("reference/")) {
    // A reference page: its namespace's card, from the namespace index page.
    const index = docs.find((candidate: DocEntry) => candidate.id === key);
    pages[key] = {
      title: `API reference: ${key.slice("reference/".length)}`,
      description: index?.data.description ?? SITE_DESCRIPTION,
    };
  } else {
    // A guide, a tool or a scenario: its own card.
    pages[key] = {
      title: entry.data.title,
      description: entry.data.description ?? SITE_DESCRIPTION,
    };
  }
}

export const { getStaticPaths, GET } = await OGImageRoute({
  pages,
  getImageOptions: (_path, page: Card) => ogImageOptions(page),
});
