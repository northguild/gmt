import { useEffect } from "react";
import { IDLE_TIMEOUT_MS } from "~/lib/chat-constants";

/**
 * DOX-C3a (#139) — catches a stalled-but-open stream. `useChat` owns the
 * per-request abort and abort-on-new-send, but it has no idle timeout: a
 * connection that opens and then goes silent will hang indefinitely, showing a
 * spinner forever. This is the thing that distinguishes "still thinking" from
 * "quietly dead" without killing a legitimately long answer.
 *
 * The reset signal is `messages`' identity, not a per-chunk callback: `onData`
 * only fires for custom `data-*` parts, never for text deltas, so there is no
 * public hook that runs per token. `useChat` does replace the `messages` array
 * on every streamed delta, which makes it a reliable proxy — every chunk
 * re-runs this effect, clearing the old timer and arming a fresh one.
 *
 * Cleanup clears the handle on every re-run and on unmount, so no timer
 * dangles past a `stop()`, a completed answer, or a navigation away.
 */
export function useIdleTimeout({
  status,
  messages,
  stop,
  onStall,
  timeoutMs = IDLE_TIMEOUT_MS,
}: {
  status: string;
  messages: readonly unknown[];
  stop: () => void;
  onStall: () => void;
  timeoutMs?: number;
}): void {
  useEffect(() => {
    if (status !== "streaming" && status !== "submitted") return;

    const handle = setTimeout(() => {
      stop();
      onStall();
    }, timeoutMs);

    return () => clearTimeout(handle);
  }, [status, messages, stop, onStall, timeoutMs]);
}
