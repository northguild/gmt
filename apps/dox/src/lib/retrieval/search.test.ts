import { buildRetrievalCorpus } from "./corpus";
import { indexFor, searchChunks } from "./search";
import type { RetrievalChunk } from "./types";

/* DOX-C1 (#137) DoD: "Retrieval returns sensible chunks for a spread of real
   questions: a direct lookup, a task, a concept, and a near-miss." Run against
   the real generated corpus, not a synthetic fixture — the whole point is
   proving retrieval works on the actual corpus, not on data shaped to make it
   look good.

   This used to be `buildFunctionChunks(corpus)`, i.e. the reference half only.
   That made every claim below a claim about 78% of what the Worker actually
   searches: the 164 guide sections were exercised by nothing, even though the
   "concept" question this file tests is precisely the kind whose answer lives
   in a guide rather than in a function's docstring. */
const chunks: RetrievalChunk[] = buildRetrievalCorpus();

describe("searchChunks — DOX-C1 DoD question spread", () => {
  it("direct lookup: 'what does formatDate do' finds formatDate's own chunk", () => {
    const results = searchChunks(chunks, "what does formatDate do");
    expect(results.some((c) => c.title === "formatDate")).toBe(true);
  });

  it("task: 'convert UTC to Tokyo' finds a zoned conversion function", () => {
    const results = searchChunks(chunks, "convert UTC to Tokyo timezone");
    expect(
      results.some((c) => /convert/i.test(c.title) && c.namespace === "zoned"),
    ).toBe(true);
  });

  it("concept: 'what happens during a DST gap' surfaces DST-related chunks", () => {
    const results = searchChunks(chunks, "what happens during a DST gap");
    expect(results.some((c) => /dst|daylight/i.test(c.text))).toBe(true);
  });

  it("near-miss: 'addBusinessDay' (singular) still finds the plural function", () => {
    const results = searchChunks(chunks, "addBusinessDay");
    // Fuzzy matching should bridge singular/plural — the corpus's real name
    // is plural (verify it exists so this test fails loudly if renamed).
    expect(chunks.some((c) => c.title === "addBusinessDays")).toBe(true);
    expect(results.some((c) => c.title === "addBusinessDays")).toBe(true);
  });

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

  it("a genuinely out-of-domain question returns few or no chunks — the honest-refusal path DOX-C2 depends on", () => {
    // Not "parse a cron expression" — verified 2026-09-09 that one actually
    // surfaces real, keyword-relevant parseHttpDate/parseRfc3339/parseSqlDateTime
    // chunks (the corpus genuinely has a family of parse* functions), which
    // is honest retrieval, not padding; DOX-C2's own DoD uses that example
    // for the end-to-end *LLM* refusal test, where recognizing "none of
    // these describe cron support" is the model's job, not retrieval's.
    // This test needs zero real keyword overlap with the corpus at all.
    // ("translate this sentence into french" is asserted in the refusal-path
    // block below: NMEA messages are "sentences", so a few Maritime guide
    // sections are an honest match for it, and it must stay under the bound.)
    for (const q of [
      "recommend a good pizza restaurant nearby",
      "suggest a vegetarian lasagne recipe",
    ]) {
      const results = searchChunks(chunks, q);
      expect(results.length).toBeLessThan(5);
    }
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
      // A guide page, or a top-level "Start here" page such as /upstream/ or /.
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

  for (const question of OFF_DOMAIN) {
    it(`returns almost nothing for "${question}"`, () => {
      const results = searchChunks(chunks, question, { limit: 100 });
      expect(results.length).toBeLessThan(5);
    });
  }

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

describe("searchChunks — camelCase names", () => {
  it("a plain-words question finds the identifier it describes, near the top", () => {
    // The point of splitting identifiers: "leap second" never matched the
    // single term `isLeapSecond` before, and ranked it 45th.
    const results = searchChunks(chunks, "is it a leap second");
    expect(results.slice(0, 8).some((c) => c.title === "isLeapSecond")).toBe(
      true,
    );
  });

  it("a question that types the identifier finds its own chunk first", () => {
    const results = searchChunks(chunks, "what does gnssWeekToUtc return");
    expect(results[0]?.title).toBe("gnssWeekToUtc");
  });
});

describe("searchChunks — GNSS and leap-second questions", () => {
  it("a Galileo week and time of week finds gnssWeekToUtc", () => {
    const results = searchChunks(
      chunks,
      "What UTC time is Galileo week 1024, time of week 18, era 0?",
    );
    expect(
      results.some((c) => c.kind === "function" && c.title === "gnssWeekToUtc"),
    ).toBe(true);
  });

  it("seconds across the 2016 leap second finds leapSecondsBetween or the leap-seconds guide", () => {
    const results = searchChunks(
      chunks,
      "How many seconds passed across the 2016 leap second?",
    );
    expect(
      results.some(
        (c) =>
          (c.kind === "function" && c.title === "leapSecondsBetween") ||
          (c.kind === "guide" && c.url.includes("leap-seconds-and-tai")),
      ),
    ).toBe(true);
  });

  it("the next GNSS week rollover finds gnssWeekToUtc or the Maritime guide", () => {
    const results = searchChunks(
      chunks,
      "When does the next GNSS week rollover happen?",
    );
    expect(
      results.some(
        (c) =>
          (c.kind === "function" && c.title === "gnssWeekToUtc") ||
          (c.kind === "guide" && c.url.includes("maritime-gnss-time")),
      ),
    ).toBe(true);
  });

  it("fiscal and workforce questions still return their chunks", () => {
    expect(
      searchChunks(chunks, "how do I find the fiscal quarter of a date").some(
        (c) => c.title === "getQuarter",
      ),
    ).toBe(true);
    expect(
      searchChunks(
        chunks,
        "how do I check a driver's duty hours in a rolling window",
      ).some((c) => c.title === "dutyViolations"),
    ).toBe(true);
  });

  it("a 23:59:60 question finds the isLeapSecond function", () => {
    const results = searchChunks(
      chunks,
      "Is 2016-12-31T23:59:60Z a real leap second?",
    );
    expect(
      results.some((c) => c.kind === "function" && c.title === "isLeapSecond"),
    ).toBe(true);
  });

  it("GLONASS time offset from UTC finds utcToGnss or the Maritime guide", () => {
    const results = searchChunks(chunks, "GLONASS time offset from UTC");
    expect(
      results.some(
        (c) =>
          (c.kind === "function" && c.title === "utcToGnss") ||
          (c.kind === "guide" && c.url.includes("maritime-gnss-time")),
      ),
    ).toBe(true);
  });
});
