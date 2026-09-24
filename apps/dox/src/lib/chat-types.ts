/**
 * DOX-C3a (#139) — shapes shared across the Worker/client boundary, so the two
 * sides can't drift on a contract neither of them owns alone.
 *
 * Kept separate from `chat-constants.ts` (values) because this is types only —
 * `worker/chat-handler.ts` writes these, `components/ask/*` reads them back off
 * `message.parts`.
 */

/** The custom UI-message data part the Worker emits before the answer streams,
 * making grounding legible instead of asserted: how much corpus was searched,
 * how much survived the relevance threshold, and which chunks those were.
 *
 * `retrievedCount: 0` is the honest-refusal case — the trace should *look* like
 * nothing was retrieved, because nothing was. */
export interface RetrievalTraceData {
  totalChunks: number;
  retrievedCount: number;
  chunkTitles: string[];
  /** The URLs of the retrieved chunks — i.e. exactly the route allowlist the
   * system prompt hands the model this turn.
   *
   * Load-bearing for link hardening, not just display: the generated
   * `route-manifest.ts` contains **only** `/reference/...` paths (verified —
   * zero `/guides/...` entries), because it predates DOX-C1's guide chunking.
   * Validating model-emitted links against the manifest alone would therefore
   * downgrade every legitimate *guide* citation to plain text. Checking
   * against the manifest ∪ what was actually retrieved is both more accurate
   * and tighter than a static route list, and it mirrors the instruction the
   * Worker already gives the model. */
  chunkUrls: string[];
  /** Which brain answered. Shown in the transcript so a reader can tell why two
   * answers differ in voice — Dox moves between models as daily budgets run
   * out, and an unexplained change in tone reads as a bug. */
  brainId?: string;
  brainLabel?: string;
  /** Where the time went, in milliseconds per stage. Present from the first
   * write; `firstToken`, `total` and `toolCalled` arrive when the answer
   * finishes, in a second write of the same part (same `id`, so the client
   * replaces it in place rather than appending a second trace). */
  timings?: RetrievalTimings;
  /** Every brain tried this request, in order, with how long each took and
   * why the walk moved on. The last row is the one that answered. */
  attempts?: BrainAttemptTrace[];
  /** The widget tool the model called, or `null` once the answer finished
   * without one. Absent until then. */
  toolCalled?: string | null;
}

/** Milliseconds spent in each stage of one `/api/chat` request. Whole
 * numbers — a sub-millisecond stage is 0, not noise. */
export interface RetrievalTimings {
  /** The KV ledger read. 0 without a ledger. */
  usage: number;
  /** Fetching (or re-reading) the chunk corpus. */
  corpus: number;
  /** MiniSearch: index build plus the query. */
  search: number;
  /** Assembling the system prompt and converting the transcript. */
  prompt: number;
  /** Every brain attempt, including the ones that failed over. */
  brains: number;
  /** From the request arriving to the first text or tool chunk. */
  firstToken?: number;
  /** From the request arriving to the last chunk. */
  total?: number;
}

export interface BrainAttemptTrace {
  brainId: string;
  ms: number;
  /** `busy`: the model was overloaded (503) for this request only — tried
   * the next brain, marked nothing in the ledger. */
  outcome: "answered" | "spent" | "unavailable" | "busy";
}

/** The `id` on the retrieval part. Fixed, so the finishing write replaces the
 * opening one — the AI SDK reconciles a `data-*` part by `id`. */
export const RETRIEVAL_PART_ID = "retrieval" as const;

/** The `type` discriminant on the emitted part. `data-` prefix is the AI SDK's
 * convention for custom data parts (`DataUIPart`'s `type: \`data-${NAME}\``). */
export const RETRIEVAL_PART_TYPE = "data-retrieval" as const;

/** Progress while Dox chooses a brain — "Asking 3.8 Flash…", "3.8 Flash is
 * busy — trying the next model…". Written `transient`: it reaches `onData`
 * and the pending card, never the message or the history. */
export interface StatusData {
  text: string;
}
export const STATUS_PART_TYPE = "data-status" as const;

/**
 * A request the Worker could not answer once its stream was open — every brain
 * out, or an upstream failure. Carries exactly the `{ status, payload }` a
 * non-OK HTTP response used to, so the client hands it to the same
 * `classifyChatError` and the reader sees the same warning. `transient`, so no
 * empty assistant turn is left behind.
 */
export interface RefusalData {
  status: number;
  payload: unknown;
}
export const REFUSAL_PART_TYPE = "data-refusal" as const;
