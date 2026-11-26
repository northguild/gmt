/**
 * The chat transport's `fetch`, shared by `/dox` and the deck.
 */

/** Non-OK responses carry the Worker's own `{error, retryable}` JSON, but the
 * transport throws before that body reaches `onError` — the SDK formats its own
 * message and the original payload is lost. Reading it here and attaching it to
 * `cause` is what lets the UI show the Worker's actual wording (and its
 * `retryable` flag) instead of a generic failure. */
export function createChatFetch(
  doFetch: typeof fetch,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const response = await doFetch(input, init);
    if (response.ok) return response;

    let payload: unknown;
    try {
      payload = await response.clone().json();
    } catch {
      payload = undefined;
    }

    const error = new Error(`Chat request failed with ${response.status}`, {
      cause: { status: response.status, payload },
    });
    throw error;
  };
}

/** The page's own `fetch`, read when the request is made, so a test's stub is seen. */
export const chatFetch = createChatFetch((input, init) => fetch(input, init));
