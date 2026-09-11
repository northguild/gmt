import type { RetrievalChunk } from "./types";

/**
 * DOX-C1 (#137) — approximate token count via the widely-used "~4 characters
 * per token" heuristic for English text. AI Elements' `context` component
 * (which wraps `tokenlens` for exact, provider-specific counts) is
 * deliberately not installed, and the
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

/** Corpus token measurements, computed rather than hand-copied so the figures
 * quoted in `context/dox/built.md` can be regenerated whenever the corpus
 * changes. */
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
