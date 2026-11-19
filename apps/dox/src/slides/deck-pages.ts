/**
 * Each deck's page component, by registry slug: `src/pages/slides/[slug]/` renders the one for the
 * page's slug. A deck takes one prop, `presenter`, which renders its slides as the presenter
 * view's hidden source. A new deck adds a row here beside its row in `decks.ts`.
 */
import Deck0 from "./give-me-temporal/Deck0.astro";

type DeckComponent = typeof Deck0;

const DECK_COMPONENTS: Readonly<Record<string, DeckComponent>> = {
  "give-me-temporal": Deck0,
};

/** The component for a deck's slug; a slug with no row here fails the build. */
export function deckComponent(slug: string): DeckComponent {
  const component = DECK_COMPONENTS[slug];
  if (component === undefined)
    throw new Error(`deck-pages.ts has no component for the deck "${slug}"`);
  return component;
}
