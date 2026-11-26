/**
 * Which share cards the site has and what each says: `site`, one per guide, tool, scenario,
 * migration and comparison page, and one per reference namespace. Only `site` carries a line; every
 * other card is its title. Pure and free of `astro:`
 * imports, so the `/og/…` route and the layout test both read it.
 */
import { ogImageKey } from "./head-tags";
import type { OgCard } from "./og-art";

/** The line under `GMT` on the site card: the first sentence of the home hero's tagline. */
export const SITE_CARD_LINE =
  "The most tested and most precise date and time library for JavaScript.";

/** A docs page as the cards read it: its route id and its frontmatter. */
export type OgDocEntry = {
  id: string;
  data: { title: string };
};

export function ogCards(docs: readonly OgDocEntry[]): Record<string, OgCard> {
  const cards: Record<string, OgCard> = {
    site: { kind: "site", line: SITE_CARD_LINE },
  };
  for (const entry of docs) {
    const key = ogImageKey(entry.id);
    if (key === "site" || key in cards) continue;
    if (key.startsWith("reference/")) {
      // A reference page: its namespace's card.
      cards[key] = {
        kind: "page",
        title: `API reference: ${key.slice("reference/".length)}`,
      };
    } else {
      // A guide, a tool or a scenario: its own card.
      cards[key] = { kind: "page", title: entry.data.title };
    }
  }
  return cards;
}

/** What the card shows behind its text; the alt names it so a reader who cannot see the image knows. */
const CARD_SCENE = "over the Earth seen from above the North Atlantic.";

/**
 * The alt text of a card (`og:image:alt`, `twitter:image:alt`): what is on the image, built from the
 * card itself. The site card quotes its line, a page card its title.
 */
export function ogImageAlt(card: OgCard): string {
  return card.kind === "site"
    ? `GMT share card: "${card.line}" ${CARD_SCENE}`
    : `Share card: "${card.title}" ${CARD_SCENE}`;
}
