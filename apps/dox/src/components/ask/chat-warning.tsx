/**
 * DOX-C3a (#139) — error/warning rendering.
 *
 * A rate limit, a validation rejection, or a stalled stream is a *warning*, not
 * a crash: the UI stays usable and the reader can try again. Crucially these
 * are held in component state and never become `UIMessage`s, so they are
 * excluded from the history sent upstream on the next turn **by construction**
 * rather than by filtering them back out — the UI can be forgiving without
 * corrupting the model's context.
 *
 * Styling reuses the site's existing "signal lost" language (the amber
 * `--gmt-signal*` tokens used by every widget's sentinel state) rather than
 * inventing a generic error box.
 */

export interface ChatWarningState {
  message: string;
  retryable: boolean;
}

/** The Worker's own `{error, retryable}` body, recovered from the thrown
 * error's `cause` (see `chatFetch` in DoxChat.tsx — the transport formats its
 * own message and drops the payload, so it's stashed there on the way past). */
interface WorkerErrorPayload {
  status?: number;
  payload?: { error?: string; retryable?: boolean };
}

export function classifyChatError(error: Error): ChatWarningState {
  const cause = error.cause as WorkerErrorPayload | undefined;
  const workerMessage = cause?.payload?.error;

  if (workerMessage) {
    return {
      message: workerMessage,
      retryable: cause?.payload?.retryable ?? false,
    };
  }

  // An HTTP response came back, but not one the Worker wrote. The common
  // case by far is a 404 in local development: `astro dev` serves the static
  // site only — `/api/chat` exists solely in the Cloudflare Worker, which runs
  // under `wrangler dev` (or in production). Saying "check your connection"
  // there is actively misleading, so name the real cause.
  if (cause?.status === 404 && isLocalhost()) {
    return {
      message:
        "No /api/chat endpoint. The Astro dev server doesn't run the Worker — use `pnpm build && wrangler dev` to talk to Dox locally.",
      retryable: false,
    };
  }

  if (cause?.status) {
    return {
      message: `Dox is unavailable (HTTP ${cause.status}).`,
      retryable: cause.status >= 500,
    };
  }

  // Nothing was attached by `chatFetch`, which means no non-OK HTTP response
  // was ever seen. Two very different failures land here and must not be
  // conflated:
  //
  //   1. The request never completed — fetch rejected. That is a real
  //      transport failure and "check your connection" is the right thing to
  //      say.
  //   2. The response was a perfectly good 200 and the Worker wrote an error
  //      INTO the already-open stream (`createUIMessageStream`'s `onError`,
  //      whose text is `mapUpstreamError`'s curated, reader-facing wording).
  //      That arrives as a plain Error carrying exactly the message we want to
  //      show.
  //
  // Case 2 was being reported as case 1 — observed live 2026-09-10, where a
  // Gemini daily-quota exhaustion (HTTP 200, error frame mid-stream) told the
  // reader to check their connection. Nothing was wrong with their connection.
  if (isTransportFailure(error)) {
    return {
      message: "Couldn't reach Dox. Check your connection and try again.",
      retryable: true,
    };
  }

  const streamed = error.message?.trim();
  if (streamed) return { message: streamed, retryable: true };

  return {
    message: "Couldn't reach Dox. Check your connection and try again.",
    retryable: true,
  };
}

/** A rejected `fetch` — as opposed to an error delivered inside a successful
 * response's stream. The browser signals this as a `TypeError` ("Failed to
 * fetch"), and an aborted request as an `AbortError` `DOMException`; an error
 * the Worker streamed is a plain `Error`. */
function isTransportFailure(error: Error): boolean {
  return (
    error.name === "TypeError" ||
    error.name === "AbortError" ||
    (typeof DOMException !== "undefined" && error instanceof DOMException)
  );
}

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function ChatWarning({ state }: { state: ChatWarningState }) {
  return (
    <div className="gmt-hive-warning" role="status">
      <span className="gmt-hive-warning-marker" aria-hidden="true">
        ⟨ ! ⟩
      </span>
      <p>{state.message}</p>
    </div>
  );
}
