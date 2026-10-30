import MiniSearch from "minisearch";
import type { RetrievalChunk } from "./types";

interface SearchOptions {
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
  // Every page is about a JavaScript library, so these name no topic.
  "javascript",
  "typescript",
]);

/* A function's name is the sharpest statement of what it does, but the
   default tokenizer keeps `isLeapSecond` as one term, so a question that says
   "leap second" never matched the name. Identifiers are therefore also split
   into their camelCase words ("is", "leap", "second"). Only the index is
   split: a query that types an identifier ("formatDate") stays one narrow
   term instead of fanning out to every chunk that mentions "format" or
   "date". Runs of capitals stay together ("utcToGnss" -> utc, to, gnss;
   "ISOString" -> iso, string).

   The split words are not equal evidence everywhere:
   - In a chunk's **title** they say what the function is for, so they count
     in full (the `title` field keeps the whole token plus its words).
   - In the **body** they are incidental: `bestAvailable` in a guide's prose
     says nothing about "best", and `breakpoint` or `readOnly` do not make a
     chunk about breaking or reading. Those words go to a separate `parts`
     field with a low weight (PARTS_BOOST), so a question that names a
     concept still finds the identifiers that carry it, but an everyday word
     that only occurs inside an identifier cannot lift a chunk on its own.
     The body's whole tokens stay in `text` at full weight, exactly as before. */
const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u;
const IDENTIFIER_WORDS = /\p{Lu}+(?!\p{Ll})|\p{Lu}?\p{Ll}+|\p{Nd}+/gu;

/** Weight of an identifier's words when they occur in a chunk's body. */
const PARTS_BOOST = 0.25;

/* Edits are only allowed on longer terms. On a 3-5 letter word one edit
   reaches a different real word ("best" -> rest/test/past, "dog" -> dot/log,
   "read" -> head), so every ordinary question matched chunks it had nothing
   to do with. Typo tolerance is kept where it works: a long term such as
   "addBusinessDay" still finds the plural "addBusinessDays". */
const MIN_FUZZY_LENGTH = 6;

function fuzzyFor(term: string): number {
  return term.length >= MIN_FUZZY_LENGTH ? 0.2 : 0;
}

function tokenizeQuery(text: string): string[] {
  return text.split(SPACE_OR_PUNCTUATION).filter(Boolean);
}

/** The camelCase words of every multi-word identifier in `text`, without the
 * whole tokens. */
function identifierWords(text: string): string[] {
  const out: string[] = [];
  for (const raw of tokenizeQuery(text)) {
    const words = raw.match(IDENTIFIER_WORDS);
    if (words && words.length > 1) out.push(...words);
  }
  return out;
}

function tokenizeField(text: string, fieldName?: string): string[] {
  if (fieldName === "parts") return identifierWords(text);
  const whole = tokenizeQuery(text);
  return fieldName === "title" ? [...whole, ...identifierWords(text)] : whole;
}

function processTerm(term: string): string | false {
  const lower = term.toLowerCase();
  if (STOPWORDS.has(lower) || lower.length < 2) return false;
  return lower;
}

