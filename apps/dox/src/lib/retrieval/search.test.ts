import { buildRetrievalCorpus } from "./corpus";
import { EVERYDAY_WORDS, indexFor, searchChunks, zonePlacesIn } from "./search";
import type { RetrievalChunk } from "./types";

/* Mechanism tests against the real generated corpus (reference and guides). Whether a given
   question finds its answer is scored by `evals/offline.test.ts` from `evals/cases.ts`. */
const chunks: RetrievalChunk[] = buildRetrievalCorpus();

describe("searchChunks — result count and namespace bias", () => {
  it("returns roughly 10-20 chunks per question by default", () => {
    const results = searchChunks(chunks, "format a date for display");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(15);
  });

  it("a namespace bias surfaces same-namespace results earlier without excluding others", () => {
    const biased = searchChunks(chunks, "convert to another zone", {
      namespace: "zoned",
      limit: 20,
    });
    const unbiased = searchChunks(chunks, "convert to another zone", {
      limit: 20,
    });
    // Bias, not filter: some result may still come from outside "zoned".
    expect(biased.length).toBeGreaterThan(0);
    const biasedZonedRank = biased.findIndex((c) => c.namespace === "zoned");
    const unbiasedZonedRank = unbiased.findIndex(
      (c) => c.namespace === "zoned",
    );
    expect(biasedZonedRank).toBeGreaterThanOrEqual(0);
    expect(biasedZonedRank).toBeLessThanOrEqual(unbiasedZonedRank);
  });
});

/* The guide half of the corpus — 164 of 761 chunks — was searched by no test
   at all until the fixture above stopped filtering it out. These are the
   properties that only guides can carry. */
describe("searchChunks — guide retrieval", () => {
  it("has guide chunks in the corpus at all", () => {
    const guides = chunks.filter((c) => c.kind === "guide");
    expect(guides.length).toBeGreaterThan(100);
  });

  it("answers a conceptual question largely from guides, not function docstrings", () => {
    // The DoD's "concept" case. A function's docstring says what it does; a
    // guide says what happens to you and why — which is what this question
    // asks. Against the reference half alone this returned 5 chunks and none
    // of them explained anything.
    const results = searchChunks(chunks, "what happens during a DST gap", {
      limit: 20,
    });
    expect(results.some((c) => c.kind === "guide")).toBe(true);
  });

  it("gives a conceptual question strictly more to work with than functions alone", () => {
    const question = "how do I handle a DST overlap when the clock goes back";
    const all = searchChunks(chunks, question, { limit: 100 });
    const functionsOnly = searchChunks(
      chunks.filter((c) => c.kind === "function"),
      question,
      { limit: 100 },
    );
    expect(all.length).toBeGreaterThan(functionsOnly.length);
  });

  it("gives every guide chunk a URL with a resolvable anchor", () => {
    // Guide chunks are fragmented per `## ` heading via github-slugger, to
    // match Starlight's own anchor ids. A citation that lands on the page but
    // not the section is a worse answer, and a malformed one is a 404.
    const guides = chunks.filter((c) => c.kind === "guide");
    for (const chunk of guides) {
      // A guide page, or a top-level page such as /upstream/ or /.
      const [path] = chunk.url.split("#");
      expect(
        path.startsWith("/guides/") || /^\/(?:[a-z0-9-]+\/)?$/.test(path),
      ).toBe(true);
      const [, fragment] = chunk.url.split("#");
      if (fragment !== undefined) {
        expect(fragment).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      }
    }
  });
});

/* DOX-C1 DoD: "A question with no good match returns few or no chunks rather
   than 20 bad ones — the refusal path in DOX-C2 depends on this being honest."
   Previously asserted against the reference half; the guide chunks are prose,
   which is exactly the material most likely to weakly match anything. */
describe("searchChunks — the refusal path's honesty", () => {
  const OFF_DOMAIN = [
    "recommend a pizza restaurant",
    "translate to French",
    "translate this sentence into french",
    "javascript sorting algorithm",
    "how do I bake sourdough bread",
    "what is the capital of Peru",
    "write me a haiku about cats",
    "best pasta recipe",
    "tell me a story about a dog",
  ];

  it("an everyday word that only occurs inside an identifier does not match on its own", () => {
    // Splitting `bestAvailable` into best + available on the index side once
    // took "best pasta recipe" from 6 chunks to 18 and "how do I bake
    // sourdough bread" from 0 to 3. The body's identifier words now count for
    // a fraction of a whole word, and short words are not fuzzed into
    // neighbours (best -> rest/test/past).
    expect(searchChunks(chunks, "how do I bake sourdough bread")).toEqual([]);
    expect(
      searchChunks(chunks, "best pasta recipe", { limit: 100 }).length,
    ).toBeLessThanOrEqual(2);
  });

  it("does not manufacture a full context out of weak matches", () => {
    // The specific failure this guards: 15 mediocre chunks look, to the
    // model, exactly like 15 good ones, and it will improvise from them.
    for (const question of OFF_DOMAIN) {
      expect(searchChunks(chunks, question).length).toBeLessThan(5);
    }
  });
});

/* Mechanism tests on a small made-up corpus, so each pins one rule of `search.ts` and nothing
   else moves it. */
