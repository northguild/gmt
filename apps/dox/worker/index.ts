import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ALLOWED_MODELS } from "../src/lib/chat-constants";
import { createChatHandler } from "./chat-handler";
import { CORE_RULES_CONTENT } from "./core-rules";
import { VOCABULARY_CONTENT } from "./vocabulary";

/** Hand-declared rather than pulling in `@cloudflare/workers-types` — this
 * Worker only ever touches two bindings, and the spike in this story found
 * no friction without the full types package. */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
  NORTHGUILD_GMT_GEMINI_API_KEY?: string;
}

declare const caches: { default: Cache };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/api/chat") {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed.", retryable: false },
        { status: 405 },
      );
    }

    if (!env.NORTHGUILD_GMT_GEMINI_API_KEY) {
      // Never reachable in production once `wrangler secret put` has been
      // run once (DOX-C2 step 13/14) — this is the "missing API key → 500"
      // branch from DOX-C.md's validation pipeline, not a runtime fault.
      return Response.json(
        { error: "The assistant is not configured.", retryable: false },
        { status: 500 },
      );
    }

    const google = createGoogleGenerativeAI({
      apiKey: env.NORTHGUILD_GMT_GEMINI_API_KEY,
    });

    const handleChat = createChatHandler({
      model: google(ALLOWED_MODELS[0]),
      vocabulary: VOCABULARY_CONTENT,
      coreRules: CORE_RULES_CONTENT,
      fetchImpl: (input, init) => env.ASSETS.fetch(input, init),
      cache: caches.default,
    });

    return handleChat(request);
  },
};
