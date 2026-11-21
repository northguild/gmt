/**
 * What a deck's live panels need from the deck: the questions, the recordings' home, the page
 * tool's call and how the quoted agent's run is shown. A deck writes one of these in
 * `src/slides/<slug>/live-data.ts` and hands it to `DeckLive`; nothing under `lib/slides/` or
 * `components/slides/` names a deck. No imports but types, so the recording script (run outside
 * Vite) and the Astro components read the same list.
 */
import type { AgentQuoteConfig } from "./agent-quote";

export interface FaqQuestion {
  id: string;
  question: string;
}

/** The page tool's one scripted question and the year its call is made for. */
export interface DeckToolScript {
  /** The question as the chat shows it. */
  question: string;
  /** The year passed to the tool: a fixed date in the talk, not a window that ages. */
  year: number;
}

export interface DeckLiveData {
  /** The page the Worker is told a question comes from, for retrieval's namespace bias. */
  pageContext: string;
  /** Where the recordings are kept, relative to `apps/dox`. */
  recordedDir: string;
  /** The running question, played live with its recording as the fallback. */
  running: FaqQuestion;
  /** The ready questions, each with a recorded Dox answer. */
  faq: readonly FaqQuestion[];
  /** The page-tool slide's call. */
  tool: DeckToolScript;
  /** How the quoted agent's answer and its run are shown. */
  agentRun: AgentQuoteConfig;
}

/** Every recording the deck needs, by id. */
export const recordingIds = (live: DeckLiveData): readonly string[] => [
  live.running.id,
  ...live.faq.map((item) => item.id),
];
