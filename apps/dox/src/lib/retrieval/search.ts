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

/* At most this many edits, however long the term. A fifth of a long
   identifier is three or four edits, which reaches a different function:
   `addBusinessDay` (three edits from `isBusinessDay`) ranked that neighbour
   above `addBusinessDays`, the name it is a prefix of. */
const MAX_FUZZY_EDITS = 2;

function fuzzyFor(term: string): number {
  return term.length >= MIN_FUZZY_LENGTH
    ? Math.min(MAX_FUZZY_EDITS, Math.round(term.length * 0.2))
    : 0;
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

/* A sentence about something else still shares a few ordinary words with
   the guides ("who won the football match last night" meets "match",
   "night" and "last"), and a few weak hits are enough to put a context in
   front of the model. What it lacks is the rest of its words: the guides
   have no "football" and no "won". So a question of MIN_GATED_TERMS or more
   topic terms with any of them matching no chunk at all is about something
   else, and finds nothing. One unknown word is enough: the guides use so
   many everyday words ("tell", "about", "movies", "recommend") that "who is
   Casey Affleck and what movies did he make" has one unknown word in six.

   A real question can lack words too: a reader's city or noun is not in the
   guides ("Mumbai", "ferry", "parcel") and says nothing against the
   question. So the gate applies only to a question with no on-topic
   evidence of its own. Evidence is any one of
   - a word that names gmt's functions: a word in at least MIN_NAME_USES
     function names ("time", "date", "week", "interval", "offset"), which the
     corpus supplies and nobody lists by hand;
   - a place that is an IANA time zone city ("Lagos", "Singapore", "Seoul";
     Mumbai is not one, its zone is Asia/Kolkata), except the EVERYDAY_WORDS
     that also end a zone id: "data center" (America/North_Dakota/Center) or
     "Casey Affleck" (Antarctica/Casey) is not a question about time;
   - a clock or calendar token ("23:40", "2024-06-14", "9am").
   Such a question is never gated, whatever else it says. A question with
   none of them and with words nobody wrote about is not about time.

   A zone city also says what the question is about when it never uses the
   word: "what is 9am in Lagos for me in Singapore" is a conversion between
   two zones, and shares no word with `convertZonedToZoned` or the guide on
   timezones. The search therefore adds ZONE_WORD to such a question.

   One zone city, a time of day and a date, and little else ("What happens to
   1:30am on 27 October 2024 in London?"), is a third kind of question: what
   that wall-clock time is in that zone on that day. It never says "daylight"
   or "ambiguous" either, and its numbers, month and city match the worked
   examples of the cron and scheduling guides, which then fill the context
   and pull the model to a cron tool. The search therefore adds
   LOCAL_TIME_WORDS, the words of the guides that say whether a local time
   exists, repeats or is skipped. "Little else" is at most MAX_OTHER_TERMS
   terms beyond the city, the month or weekday and the time: "my flight leaves
   Dubai at 23:40 and lands in Mumbai" has the same shape and says what it is
   about, so it is left to its own words. Two cities stay a conversion.

   Shorter queries are never gated: a typed name or a two-word lookup has no
   sentence around it to tell, and a typo there should still land on the
   nearest function.

   Tried and dropped: gating each chunk by the share of the query's weight it
   matches. A long, legitimate question (a container's dwell, with a
   terminal, a city, a month and a time) spreads its words over many chunks,
   so no chunk covers much of it, and the right ones were cut. Also dropped:
   the unknown words on their own, with no evidence, which returned nothing
   for "my boss in Lagos wants a call at 9am his time, what is that for me in
   Singapore" because "boss", "wants" and "his" are in no guide.

   Numbers, times and ids are what the reader brings, not a topic the guides
   could be missing, so they are not counted as unknown. */
const MIN_GATED_TERMS = 3;
const MIN_NAME_USES = 5;
const MIN_EVIDENCE_LENGTH = 4;
const ZONE_WORD = "timezone";
const LOCAL_TIME_WORDS = "ambiguous nonexistent daylight disambiguation";
const MAX_OTHER_TERMS = 2;

/** The function that converts between two zones, and where it ranks for a
 * question that names two zone cities. */
export const ZONE_CONVERSION_ID = "zoned/convert/convertZonedToZoned";
const ZONE_CONVERSION_RANK = 3;

const CLOCK_TOKEN =
  /\b\d{1,2}:\d{2}\b|\b\d{4}-\d{2}(?:-\d{2}|-?w\d{2})?\b|\b\d{1,2}\s?[ap]\.?m\b/i;

/** A time of day: a clock reading or an am/pm hour, with no date alone. */
const TIME_OF_DAY = /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?[ap]\.?m\b/i;

/** A date as digits, or a day of the month before a month name. */
const CALENDAR_DATE = /\b\d{4}-\d{2}-\d{2}\b/;

/** The distinct topic terms of `query`, folded as the index folds them. */
function topicTerms(query: string): string[] {
  const terms = new Set<string>();
  for (const raw of tokenizeQuery(query)) {
    const term = processTerm(raw);
    if (term && !/^\p{Nd}/u.test(term)) terms.add(term);
  }
  return [...terms];
}

/** The words that name gmt's functions, in at least MIN_NAME_USES of them. */
function nameWordsOf(chunks: RetrievalChunk[]): Set<string> {
  const uses = new Map<string, number>();
  for (const chunk of chunks) {
    if (chunk.id.startsWith("/")) continue;
    const words = new Set(identifierWords(chunk.title));
    if (tokenizeQuery(chunk.title).length === 1) {
      for (const word of tokenizeQuery(chunk.title)) words.add(word);
    }
    for (const word of words) {
      const lower = word.toLowerCase();
      if (lower.length >= MIN_EVIDENCE_LENGTH && !/^\p{Nd}/u.test(lower)) {
        uses.set(lower, (uses.get(lower) ?? 0) + 1);
      }
    }
  }
  return new Set(
    [...uses].filter(([, n]) => n >= MIN_NAME_USES).map(([word]) => word),
  );
}

/** Last parts of zone ids that are, far more often, an English word or a
 * person's name: a question using one is no more about time than any other.
 * The cities a reader asks the time of stay places, even where they are also
 * names ("Phoenix", "Lima", "Hobart"); a real question naming one of these
 * also names a second city or a clock time, which is evidence enough. */
export const EVERYDAY_WORDS: ReadonlySet<string> = new Set([
  "beulah",
  "canary",
  "casey",
  "center",
  "christmas",
  "darwin",
  "davis",
  "dawson",
  "easter",
  "guernsey",
  "jersey",
  "knox",
  "midway",
  "oral",
  "palmer",
  "regina",
  "resolute",
  "reunion",
  "stanley",
  "troll",
  "wake",
  "wallis",
]);

/** Single-word IANA zone cities in lower case, and the multi-word ones with
 * a space ("new york"), less EVERYDAY_WORDS. Empty where the runtime cannot
 * list zones. */
const ZONE_PLACES: { words: Set<string>; phrases: string[] } = (() => {
  const words = new Set<string>();
  const phrases: string[] = [];
  try {
    for (const zone of Intl.supportedValuesOf("timeZone")) {
      const place = zone.slice(zone.lastIndexOf("/") + 1).toLowerCase();
      const spaced = place.replaceAll("_", " ");
      if (spaced.includes(" ")) phrases.push(spaced);
      else if (
        place.length >= MIN_EVIDENCE_LENGTH &&
        !EVERYDAY_WORDS.has(place)
      )
        words.add(place);
    }
  } catch {
    // A runtime without the list simply has fewer places to recognise.
  }
  return { words, phrases };
})();

/** How many distinct IANA time zone cities the terms name. */
function zonePlaceCount(terms: string[]): number {
  const named = new Set(terms.filter((term) => ZONE_PLACES.words.has(term)));
  const spaced = ` ${terms.join(" ")} `;
  for (const phrase of ZONE_PLACES.phrases) {
    if (spaced.includes(` ${phrase} `)) named.add(phrase);
  }
  return named.size;
}

/** How many distinct IANA time zone cities `query` names ("Lagos", "New York"). */
export function zonePlacesIn(query: string): number {
  return zonePlaceCount(topicTerms(query));
}

/** Whether the query names an IANA time zone city. */
function namesZonePlace(terms: string[]): boolean {
  return zonePlaceCount(terms) > 0;
}

/** The month and weekday names, long and short, as the reader types them. */
const JANUARY_2024 = 1_704_067_200_000;
const DAY = 86_400_000;
const DATE_WORDS: Set<string> = (() => {
  const words = new Set<string>();
  const format = (options: Intl.DateTimeFormatOptions, count: number) => {
    for (let n = 0; n < count; n++) {
      // Milliseconds since the epoch: 1 January 2024 (a Monday) plus n days,
      // or plus the middle of month n, which no time zone can move to a
      // neighbouring month.
      const days = "weekday" in options ? n : 15 + 30.5 * n;
      const date = JANUARY_2024 + days * DAY;
      words.add(
        new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" })
          .format(date)
          .toLowerCase()
          .replace(".", ""),
      );
    }
  };
  format({ month: "long" }, 12);
  format({ month: "short" }, 12);
  format({ weekday: "long" }, 7);
  format({ weekday: "short" }, 7);
  return words;
})();

/** Whether `query` names one zone city, a time of day and a date and says
 * little else: a question about what that clock reading is there. */
function asksLocalTime(query: string, terms: string[]): boolean {
  if (zonePlaceCount(terms) !== 1 || !TIME_OF_DAY.test(query)) return false;
  if (!CALENDAR_DATE.test(query) && !terms.some((t) => DATE_WORDS.has(t))) {
    return false;
  }
  const spaced = ` ${terms.join(" ")} `;
  const inPhrase = ZONE_PLACES.phrases
    .filter((phrase) => spaced.includes(` ${phrase} `))
    .flatMap((phrase) => phrase.split(" "));
  const others = terms.filter(
    (term) =>
      !ZONE_PLACES.words.has(term) &&
      !inPhrase.includes(term) &&
      !DATE_WORDS.has(term),
  );
  return others.length <= MAX_OTHER_TERMS;
}

/** Whether `query` carries evidence that it is about time at all. */
function hasTopicEvidence(
  query: string,
  terms: string[],
  nameWords: Set<string>,
): boolean {
  if (CLOCK_TOKEN.test(query) || namesZonePlace(terms)) return true;
  return terms.some((term) => {
    if (term.length < MIN_EVIDENCE_LENGTH) return false;
    for (const word of nameWords) if (term.startsWith(word)) return true;
    return false;
  });
}

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
  nameWords: Set<string>;
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
      nameWords: nameWordsOf(chunks),
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
  const { index, byId, nameWords } = indexFor(chunks);

  const terms = topicTerms(query);
  // A city says the question is about a zone even when it never says "zone":
  // "what is 9am in Lagos for me in Singapore" is a conversion between two.
  let searched = namesZonePlace(terms) ? `${query} ${ZONE_WORD}` : query;
  // A reader who only names a clock reading, a day and a place is asking what
  // that reading is there: it may not exist, or happen twice.
  if (asksLocalTime(query, terms)) searched += ` ${LOCAL_TIME_WORDS}`;

  const results = index.search(searched, {
    boostDocument: namespace
      ? (_id, _term, stored) =>
          stored?.namespace === namespace ? NAMESPACE_BOOST : 1
      : undefined,
  });

  if (
    terms.length >= MIN_GATED_TERMS &&
    !hasTopicEvidence(query, terms, nameWords)
  ) {
    const unknown = terms.filter(
      (term) =>
        index.search(term, { prefix: true, fuzzy: fuzzyFor }).length === 0,
    );
    if (unknown.length > 0) return [];
  }

  const hits = results
    .filter((r) => r.score >= MIN_RELEVANCE_SCORE)
    .map((r) => byId.get(r.id))
    .filter((c): c is RetrievalChunk => c !== undefined);

  // Two zone cities make it a conversion between zones, whatever else the
  // sentence says ("shift", "free", "hours" pull in guides about those): the
  // conversion function is always among the first few.
  const anchor = byId.get(ZONE_CONVERSION_ID);
  if (anchor && hits.length > 0 && zonePlaceCount(terms) >= 2) {
    const rest = hits.filter((chunk) => chunk.id !== anchor.id);
    rest.splice(ZONE_CONVERSION_RANK, 0, anchor);
    return rest.slice(0, limit);
  }
  return hits.slice(0, limit);
}
