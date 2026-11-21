/**
 * Deck 0's recorded Dox answers, read at build time from `recorded/*.json` and handed to
 * `DeckLive`. The glob must be a literal, so it lives here and not in `lib/slides/`.
 */
export const RECORDED: readonly unknown[] = Object.values(
  import.meta.glob<unknown>("./recorded/*.json", {
    eager: true,
    import: "default",
  }),
);
