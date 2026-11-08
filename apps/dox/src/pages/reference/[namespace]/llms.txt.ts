import type { APIRoute, GetStaticPaths } from "astro";
import { SITE_URL } from "~/lib/site";
import { corpus } from "~/generated/reference/corpus";
import {
  namespaceEntries,
  namespaceSections,
  namespaceTitle,
  renderLlmsTxt,
} from "~/lib/llms";
import { namespaceSummary } from "~/lib/namespace-summary";

/** One `llms.txt` per reference namespace, from the grouping the root file's index reads. */
export const getStaticPaths = (() =>
  namespaceEntries(corpus).map((ns) => ({
    params: { namespace: ns.namespace },
    props: { ns },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute<{
  ns: ReturnType<typeof namespaceEntries>[number];
}> = ({ props: { ns } }) =>
  new Response(
    renderLlmsTxt({
      title: namespaceTitle(ns.namespace),
      summary: `${namespaceSummary(ns.namespace)} Back to the [root llms.txt](${SITE_URL}/llms.txt).`,
      sections: namespaceSections(ns, SITE_URL),
    }),
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
