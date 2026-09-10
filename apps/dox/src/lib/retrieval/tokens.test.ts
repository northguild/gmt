/// <reference types="vitest/globals" />
import {
  estimateRetrievedSetTokens,
  estimateTokens,
  measureCorpus,
} from "./tokens";
import type { RetrievalChunk } from "./types";

const CHUNK: RetrievalChunk = {
  id: "a",
  kind: "function",
  url: "/reference/a",
  namespace: "a",
  title: "a",
  text: "0123456789".repeat(4), // 40 chars
};

describe("estimateTokens", () => {
  it("uses the ~4 chars-per-token heuristic", () => {
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });

  it("rounds up for partial tokens", () => {
    expect(estimateTokens("a")).toBe(1);
  });
});

describe("measureCorpus", () => {
  it("aggregates total, mean, and max tokens across chunks", () => {
    const report = measureCorpus([
      CHUNK,
      { ...CHUNK, id: "b", text: "a".repeat(80) },
    ]);
    expect(report.totalChunks).toBe(2);
    expect(report.totalTokens).toBe(10 + 20);
    expect(report.meanTokensPerChunk).toBe(15);
    expect(report.maxTokensPerChunk).toBe(20);
  });

  it("counts function vs guide chunks separately", () => {
    const report = measureCorpus([CHUNK, { ...CHUNK, id: "b", kind: "guide" }]);
    expect(report.functionChunkCount).toBe(1);
    expect(report.guideChunkCount).toBe(1);
  });
});

describe("estimateRetrievedSetTokens", () => {
  it("sums tokens for exactly the chunks given", () => {
    expect(estimateRetrievedSetTokens([CHUNK, CHUNK])).toBe(20);
  });
});
