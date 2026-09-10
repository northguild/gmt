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

// Empirically tuned against DOX-C1's four required question types plus
// three genuinely out-of-domain probes (verified 2026-09-09, corpus size
// 591 functions + guide sections): every real match — a direct lookup, a
// task, a concept, and a near-miss — scored at least 10.6 at its best
// result; three unrelated questions ("recommend a pizza restaurant",
// "translate to French", "javascript sorting algorithm") topped out at 6.0
// or scored 0 results. This is a property of *this* corpus's size and the
// boost/stopword settings above, not a universal constant — re-verify if
// either changes materially.
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
 * corpus size (591 functions + a few dozen guide sections) that's low
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
