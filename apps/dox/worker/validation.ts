import { safeValidateUIMessages } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";
import {
  ALLOWED_MODELS,
  MAX_MESSAGES,
  MAX_MESSAGE_LENGTH,
  type AllowedModel,
} from "../src/lib/chat-constants";

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
  model: z.enum(ALLOWED_MODELS).optional(),
  // The current page's route, e.g. "/reference/zoned/...", used to bias
  // retrieval toward that namespace. Free-form and optional — no client
  // sends it yet (DOX-C3a is what sends real page context).
  pageContext: z.string().optional(),
});

export type ValidChatRequest = {
  messages: UIMessage[];
  model: AllowedModel;
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

  const {
    messages: rawMessages,
    model = ALLOWED_MODELS[0],
    pageContext,
  } = envelope.data;

  const uiResult = await safeValidateUIMessages({ messages: rawMessages });
  if (!uiResult.success) {
    return { ok: false, status: 400, error: "malformed message shape" };
  }

  for (const message of uiResult.data) {
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

  return {
    ok: true,
    value: { messages: uiResult.data, model, pageContext },
  };
}
