/**
 * The share images, one PNG per guide, tool and scenario, per reference namespace, and `site` for
 * every other page: about 160 files, never one per reference page. `ogImageKey` in
 * `src/lib/head-tags.ts` says which image a page points at, `ogCards` in `src/lib/og-cards.ts`
 * says what each card reads, and `src/lib/og-art.ts` draws it.
 */
import { getCollection } from "astro:content";
import type { APIRoute, GetStaticPaths } from "astro";
import { renderCard } from "~/lib/og-art";
import { ogCards, type OgDocEntry } from "~/lib/og-cards";

const docs: OgDocEntry[] = await getCollection("docs");
const cards = ogCards(docs);

export const getStaticPaths = (() =>
  Object.keys(cards).map((key) => ({
    params: { route: `${key}.png` },
    props: { key },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderCard(cards[props.key as string]);
  return new Response(png as Uint8Array<ArrayBuffer>, {
    headers: { "Content-Type": "image/png" },
  });
};
