import type { APIRoute } from "astro";
import { corpus } from "~/generated/reference/corpus";
import { buildFunctionChunks } from "~/lib/retrieval/function-chunks";
import { buildGuideChunks } from "~/lib/retrieval/guide-chunks";
import { loadGuideSources } from "~/lib/retrieval/guide-sources";

/**
 * DOX-C1 (#137) — the retrieval corpus, built at `astro build` time (Node
 * has `fs` access here; the Worker doesn't) and shipped as a static asset.
 * DOX-C2's Worker fetches this same-origin — see `lib/retrieval/fetch-chunks.ts`
 * — rather than rebuilding chunks itself, which is why this is a build-time
 * endpoint and not runtime logic.
 */
export const GET: APIRoute = () => {
  const chunks = [
    ...buildFunctionChunks(corpus),
    ...buildGuideChunks(loadGuideSources()),
  ];
  return new Response(JSON.stringify(chunks), {
    headers: { "content-type": "application/json" },
  });
};
