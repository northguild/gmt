import type { RetrievalChunk } from "./types";

/** Minimal subset of the Web Cache API (`caches.default` in a Cloudflare
 * Worker) this file needs — declared locally so this module has no
 * `@cloudflare/workers-types` dependency and stays trivially mockable in
 * tests. */
export interface ChunkCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface FetchChunksOptions {
  /** Injectable for tests; defaults to the ambient `fetch`. */
  fetchImpl?: typeof fetch;
  /** The Worker's `caches.default` in production. Omitted in tests that
   * don't care about caching, or when calling from a context (like the
   * `astro build` endpoint that generates the file in the first place)
   * that has no Cache API at all. */
  cache?: ChunkCache;
  /** How long a cache hit is considered fresh. DOX-C1's DoD only asks that
   * *a* caching behavior exist and be recorded — this is a starting value,
   * not a measured optimum; retuning it needs production traffic DOX-C2
   * doesn't have yet. */
  cacheTtlSeconds?: number;
  /** Injectable clock for the in-memory memo's TTL; defaults to `Date.now`. */
  now?: () => number;
}

const CHUNKS_PATH = "/retrieval-chunks.json";

/* The parsed corpus, once per isolate. The Cache API below survives across
   isolates but hands back bytes, and `response.json()` over 750 KB was being
   paid on every request. This memo returns the *same array* for the life of
   its TTL, which is also what lets `search.ts` keep one index per corpus.
   Keyed on the URL so a test (or a second origin) never sees another's
   corpus; the TTL matches the Cache API entry's, so the two expire together. */
let memo: { url: string; chunks: RetrievalChunk[]; expiresAt: number } | null =
  null;

/** Forgets the in-memory corpus. Tests only. */
export function resetChunksMemo(): void {
  memo = null;
}

/**
 * DOX-C1 (#137) — "the Worker fetches the corpus from the static site it is
 * already serving" (overview.md §2 "Hosting"). Same-origin, so no CORS and
 * no separate deployment coupling: `origin` is the Worker's own request
 * origin, and `/retrieval-chunks.json` is `dox.astro`'s sibling endpoint —
 * see `src/pages/retrieval-chunks.json.ts` — built into the same static
 * asset bundle `env.ASSETS` already serves.
 *
 * Caching is via the standard Cache API (`caches.default` on Cloudflare),
 * keyed on the request URL, with a `Cache-Control` max-age header on the
 * stored response — the conventional pattern for a Worker fronting its own
 * static assets. DOX-C2 owns actually wiring `caches.default` in; this
 * function only needs the two methods it uses (see `ChunkCache` above),
 * which is what makes it testable with a plain mock instead of Miniflare.
 */
export async function fetchChunks(
  origin: string,
  options: FetchChunksOptions = {},
): Promise<RetrievalChunk[]> {
  const {
    fetchImpl = fetch,
    cache,
    cacheTtlSeconds = 300,
    now = Date.now,
  } = options;
  const url = new URL(CHUNKS_PATH, origin).toString();
  const cacheKey = new Request(url);

  if (memo && memo.url === url && memo.expiresAt > now()) return memo.chunks;

  const remember = (chunks: RetrievalChunk[]): RetrievalChunk[] => {
    memo = { url, chunks, expiresAt: now() + cacheTtlSeconds * 1000 };
    return chunks;
  };

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return remember((await cached.json()) as RetrievalChunk[]);
  }

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(
      `fetchChunks: ${url} returned ${response.status} ${response.statusText}`,
    );
  }
  const chunks = (await response.json()) as RetrievalChunk[];

  if (cache) {
    const cacheResponse = new Response(JSON.stringify(chunks), {
      headers: {
        "content-type": "application/json",
        "cache-control": `max-age=${cacheTtlSeconds}`,
      },
    });
    await cache.put(cacheKey, cacheResponse);
  }

  return remember(chunks);
}
