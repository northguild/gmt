import MiniSearch from "minisearch";
import type { RetrievalChunk } from "./types";

export interface SearchOptions {
  /** The namespace to bias toward, e.g. the current reference page's
   * namespace ("zoned") or a guide's top-level directory. A bias, not a
   * filter — DOX-C1's DoD requires a cross-namespace question to still
   * work, so an out-of-namespace chunk can still win on relevance alone. */
  namespace?: string;
  /** Chunks to return. DOX-C1's DoD: "roughly 10-20 chunks per question." */
  limit?: number;
}

const NAMESPACE_BOOST = 1.5;

// A natural-language question is full of words that appear in nearly every
// corpus entry ("a", "the", "what", "do", "for"...). Left in, they turn OR
// combination into "any word overlaps" — verified 2026-09-09: "format a date
// for display" (a real, in-corpus question) matched 489 of 591 chunks
// without this filter, because "a"/"for" alone matched hundreds of unrelated
// entries. Filtering them out is what makes the score gap in
// MIN_RELEVANCE_SCORE below meaningful instead of swamped by stopword noise.
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "do",
  "does",
  "did",
  "is",
  "are",
  "was",
  "were",
  "what",
  "how",
  "to",
  "of",
  "for",
  "in",
  "on",
  "at",
  "and",
  "or",
  "with",
  "from",
  "i",
  "me",
  "my",
  "you",
  "your",
  "it",
  "this",
  "that",
]);

function processTerm(term: string): string | false {
  const lower = term.toLowerCase();
  if (STOPWORDS.has(lower) || lower.length < 2) return false;
  return lower;
}

/* Empirically tuned against DOX-C1's four required question types plus
   genuinely out-of-domain probes. This is a property of *this* corpus's size
   and the boost/stopword settings above, not a universal constant — re-verify
   if either changes materially.

   First tuned 2026-09-09 against 591 function chunks. **Re-verified 2026-09-10
   against the whole 761-chunk corpus** (597 function + 164 guide), which is
   what the Worker actually searches — the original measurement was taken over
   the reference half alone, and the corpus has since grown by six functions.
   The threshold holds unchanged. Chunks clearing it, per question:

     what does formatDate do ........................  8   (2 guide)
     convert UTC to Tokyo timezone .................. 60  (22 guide)
     what happens during a DST gap .................. 18  (14 guide)
     addBusinessDay .................................  2   (0 guide)
     how do I handle a DST overlap .................. 57  (31 guide)

     recommend a pizza restaurant ...................  1
     translate to French ............................  0
     javascript sorting algorithm ...................  0
     how do I bake sourdough bread ..................  0
     what is the capital of Peru ....................  0
     write me a haiku about cats ....................  0

   The out-of-domain column is the one that matters: DOX-C2's refusal path is
   only honest if a question with no answer retrieves nothing, and a threshold
   that let 20 weak matches through would manufacture a context to improvise
   from. Note `processTerm`'s stopword list is doing most of that work — the
   same probes against an index built without it score an off-domain question
   like "how do I bake sourdough bread" into the hundreds. */
const MIN_RELEVANCE_SCORE = 8;

function buildIndex(chunks: RetrievalChunk[]): MiniSearch<RetrievalChunk> {
  const index = new MiniSearch<RetrievalChunk>({
    idField: "id",
    fields: ["title", "text"],
    storeFields: ["namespace"],
    processTerm,
    searchOptions: {
      // BM25's default field weights already favor short, exact matches —
      // boost `title` on top of that so a direct lookup ("what does
      // formatDate do") ranks the function's own chunk above a guide that
      // merely mentions the name in passing.
      boost: { title: 2 },
      prefix: true,
      fuzzy: 0.2,
    },
  });
  index.addAll(chunks);
  return index;
}

/**
 * DOX-C1 (#137) — keyword/BM25 retrieval over the chunk corpus, with a
 * namespace bias (not a filter) toward the current page's context. Builds a
 * fresh index every call rather than caching one across calls — at this
 * corpus size (597 functions + 164 guide sections) that's low
 * single-digit milliseconds, and it keeps this function pure and easy to
 * test. DOX-C2's Worker should build the index once per isolate instead of
 * once per request — see `fetch-chunks.ts`'s caching note.
 */
export function searchChunks(
  chunks: RetrievalChunk[],
  query: string,
  options: SearchOptions = {},
): RetrievalChunk[] {
  const { namespace, limit = 15 } = options;
  const index = buildIndex(chunks);
  const byId = new Map(chunks.map((c) => [c.id, c]));

  const results = index.search(query, {
    boostDocument: namespace
      ? (_id, _term, stored) =>
          stored?.namespace === namespace ? NAMESPACE_BOOST : 1
      : undefined,
  });

  return results
    .filter((r) => r.score >= MIN_RELEVANCE_SCORE)
    .slice(0, limit)
    .map((r) => byId.get(r.id))
    .filter((c): c is RetrievalChunk => c !== undefined);
}
