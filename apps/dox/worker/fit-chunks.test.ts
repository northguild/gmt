import type { RetrievalChunk } from "../src/lib/retrieval/types";
import {
  fitChunks,
  MAX_PROMPT_CHUNK_CHARS,
  MAX_PROMPT_CHUNKS,
} from "./fit-chunks";

function chunk(id: string, size: number): RetrievalChunk {
  return {
    id,
    kind: "guide",
    url: `/guides/${id}/`,
    namespace: "guides",
    title: "",
    text: "x".repeat(size),
  };
}

const ids = (chunks: readonly RetrievalChunk[]) => chunks.map((c) => c.id);

describe("fitChunks", () => {
  it("keeps every chunk when they fit", () => {
    const chunks = [chunk("a", 10), chunk("b", 10)];
    expect(fitChunks(chunks)).toEqual(chunks);
  });

  it("stops at the chunk count", () => {
    const chunks = Array.from({ length: 15 }, (_, i) => chunk(`c${i}`, 1));
    expect(fitChunks(chunks)).toHaveLength(MAX_PROMPT_CHUNKS);
    expect(ids(fitChunks(chunks))[0]).toBe("c0");
  });

  it("always keeps the best chunk, whatever its size", () => {
    const chunks = [
      chunk("huge", MAX_PROMPT_CHUNK_CHARS * 2),
      chunk("small", 10),
    ];
    expect(ids(fitChunks(chunks))).toEqual(["huge"]);
  });

  it("skips a chunk that would overflow and keeps a smaller one after it", () => {
    const chunks = [chunk("a", 60), chunk("too-big", 50), chunk("b", 40)];
    expect(ids(fitChunks(chunks, { maxChars: 100 }))).toEqual(["a", "b"]);
  });

  it("counts the title toward the size", () => {
    const titled = { ...chunk("titled", 50), title: "t".repeat(20) };
    const chunks = [chunk("a", 40), titled];
    expect(ids(fitChunks(chunks, { maxChars: 100 }))).toEqual(["a"]);
  });

  it("returns nothing for nothing", () => {
    expect(fitChunks([])).toEqual([]);
  });
});
