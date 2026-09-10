import type { RetrievalChunk } from "../src/lib/retrieval/types";

export interface PromptSections {
  /** Exactly the retrieved chunks' URLs — never the full route manifest.
   * DOX-C.md: "a model shown 20 valid routes hallucinates far less than
   * one shown 120." */
  routeAllowlist: string[];
  chunks: RetrievalChunk[];
  /** packages/gmt/skills/*\/SKILL.md content (consumer-facing skills only) — see worker/vocabulary.ts. */
  vocabulary: string;
  /** packages/gmt/README.md's "Core Rules" section, verbatim — see worker/core-rules.ts. */
  coreRules: string;
}

/**
 * DOX-C2 (#138) — pure function, no I/O, no model call: given fixed
 * sections, assembles the system prompt. Order matters (DOX-C.md): persona
 * and scope, then linking rules, then vocabulary (so the model learns GMT's
 * terminology before reading raw signatures), then core rules, then the
 * retrieved chunks themselves, then the (currently empty) tool-registry
 * placeholder DOX-C3b fills in, then an explicit refusal instruction.
 */
export function assembleSystemPrompt(sections: PromptSections): string {
  const { routeAllowlist, chunks, vocabulary, coreRules } = sections;

  const chunksBlock =
    chunks.length > 0
      ? chunks
          .map((c) => `### ${c.title} (${c.url})\n\n${c.text}`)
          .join("\n\n")
      : "(no chunks retrieved for this question)";

  const allowlistBlock =
    routeAllowlist.length > 0
      ? routeAllowlist.map((url) => `- ${url}`).join("\n")
      : "(none — this question retrieved no pages; do not link to anything)";

  return `## Persona and scope

You are Ask Dox, the documentation assistant for @northguild/gmt, a Temporal-first date/time library. Answer only from the reference material and guide excerpts supplied below in "Retrieved context". If the supplied context does not answer the question, say so plainly rather than guessing or drawing on general knowledge of date/time libraries.

## Linking rules

You may link ONLY to the following pages, exactly as written. Never invent a URL, never link to a GitHub anchor or a SKILL.md heading, and never modify one of these paths:

${allowlistBlock}

If the question has no good match above, do not produce a link at all.

## Vocabulary

${vocabulary}

## Core rules

${coreRules}

## Retrieved context

${chunksBlock}

## Available tools

(no tools are registered yet)

## Refusal instruction

If "Retrieved context" above is empty, or does not actually answer the question, refuse: say plainly that @northguild/gmt's documentation does not cover this, and do not improvise an answer from general knowledge. Do not apologize excessively; one direct sentence is enough.`;
}
