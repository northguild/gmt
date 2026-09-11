/// <reference types="vitest/globals" />
import { buildRetrievalCorpus } from "./corpus";
import { searchChunks } from "./search";
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
    // surfaces real, keyword-relevant parseHttp/parseRfc3339/parseSql
    // chunks (the corpus genuinely has a family of parse* functions), which
    // is honest retrieval, not padding; DOX-C2's own DoD uses that example
    // for the end-to-end *LLM* refusal test, where recognizing "none of
    // these describe cron support" is the model's job, not retrieval's.
    // This test needs zero real keyword overlap with the corpus at all.
    for (const q of [
      "recommend a good pizza restaurant nearby",
      "translate this sentence into french",
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
      expect(chunk.url.startsWith("/guides/")).toBe(true);
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
    "javascript sorting algorithm",
    "how do I bake sourdough bread",
    "what is the capital of Peru",
    "write me a haiku about cats",
  ];

  for (const question of OFF_DOMAIN) {
    it(`returns almost nothing for "${question}"`, () => {
      const results = searchChunks(chunks, question, { limit: 100 });
      expect(results.length).toBeLessThan(5);
    });
  }

  it("does not manufacture a full context out of weak matches", () => {
    // The specific failure this guards: 15 mediocre chunks look, to the
    // model, exactly like 15 good ones, and it will improvise from them.
    for (const question of OFF_DOMAIN) {
      expect(searchChunks(chunks, question).length).toBeLessThan(5);
    }
  });
});
