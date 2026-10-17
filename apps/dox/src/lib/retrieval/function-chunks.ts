import type { CorpusEntry } from "~/reference-types";
import type { RetrievalChunk } from "./types";

/**
 * DOX-C1 (#137) — one chunk per reference entry (function, type, or regex):
 * signature + description + formatted examples + the entry's own link.
 * Pure function, no I/O — the same data `corpus.ts` already exports.
 *
 * A type chunk also carries each member's name and description, so a question
 * about a field ("what is calendarDays?") finds the type that declares it.
 *
 * A function chunk also carries the description of each documented type its
 * signature names. `utcToGnss(system: GnssSystem, ...)` never says "GLONASS" —
 * its type does, and the type is what a reader's word for the thing maps to.
 *
 * The link is `entry.url`, fragment included: a type documented on its
 * function's page is cited at its own heading there, not at the top of the page.
 */
export function buildFunctionChunks(corpus: CorpusEntry[]): RetrievalChunk[] {
  const typeDescriptions = new Map<string, string>();
  for (const entry of corpus) {
    if (entry.kind === "type" && entry.description) {
      typeDescriptions.set(entry.name, entry.description);
    }
  }
  return corpus.map((entry) => {
    const parts = [entry.name];
    if (entry.signature) parts.push(entry.signature);
    parts.push(entry.description);
    if (entry.kind === "function" && entry.signature) {
      const named = new Set(entry.signature.match(/[A-Z][A-Za-z0-9]*/g));
      for (const name of named) {
        const description = typeDescriptions.get(name);
        if (description) parts.push(`${name}: ${description}`);
      }
    }
    for (const ex of entry.examples) {
      parts.push(
        ex.note
          ? `${ex.call} // ${ex.result} — ${ex.note}`
          : `${ex.call} // ${ex.result}`,
      );
    }
    for (const member of entry.members ?? []) {
      parts.push(
        member.description
          ? `${member.name}: ${member.description}`
          : member.name,
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
