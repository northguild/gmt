import { safeValidateUIMessages } from "ai";
import { buildWorkerTools, type DoxUIMessage } from "./tools";
import type { UIMessage } from "ai";
import { z } from "zod";
import {
  BRAIN_IDS,
  MAX_MESSAGES,
  MAX_MESSAGE_LENGTH,
  type BrainId,
} from "../src/lib/chat-constants";
import {
  MAX_CONVERSATION_CHARS,
  MAX_PAGE_CONTEXT_LENGTH,
  conversationLength,
  sanitizeUserText,
} from "../src/lib/chat-sanitize";

/**
 * DOX-C2 (#138) — the validation pipeline from DOX-C.md, minus the branches
 * that live elsewhere (`method !== POST` and malformed JSON are the caller's
 * job, since they happen before a body object exists to validate).
 *
 * `messages`' *internal* shape (parts, tool-call variants, etc.) is
 * delegated to `ai`'s own `safeValidateUIMessages` rather than a hand-guessed
 * zod schema — `UIMessage` has ~10 part-type variants and is maintained by
 * the SDK in lockstep with what `useChat`/`DefaultChatTransport` actually
 * sends. Zod here validates only the request envelope and this app's own
 * business rules (role restriction, length cap) that the SDK's structural
 * validator has no opinion on.
 */
const requestEnvelopeSchema = z.object({
  messages: z
    .array(z.unknown())
    .min(1, "messages must not be empty")
    .max(MAX_MESSAGES, `messages must not exceed ${MAX_MESSAGES}`),
  // Which brain the reader picked. Optional — an unset value means "whichever
  // has budget". An id outside the registry is rejected rather than silently
  // ignored: it can only come from a stale client or a hand-rolled request,
  // and both deserve to be told.
  model: z.enum(BRAIN_IDS).optional(),
  // The current page's route, e.g. "/reference/zoned/...", used to bias
  // retrieval toward that namespace. `namespaceFromPageContext` only ever
  // matches `/reference/<seg>` or `/guides/<seg>`, so it is already inert
  // against anything else — the cap is here so an unbounded string can't be
  // used to inflate a request body that is otherwise carefully budgeted.
  pageContext: z.string().max(MAX_PAGE_CONTEXT_LENGTH).optional(),
});

export type ValidChatRequest = {
  messages: UIMessage[];
  /** The brain the reader explicitly picked, or `undefined` for "no
   * preference". Left undefined rather than defaulted here so the handler can
   * tell an explicit choice from an absent one — `chooseBrain` treats those
   * differently when the preferred brain is out of budget. */
  model?: BrainId;
  pageContext?: string;
};

export type ValidationResult =
  | { ok: true; value: ValidChatRequest }
  | { ok: false; status: number; error: string };

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("");
}

/**
 * Rewrite every text part through the sanitiser.
 *
 * Server-side because the client is not a security boundary: `DoxChat` runs
 * the same function so a reader gets an instant, specific message, but anything
 * at all can POST to `/api/chat`, so what actually reaches the model has to be
 * cleaned here. Returns a new message — never mutates the SDK's parsed object.
 */
function sanitizeMessage(message: UIMessage): UIMessage {
  return {
    ...message,
    parts: message.parts.map((part) =>
      part.type === "text" && "text" in part
        ? { ...part, text: sanitizeUserText(part.text) }
        : part,
    ),
  };
}

export async function validateChatRequest(
  body: unknown,
): Promise<ValidationResult> {
  const envelope = requestEnvelopeSchema.safeParse(body);
  if (!envelope.success) {
    return {
      ok: false,
      status: 400,
      error: envelope.error.issues[0]?.message ?? "invalid request body",
    };
  }

  const { messages: rawMessages, model, pageContext } = envelope.data;

  /* `tools` is what makes tool parts actually validated rather than waved
     through. Without it the SDK accepts any `tool-*` part with arbitrary JSON
     as its `input`; with it, an unknown tool name or an input that fails the
     schema is rejected here, at the edge, as a 400 — which is where DOX-C's
     "the client is untrusted" line puts it. */
  const uiResult = await safeValidateUIMessages<DoxUIMessage>({
    messages: rawMessages,
    // The same set the handler runs, not the execute-less client copy — so
    // what passes validation here is exactly what `streamText` will accept.
    tools: buildWorkerTools(),
  });
  if (!uiResult.success) {
    return { ok: false, status: 400, error: "malformed message shape" };
  }

  // Sanitise BEFORE the limit checks, not after: the caps have to be measured
  // against what actually reaches the model. Checking first would let invisible
  // padding trip the length limit for a reader whose visible text is well
  // inside it — and, worse, would let a payload of tag characters through the
  // checks unexamined.
  const messages = uiResult.data.map(sanitizeMessage);

  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") {
      return {
        ok: false,
        status: 400,
        error: `role "${message.role}" is not allowed from the client`,
      };
    }
    if (messageText(message).length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        status: 400,
        error: `message content exceeds ${MAX_MESSAGE_LENGTH} characters`,
      };
    }
  }

  // A final user turn that is empty *after* sanitising means the request
  // carried nothing but invisible characters — there is no question in it to
  // answer, and forwarding it would spend a model call on a payload rather
  // than a prompt.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser && messageText(lastUser).trim() === "") {
    return {
      ok: false,
      status: 400,
      error: "Message is empty.",
    };
  }

  // Whole-conversation budget. `MAX_MESSAGES` x `MAX_MESSAGE_LENGTH` is 160k
  // characters, every one of which is re-sent and re-billed on each turn — the
  // per-message cap alone bounds a single paste, not a request.
  const totalChars = conversationLength(messages.map(messageText));
  if (totalChars > MAX_CONVERSATION_CHARS) {
    return {
      ok: false,
      status: 400,
      error: `Conversation is too long (${totalChars} characters, limit ${MAX_CONVERSATION_CHARS}). Start a new one.`,
    };
  }

  return {
    ok: true,
    value: { messages, model, pageContext },
  };
}
