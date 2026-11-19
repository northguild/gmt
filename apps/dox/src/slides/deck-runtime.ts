/**
 * Each deck's client-side data, looked up by slug. The generic runtime in `lib/slides/` knows no
 * deck: the mount and the presenter view read `data-deck-slug`, load that deck's runtime here, and
 * pass it to the stage and the visuals. A new deck adds one row and a `src/slides/<slug>/runtime.ts`;
 * nothing under `lib/slides/` changes. The live panels are not here: they get their data at build
 * time, as props from the deck's `.astro`.
 *
 * Each row is a dynamic import, so a deck's data never reaches another page's bundle and stays off
 * the first paint.
 */
import { NO_STAGE_DATA, type DeckStageData } from "~/lib/slides/stage-data";

export interface DeckRuntime {
  /** Places, time-lapses, pins and readiness rows the space stage and presenter view need. */
  stage: DeckStageData;
}

const RUNTIMES: Readonly<
  Record<string, () => Promise<{ runtime: DeckRuntime }>>
> = {
  "give-me-temporal": () => import("./give-me-temporal/runtime"),
};

/** The deck's runtime, or `null` for a slug with none. */
export async function loadDeckRuntime(
  slug: string,
): Promise<DeckRuntime | null> {
  const load = RUNTIMES[slug];
  return load ? (await load()).runtime : null;
}

/** The slugs that have a runtime; `decks.test.ts` checks each is a registered deck. */
export const RUNTIME_SLUGS: readonly string[] = Object.keys(RUNTIMES);

/**
 * The stage data of the deck a page renders, for `<Slide>` and `<Build>` to check their names
 * against while the page builds. Every deck page is `src/pages/slides/[slug]/`, so `slug` is the
 * page's route parameter; a deck with no runtime has no places or lapses of its own.
 */
export async function deckStage(
  slug: string | undefined,
): Promise<DeckStageData> {
  if (slug === undefined)
    throw new Error(
      "A slide renders only on a deck page, src/pages/slides/[slug]/",
    );
  return (await loadDeckRuntime(slug))?.stage ?? NO_STAGE_DATA;
}
