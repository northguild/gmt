/// <reference types="vitest/globals" />
/**
 * Keeps the corpus figures shown on the empty chat screen honest.
 *
 * `CORPUS_SUMMARY` is a hardcoded string in the client bundle — deriving it
 * would drag the 536 KB generated corpus and the content collection into the
 * chat island for the sake of three numbers.
 *
 * The numbers are now **generated** (`scripts/build-corpus-counts.ts`), so this
 * no longer demands a hand-edit whenever the library grows — which it did on
 * three separate merges: 591/755, then 597/761, then 618/782.
 *
 * What it guards now is the one seam the generator could not remove. The counts
 * are derived under Node, walking the guides tree with `fs`; the corpus the
 * Worker and the tests actually search is built under Vite, from
 * `import.meta.glob`. Both call the same `toGuideSource` and the same
 * `buildGuideChunks`, so only the *file discovery* differs — and this asserts
 * the two see the same set. A guide the glob picks up and the walk misses (or
 * the reverse) would otherwise make the advertised figure quietly wrong.
 */
import { corpus } from "~/generated/reference/corpus";
import {
  CORPUS_CHUNK_COUNT,
  CORPUS_FUNCTION_COUNT,
  CORPUS_GUIDE_COUNT,
  CORPUS_REFERENCE_COUNT,
  CORPUS_SUMMARY,
} from "~/lib/chat-constants";
import { buildRetrievalCorpus } from "./corpus";

const chunks = buildRetrievalCorpus();

describe("CORPUS_SUMMARY", () => {
  // Every reference entry — function, type or regex pattern — becomes one chunk of kind
  // "function", so the chunk kind is not the figure the screen calls "functions".
  it("matches the real number of reference chunks", () => {
    expect(chunks.filter((c) => c.kind === "function")).toHaveLength(
      CORPUS_REFERENCE_COUNT,
    );
  });

  it("counts only function entries as functions", () => {
    expect(corpus.filter((e) => e.kind === "function")).toHaveLength(
      CORPUS_FUNCTION_COUNT,
    );
    expect(CORPUS_FUNCTION_COUNT).toBeLessThan(CORPUS_REFERENCE_COUNT);
  });

  it("matches the real number of guide chunks", () => {
    expect(chunks.filter((c) => c.kind === "guide")).toHaveLength(
      CORPUS_GUIDE_COUNT,
    );
  });

  it("matches the real total", () => {
    expect(chunks).toHaveLength(CORPUS_CHUNK_COUNT);
  });

  it("renders the numbers it was built from", () => {
    expect(CORPUS_SUMMARY).toContain(String(CORPUS_FUNCTION_COUNT));
    expect(CORPUS_SUMMARY).toContain(String(CORPUS_CHUNK_COUNT));
  });
});
