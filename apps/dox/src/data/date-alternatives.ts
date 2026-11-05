import { competitorComparisons } from "./library-comparison";
import { libraryStack, type Layer } from "./library-stack";

/**
 * The layers of the "alternatives inherit it" argument, in the order both the page and the text
 * surfaces show them: the standard, the layer built on it, `Date`, then every competitor.
 *
 * Temporal, `@northguild/gmt` and `Date` are structural anchors (`library-stack.ts`); every
 * competitor row comes from `library-comparison.ts`, the data behind the CI-execution chart, so a
 * new library needs an entry there and nowhere else. Here rather than in
 * `WhyDateAlternatives.astro` so the text surfaces render the same table.
 */
const competitorStack: Layer[] = competitorComparisons
  .filter((lib) => lib.kind && lib.detail && lib.foundation)
  .map((lib) => ({
    name: lib.displayName,
    detail: lib.bannedCompanions?.length
      ? `${lib.detail} Our gmt lint packages also ban the companion ${lib.bannedCompanions.join(", ")} package${lib.bannedCompanions.length > 1 ? "s" : ""}.`
      : lib.detail!,
    foundation: lib.foundation!,
    kind: lib.kind!,
  }));

// "wraps" rows read as branching off Date, so they follow it; "nonstandard" rows (currently just
// @internationalized/date) are their own case and read best last.
export const alternativesStack: Layer[] = [
  libraryStack[0]!,
  libraryStack[1]!,
  libraryStack[2]!,
  ...competitorStack.filter((l) => l.kind === "wraps"),
  ...competitorStack.filter((l) => l.kind === "nonstandard"),
];
