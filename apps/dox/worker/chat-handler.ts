import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type LanguageModel,
} from "ai";
import type {
  ChunkCache,
  FetchChunksOptions,
} from "../src/lib/retrieval/fetch-chunks";
import { fetchChunks } from "../src/lib/retrieval/fetch-chunks";
import { searchChunks } from "../src/lib/retrieval/search";
import { RETRIEVAL_PART_TYPE } from "../src/lib/chat-types";
import { getUnixNowMs } from "./clock";
import { mapUpstreamError } from "./error-mapping";
import { namespaceFromPageContext } from "./namespace-from-page";
import { checkRateLimit, clientIdFromRequest } from "./rate-limit";
import { ENABLED_TOOL_DOCS } from "../src/lib/dox-tools";
import { assembleSystemPrompt } from "./system-prompt";
import { buildWorkerTools } from "./tools";
import { validateChatRequest } from "./validation";
import { chooseBrain, openFirstWorkingBrain, orderCandidates } from "./brains";
import {
  hashVisitor,
  markBrain,
  readUsage,
  recordRequest,
  type UsageSnapshot,
  type UsageStore,
} from "./usage";
import { BRAINS, VISITOR_DAILY_MAX } from "../src/lib/chat-constants";
import { nextPtMidnightMs } from "../src/lib/pt-day";

export interface ChatHandlerDeps {
  /** Builds a model for a brain id. A factory rather than a single value
   * because the free tier's allowance is per model, so Dox keeps several and
   * moves between them — see `brains.ts`. Tests pass `() => fakeModel(...)`,
   * and can make one brain throw to cover failover. */
  resolveModel: (brainId: string) => LanguageModel;
  /** The KV usage ledger. Optional: when absent (every unit test) the ledger is
   * simply skipped and the first brain is used, so no test needs a KV stub to
   * exercise unrelated behaviour. */
  usage?: UsageStore;
  /** Whether this request carries a valid dev cookie. Devs are exempt from the
   * per-visitor daily cap — not from the shared pool, which nothing can raise
   * on the free tier. */
  isDev?: (request: Request) => Promise<boolean>;
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
  /** Overridable in tests; defaults to the real `searchChunks`. Injectable
   * because BM25 relevance is a property of the *whole* corpus: DOX-C1's
   * `MIN_RELEVANCE_SCORE` was tuned against all 755 chunks, and against a
   * handful of fixture chunks IDF collapses so nothing clears the threshold.
   * Tests that care about the trace or the prompt shouldn't have to smuggle
   * in a realistic corpus to get there. */
  searchChunksImpl?: typeof searchChunks;
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
    resolveModel,
    usage,
    isDev,
    vocabulary,
    coreRules,
    fetchChunksImpl = fetchChunks,
    searchChunksImpl = searchChunks,
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

    const { messages, pageContext, model: requestedBrainId } = validation.value;

    // ---- Daily budget, brain selection -------------------------------------
    // The in-memory limiter above is BURST protection (per isolate, 20/60s).
    // This is the daily one, and it is the reason Dox can exist on a free tier
    // at all: the allowance is per model, so several brains are kept and the
    // ledger says which still has room.
    const nowMs = now();
    const visitorHash = await hashVisitor(clientId);
    const dev = (await isDev?.(request)) ?? false;

    let snapshot: UsageSnapshot = {
      perBrain: {},
      states: {},
      visitor: 0,
    };
    if (usage) {
      snapshot = await readUsage(
        usage,
        BRAINS.map((brain) => brain.id),
        visitorHash,
        nowMs,
      );
    }

    // A dev is exempt from the per-visitor cap only. Nothing here can grant
    // more of the shared pool — on the free tier that ceiling is fixed.
    if (!dev && snapshot.visitor >= VISITOR_DAILY_MAX) {
      return Response.json(
        {
          error: `You have used your ${VISITOR_DAILY_MAX} questions for today. Dox resets at midnight Pacific.`,
          retryable: false,
          resetsAt: new Date(nextPtMidnightMs(nowMs)).toISOString(),
        },
        { status: 429 },
      );
    }

    const candidateBrains = orderCandidates(snapshot, requestedBrainId);
    const choice = chooseBrain(snapshot, requestedBrainId);
    if (!choice.brain) {
      // Every brain is out. This is a sentinel state, not a fault: say what
      // happened and when it comes back, rather than "something went wrong".
      return Response.json(
        {
          error:
            "Dox has used its free allowance for today. It resets at midnight Pacific.",
          retryable: false,
          resetsAt: new Date(nextPtMidnightMs(nowMs)).toISOString(),
        },
        { status: 429 },
      );
    }

