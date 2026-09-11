import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createWorkersAI } from "workers-ai-provider";
import {
  BRAINS,
  VISITOR_DAILY_MAX,
  findBrain,
  type Brain,
} from "../src/lib/chat-constants";
import { nextPtMidnightMs } from "../src/lib/pt-day";
import { chooseBrain, remainingFor } from "./brains";
import { createChatHandler } from "./chat-handler";
import { CORE_RULES_CONTENT } from "./core-rules";
import {
  devCookieHeader,
  isDevRequest,
  signDevToken,
  timingSafeEqual,
} from "./dev-access";
import { clientIdFromRequest } from "./rate-limit";
import {
  hashVisitor,
  providerResets,
  readUsage,
  type UsageStore,
} from "./usage";
import { VOCABULARY_CONTENT } from "./vocabulary";

/** Hand-declared rather than pulling in `@cloudflare/workers-types` — this
 * Worker only ever touches a few binding methods, and the spike in this story
 * found no friction without the full types package. */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

/** The Workers AI binding, hand-declared for the same reason as `Fetcher`.
 * `workers-ai-provider` types it as `@cloudflare/workers-types`' `Ai`, which
 * this app does not install; only `run` is ever called, and by the provider. */
interface WorkersAIBinding {
  run(model: string, inputs: unknown, options?: unknown): Promise<unknown>;
}

interface Env {
  ASSETS: Fetcher;
  NORTHGUILD_GMT_GEMINI_API_KEY?: string;
  /** Workers AI (DOX-C4). Optional: without it the `workers-ai` brains are
   * simply not offered, and Dox runs on Gemini alone. */
  AI?: WorkersAIBinding;
  /** Shared secret for the dev bypass. Absent locally until someone sets it in
   * `.dev.vars`; the bypass simply never engages without it. */
  DOX_DEV_KEY?: string;
  /** The usage ledger. Optional so the Worker still runs before the namespace
   * exists — without it Dox always uses the first brain and reports no counts,
   * which degrades gracefully instead of failing to boot. */
  DOX_USAGE?: UsageStore;
}

declare const caches: { default: Cache };

/**
 * The brains this deployment can reach: Gemini ones need the key, Workers AI
 * ones need the binding. Filtering here, rather than letting an unconfigured
 * brain fail at call time, matters because that failure would not look like a
 * spent brain — `brainStateFromError` would rethrow it and end the request
 * instead of failing over.
 */
function configuredBrains(env: Env): Brain[] {
  return BRAINS.filter((brain: Brain) =>
    brain.provider === "workers-ai"
      ? Boolean(env.AI)
      : Boolean(env.NORTHGUILD_GMT_GEMINI_API_KEY),
  );
}

/**
 * `?key=` on a request that reaches the Worker hands it a candidate dev secret.
 * Verified here, exchanged for a signed HttpOnly cookie, then redirected to a
 * clean URL so the secret never lingers in history, a bookmark, or a referrer.
 *
 * **Use `/api/brains?key=<secret>`.** A URL that matches a static asset —
 * `/dox/`, or any page — is served before the Worker runs (`wrangler.jsonc`
 * has no `run_worker_first`), so `?key=` on a page never gets here.
 */
async function handleDevKey(url: URL, env: Env): Promise<Response> {
  const candidate = url.searchParams.get("key") ?? "";
  const clean = new URL(url);
  clean.searchParams.delete("key");

  const headers = new Headers({ location: clean.toString() });

  // Constant-time, via `timingSafeEqual`: this path runs before the chat
  // handler's burst limiter, so guessing here is not rate limited.
  //
  // What this endpoint must never do is *leak* — hence the redirect that
  // strips the key and the HttpOnly cookie that keeps it out of the page.
  if (env.DOX_DEV_KEY && (await timingSafeEqual(candidate, env.DOX_DEV_KEY))) {
    const token = await signDevToken(env.DOX_DEV_KEY, Date.now());
    headers.append(
      "set-cookie",
      devCookieHeader(token, url.protocol === "https:"),
    );
  }

  return new Response(null, { status: 303, headers });
}

