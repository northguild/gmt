/**
 * What of the transcript actually gets re-sent to the model.
 *
 * The history is cleaned before each request. An assistant turn that never
 * received any text — stopped before the first token, or killed mid-stream by a
 * rate limit or a provider error — keeps empty text forever, and is dropped
 * here rather than replayed upstream on every later question.
 *
 * Replaying it costs three things, in ascending order of how much they matter: wasted
 * tokens on a shared free-tier budget; a confusing conversation shape (a user
 * turn answered by silence, then another user turn); and — because Gemini
 * rejects some malformed histories outright — an eventual hard failure whose
 * cause is several questions upstream of where it surfaces.
 */
import type { UIMessage } from "ai";

/** The text a message actually carries. Non-text parts (the retrieval trace,
 *  and later a tool call) are deliberately not text and do not count. */
export function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("");
}

/**
 * Drop assistant turns that carry no answer.
 *
 * Only assistant turns: a user turn is what the reader actually asked, and
 * dropping one would silently rewrite the conversation they can see. An
 * assistant turn with no text is not an answer the model gave — it is the
 * absence of one.
 */
export function sendableHistory<T extends UIMessage>(
  messages: readonly T[],
): T[] {
  return messages.filter(
    (message) =>
      message.role !== "assistant" || messageText(message).trim() !== "",
  );
}
