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
}

/** The `type` discriminant on the emitted part. `data-` prefix is the AI SDK's
 * convention for custom data parts (`DataUIPart`'s `type: \`data-${NAME}\``). */
export const RETRIEVAL_PART_TYPE = "data-retrieval" as const;