/** `GET /api/brains` — what the badge and the selector need before any chat. */
async function handleBrains(request: Request, env: Env): Promise<Response> {
  const nowMs = Date.now();
  const dev = await isDevRequest(request, env.DOX_DEV_KEY, nowMs);
  const visitorHash = await hashVisitor(clientIdFromRequest(request));
  const brains = configuredBrains(env);

  const snapshot = env.DOX_USAGE
    ? await readUsage(env.DOX_USAGE, brains, visitorHash, nowMs)
    : { perBrain: {}, states: {}, visitor: 0 };

  const active = chooseBrain(snapshot, undefined, brains).brain;

  return Response.json(
    {
      brains: brains.map((brain: Brain) => ({
        id: brain.id,
        label: brain.label,
        provider: brain.provider,
        remaining: remainingFor(brain, snapshot),
        limit: brain.dailyLimit,
        state: snapshot.states[brain.id] ?? "ok",
      })),
      /* One entry per configured provider, each with its own next midnight —
         Pacific for Gemini, UTC for Workers AI (DOX-C4). There is no single
         pool-wide reset any more, so the old top-level `resetsAt` is gone;
         the chat decides which of these (or the visitor's) to show. */
      providers: providerResets(brains, nowMs),
      activeBrainId: active?.id ?? null,
      visitor: {
        used: snapshot.visitor,
        limit: VISITOR_DAILY_MAX,
        remaining: dev
          ? null
          : Math.max(0, VISITOR_DAILY_MAX - snapshot.visitor),
        // A dev is exempt from the per-visitor cap. NOT from the shared pool —
        // nothing on the free tier can raise that, and the UI says so.
        unlimited: dev,
        // The visitor cap is Dox's own and always on the Pacific day.
        resetsAt: new Date(nextPtMidnightMs(nowMs)).toISOString(),
      },
    },
    {
      headers: {
        /* `private`, never `public`: this body carries `visitor.used`,
           `visitor.remaining` and `visitor.unlimited`, all keyed on one
           visitor's hashed IP and dev cookie. Under `public` any shared or CDN
           cache is entitled to hand one reader's counts — including a dev's
           `unlimited: true` — to the next reader through it.

           `no-store` rather than a short `max-age` because the original
           "keep ledger reads flat" rationale does not survive that change:
           it was an argument for an *edge* cache absorbing shared traffic,
           and `private` is precisely the instruction not to have one. What
           is left to cache is one visitor's own browser, and any window at
           all swallows DoxChat's post-send refresh 1.5s later — leaving the
           badge motionless after the reader's own question, which is what
           DOX-C3a's "they move with real requests" line rules out.

           The load this gives up is negligible and worth stating so nobody
           re-adds the header: this endpoint is fetched once per chat mount
           plus once per send, against a per-visitor cap of VISITOR_DAILY_MAX,
           so a visitor costs single-digit KV reads per day. */
        "cache-control": "private, no-store",
      },
    },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.searchParams.has("key")) {
      return handleDevKey(url, env);
    }

    if (url.pathname === "/api/brains") {
      if (request.method !== "GET") {
        return Response.json(
          { error: "Method not allowed.", retryable: false },
          { status: 405 },
        );
      }
      return handleBrains(request, env);
    }

    if (url.pathname !== "/api/chat") {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed.", retryable: false },
        { status: 405 },
      );
    }

    const brains = configuredBrains(env);
    if (brains.length === 0) {
      // Neither a Gemini key nor the Workers AI binding: a misconfigured
      // deploy, not a runtime fault.
      return Response.json(
        { error: "The assistant is not configured.", retryable: false },
        { status: 500 },
      );
    }

    const google = env.NORTHGUILD_GMT_GEMINI_API_KEY
      ? createGoogleGenerativeAI({ apiKey: env.NORTHGUILD_GMT_GEMINI_API_KEY })
      : undefined;
    const workersAI = env.AI
      ? createWorkersAI({ binding: env.AI as never })
      : undefined;

    const handleChat = createChatHandler({
      // A factory, not a model: the handler picks a brain from the ledger and
      // resolves it here, which is what lets Dox move between models as their
      // separate daily budgets run out.
      resolveModel: (brainId) => {
        const brain = findBrain(brainId);
        const model = brain?.model ?? brainId;
        if (brain?.provider === "workers-ai" && workersAI) {
          return workersAI(
            model,
            // `!== undefined`, not truthiness: `null` is a real setting
            // ("thinking off"), distinct from leaving the model's default.
            brain.reasoningEffort !== undefined
              ? { reasoning_effort: brain.reasoningEffort }
              : {},
          );
        }
        if (brain?.provider === "google" && google) return google(model);
        // Unreachable while `brains` is `configuredBrains(env)`: the handler
        // only ever resolves a brain from that list.
        throw new Error(`brain ${brainId} has no configured provider`);
      },
      brains,
      usage: env.DOX_USAGE,
      isDev: (req) => isDevRequest(req, env.DOX_DEV_KEY, Date.now()),
      vocabulary: VOCABULARY_CONTENT,
      coreRules: CORE_RULES_CONTENT,
      fetchImpl: (input, init) => env.ASSETS.fetch(input, init),
      cache: caches.default,
    });

    return handleChat(request);
  },
};
