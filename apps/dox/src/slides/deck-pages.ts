/**
 * Each deck's page component, by registry slug, and the routes `src/pages/slides/[slug]/` builds
 * from them: both pages there take `deckRoutes` as their `getStaticPaths`. A deck takes one prop,
 * `presenter`, which renders its slides as the presenter view's hidden source. A new deck adds a
 * row here beside its row in `decks.ts`.
 */
import { DECKS, type DeckEntry } from "./decks";
import Deck0 from "./give-me-temporal/Deck0.astro";

type DeckComponent = typeof Deck0;

const DECK_COMPONENTS: Readonly<Record<string, DeckComponent>> = {
  "give-me-temporal": Deck0,
};

/** The component for a deck's slug; a slug with no row here fails the build. */
function deckComponent(slug: string): DeckComponent {
  const component = DECK_COMPONENTS[slug];
  if (component === undefined)
    throw new Error(`deck-pages.ts has no component for the deck "${slug}"`);
  return component;
}

/** A deck page's props: the registry row and the deck's component. */
export interface DeckRoute {
  readonly deck: DeckEntry;
  readonly Deck: DeckComponent;
}

/** One route per registry row, for a `[slug]` page's `getStaticPaths`. */
export function deckRoutes(): { params: { slug: string }; props: DeckRoute }[] {
  return DECKS.map((deck) => ({
    params: { slug: deck.slug },
    props: { deck, Deck: deckComponent(deck.slug) },
  }));
}
