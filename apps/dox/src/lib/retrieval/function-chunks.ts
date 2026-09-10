import type { CorpusEntry } from "~/reference-types";
import type { RetrievalChunk } from "./types";

/**
 * DOX-C1 (#137) — one chunk per reference entry (function, type, or regex):
 * signature + description + formatted examples + the entry's own page URL.
 * Pure function, no I/O — the same data `corpus.ts` already exports.
 */
export function buildFunctionChunks(corpus: CorpusEntry[]): RetrievalChunk[] {
  return corpus.map((entry) => {
    const parts = [entry.name];
    if (entry.signature) parts.push(entry.signature);
    parts.push(entry.description);
    for (const ex of entry.examples) {
      parts.push(
        ex.note
          ? `${ex.call} // ${ex.result} — ${ex.note}`
          : `${ex.call} // ${ex.result}`,
      );
    }
    return {
      id: `${entry.namespace}/${entry.module}/${entry.name}`,
      kind: "function",
      url: entry.url,
      namespace: entry.namespace,
      title: entry.name,
      text: parts.join("\n"),
    } satisfies RetrievalChunk;
  });
}