/* Empirically tuned against DOX-C1's four required question types plus
   genuinely out-of-domain probes. This is a property of *this* corpus's size
   and the tokenizer, boost and fuzzy settings above, not a universal
   constant — re-verify if any of them changes materially, and re-run the
   off-topic probes first: a tokenizer change that adds index terms raises
   scores for questions that have nothing to do with gmt.

   Last measured over the whole 1245-chunk corpus (function + guide chunks),
   with `limit` lifted so the count is the number clearing the cut-off. Chunks
   clearing it, per question:

     what does formatDate do ........................   8   (2 guide)
     convert UTC to Tokyo timezone .................. 276  (70 guide)
     what happens during a DST gap ..................  23  (21 guide)
     addBusinessDay .................................   3   (0 guide)
     how do I handle a DST overlap ..................  37

     recommend a pizza restaurant ...................   2   (both guide: "Recommendation")
     translate to French ............................   0
     javascript sorting algorithm ...................   1   (guide: JavaScript: TC39)
     how do I bake sourdough bread ..................   0
     what is the capital of Peru ....................   0
     write me a haiku about cats ....................   1   (guide)
     best pasta recipe ..............................   2   (the `bestAvailable` entry)
     tell me a story about a dog ....................   4   (guide titles that say "tell")
     translate this sentence into french ............   4   (NMEA "sentences")

   The score distributions overlap, so no single cut-off can separate them:
   the weakest legitimate lookup (`addBusinessDay`, a singular typed against
   a plural name) tops out near 13, while off-topic questions that share one
   ordinary word with a guide reach 20-45. Raising the cut-off to exclude
   them would also exclude that lookup. What keeps the off-topic column
   near zero is therefore not the threshold but what is allowed to score:
   the stopword list (without it "how do I bake sourdough bread" scores into
   the hundreds), the low weight of identifier words in a chunk's body
   (PARTS_BOOST), and no typo tolerance on short words (MIN_FUZZY_LENGTH).
   Before those last two, splitting camelCase on the index side took
   "how do I bake sourdough bread" from 0 to 3 chunks, "best pasta recipe"
   from 6 to 18 (every chunk with `bestAvailable`, plus fuzzy "rest", "test",
   "past") and "tell me a story about a dog" from 13 to 18.

   The out-of-domain column is the one that matters: DOX-C2's refusal path is
   only honest if a question with no answer retrieves nothing, and a threshold
   that let 20 weak matches through would manufacture a context to improvise
   from. The remaining hits are real whole-word matches in guide prose, not
   noise from the index. */
const MIN_RELEVANCE_SCORE = 8;

function buildIndex(chunks: RetrievalChunk[]): MiniSearch<RetrievalChunk> {
  const index = new MiniSearch<RetrievalChunk>({
    idField: "id",
    fields: ["title", "text", "parts"],
    storeFields: ["namespace"],
    tokenize: tokenizeField,
    // `parts` is the body re-read for its identifiers' words only.
    extractField: (chunk, field) =>
      field === "parts" ? chunk.text : chunk[field as keyof RetrievalChunk],
    processTerm,
    searchOptions: {
      // BM25's default field weights already favor short, exact matches —
      // boost `title` on top of that so a direct lookup ("what does
      // formatDate do") ranks the function's own chunk above a guide that
      // merely mentions the name in passing.
      boost: { title: 2, parts: PARTS_BOOST },
      tokenize: tokenizeQuery,
      prefix: true,
      fuzzy: fuzzyFor,
    },
  });
  index.addAll(chunks);
  return index;
}

interface Indexed {
  index: MiniSearch<RetrievalChunk>;
  byId: Map<string, RetrievalChunk>;
}

/* One index per corpus array, for as long as that array lives. Building it
   over the 884-chunk corpus measured 50–70 ms in Node (2026-09-24), which
   was being paid on every chat request; `fetch-chunks.ts` hands the Worker
   the same array back for the life of its memo, so the build now happens
   once per isolate per corpus refresh. A `WeakMap` keyed on the array means
   a test that passes a fresh array always gets a fresh index, and nothing
   here can outlive the corpus it was built from. */
const INDEXES = new WeakMap<RetrievalChunk[], Indexed>();

/** The index for exactly this array — the same object back until the array
 * is garbage-collected. Exported for the memo test only. */
export function indexFor(chunks: RetrievalChunk[]): Indexed {
  let indexed = INDEXES.get(chunks);
  if (!indexed) {
    indexed = {
      index: buildIndex(chunks),
      byId: new Map(chunks.map((c) => [c.id, c])),
    };
    INDEXES.set(chunks, indexed);
  }
  return indexed;
}

/**
 * DOX-C1 (#137) — keyword/BM25 retrieval over the chunk corpus, with a
 * namespace bias (not a filter) toward the current page's context. A pure
 * function of its inputs: the index is memoised per corpus array (see
 * `indexFor`), never per query, so two calls with the same chunks and query
 * return the same results whether or not the memo was warm.
 */
export function searchChunks(
  chunks: RetrievalChunk[],
  query: string,
  options: SearchOptions = {},
): RetrievalChunk[] {
  const { namespace, limit = 15 } = options;
  const { index, byId } = indexFor(chunks);

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
