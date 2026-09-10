import { convertToModelMessages, streamText, type LanguageModel } from "ai";
import type { ChunkCache, FetchChunksOptions } from "../src/lib/retrieval/fetch-chunks";
import { fetchChunks } from "../src/lib/retrieval/fetch-chunks";
import { searchChunks } from "../src/lib/retrieval/search";
import { getUnixNowMs } from "./clock";
import { mapUpstreamError } from "./error-mapping";
import { namespaceFromPageContext } from "./namespace-from-page";
import { checkRateLimit, clientIdFromRequest } from "./rate-limit";
import { assembleSystemPrompt } from "./system-prompt";
import { validateChatRequest } from "./validation";

export interface ChatHandlerDeps {
  /** Real `google("gemini-2.5-flash")` in production; a fake
   * `LanguageModel` in tests so no network call happens. */
  model: LanguageModel;
  /** `VOCABULARY_CONTENT` / `CORE_RULES_CONTENT` in production (worker/index.ts
   * wires these in). Injected — not imported directly here — so this module
   * never touches the `.md` Text-module imports those come from: Wrangler's
   * bundler resolves them fine, but Vitest runs under Vite, which has no
   * such rule and fails to even parse the file. Verified during this story
   * when `chat-handler.test.ts` failed to load until this was split out. */
  vocabulary: string;
  coreRules: string;
  /** Overridable in tests; defaults to the real `fetchChunks`. */
  fetchChunksImpl?: typeof fetchChunks;
  fetchImpl?: FetchChunksOptions["fetchImpl"];
  cache?: ChunkCache;
  now?: () => number;
}

/**
 * DOX-C2 (#138) — the pipeline from DOX-C.md, in order: method (checked by
 * the caller — see worker/index.ts), rate limit, JSON parse, zod/AI-SDK
 * validation, retrieve, assemble prompt, stream. Every dependency is
 * injected so this is testable with a fake model and no live key, matching
 * `fetch-chunks.ts`'s own "testable with a plain mock" precedent.
 */
export function createChatHandler(deps: ChatHandlerDeps) {
  const {
    model,
    vocabulary,
    coreRules,
    fetchChunksImpl = fetchChunks,
    fetchImpl,
    cache,
    now = getUnixNowMs,
  } = deps;

  return async function handleChat(request: Request): Promise<Response> {
    const clientId = clientIdFromRequest(request);
    const rateLimitResult = checkRateLimit(clientId, now());
    if (!rateLimitResult.allowed) {
      return Response.json(
        { error: "Too many requests. Please slow down.", retryable: true },
        {
          status: 429,
          headers: {
            "retry-after": String(rateLimitResult.retryAfterSeconds ?? 60),
          },
        },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Malformed JSON body.", retryable: false },
        { status: 400 },
      );
    }

    const validation = await validateChatRequest(body);
    if (!validation.ok) {
      return Response.json(
        { error: validation.error, retryable: false },
        { status: validation.status },
      );
    }

    const { messages, pageContext } = validation.value;

    try {
      const origin = new URL(request.url).origin;
      const chunks = await fetchChunksImpl(origin, {
        fetchImpl,
        cache,
      });

      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
      const query = lastUserMessage
        ? lastUserMessage.parts
            .filter((part) => part.type === "text")
            .map((part) => ("text" in part ? part.text : ""))
            .join("")
        : "";

      const retrieved = searchChunks(chunks, query, {
        namespace: namespaceFromPageContext(pageContext),
      });

      const systemPrompt = assembleSystemPrompt({
        routeAllowlist: retrieved.map((c) => c.url),
        chunks: retrieved,
        vocabulary,
        coreRules,
      });

      const result = streamText({
        model,
        instructions: systemPrompt,
        messages: await convertToModelMessages(messages),
      });

      // toUIMessageStreamResponse is deprecated in ai@7 in favor of the
      // standalone toUIMessageStream/createUIMessageStreamResponse helpers,
      // but is still the exact mechanism DOX-C.md's spec names and is not
      // yet removed. Left as-is; migrate if a future `ai` major drops it.
      //
      // The model call itself happens lazily while the stream is consumed,
      // not inside this function's own try/catch (verified live during this
      // story: an invalid model name did not throw here — headers were
      // already sent, and the failure surfaced mid-stream as a generic
      // "An error occurred." data frame instead). `onError` is the actual
      // seam for mapping an upstream failure to a readable message; the
      // try/catch below still matters for failures before any stream opens
      // (e.g. `convertToModelMessages` rejecting on a message that passed
      // validation but still can't convert).
      return result.toUIMessageStreamResponse({
        onError: (error) => {
          console.error("chat stream error", error);
          return mapUpstreamError(error).body.error;
        },
      });
    } catch (error) {
      console.error("chat-handler error", error);
      const mapped = mapUpstreamError(error);
      return Response.json(mapped.body, { status: mapped.status });
    }
  };
}
