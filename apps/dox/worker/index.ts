import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createWorkersAI } from "workers-ai-provider";
import { BRAINS, findBrain, type Brain } from "../src/lib/chat-constants";
import {
  SITE_BASE,
  SITE_ORIGIN,
  SITE_URL,
  isUnderBase,
  stripBase,
} from "../src/lib/site";
import { brainsPayload } from "./brains-payload";
import { getUnixNowMs } from "./clock";
import { handleCanadaClockChange } from "./canada-clock-change";
import { handleMoroccoClockChange } from "./morocco-clock-change";
import { createChatHandler } from "./chat-handler";
import { CORE_RULES_CONTENT } from "./core-rules";
import {
  devCookieHeader,
  isDevRequest,
  signDevToken,
  timingSafeEqual,
} from "./dev-access";
import { clientIdFromRequest } from "./rate-limit";
import { hashVisitor, readUsage, type UsageStore } from "./usage";
import { VOCABULARY_SKILLS } from "./vocabulary";
import { workersAISettings } from "./workers-ai-settings";

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
  /** Dev only — `scripts/dev-all.mjs` sets it to the running `astro dev` server. The
   * retrieval corpus is then read from that server instead of the built `dist/`, so the
   * local chat needs no site build and answers from content edits as they are saved.
   * Unset in production, where the assets binding serves the built corpus. */
  DOX_ASSETS_ORIGIN?: string;
}

declare const caches: { default: Cache };

/**
 * The brains this deployment can reach: Gemini ones need the key, Workers AI
 * ones need the binding. Filtering here, rather than letting an unconfigured
 * brain fail at call time, matters because that failure would not look like a
 * spent brain — `brainStateFromError` would rethrow it and end the request
 * instead of failing over.
 */
/**
 * How the chat handler fetches the retrieval corpus: through the assets binding, or — when
 * `DOX_ASSETS_ORIGIN` is set in dev — the same path and query from that origin.
 */
export function corpusFetcher(
  env: Env,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const origin = env.DOX_ASSETS_ORIGIN;
  if (!origin) return (input, init) => env.ASSETS.fetch(input, init);
  return (input, init) => {
    const requested = new URL(input instanceof Request ? input.url : input);
    return fetch(new URL(requested.pathname + requested.search, origin), init);
  };
}

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
 * **Use `/gmt/api/brains?key=<secret>`.** A page URL (`/gmt/`, a trailing
 * slash) or a file (a dot after `/gmt/`) is served as an asset before the
 * Worker runs (`run_worker_first` in `wrangler.jsonc`), so `?key=` on a page
 * never gets here.
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
    const token = await signDevToken(env.DOX_DEV_KEY, getUnixNowMs());
    headers.append(
      "set-cookie",
      devCookieHeader(token, url.protocol === "https:"),
    );
  }

  return new Response(null, { status: 303, headers });
}

/** `GET /api/brains` — what the badge and the selector need before any chat. */
async function handleBrains(request: Request, env: Env): Promise<Response> {
  const nowMs = getUnixNowMs();
  const dev = await isDevRequest(request, env.DOX_DEV_KEY, nowMs);
  const visitorHash = await hashVisitor(clientIdFromRequest(request));
  const brains = configuredBrains(env);

  const snapshot = env.DOX_USAGE
    ? await readUsage(env.DOX_USAGE, brains, visitorHash, nowMs)
    : { perBrain: {}, states: {}, visitor: 0 };

  return Response.json(
    brainsPayload({ brains, snapshot, nowMs, dev }),
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
           all would hand back stale counts to the re-read DoxChat makes after
           a refused question.

           The load this gives up is negligible and worth stating so nobody
           re-adds the header: this endpoint is fetched once per chat mount
           plus once per refused question, so a visitor costs single-digit KV
           reads per day. */
        "cache-control": "private, no-store",
      },
    },
  );
}

/**
 * The API routes, by base-less path. `undefined` for any other path, so the
 * caller decides what happens next.
 */
async function routeApi(
  path: string,
  request: Request,
  env: Env,
): Promise<Response | undefined> {
  if (path === "/api/brains") {
    if (request.method !== "GET") {
      return Response.json(
        { error: "Method not allowed.", retryable: false },
        { status: 405 },
      );
    }
    return handleBrains(request, env);
  }

  // Any method: the handler answers 405 itself (POST joins GET with the stored-times check).
  if (path === "/api/canada-clock-change") {
    return handleCanadaClockChange(request, env);
  }
  if (path === "/api/morocco-clock-change") {
    return handleMoroccoClockChange(request, env);
  }

  if (path !== "/api/chat") return undefined;

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
        return workersAI(model, workersAISettings(brain));
      }
      if (brain?.provider === "google" && google) return google(model);
      // Unreachable while `brains` is `configuredBrains(env)`: the handler
      // only ever resolves a brain from that list.
      throw new Error(`brain ${brainId} has no configured provider`);
    },
    brains,
    usage: env.DOX_USAGE,
    isDev: (req) => isDevRequest(req, env.DOX_DEV_KEY, getUnixNowMs()),
    vocabulary: VOCABULARY_SKILLS,
    coreRules: CORE_RULES_CONTENT,
    fetchImpl: corpusFetcher(env),
    cache: caches.default,
  });

  return handleChat(request);
}

function redirect(location: string): Response {
  return new Response(null, { status: 301, headers: { location } });
}

/*
 * Branches are by path, never by hostname, so `wrangler dev` runs the code
 * production runs.
 *
 *  1. Not under the base: a legacy `workers.dev` path, or `northguild.dev/gmtx`.
 *     The two API routes are served in place — a 301 turns a `fetch` POST into
 *     a GET, and the hop to another origin has no CORS, so a tab opened before
 *     the move would lose its chat. Everything else is a 301 into the base.
 *     A `key` is dropped from the query, never carried to a page URL.
 *  2. The dev key, anywhere under the base (`/gmt` included).
 *  3. Exactly `/gmt`: a 301 to `/gmt/`.
 *  4. Under the base: the API, then the assets binding.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!isUnderBase(url.pathname)) {
      const api = await routeApi(url.pathname, request, env);
      if (api) return api;
      if (url.pathname === "/robots.txt") {
        return redirect(`${SITE_ORIGIN}/robots.txt`);
      }
      // A dev key is never carried to the new host: it would land on a page
      // URL, which assets serve, so the key would stay in the address bar.
      // The query is filtered as raw text so every other byte is kept as sent.
      const kept = url.search
        .slice(1)
        .split("&")
        .filter((pair) => pair !== "" && !/^key(?:=|$)/.test(pair));
      const search = kept.length > 0 ? `?${kept.join("&")}` : "";
      return redirect(`${SITE_URL}${url.pathname}${search}`);
    }

    // Ahead of the `/gmt` branch: `/gmt?key=` would otherwise be a 301 to the
    // page `/gmt/?key=`, which assets serve with the key still in the URL.
    if (url.searchParams.has("key")) {
      return handleDevKey(url, env);
    }

    if (url.pathname === SITE_BASE) {
      return redirect(`${SITE_URL}/${url.search}`);
    }

    const api = await routeApi(stripBase(url.pathname), request, env);
    if (api) return api;

    // Only a page path without its slash, or a missing extension-less path,
    // gets here. Assets mirror the full path (`dist/gmt/…`), `html_handling`
    // adds the slash and `404-page` finds `dist/gmt/404.html`. The request
    // is passed on unmodified.
    return env.ASSETS.fetch(request);
  },
};
