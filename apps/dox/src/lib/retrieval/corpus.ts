/**
 * The whole retrieval corpus — reference functions plus guide sections.
 *
 * Extracted from `pages/retrieval-chunks.json.ts` so the corpus the Worker
 * actually serves and the corpus the tests search are assembled by the same
 * code. Before this existed, `search.test.ts` built its chunks from
 * `buildFunctionChunks(corpus)` alone, which quietly meant every claim about
 * retrieval quality was made against 78% of the corpus: the 164 guide sections
 * — where the conceptual answers live — were searched by no test at all.
 *
 * Node-only: `loadGuideSources` reads the content collection through
 * `import.meta.glob`. The Worker never calls this; it fetches the built JSON.
 */
import { buildFunctionChunks } from "./function-chunks";
import { buildGuideChunks } from "./guide-chunks";
import { loadGuideSources } from "./guide-sources";
import type { RetrievalChunk } from "./types";
import { corpus } from "~/generated/reference/corpus";

export function buildRetrievalCorpus(): RetrievalChunk[] {
  return [
    ...buildFunctionChunks(corpus),
    ...buildGuideChunks(loadGuideSources()),
  ];
}
