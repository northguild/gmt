import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  BRAINS,
  VISITOR_DAILY_MAX,
  type Brain,
} from "../src/lib/chat-constants";
import { nextPtMidnightMs } from "../src/lib/pt-day";
import { chooseBrain, remainingFor } from "./brains";
import { createChatHandler } from "./chat-handler";
import { CORE_RULES_CONTENT } from "./core-rules";
import { devCookieHeader, isDevRequest, signDevToken } from "./dev-access";
import { clientIdFromRequest } from "./rate-limit";
import { hashVisitor, readUsage, type UsageStore } from "./usage";
import { VOCABULARY_CONTENT } from "./vocabulary";

/** Hand-declared rather than pulling in `@cloudflare/workers-types` — this
 * Worker only ever touches a few binding methods, and the spike in this story
 * found no friction without the full types package. */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
  NORTHGUILD_GMT_GEMINI_API_KEY?: string;
  /** Shared secret for the dev bypass. Absent locally until someone sets it in
   * `.dev.vars`; the bypass simply never engages without it. */
  DOX_DEV_KEY?: string;
  /** The usage ledger. Optional so the Worker still runs before the namespace
   * exists — without it Dox always uses the first brain and reports no counts,
   * which degrades gracefully instead of failing to boot. */
  DOX_USAGE?: UsageStore;
}

declare const caches: { default: Cache };

const BRAIN_IDS = BRAINS.map((brain) => brain.id);

/** `?key=` on any page hands the Worker a candidate dev secret. Verified here,
 * exchanged for a signed HttpOnly cookie, then redirected to a clean URL so the
 * secret never lingers in history, a bookmark, or a referrer header. */
async function handleDevKey(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  const candidate = url.searchParams.get("key") ?? "";
  const clean = new URL(url);
  clean.searchParams.delete("key");

  const headers = new Headers({ location: clean.toString() });

  // A plain comparison, not a constant-time one. That is a deliberate call,
  // not an oversight: the burst limiter already caps attempts, the secret is
  // high-entropy rather than guessable character-by-character, and a timing
  // oracle over a network is not a practical way to recover it. What this
  // endpoint must never do is *leak* — hence the redirect that strips the key
  // and the HttpOnly cookie that keeps it out of the page.
  if (env.DOX_DEV_KEY && candidate === env.DOX_DEV_KEY) {
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

  const snapshot = env.DOX_USAGE
    ? await readUsage(env.DOX_USAGE, BRAIN_IDS, visitorHash, nowMs)
    : { perBrain: {}, states: {}, visitor: 0 };

  const active = chooseBrain(snapshot).brain;

  return Response.json(
    {
      brains: BRAINS.map((brain: Brain) => ({
        id: brain.id,
        label: brain.label,
        remaining: remainingFor(brain, snapshot),
        limit: brain.dailyLimit,
        state: snapshot.states[brain.id] ?? "ok",
      })),
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
      },
      resetsAt: new Date(nextPtMidnightMs(nowMs)).toISOString(),
    },
    {
      headers: {
        // Short edge cache keeps ledger reads flat as /dox traffic grows, at
        // the cost of a badge that can be up to a minute stale. The number is
        // advisory anyway — see usage.ts.
        "cache-control": "public, max-age=15",
      },
    },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.searchParams.has("key")) {
      return handleDevKey(request, url, env);
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
      // A factory, not a model: the handler picks a brain from the ledger and
      // resolves it here, which is what lets Dox move between models as their
      // separate daily budgets run out.
      resolveModel: (brainId) => google(brainId),
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
