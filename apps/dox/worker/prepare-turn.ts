/**
 * Everything the Worker decides about one question before a model sees it:
 * the query, the retrieval hits, the context cut, the tool offer and the
 * vocabulary pick. The handler and the evals (`evals/offline.test.ts`) both
 * call this, so a score measures the code the chat runs.
 */
import type { UIMessage } from "ai";
import type { DoxToolName } from "../src/lib/dox-tools";
import type { RetrievalChunk } from "../src/lib/retrieval/types";
import { fitChunks } from "./fit-chunks";
import { namespaceFromPageContext } from "./namespace-from-page";
import { zonePlacesIn } from "../src/lib/retrieval/search";
import { selectTools } from "./select-tools";
import {
  chooseSkills,
  ZONE_CONVERSION_ANCHOR,
  type VocabularySkill,
} from "./select-vocabulary";

/** The last user turn's text parts, joined. */
export function queryOf(messages: readonly UIMessage[]): string {
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  return lastUserMessage
    ? lastUserMessage.parts
        .filter((part) => part.type === "text")
        .map((part) => ("text" in part ? part.text : ""))
        .join("")
    : "";
}

export interface PreparedTurn {
  query: string;
  /** Before `fitChunks`: retrieval metrics read this. */
  searched: readonly RetrievalChunk[];
  /** After `fitChunks`: the prompt, the link allowlist and the trace read this. */
  retrieved: RetrievalChunk[];
  offered: readonly DoxToolName[];
  chosen: readonly VocabularySkill[];
}

export async function prepareTurn(input: {
  messages: readonly UIMessage[];
  pageContext: string | undefined;
  search: (
    query: string,
    options: { namespace?: string },
  ) => RetrievalChunk[] | Promise<RetrievalChunk[]>;
  skills: readonly VocabularySkill[];
}): Promise<PreparedTurn> {
  const { messages, pageContext, search, skills } = input;
  const query = queryOf(messages);

  // Capped before anything else reads it, so the prompt, the linking
  // allowlist and the trace all describe the same chunks.
  const searched = await search(query, {
    namespace: namespaceFromPageContext(pageContext),
  });
  const retrieved = fitChunks(searched);

  /* Only the tools this question could use (see `select-tools.ts`), which
     always include every tool the history already called. */
  const offered = selectTools({ query, retrieved, messages });
  // Two zone cities make it a conversion between zones, however the rest reads.
  const anchors = zonePlacesIn(query) >= 2 ? [ZONE_CONVERSION_ANCHOR] : [];
  const chosen = chooseSkills(skills, retrieved, undefined, anchors);
  return { query, searched, retrieved, offered, chosen };
}
