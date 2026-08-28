import type { APIContext, APIRoute } from "astro";
import { corpus } from "~/generated/reference/corpus";
import { renderLlmsTxt, type LlmsSection } from "~/lib/llms";

export const GET: APIRoute = ({ site }: APIContext) => {
  const base =
    site?.toString().replace(/\/$/, "") ??
    "https://gmt-dox.northguild.workers.dev";

  // Group corpus by namespace
  const byNs = new Map<string, typeof corpus>();
  for (const entry of corpus) {
    if (!byNs.has(entry.namespace)) byNs.set(entry.namespace, []);
    byNs.get(entry.namespace)!.push(entry);
  }

  const sections: LlmsSection[] = [];

  // Reference sections grouped by namespace
  for (const [ns, entries] of byNs) {
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const links = entries.map((e) => ({
      title: e.name,
      url: `${base}${e.url}.md`,
      description: e.description,
    }));
    sections.push({ heading: `Reference — ${ns}`, links });
  }

  // Guides section
  const guideLinks = [
    {
      title: "Install",
      url: `${base}/install.md`,
      description: "How to install and configure @northguild/gmt",
    },
    {
      title: "Core Rules",
      url: `${base}/core-rules.md`,
      description: "The fundamental rules of GMT",
    },
  ];
  sections.push({ heading: "Guides", links: guideLinks });

  return new Response(
    renderLlmsTxt({
      title: "@northguild/gmt",
      summary:
        "Temporal-first date and time utilities with timezone support and polyfill integration.",
      sections,
    }),
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
};
