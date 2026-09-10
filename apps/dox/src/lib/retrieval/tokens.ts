import type { RetrievalChunk } from "./types";

/**
 * DOX-C1 (#137) — approximate token count via the widely-used "~4 characters
 * per token" heuristic for English text. AI Elements' `context` component
 * (which wraps `tokenlens` for exact, provider-specific counts) is
 * deliberately not installed (this file's header in DOX-C.md), and the
 * provider is chosen per-request behind the AI SDK — an exact count would
 * be exact for only one provider's tokenizer anyway. This is a budgeting
 * estimate, not a billing figure; label it as such wherever it's shown.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface CorpusTokenReport {
  totalChunks: number;
  totalTokens: number;
  meanTokensPerChunk: number;
  maxTokensPerChunk: number;
  functionChunkCount: number;
  guideChunkCount: number;
}

/** DOX-C1 (#137) DoD: "Corpus token measurements are recorded in this
 * issue." Computed here so the numbers in DOX-C.md can be regenerated
 * rather than hand-copied whenever the corpus changes. */
export function measureCorpus(chunks: RetrievalChunk[]): CorpusTokenReport {
  const tokenCounts = chunks.map((c) => estimateTokens(c.text));
  const totalTokens = tokenCounts.reduce((sum, n) => sum + n, 0);
  return {
    totalChunks: chunks.length,
    totalTokens,
    meanTokensPerChunk:
      chunks.length > 0 ? Math.round(totalTokens / chunks.length) : 0,
    maxTokensPerChunk: tokenCounts.length > 0 ? Math.max(...tokenCounts) : 0,
    functionChunkCount: chunks.filter((c) => c.kind === "function").length,
    guideChunkCount: chunks.filter((c) => c.kind === "guide").length,
  };
}

/** Tokens for one retrieved set — what a single request's context injection
 * actually costs, the number DOX-C1's DoD calls "tokens for a typical
 * retrieved set." */
export function estimateRetrievedSetTokens(chunks: RetrievalChunk[]): number {
  return chunks.reduce((sum, c) => sum + estimateTokens(c.text), 0);
}
