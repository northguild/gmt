import { useEffect } from "react";
import { FIRST_OUTPUT_TIMEOUT_MS, IDLE_TIMEOUT_MS } from "~/lib/chat-constants";

/**
 * Catches a stalled-but-open request. `useChat` owns the per-request abort and
 * abort-on-new-send, but it has no timeout: a connection that opens and then
 * goes silent hangs forever behind a spinner. This tells "still thinking" from
 * "quietly dead" without killing a legitimately long answer.
 *
 * Two limits, because the two waits are different:
 *
 * - **`submitted` — waiting for the first output** (`FIRST_OUTPUT_TIMEOUT_MS`).
 *   No answer text can arrive yet: the Worker may be failing over past spent
 *   or slow brains first. Holding this to the idle limit stopped answers that
 *   were on their way. Each progress line the Worker sends (`activity`)
 *   restarts it, so a long walk through several brains is never cut off while
 *   it is still moving — the Worker gives each brain its own start timeout
 *   (`BRAIN_START_TIMEOUT_MS`), well inside this one.
 * - **`streaming` — silence between chunks** (`timeoutMs`, default
 *   `IDLE_TIMEOUT_MS`), restarted on every chunk.
 *
 * The restart signal is `messages`' identity, not a per-chunk callback: `onData`
 * only fires for custom `data-*` parts, never for text deltas. `useChat`
 * replaces the `messages` array on every streamed delta, so each chunk re-runs
 * this effect, clearing the old timer and arming a fresh one. Progress parts
 * are transient and never touch `messages`, which is why they arrive
 * separately as `activity`.
 *
 * Cleanup clears the handle on every re-run and on unmount, so no timer
 * dangles past a `stop()`, a completed answer, or a navigation away.
 */
export function useIdleTimeout({
  status,
  messages,
  activity,
  stop,
  onStall,
  timeoutMs = IDLE_TIMEOUT_MS,
  firstOutputTimeoutMs = FIRST_OUTPUT_TIMEOUT_MS,
}: {
  status: string;
  messages: readonly unknown[];
  /** Any other sign of life — the current progress line. A change restarts
   *  the timer. */
  activity?: unknown;
  stop: () => void;
  onStall: () => void;
  timeoutMs?: number;
  firstOutputTimeoutMs?: number;
}): void {
  useEffect(() => {
    if (status !== "streaming" && status !== "submitted") return;

    const handle = setTimeout(
      () => {
        stop();
        onStall();
      },
      status === "submitted" ? firstOutputTimeoutMs : timeoutMs,
    );

    return () => clearTimeout(handle);
  }, [
    status,
    messages,
    activity,
    stop,
    onStall,
    timeoutMs,
    firstOutputTimeoutMs,
  ]);
}
