/**
 * DOX-C3a (#139) — input hardening, shared by the client and the Worker.
 *
 * Two different jobs, deliberately separated:
 *
 *   `sanitizeUserText`  strips characters that are invisible but meaningful.
 *   `checkUserText`     enforces the limits, and reports *why* it refused.
 *
 * The client runs both so a reader gets an instant, specific message instead of
 * a 400 after a round trip. The Worker runs both again because the client is
 * not a security boundary — anything can POST to `/api/chat`. Neither call is
 * redundant; they serve different purposes at different trust levels.
 *
 * ## What is actually being defended against
 *
 * Not "bad words" — a documentation assistant has no business filtering topics,
 * and a model that refuses out-of-corpus questions already handles nonsense.
 * The concern is text that *renders as one thing and means another*, because
 * that defeats the reader's own judgement about what they are sending and
 * defeats a reviewer reading a transcript:
 *
 *  - **Unicode tag characters** (U+E0000–U+E007F) mirror ASCII but render as
 *    nothing at all. They are the standard way to smuggle hidden instructions
 *    into an LLM prompt: a message that looks like "how do I add days?" can
 *    carry an invisible payload the model still reads.
 *  - **Bidi controls** (U+202A–U+202E, U+2066–U+2069) reorder a run of text
 *    visually without changing its logical order — the "Trojan Source" class of
 *    attack. What the reader sees and what the model receives diverge.
 *  - **Zero-width characters** (U+200B, U+2060–U+2064, U+FEFF) pad text
 *    invisibly: they inflate length, break naive filters, and can split a word
 *    so it survives review but reassembles for the model.
 *
 * Two zero-width characters are deliberately **kept**: U+200C (ZWNJ) and U+200D
 * (ZWJ). Both are ordinary letters' worth of meaning in real scripts — ZWNJ is
 * required in Persian and several Indic scripts, and ZWJ forms both Indic
 * conjuncts and every multi-part emoji. Their attack value is also far lower
 * than the rest of this set: they can pad or split a word, but unlike tag
 * characters they cannot carry a hidden payload, and unlike bidi controls they
 * cannot make displayed text differ from sent text. Stripping them would
 * corrupt legitimate questions to buy very little.
 *  - **C0/C1 controls** other than tab and newline have no meaning in prose and
 *    can corrupt logs and terminals downstream.
 *
 * Stripping is the right response rather than rejecting: a reader who pastes a
 * snippet out of a PDF and picks up a stray U+200B should get an answer, not an
 * error. What survives is exactly what they could see.
 *
 * Prompt *injection* in the plain-text sense ("ignore previous instructions")
 * is NOT handled here, and cannot be — it is indistinguishable from a legitimate
 * question at the character level. That is defended in `worker/system-prompt.ts`
 * (role separation plus an explicit instruction that user and retrieved text are
 * data, never commands) and by the fact that Dox has no tools and no write path.
 */

import { MAX_MESSAGE_LENGTH } from "./chat-constants";

/**
 * Total characters across the whole conversation. `MAX_MESSAGES` ×
 * `MAX_MESSAGE_LENGTH` is 160,000 characters — every one of which would be
 * re-sent and re-billed on every turn. This is the cap that actually bounds a
 * request; the per-message one only bounds a single paste.
 */
export const MAX_CONVERSATION_CHARS = 24_000;

/** Longest accepted `pageContext`. It is only ever matched against
 * `/reference/<seg>` or `/guides/<seg>`, so anything longer is not a real route
 * and there is no reason to carry it. */
export const MAX_PAGE_CONTEXT_LENGTH = 512;

/**
 * Invisible-but-meaningful codepoints. Ordered as in the doc comment above.
 * `\p{Cf}` would cover most of these, but it also covers characters that carry
 * real linguistic meaning (U+00AD soft hyphen, and the ZWJ sequences that hold
 * together emoji and Indic conjuncts) — so the set is enumerated rather than
 * swept up by category.
 */
const INVISIBLE = new RegExp(
  [
    "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", // C0 + DEL, keeping \t \n
    "[\\u0080-\\u009F]", // C1
    "\\u200B", // zero-width space (U+200C ZWNJ / U+200D ZWJ kept — see above)
    "[\\u200E\\u200F]", // LRM / RLM directional marks
    "[\\u202A-\\u202E]", // bidi embedding/override
    "[\\u2060-\\u2064]", // word joiner + invisible operators
    "[\\u2066-\\u2069]", // bidi isolates
    "\\uFEFF", // BOM / zero-width no-break space
    "[\\u{E0000}-\\u{E007F}]", // Unicode tag block
  ].join("|"),
  "gu",
);

/** Runs of 3+ blank lines collapse to two. Purely cosmetic, but it stops a
 * message being padded to the length cap with newlines. */
const EXCESS_BLANK_LINES = /\n{3,}/g;

/**
 * Strip what cannot be seen, normalise what can.
 *
 * NFC first, so that a composed and a decomposed form of the same string
 * measure the same length against the cap — otherwise the limit depends on how
 * the reader's keyboard happened to encode an accent.
 */
export function sanitizeUserText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(EXCESS_BLANK_LINES, "\n\n")
    .trim();
}

export type UserTextCheck =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/**
 * Sanitise, then apply this app's limits. Returns the cleaned text on success
 * so callers cannot accidentally use the raw input instead.
 */
export function checkUserText(raw: string): UserTextCheck {
  const text = sanitizeUserText(raw);

  if (text === "") {
    return { ok: false, reason: "Message is empty." };
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      reason: `Message is too long — ${text.length.toLocaleString()} characters, limit ${MAX_MESSAGE_LENGTH.toLocaleString()}.`,
    };
  }
  return { ok: true, text };
}

/** Total size of a conversation, for the whole-request budget. */
export function conversationLength(texts: readonly string[]): number {
  return texts.reduce((total, text) => total + text.length, 0);
}
