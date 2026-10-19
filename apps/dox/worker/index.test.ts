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
import worker, { corpusFetcher } from "./index";
import { BRAINS, VISITOR_DAILY_MAX } from "../src/lib/chat-constants";
import { isValidUtc } from "@northguild/gmt";

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

/** A Workers AI binding for routing tests, which never reach a model call. */
const fakeAI = {
  run: async () => {
    throw new Error("routing tests never call the model");
  },
};

const idsFor = (provider: string) =>
  BRAINS.filter((brain) => brain.provider === provider).map((b) => b.id);

function get(path: string, init: RequestInit = {}) {
  return new Request(`https://gmt-dox.example${path}`, {
    headers: { "cf-connecting-ip": "1.2.3.4" },
    ...init,
  });
}

describe("worker entry — /api/brains", () => {
  it("answers GET with the full brain registry and the visitor's budget", async () => {
    const response = await worker.fetch(
      get("/api/brains"),
      makeEnv({ NORTHGUILD_GMT_GEMINI_API_KEY: "test-key", AI: fakeAI }),
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      brains: { id: string; provider: string }[];
      providers: { id: string; label: string; resetsAt: string }[];
      visitor: {
        limit: number;
        remaining: number;
        unlimited: boolean;
        resetsAt: string;
      };
    };
    expect(body.brains.map((b) => b.id)).toEqual(BRAINS.map((b) => b.id));
    expect(body.brains.map((b) => b.provider)).toEqual(
      BRAINS.map((b) => b.provider),
    );
    expect(body.visitor.limit).toBe(VISITOR_DAILY_MAX);
    // No DOX_DEV_KEY in this env, so the bypass cannot engage.
    expect(body.visitor.unlimited).toBe(false);
    expect(isValidUtc(body.visitor.resetsAt)).toBe(true);
    // DOX-C4: each provider refills on its own clock, so each carries its own
    // reset instant.
    expect(body.providers.map((p) => p.id)).toEqual(["google", "workers-ai"]);
    for (const provider of body.providers) {
      expect(isValidUtc(provider.resetsAt)).toBe(true);
    }
  });

  it("lists only the brains whose provider this deployment has configured", async () => {
    // DOX-C4: a brain the Worker cannot reach must not appear in the selector.
    const listed = async (env: Record<string, unknown>) => {
      const response = await worker.fetch(get("/api/brains"), makeEnv(env));
      const body = (await response.json()) as { brains: { id: string }[] };
      return body.brains.map((brain) => brain.id);
    };

    expect(await listed({ NORTHGUILD_GMT_GEMINI_API_KEY: "test-key" })).toEqual(
      idsFor("google"),
    );
    expect(await listed({ AI: fakeAI })).toEqual(idsFor("workers-ai"));
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

  it("runs on the Workers AI binding alone, with no Gemini key", async () => {
    // Past the configuration guard, `{}` fails validation — a 400, not the
    // "not configured" 500. `caches` is a Workers global Node does not have.
    vi.stubGlobal("caches", { default: {} });
    try {
      const response = await worker.fetch(
        get("/api/chat", { method: "POST", body: "{}" }),
        makeEnv({ AI: fakeAI }),
      );
      expect(response.status).toBe(400);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

/** A fake `ASSETS` that serves a small fixture map by pathname and 404s the rest.
 * It applies no `_redirects` and no `html_handling`. */
function fixtureAssets(files: Record<string, string> = {}) {
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
        const body = files[new URL(href).pathname];
        return body === undefined
          ? new Response("Dox 404 page", { status: 404 })
          : new Response(body, { status: 200 });
      },
    },
  };
}

const LEGACY = "https://gmt-dox.northguild.workers.dev";
const ND = "https://northguild.dev";
const nd = (path: string, init: RequestInit = {}) =>
  new Request(`${ND}${path}`, {
    headers: { "cf-connecting-ip": "1.2.3.4" },
    ...init,
  });
const legacy = (path: string, init: RequestInit = {}) =>
  new Request(`${LEGACY}${path}`, {
    headers: { "cf-connecting-ip": "1.2.3.4" },
    ...init,
  });

describe("worker entry — the legacy host (matrix rows 1-17, 31-33)", () => {
  const assets = fixtureAssets();
  const env = () => makeEnv({ ASSETS: assets.binding });

  const redirects: [string, string, string][] = [
    ["row 1", "/", "https://northguild.dev/gmt/"],
    ["row 2", "/?a=1&b=2", "https://northguild.dev/gmt/?a=1&b=2"],
    ["row 3", "/reference/", "https://northguild.dev/gmt/reference/"],
    [
      "row 4",
      "/tools/dst-inspector/?zone=Europe/Paris",
      "https://northguild.dev/gmt/tools/dst-inspector/?zone=Europe/Paris",
    ],
    [
      "row 5",
      "/guides/concepts/dst-disambiguation/",
      "https://northguild.dev/gmt/guides/concepts/dst-disambiguation/",
    ],
    ["row 6", "/reference", "https://northguild.dev/gmt/reference"],
    [
      "row 7 install.md",
      "/install.md",
      "https://northguild.dev/gmt/install.md",
    ],
    ["row 7 llms.txt", "/llms.txt", "https://northguild.dev/gmt/llms.txt"],
    [
      "row 7 llms-full.txt",
      "/llms-full.txt",
      "https://northguild.dev/gmt/llms-full.txt",
    ],
    [
      "row 8",
      "/_astro/index.abc123.css",
      "https://northguild.dev/gmt/_astro/index.abc123.css",
    ],
    ["row 9", "/_astro/stale.js", "https://northguild.dev/gmt/_astro/stale.js"],
    [
      "row 10 favicon",
      "/favicon.svg",
      "https://northguild.dev/gmt/favicon.svg",
    ],
    [
      "row 10 font",
      "/fonts/michroma-latin-400-normal.woff2",
      "https://northguild.dev/gmt/fonts/michroma-latin-400-normal.woff2",
    ],
    [
      "row 10 pagefind",
      "/pagefind/pagefind.js",
      "https://northguild.dev/gmt/pagefind/pagefind.js",
    ],
    [
      "row 10 sitemap",
      "/sitemap-index.xml",
      "https://northguild.dev/gmt/sitemap-index.xml",
    ],
    ["row 11", "/robots.txt", "https://northguild.dev/robots.txt"],
    [
      "row 12 hop 1",
      "/reference/duty/?a=1",
      "https://northguild.dev/gmt/reference/duty/?a=1",
    ],
  ];

  it.each(redirects)("%s: GET %s is a 301 to %s", async (_row, path, to) => {
    const response = await worker.fetch(legacy(path), env());
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(to);
  });

  it("rows 31-33: a browser navigation gets the same 301, never the 404 page", async () => {
    for (const [path, to] of [
      ["/", "https://northguild.dev/gmt/"],
      [
        "/guides/concepts/dst-disambiguation/",
        "https://northguild.dev/gmt/guides/concepts/dst-disambiguation/",
      ],
      [
        "/reference/duty/?a=1",
        "https://northguild.dev/gmt/reference/duty/?a=1",
      ],
    ]) {
      const response = await worker.fetch(
        legacy(path, {
          headers: {
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
            accept: "text/html",
          },
        }),
        env(),
      );
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(to);
    }
  });

  it("row 14: a POST to a non-API path is a 301", async () => {
    const response = await worker.fetch(
      legacy("/docs/x", { method: "POST", body: "x" }),
      env(),
    );
    expect(response.status).toBe(301);
  });

  it("never reaches the assets binding for a legacy path", async () => {
    expect(assets.calls).toHaveLength(0);
  });

  it("row 15: POST /api/chat is answered in place by the chat validator, never redirected", async () => {
    vi.stubGlobal("caches", { default: {} });
    try {
      const response = await worker.fetch(
        legacy("/api/chat", { method: "POST", body: "" }),
        makeEnv({ AI: fakeAI }),
      );
      expect(response.status).toBe(400);
      expect(response.headers.get("location")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("row 16: GET /api/brains is 200 JSON in place", async () => {
    const response = await worker.fetch(legacy("/api/brains"), env());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("json");
  });

  it("row 17: ?key= on a legacy API path is not exchanged (no cookie, no 303)", async () => {
    const response = await worker.fetch(
      legacy("/api/brains?key=x"),
      makeEnv({ DOX_DEV_KEY: "x" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("worker entry — northguild.dev/gmt (matrix rows 19-25, 34)", () => {
  it("row 19 and 34: /gmt is a 301 to /gmt/, keeping the query", async () => {
    for (const [path, to] of [
      ["/gmt", "https://northguild.dev/gmt/"],
      ["/gmt?a=1", "https://northguild.dev/gmt/?a=1"],
    ]) {
      const response = await worker.fetch(nd(path), makeEnv());
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(to);
    }
  });

  it("row 21: a missing page is the Dox 404 page, from the assets binding with the full path", async () => {
    const assets = fixtureAssets();
    const response = await worker.fetch(
      nd("/gmt/nope/"),
      makeEnv({ ASSETS: assets.binding }),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Dox 404 page");
    expect(assets.calls).toEqual(["https://northguild.dev/gmt/nope/"]);
  });

  it("hands a page path to the assets binding untouched, base included", async () => {
    const assets = fixtureAssets({ "/gmt/reference": "page" });
    const request = nd("/gmt/reference");
    const response = await worker.fetch(
      request,
      makeEnv({ ASSETS: assets.binding }),
    );
    expect(response.status).toBe(200);
    expect(assets.calls).toEqual(["https://northguild.dev/gmt/reference"]);
  });

  it("row 22: GET /gmt/api/brains is 200 JSON", async () => {
    const response = await worker.fetch(nd("/gmt/api/brains"), makeEnv());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("json");
  });

  it("row 23: /gmt/api/chat is 400 on an empty POST and 405 on a GET", async () => {
    vi.stubGlobal("caches", { default: {} });
    try {
      const post = await worker.fetch(
        nd("/gmt/api/chat", { method: "POST", body: "" }),
        makeEnv({ AI: fakeAI }),
      );
      expect(post.status).toBe(400);
      const get = await worker.fetch(
        nd("/gmt/api/chat"),
        makeEnv({ AI: fakeAI }),
      );
      expect(get.status).toBe(405);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("row 24: a wrong ?key= is a 303 to the clean /gmt path with no cookie; the right one sets Path=/gmt/", async () => {
    const wrong = await worker.fetch(
      nd("/gmt/api/brains?key=wrong"),
      makeEnv({ DOX_DEV_KEY: "right-secret" }),
    );
    expect(wrong.status).toBe(303);
    expect(wrong.headers.get("location")).toBe(
      "https://northguild.dev/gmt/api/brains",
    );
    expect(wrong.headers.get("set-cookie")).toBeNull();

    const right = await worker.fetch(
      nd("/gmt/api/brains?key=right-secret"),
      makeEnv({ DOX_DEV_KEY: "right-secret" }),
    );
    expect(right.status).toBe(303);
    expect(right.headers.get("location")).toBe(
      "https://northguild.dev/gmt/api/brains",
    );
    expect(right.headers.get("set-cookie")).toContain("Path=/gmt/");
  });

  it("row 25: /gmtx is not under the base; it is a 301 to /gmt/gmtx", async () => {
    const response = await worker.fetch(nd("/gmtx"), makeEnv());
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://northguild.dev/gmt/gmtx",
    );
  });

  it("claims ?key= under the base ahead of the API router", async () => {
    const assets = assetsBinding();
    const response = await worker.fetch(
      nd("/gmt/api/chat?key=right-secret", { method: "POST", body: "{}" }),
      makeEnv({ DOX_DEV_KEY: "right-secret", ASSETS: assets.binding }),
    );
    expect(response.status).toBe(303);
    expect(assets.calls).toHaveLength(0);
  });
});

describe("corpusFetcher — where the retrieval corpus is read from", () => {
  it("reads through the assets binding when no dev origin is set", async () => {
    const assets = assetsBinding();
    const fetchCorpus = corpusFetcher(makeEnv({ ASSETS: assets.binding }));

    await fetchCorpus("https://gmt-dox.example/retrieval-chunks.json");

    expect(assets.calls).toEqual([
      "https://gmt-dox.example/retrieval-chunks.json",
    ]);
  });

  it("reads the same path from DOX_ASSETS_ORIGIN, not the binding, when it is set", async () => {
    const assets = assetsBinding();
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response("[]", { status: 200 });
    });
    try {
      const fetchCorpus = corpusFetcher(
        makeEnv({
          ASSETS: assets.binding,
          DOX_ASSETS_ORIGIN: "http://localhost:4321",
        }),
      );

      await fetchCorpus("http://localhost:8787/retrieval-chunks.json?v=1");

      expect(seen).toEqual(["http://localhost:4321/retrieval-chunks.json?v=1"]);
      expect(assets.calls).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