    try {
      const origin = new URL(request.url).origin;
      const chunks = await fetchChunksImpl(origin, {
        fetchImpl,
        cache,
      });

      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      const query = lastUserMessage
        ? lastUserMessage.parts
            .filter((part) => part.type === "text")
            .map((part) => ("text" in part ? part.text : ""))
            .join("")
        : "";

      const retrieved = searchChunksImpl(chunks, query, {
        namespace: namespaceFromPageContext(pageContext),
      });

      /* Built per request. `streamText`, `convertToModelMessages` and
         `toUIMessageStream` must all be handed the *same* set, or a tool part
         is typed in one layer and opaque in the next. */
      const tools = buildWorkerTools();

      const systemPrompt = assembleSystemPrompt({
        routeAllowlist: retrieved.map((c) => c.url),
        chunks: retrieved,
        vocabulary,
        coreRules,
        tools: ENABLED_TOOL_DOCS,
      });

      /* `ignoreIncompleteToolCalls` drops a tool part that never reached a
         terminal state, which is what a reader who hits Stop between the
         tool-call chunk and the tool-result chunk leaves in the transcript.
         Without it that turn is replayed as a `functionCall` with no matching
         `functionResponse` — history the provider rejects, one question later.
         Pinned in `tools.test.ts`. */
      const modelMessages = await convertToModelMessages(messages, {
        tools,
        ignoreIncompleteToolCalls: true,
      });

      // DOX-C3a (#139): the retrieval trace rides the same stream as the
      // answer. `createUIMessageStream` + `writer.merge(toUIMessageStream(...))`
      // rather than `streamText(...).toUIMessageStreamResponse()` — that
      // shorthand can only carry the model's own output, with no seam to
      // write a custom data part first.
      //
      // The model call happens lazily while the stream is consumed, not
      // inside this function's try/catch (verified live during DOX-C2: an
      // invalid model name did not throw here — headers were already sent and
      // the failure surfaced mid-stream as a generic "An error occurred."
      // frame). `onError` below is the seam that maps an upstream failure to
      // readable text; the outer try/catch still matters for failures before
      // any stream opens (e.g. `convertToModelMessages` rejecting).
      // Both stream layers need this. `toUIMessageStream` has its own
      // `onError` defaulting to the SDK's generic "An error occurred." mask,
      // and it runs *first* — so leaving it unset swallows the real error
      // before `createUIMessageStream`'s handler can map it. Caught by
      // chat-handler.test.ts when only the outer one was wired.
      // Reached only if the answer dies *part-way through*, after the model
      // has already begun producing output. A start-up failure never gets here
      // — `openFirstWorkingBrain` catches those and moves to the next brain.
      const onStreamError = (error: unknown): string => {
        console.error("chat stream error", error);
        return mapUpstreamError(error).body.error;
      };

      // ---- Failover, inside this one request ---------------------------
      //
      // Awaiting `result.warnings` forces the upstream call and surfaces a 429
      // or a 404 *before* any UI stream is opened — which is what makes it
      // possible to quietly try the next brain instead of showing an error.
      //
      // The first design deferred this, reasoning that a pre-flight ledger
      // check made an in-request failure "a rare race". That was wrong, and the
      // user hit it immediately. It is the normal path: every brain, every day,
      // reaches its limit on some unlucky request, and without this that
      // request fails visibly. Worse, with no ledger there is no memory at all,
      // so EVERY request picks the same exhausted brain and fails — which is
      // exactly what "Automatic isn't switching" turned out to be.
      //
      // The ledger is now an optimisation (skip brains already known to be out,
      // and drive the badge), not the mechanism.
      const attempt = await openFirstWorkingBrain({
        candidates: candidateBrains,
        resolveModel,
        instructions: systemPrompt,
        messages: modelMessages,
        tools,
        onBrainOut: (brainId, state) => {
          if (usage) void markBrain(usage, brainId, state, nowMs);
        },
      });

      if (!attempt) {
        return Response.json(
          {
            error:
              "Dox has used its free allowance for today. It resets at midnight Pacific.",
            retryable: false,
            resetsAt: new Date(nextPtMidnightMs(nowMs)).toISOString(),
          },
          { status: 429 },
        );
      }

      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({
            type: RETRIEVAL_PART_TYPE,
            data: {
              totalChunks: chunks.length,
              retrievedCount: retrieved.length,
              chunkTitles: retrieved.map((chunk) => chunk.title),
              chunkUrls: retrieved.map((chunk) => chunk.url),
              // The brain that actually answered — after a failover this is not
              // the one selection first proposed.
              brainId: attempt.brain.id,
              brainLabel: attempt.brain.label,
            },
          });

          writer.merge(
            toUIMessageStream({
              stream: attempt.result.stream,
              // Typed tool parts rather than opaque ones — this is what lets a
              // `tool-showGlobe` part reach the client with a parsed `input`.
              tools,
              onError: onStreamError,
            }),
          );
        },
        onError: onStreamError,
      });

      // Recorded now rather than on success, because the request has been sent
      // to Google by the time the stream is consumed and it counts against the
      // quota whether or not the reader ever reads the answer. Best-effort: a
      // ledger failure must never fail a chat.
      if (usage) {
        void recordRequest(usage, attempt.brain.id, visitorHash, nowMs);
      }

      return createUIMessageStreamResponse({ stream });
    } catch (error) {
      console.error("chat-handler error", error);
      const mapped = mapUpstreamError(error);
      return Response.json(mapped.body, { status: mapped.status });
    }
  };
}
