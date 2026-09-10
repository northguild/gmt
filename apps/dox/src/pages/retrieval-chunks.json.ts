import type { APIRoute } from "astro";
import { buildRetrievalCorpus } from "~/lib/retrieval/corpus";

/**
 * DOX-C1 (#137) — the retrieval corpus, built at `astro build` time (Node
 * has `fs` access here; the Worker doesn't) and shipped as a static asset.
 * DOX-C2's Worker fetches this same-origin — see `lib/retrieval/fetch-chunks.ts`
 * — rather than rebuilding chunks itself, which is why this is a build-time
 * endpoint and not runtime logic.
 *
 * The assembly itself lives in `lib/retrieval/corpus.ts` so the tests search
 * exactly what this serves.
 */
export const GET: APIRoute = () => {
  return new Response(JSON.stringify(buildRetrievalCorpus()), {
    headers: { "content-type": "application/json" },
  });
};
