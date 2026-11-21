/**
 * The chat transport the deck's slides hand to `DoxChat` (`createTransport`), so a slide shows the
 * real Dox chat and the demo's rules live here, not in the components.
 *
 * The rules of the demo (`context/dox/specs/dox-g12/s4b-live-agents.md`):
 *  - A question typed in the composer goes live, to `POST /gmt/api/chat`, through the AI SDK's
 *    `DefaultChatTransport`, the one `/dox` uses, so the Worker sees the same body.
 *  - 8 s to the first output. Past it, or on an HTTP error, a refusal or a stream error before any
 *    output, the live request is aborted and the question's recording plays in its place, labelled
 *    with its date and brain. A late live chunk is dropped: nothing reaches the chat after the
 *    switch. Without a recording the failure reaches the chat as the same error `/dox` shows.
 *  - A planned recording (`plan`) plays with no network and no live attempt: the ready questions.
 *  - One request at a time is the chat's own guard (`DoxChat`'s `send` refuses while busy); a
 *    transport asked twice at once refuses the second.
 *  - `abort` stops everything in flight and leaves nothing running: no request, no timer.
 *
 * Once the live answer has produced output it is the answer; a stream error after that reaches the
 * chat as the error it is, since a message already on screen cannot be taken back.
 */
import {
  DefaultChatTransport,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { chatFetch, createChatFetch } from "~/lib/chat-fetch";
import { sendableHistory } from "~/lib/chat-history";
import {
  REFUSAL_PART_TYPE,
  STATUS_PART_TYPE,
  USAGE_PART_TYPE,
} from "~/lib/chat-types";
import { withBase } from "~/lib/site";
import { formatRecordedLabel, replayStream, type Recording } from "./replay";
import type { DemoSource, DemoState } from "./sync";

/** How long the live call has to give its first output. */
export const FIRST_OUTPUT_MS = 8000;

/** Where the answer on screen comes from, for the line above the composer. */
export interface SourceState {
  source: DemoSource;
  /** The recorded line, "Recorded 15 December 2026, Gemma"; absent for Live and Waiting. */
  label?: string;
}

/** What the next question is: a recording that plays with no network, or the live call. */
interface DeckPlan {
  /** The answer to play, or `null` while none is recorded. */
  recording: Recording | null;
  /** Skip the live call and play `recording`: a ready question. */
  recordedOnly: boolean;
}

interface DeckSessionOptions {
  /** The page the Worker is told a question comes from (`DeckLiveData.pageContext`). */
  pageContext: string;
  /** The deck's venue zone (`DeckEntry.zone`): a recording's date is read in it. */
  zone: string;
  /** Told where each answer comes from, and `null` when the demo ends. */
  onSource: (state: SourceState | null) => void;
  /** The request, for a test; defaults to the page's `fetch`. */
  fetch?: typeof fetch;
  budgetMs?: number;
  api?: string;
  /**
   * An answer made in the page: any question gets this stream, with no network. The page-tool
   * slide runs its tool here. Aborting the signal ends it.
   */
  local?: (signal: AbortSignal) => ReadableStream<UIMessageChunk>;
}

export interface DeckSession {
  /** Sets how the next question is answered; read once, by the next request. */
  plan(next: DeckPlan | null): void;
  /** The transport to give `DoxChat`; `brain` reads the control bar's pick. */
  transport(brain: () => string | null): ChatTransport<UIMessage>;
  /** Stops every request and replay in flight. The session can be used again. */
  abort(): void;
}

/** Thrown inside a run for a stall or a refusal the Worker wrote into the stream. */
class AnswerFailed extends Error {}

/** The chunks that count as output: the answer has begun. */
const OUTPUT_CHUNKS: ReadonlySet<string> = new Set([
  "text-start",
  "text-delta",
  "tool-input-start",
  "tool-input-delta",
  "tool-input-available",
  "tool-output-available",
]);

/** A transient progress line: the chat shows it at once and it never becomes part of a message. */
const isStatus = (chunk: UIMessageChunk): boolean =>
  chunk.type === STATUS_PART_TYPE;

/** Whether `error` is the end of the run by the reader (leaving the slide, stop). */
const isAbort = (signal: AbortSignal): boolean => signal.aborted;

export function createDeckSession(o: DeckSessionOptions): DeckSession {
  let planned: DeckPlan | null = null;
  const running = new Set<AbortController>();

  const abort = (): void => {
    for (const controller of running) controller.abort();
    running.clear();
  };

  function transport(brain: () => string | null): ChatTransport<UIMessage> {
    const doFetch = o.fetch ? createChatFetch(o.fetch) : chatFetch;

    /** Plays `recording` into `out`, without the quota counts it was recorded with. */
    async function play(
      recording: Recording,
      out: ReadableStreamDefaultController<UIMessageChunk>,
      signal: AbortSignal,
    ): Promise<void> {
      const label = await formatRecordedLabel(recording, o.zone);
      if (signal.aborted) return;
      o.onSource({ source: "recorded", label });
      const reader = replayStream(recording, signal).getReader();
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done || signal.aborted) return;
          if (next.value.type === USAGE_PART_TYPE) continue;
          out.enqueue(next.value);
        }
      } finally {
        reader.releaseLock();
      }
    }

    /**
     * The live call. Resolves when the answer has ended; rejects with the reason it failed.
     * `committed` says whether output had reached the chat, which decides whether a recording can
     * still take over.
     */
    async function live(
      args: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0],
      out: ReadableStreamDefaultController<UIMessageChunk>,
      signal: AbortSignal,
      state: { committed: boolean },
    ): Promise<void> {
      const request = new AbortController();
      const follow = (): void => request.abort(signal.reason);
      signal.addEventListener("abort", follow, { once: true });
      let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(
        () => request.abort(new AnswerFailed("Dox was too slow")),
        o.budgetMs ?? FIRST_OUTPUT_MS,
      );
      const stop = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
      };
      const aborted = new Promise<never>((_, reject) => {
        const fail = (): void => reject(request.signal.reason);
        if (request.signal.aborted) fail();
        else request.signal.addEventListener("abort", fail, { once: true });
      });
      // Settles only if nothing races it, so a failure that nobody awaits is not unhandled.
      aborted.catch(() => {});
      try {
        const inner = new DefaultChatTransport<UIMessage>({
          api: o.api ?? withBase("/api/chat"),
          fetch: doFetch,
          prepareSendMessagesRequest: ({ messages }) => {
            const model = brain();
            return {
              body: {
                messages: sendableHistory(messages),
                pageContext: o.pageContext,
                ...(model ? { model } : {}),
              },
            };
          },
        });
        const stream = await Promise.race([
          inner.sendMessages({ ...args, abortSignal: request.signal }),
          aborted,
        ]);
        const reader = stream.getReader();
        const held: UIMessageChunk[] = [];
        try {
          for (;;) {
            const next = await Promise.race([reader.read(), aborted]);
            if (next.done) break;
            const chunk = next.value;
            if (state.committed) {
              out.enqueue(chunk);
              continue;
            }
            if (chunk.type === REFUSAL_PART_TYPE) {
              throw new AnswerFailed("Dox refused the question");
            }
            if (chunk.type === "error") {
              throw new AnswerFailed("Dox sent an error");
            }
            if (isStatus(chunk)) {
              out.enqueue(chunk);
              continue;
            }
            if (!OUTPUT_CHUNKS.has(chunk.type)) {
              held.push(chunk);
              continue;
            }
            // First output: this is the answer. What came before it goes first, in order.
            state.committed = true;
            stop();
            o.onSource({ source: "live" });
            for (const earlier of held) out.enqueue(earlier);
            out.enqueue(chunk);
          }
        } finally {
          // The SDK's own reader is left to the abort below: cancelling it closes a stream it has
          // already closed, which surfaces as an unhandled rejection.
          reader.releaseLock();
        }
        if (!state.committed) throw new AnswerFailed("Dox gave no answer");
      } finally {
        stop();
        signal.removeEventListener("abort", follow);
        // Whatever is still open (a stalled body) ends here, so a late chunk has nowhere to go.
        request.abort();
      }
    }

    async function answer(
      args: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0],
      out: ReadableStreamDefaultController<UIMessageChunk>,
      signal: AbortSignal,
      plan: DeckPlan | null,
    ): Promise<void> {
      if (o.local) {
        o.onSource({ source: "live" });
        const reader = o.local(signal).getReader();
        try {
          for (;;) {
            const next = await reader.read();
            if (next.done || signal.aborted) return;
            out.enqueue(next.value);
          }
        } finally {
          reader.releaseLock();
        }
      }
      if (plan?.recordedOnly) {
        if (!plan.recording) {
          o.onSource({ source: "recorded", label: "Recording to come" });
          throw new Error("This answer has not been recorded yet.");
        }
        await play(plan.recording, out, signal);
        return;
      }
      o.onSource({ source: "pending" });
      const state = { committed: false };
      try {
        await live(args, out, signal, state);
      } catch (failure) {
        if (isAbort(signal)) return;
        if (state.committed) throw failure;
        if (plan?.recording) {
          out.enqueue({
            type: STATUS_PART_TYPE,
            data: { text: "Dox could not answer live. Playing the recording." },
            transient: true,
          } as UIMessageChunk);
          await play(plan.recording, out, signal);
          return;
        }
        o.onSource({ source: "pending", label: "Live answer failed" });
        throw failure;
      }
    }

    return {
      async sendMessages(args) {
        const plan = planned;
        planned = null;
        const controller = new AbortController();
        running.add(controller);
        const follow = (): void => controller.abort(args.abortSignal?.reason);
        if (args.abortSignal?.aborted) follow();
        else
          args.abortSignal?.addEventListener("abort", follow, { once: true });
        const release = (): void => {
          args.abortSignal?.removeEventListener("abort", follow);
          running.delete(controller);
        };
        return new ReadableStream<UIMessageChunk>({
          async start(out) {
            try {
              await answer(args, out, controller.signal, plan);
              out.close();
            } catch (failure) {
              if (controller.signal.aborted) out.close();
              else out.error(failure);
            } finally {
              release();
              controller.abort();
            }
          },
          cancel() {
            controller.abort();
          },
        });
      },
      async reconnectToStream() {
        return null;
      },
    };
  }

  return {
    plan(next) {
      planned = next;
    },
    transport,
    abort,
  };
}

/** `gmt-demo` on the deck root: the presenter's Live or Recorded (`deck-mount.ts`). */
export function announceDemo(deck: Element, state: DemoState): void {
  deck.dispatchEvent(new CustomEvent("gmt-demo", { detail: state }));
}
