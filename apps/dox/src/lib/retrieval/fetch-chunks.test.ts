/// <reference types="vitest/globals" />
import { fetchChunks } from "./fetch-chunks";
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
});
