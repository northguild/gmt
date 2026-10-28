/**
 * Which widget tools to offer the model for one question.
 *
 * Offering all of them costs more than it buys. Each tool travels twice — once
 * as a `Call when` line in the system prompt and once as a JSON schema beside
 * it — and with 39 tools that was ~60 KB of every request, about a third of the
 * prompt, for a turn that calls at most one. A smaller set is also an easier
 * choice: the model has fewer near-misses to pick between.
 *
 * The set is:
 *
 *   1. **The core tools** — the widgets of the first `CORE_TOOL_COUNT` chat
 *      starters (globe, zone planner, converter bench, interval visualiser, DST
 *      inspector). They answer the everyday time-zone questions, which are the
 *      ones a keyword match is least sure about ("what time is it in Sydney?").
 *   2. **The best `MATCHED_TOOL_COUNT` matches** for the question: a small
 *      full-text index over each tool's name, purpose and `Call when` line, plus
 *      a bonus for every tool whose description names a function the retrieval
 *      search ranked near the top. That second signal is what finds an
 *      industry widget from a question that never says its name ("time
 *      waiting" → the dwell ledger, via `dwellTime`).
 *   3. **Every tool already used in this conversation.** Its call and result
 *      are in the history the model reads, and a provider can reject a history
 *      that calls a function the request does not declare.
 *
 * `select-tools.test.ts` pins that every chat starter's own widget is offered
 * for its own question — the starters are the questions these widgets exist
 * for, so a starter that misses is a selector bug.
 */
import MiniSearch from "minisearch";
import type { UIMessage } from "ai";
import { CHAT_STARTERS } from "../src/lib/chat-constants";
import {
  ENABLED_TOOL_DOCS,
  ENABLED_TOOL_NAMES,
  type DoxToolName,
} from "../src/lib/dox-tools";
import type { RetrievalChunk } from "../src/lib/retrieval/types";

/** How many chat starters, from the top, name an always-offered tool. */
export const CORE_TOOL_COUNT = 5;

/** How many tools the question itself picks, beyond the core ones. */
export const MATCHED_TOOL_COUNT = 3;

/** How many retrieved chunks lend their function names to the ranking. */
const RETRIEVAL_SIGNAL_DEPTH = 8;

/* The retrieval search's stopwords, plus the words every widget request uses
   ("show me", "tell me", "can I") — they say a widget is wanted, not which. */
const STOPWORDS = new Set(
  "a an the do does did is are was were what how to of for in on at and or with from i me my you your it this that show tell can be by as its their they".split(
    " ",
  ),
);

/** Splits `showDwellLedger` into its words, without the `show` every name has. */
function nameWords(name: string): string {
  return (
    name.replace(/^show/, "").match(/\p{Lu}+(?!\p{Ll})|\p{Lu}?\p{Ll}+|\p{Nd}+/gu) ??
    []
  ).join(" ");
}

/* A light suffix strip, so "waiting" meets "wait" and "cut-offs" meets
   "cut-off". Not a real stemmer: it only has to make a question and a tool
   description agree, and both are short. A doubled final letter is folded
   too ("planner" → "plan"). Pure digits are dropped — "2024" names no tool. */
function processTerm(term: string): string | false {
  const lower = term.toLowerCase();
  if (lower.length < 2 || STOPWORDS.has(lower) || /^\d+$/.test(lower)) {
    return false;
  }
  return lower
    .replace(/(ures|ure|als|al|ing|ed|es|s|e)$/, "")
    .replace(/(.)\1$/, "$1");
}

interface ToolEntry {
  name: DoxToolName;
  nameWords: string;
  purpose: string;
  when: string;
  /** Purpose and arguments together: where a tool names the functions it
   *  shows, which the retrieval bonus matches against. */
  mentions: string;
}

let index: MiniSearch<ToolEntry> | undefined;
let entries: ToolEntry[] = [];

/** Built on first use and kept for the isolate's life — the registry is
 *  fixed at build time, so there is nothing to invalidate. */
function toolIndex(): MiniSearch<ToolEntry> {
  if (index) return index;
  entries = ENABLED_TOOL_DOCS.map((doc) => ({
    name: doc.name,
    nameWords: nameWords(doc.name),
    purpose: doc.purpose,
    when: doc.when,
    mentions: `${doc.purpose} ${doc.args}`,
  }));
  index = new MiniSearch<ToolEntry>({
    idField: "name",
    fields: ["nameWords", "purpose", "when"],
    tokenize: (text) => text.split(/[\n\r\p{Z}\p{P}]+/u).filter(Boolean),
    processTerm,
    searchOptions: {
      boost: { nameWords: 2, when: 2 },
      // Typos in longer words only; a fuzzy "time" matches half the registry.
      fuzzy: (term) => (term.length >= 6 ? 0.2 : 0),
    },
  });
  index.addAll(entries);
  return index;
}

/** The function a function chunk documents: its title up to the first
 *  space, `›` or `(` ("dwellTime", not "dwellTime(…)"). */
function functionName(chunk: RetrievalChunk): string {
  return chunk.title.split(/[ ›(]/)[0] ?? "";
}

/** Every widget tool this conversation has already called. */
function toolsInHistory(messages: readonly UIMessage[]): DoxToolName[] {
  const enabled = new Set<string>(ENABLED_TOOL_NAMES);
  const found = new Set<DoxToolName>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (!part.type.startsWith("tool-")) continue;
      const name = part.type.slice("tool-".length);
      if (enabled.has(name)) found.add(name as DoxToolName);
    }
  }
  return [...found];
}

/**
 * The tools to offer for this question, core tools first.
 *
 * @param query The reader's latest message.
 * @param retrieved The retrieval search's hits for it, best first.
 * @param messages The whole conversation, for the tools it already used.
 */
export function selectTools({
  query,
  retrieved,
  messages,
}: {
  query: string;
  retrieved: readonly RetrievalChunk[];
  messages: readonly UIMessage[];
}): DoxToolName[] {
  const search = toolIndex();
  const scores = new Map<DoxToolName, number>();

  for (const hit of search.search(query)) {
    scores.set(hit.id as DoxToolName, hit.score);
  }

  retrieved.slice(0, RETRIEVAL_SIGNAL_DEPTH).forEach((chunk, rank) => {
    if (chunk.kind !== "function") return;
    const fn = functionName(chunk);
    // Short names ("add", "now") appear inside too many descriptions to mean
    // anything.
    if (fn.length <= 4) return;
    for (const entry of entries) {
      if (entry.mentions.includes(fn)) {
        scores.set(entry.name, (scores.get(entry.name) ?? 0) + 10 / (rank + 1));
      }
    }
  });

  const core = CHAT_STARTERS.slice(0, CORE_TOOL_COUNT).map(
    (starter) => starter.widget,
  );
  const matched = [...scores]
    .filter(([name]) => !core.includes(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MATCHED_TOOL_COUNT)
    .map(([name]) => name);

  return [...new Set([...core, ...matched, ...toolsInHistory(messages)])];
}
