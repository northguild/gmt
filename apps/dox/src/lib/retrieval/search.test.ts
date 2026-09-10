/// <reference types="vitest/globals" />
import { corpus } from "~/generated/reference/corpus";
import { buildFunctionChunks } from "./function-chunks";
import { searchChunks } from "./search";
import type { RetrievalChunk } from "./types";

// DOX-C1 (#137) DoD: "Retrieval returns sensible chunks for a spread of real
// questions: a direct lookup, a task, a concept, and a near-miss." Run
// against the real generated corpus, not a synthetic fixture — the whole
// point is proving retrieval works on the actual 591-entry corpus, not on
// data shaped to make it look good.
const chunks: RetrievalChunk[] = buildFunctionChunks(corpus);

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
