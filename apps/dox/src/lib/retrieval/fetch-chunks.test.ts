/// <reference types="vitest/globals" />
import { fetchChunks, resetChunksMemo } from "./fetch-chunks";
import type { RetrievalChunk } from "./types";

const SAMPLE: RetrievalChunk[] = [
  {
    id: "a",
    kind: "function",
    url: "/reference/a",
    namespace: "a",
    title: "a",
    text: "a",
  },
];

function mockCache() {
  const store = new Map<string, Response>();
  return {
    store,
    match: vi.fn(async (req: Request) => store.get(req.url)?.clone()),
    put: vi.fn(async (req: Request, res: Response) => {
      store.set(req.url, res.clone());
    }),
  };
}

describe("fetchChunks", () => {
  beforeEach(() => resetChunksMemo());
  afterEach(() => vi.restoreAllMocks());

  it("fetches /retrieval-chunks.json relative to the given origin", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
    );
    const chunks = await fetchChunks("https://gmt-dox.example/", { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://gmt-dox.example/retrieval-chunks.json",
    );
    expect(chunks).toEqual(SAMPLE);
  });

  it("throws with the status on a non-ok response", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("nope", { status: 500, statusText: "Server Error" }),
    );
    await expect(
      fetchChunks("https://gmt-dox.example", { fetchImpl }),
    ).rejects.toThrow(/500/);
  });

  it("serves a cache hit without calling fetch", async () => {
    const cache = mockCache();
    await cache.put(
      new Request("https://gmt-dox.example/retrieval-chunks.json"),
      new Response(JSON.stringify(SAMPLE)),
    );
    const fetchImpl = vi.fn();
    const chunks = await fetchChunks("https://gmt-dox.example", {
      fetchImpl,
      cache,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(chunks).toEqual(SAMPLE);
  });

  it("populates the cache on a miss, with a max-age header", async () => {
    const cache = mockCache();
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
    );
    await fetchChunks("https://gmt-dox.example", {
      fetchImpl,
      cache,
      cacheTtlSeconds: 60,
    });
    expect(cache.put).toHaveBeenCalledTimes(1);
    const [, storedResponse] = cache.put.mock.calls[0];
    expect(storedResponse.headers.get("cache-control")).toBe("max-age=60");
  });

  it("hands back the same parsed array within the TTL without touching the cache or fetch", async () => {
    const cache = mockCache();
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
    );
    let now = 1_000_000;
    const options = { fetchImpl, cache, cacheTtlSeconds: 60, now: () => now };

    const first = await fetchChunks("https://gmt-dox.example", options);
    now += 59_000;
    const second = await fetchChunks("https://gmt-dox.example", options);

    // Same object, not merely equal: `search.ts` keys its index on identity.
    expect(second).toBe(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cache.match).toHaveBeenCalledTimes(1);
  });

  it("re-reads once the TTL has passed, so a redeployed corpus is picked up", async () => {
    const cache = mockCache();
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
    );
    let now = 1_000_000;
    const options = { fetchImpl, cache, cacheTtlSeconds: 60, now: () => now };

    const first = await fetchChunks("https://gmt-dox.example", options);
    now += 60_001;
    const second = await fetchChunks("https://gmt-dox.example", options);

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
    // The Cache API entry was still warm, so the bytes came from there.
    expect(cache.match).toHaveBeenCalledTimes(2);
  });

  it("does not keep the corpus forever when the clock was unreadable as it was stored", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
    );
    // The clock reads +Infinity (its null sentinel) at the moment the memo is written, then
    // recovers. The memo must not survive on an expiry of Infinity.
    let now = Number.POSITIVE_INFINITY;
    const options = { fetchImpl, cacheTtlSeconds: 60, now: () => now };

    await fetchChunks("https://gmt-dox.example", options);
    now = 1_000_000;
    await fetchChunks("https://gmt-dox.example", options);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps one origin's corpus from answering for another", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
    );
    await fetchChunks("https://gmt-dox.example", { fetchImpl });
    await fetchChunks("http://localhost:8787", { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
