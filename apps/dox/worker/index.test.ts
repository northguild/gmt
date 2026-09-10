/// <reference types="vitest/globals" />
/**
 * Routing and configuration branches of the Worker entry point.
 *
 * `worker/index.ts` had no tests at all. Everything it dispatches to —
 * validation, rate limiting, brains, the ledger, the dev bypass — is
 * thoroughly covered, but the dispatcher itself was verified only by reading:
 * the two 405 guards, the missing-key 500, the assets passthrough and the
 * `?key=` interception all had nothing behind them. The last of those is also
 * where this file records a real surprise about the ordering (see below).
 */
import worker from "./index";
import { BRAINS, VISITOR_DAILY_MAX } from "../src/lib/chat-constants";

/** A stand-in for the static-assets binding that reports whether it was hit. */
function assetsBinding() {
  const calls: string[] = [];
  return {
    calls,
    binding: {
      fetch: async (input: RequestInfo | URL) => {
        const href =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        calls.push(href);
        return new Response("asset", { status: 200 });
      },
    },
  };
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return { ASSETS: assetsBinding().binding, ...overrides } as never;
}

function get(path: string, init: RequestInit = {}) {
  return new Request(`https://gmt-dox.example${path}`, {
    headers: { "cf-connecting-ip": "1.2.3.4" },
    ...init,
  });
}

describe("worker entry — /api/brains", () => {
  it("answers GET with the full brain registry and the visitor's budget", async () => {
    const response = await worker.fetch(get("/api/brains"), makeEnv());
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      brains: { id: string }[];
      visitor: { limit: number; remaining: number; unlimited: boolean };
      resetsAt: string;
    };
    expect(body.brains.map((b) => b.id)).toEqual(BRAINS.map((b) => b.id));
    expect(body.visitor.limit).toBe(VISITOR_DAILY_MAX);
    // No DOX_DEV_KEY in this env, so the bypass cannot engage.
    expect(body.visitor.unlimited).toBe(false);
    expect(Number.isNaN(Date.parse(body.resetsAt))).toBe(false);
  });

  it("rejects a non-GET with 405 rather than falling through to the assets binding", async () => {
    const assets = assetsBinding();
    const response = await worker.fetch(
      get("/api/brains", { method: "POST" }),
      makeEnv({ ASSETS: assets.binding }),
    );
    expect(response.status).toBe(405);
    expect(assets.calls).toHaveLength(0);
  });

  it("never lets a shared cache hold one visitor's counts", async () => {
    // The body carries visitor.used / .remaining / .unlimited, all keyed on a
    // hashed IP and a dev cookie. `public` would entitle any CDN in front of
    // this to serve one reader's numbers — a dev's `unlimited: true` included
    // — to the next reader through it.
    const response = await worker.fetch(get("/api/brains"), makeEnv());
    const cacheControl = response.headers.get("cache-control") ?? "";
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("public");
  });

  it("still answers when the KV namespace is not bound", async () => {
    // DOX_USAGE is optional so the Worker boots before the namespace exists.
    const response = await worker.fetch(get("/api/brains"), makeEnv());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { visitor: { used: number } };
    expect(body.visitor.used).toBe(0);
  });
});

describe("worker entry — /api/chat", () => {
  it("rejects a non-POST with 405", async () => {
    const response = await worker.fetch(
      get("/api/chat"),
      makeEnv({ NORTHGUILD_GMT_GEMINI_API_KEY: "test-key" }),
    );
    expect(response.status).toBe(405);
  });

  it("returns 500 without leaking anything when the API key is unset", async () => {
    const response = await worker.fetch(
      get("/api/chat", { method: "POST", body: "{}" }),
      makeEnv(),
    );
    expect(response.status).toBe(500);

    const body = (await response.json()) as {
      error: string;
      retryable: boolean;
    };
    expect(body.retryable).toBe(false);
    // A misconfigured deploy must not describe its own configuration.
    expect(body.error).not.toMatch(/key|GEMINI|env/i);
  });
});

describe("worker entry — everything else", () => {
  it("hands an ordinary page request to the assets binding untouched", async () => {
    const assets = assetsBinding();
    const response = await worker.fetch(
      get("/reference/zoned/convert/convertZonedToZoned"),
      makeEnv({ ASSETS: assets.binding }),
    );
    expect(response.status).toBe(200);
    expect(assets.calls).toHaveLength(1);
    expect(assets.calls[0]).toContain(
      "/reference/zoned/convert/convertZonedToZoned",
    );
  });

  it("redirects a ?key= request to a clean URL instead of echoing the secret", async () => {
    const response = await worker.fetch(
      get("/dox?key=wrong-secret"),
      makeEnv({ DOX_DEV_KEY: "right-secret" }),
    );
    // Wrong secret still redirects — an attacker learns nothing from the
    // status, and the secret is stripped from the URL either way.
    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).not.toContain("key=");
    expect(location).not.toContain("wrong-secret");
  });

  it("sets a dev cookie only for the correct secret", async () => {
    const right = await worker.fetch(
      get("/dox?key=right-secret"),
      makeEnv({ DOX_DEV_KEY: "right-secret" }),
    );
    expect(right.headers.get("set-cookie")).toBeTruthy();

    const wrong = await worker.fetch(
      get("/dox?key=wrong-secret"),
      makeEnv({ DOX_DEV_KEY: "right-secret" }),
    );
    expect(wrong.headers.get("set-cookie")).toBeNull();
  });

  /* Recorded rather than asserted-as-desirable: the `?key=` check sits above
     the router, so it claims *any* path carrying that param — an asset, a
     reference page, or `/api/chat` itself. A client that appended `?key=` to
     its POST would get a 303 instead of an answer. Nothing does that today,
     and stripping the secret from every URL is the safer default, but the
     reach is wider than the "on any page" in its docstring suggests. */
  it("claims ?key= ahead of the router, including on /api/chat", async () => {
    const assets = assetsBinding();
    const response = await worker.fetch(
      get("/api/chat?key=right-secret", { method: "POST", body: "{}" }),
      makeEnv({ DOX_DEV_KEY: "right-secret", ASSETS: assets.binding }),
    );
    expect(response.status).toBe(303);
    expect(assets.calls).toHaveLength(0);
  });
});