describe("searchChunks — sentences about something else and near-miss names", () => {
  it("returns nothing for a sentence about something else that shares a few ordinary words", () => {
    // "football" and "won" are in no guide; "match", "last" and "night" are.
    expect(
      searchChunks(chunks, "who won the football match last night"),
    ).toEqual([]);
    expect(searchChunks(chunks, "write a poem about autumn rain")).toEqual([]);
  });

  it("keeps the chunks of a real question whose own nouns the guides lack", () => {
    // "boss", "wants", "his", "ferry", "parcel" are in no guide. A zone city,
    // a clock time or a word that names gmt's functions says the question is
    // about time, so the words nobody wrote about do not count against it.
    for (const question of [
      "my boss in Lagos wants a call at 9am his time, what is that for me in Singapore",
      "my flight leaves Dubai at 23:40 and lands in Mumbai, how long is the flight really",
      "our parcel left on Friday, how many working days until my invoice is overdue",
      "my goat ate the hay at 23:40 while the farmer slept",
      "the wizard asked the dragon which date it hatched",
    ]) {
      expect(searchChunks(chunks, question).length, question).toBeGreaterThan(
        0,
      );
    }
  });

  it("reads a zone city as a question about time zones, though it never says so", () => {
    const top = searchChunks(
      chunks,
      "my boss in Lagos wants a call at 9am his time, what is that for me in Singapore",
      { limit: 3 },
    ).map((c) => c.id);
    expect(
      top.some((id) =>
        id.startsWith(
          "/guides/zoned-date-operations/zoned-operations/#timezone",
        ),
      ),
    ).toBe(true);
  });

  it("puts the conversion function among the first hits when two zone cities are named", () => {
    const ids = (q: string) => searchChunks(chunks, q).map((c) => c.id);
    const place = ids(
      "my colleague in Nairobi starts her shift at 6am her time, what time is that for my team in Seoul",
    ).indexOf("zoned/convert/convertZonedToZoned");
    expect(place).toBeGreaterThanOrEqual(0);
    expect(place).toBeLessThan(4);
    // One city names no conversion.
    expect(
      ids("her shift starts at 6am in Nairobi").indexOf(
        "zoned/convert/convertZonedToZoned",
      ),
    ).toBe(-1);
  });

  it("reads one city, a day and a clock time as a question about that local time", () => {
    const top = (question: string) =>
      searchChunks(chunks, question)
        .slice(0, 5)
        .map((c) => c.id);
    const dst = (id: string) =>
      id.startsWith("/guides/concepts/dst-disambiguation/") ||
      id.startsWith("/guides/how-to/check-local-time-exists/") ||
      id.endsWith("/classifyLocal") ||
      id.endsWith("/resolveLocal");
    expect(
      top("What happens to 1:30am on 27 October 2024 in London?").some(dst),
    ).toBe(true);
    expect(
      top("What happens to 2:30am on 31 March 2024 in New York?").some(dst),
    ).toBe(true);
    // A question that says what it is about is left to its own words.
    expect(
      top(
        "my flight leaves Dubai at 23:40 and lands in Mumbai, how long is the flight really",
      ).some(dst),
    ).toBe(false);
    // So is a time of day with no date, and a conversion between two cities.
    expect(top("What is 9am in Lagos?").some(dst)).toBe(false);
  });

  it("does not take a city outside the zone list for evidence", () => {
    // Mumbai is not an IANA zone city (its zone is Asia/Kolkata), so it is
    // an ordinary word the guides lack.
    expect(
      searchChunks(chunks, "who won the football match in Mumbai last night"),
    ).toEqual([]);
  });

  it("does not take an everyday word that ends a zone id for evidence", () => {
    // Center (America/North_Dakota/Center), Casey (Antarctica/Casey) and
    // Easter (Pacific/Easter) end zone ids but say nothing about time.
    for (const question of [
      "recommend a good restaurant near the data center",
      "which songs did Casey sing at the jazz festival",
      "what should I cook for Easter and Palmer",
    ]) {
      expect(searchChunks(chunks, question), question).toEqual([]);
      expect(zonePlacesIn(question), question).toBe(0);
    }
  });

  it("lists in EVERYDAY_WORDS only words that end a zone id", () => {
    const ends = new Set(
      Intl.supportedValuesOf("timeZone").map((zone) =>
        zone.slice(zone.lastIndexOf("/") + 1).toLowerCase(),
      ),
    );
    expect([...EVERYDAY_WORDS].filter((word) => !ends.has(word))).toEqual([]);
  });

  it("does not gate a short query, so a typo still lands on the nearest chunk", () => {
    expect(searchChunks(chunks, "addBusinessDayz").length).toBeGreaterThan(0);
    expect(searchChunks(chunks, "football night").length).toBeGreaterThan(0);
  });

  it("allows two edits on a long name, not three", () => {
    // `addBusinessDay` is three edits from `isBusinessDay`, which used to
    // outrank `addBusinessDays`, the name it is a prefix of.
    expect(searchChunks(chunks, "addBusinessDay")[0]?.id).toBe(
      "plain/calculate/addBusinessDays",
    );
  });
});

describe("searchChunks — one index per corpus", () => {
  it("reuses the index for the same chunk array and builds a fresh one for a new array", () => {
    const same = indexFor(chunks);
    expect(indexFor(chunks)).toBe(same);
    // A copy is a different corpus as far as the memo is concerned — a test
    // or a corpus refresh must never see a stale index.
    expect(indexFor([...chunks])).not.toBe(same);
  });

  it("returns the same results warm as cold", () => {
    const cold = searchChunks([...chunks], "what happens during a DST gap");
    searchChunks(chunks, "unrelated warm-up query");
    const warm = searchChunks(chunks, "what happens during a DST gap");
    expect(warm.map((c) => c.id)).toEqual(cold.map((c) => c.id));
  });
});
