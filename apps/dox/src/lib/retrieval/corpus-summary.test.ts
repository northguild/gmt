/// <reference types="vitest/globals" />
/**
 * Keeps the corpus figures shown on the empty chat screen honest.
 *
 * `CORPUS_SUMMARY` is a hardcoded string in the client bundle — deriving it
 * would drag the 536 KB generated corpus and the content collection into the
 * chat island for the sake of three numbers. This is the guard that makes the
 * hardcoding safe. It exists because the numbers had already gone stale: the
 * screen advertised "591 functions · 755 chunks" against a corpus that had
 * grown to 597 / 761.
 */
import {
  CORPUS_CHUNK_COUNT,
  CORPUS_FUNCTION_COUNT,
  CORPUS_GUIDE_COUNT,
  CORPUS_SUMMARY,
} from "~/lib/chat-constants";
import { buildRetrievalCorpus } from "./corpus";

const chunks = buildRetrievalCorpus();

describe("CORPUS_SUMMARY", () => {
  it("matches the real number of function chunks", () => {
    expect(chunks.filter((c) => c.kind === "function")).toHaveLength(
      CORPUS_FUNCTION_COUNT,
    );
  });

  it("matches the real number of guide chunks", () => {
    expect(chunks.filter((c) => c.kind === "guide")).toHaveLength(
      CORPUS_GUIDE_COUNT,
    );
  });

  it("matches the real total", () => {
    expect(chunks).toHaveLength(CORPUS_CHUNK_COUNT);
  });

  it("renders the numbers it was built from", () => {
    expect(CORPUS_SUMMARY).toContain(String(CORPUS_FUNCTION_COUNT));
    expect(CORPUS_SUMMARY).toContain(String(CORPUS_CHUNK_COUNT));
  });
});
