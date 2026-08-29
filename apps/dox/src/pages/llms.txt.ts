import type { APIContext, APIRoute } from "astro";
import { corpus } from "~/generated/reference/corpus";
import { renderLlmsTxt, type LlmsSection } from "~/lib/llms";
import { stripFrontmatter, stripMdx } from "~/lib/page-markdown";

const RAW = import.meta.glob("../content/docs/**/*.{md,mdx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

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

  // Guides section — every non-index page under content/docs/guides/
  const guideLinks = Object.entries(RAW)
    .filter(([path]) => path.includes("/content/docs/guides/"))
    .filter(([path]) => {
      const rel = path
        .replace(/^.*\/content\/docs\//, "")
        .replace(/\.(md|mdx)$/, "");
      return rel !== "guides/index";
    })
    .map(([path, raw]) => {
      const rel = path
        .replace(/^.*\/content\/docs\//, "")
        .replace(/\.(md|mdx)$/, "");
      const { data, body } = stripFrontmatter(raw);
      const md = stripMdx(body, { gmtVersion: "" });
      const title = data.title ?? rel;
      const description = data.description ?? md.split("\n")[0] ?? "";
      return {
        title,
        url: `${base}/${rel}.md`,
        description: String(description).replace(/\s+/g, " ").trim(),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  sections.push({ heading: "Guides", links: guideLinks });

  // Scenarios section — every non-index page under content/docs/scenarios/
  const scenarioLinks = Object.entries(RAW)
    .filter(([path]) => path.includes("/content/docs/scenarios/"))
    .filter(([path]) => {
      const rel = path
        .replace(/^.*\/content\/docs\//, "")
        .replace(/\.(md|mdx)$/, "");
      return rel !== "scenarios/index";
    })
    .map(([path, raw]) => {
      const rel = path
        .replace(/^.*\/content\/docs\//, "")
        .replace(/\.(md|mdx)$/, "");
      const { data, body } = stripFrontmatter(raw);
      const md = stripMdx(body, { gmtVersion: "" });
      const title = data.title ?? rel;
      const description = data.description ?? md.split("\n")[0] ?? "";
      return {
        title,
        url: `${base}/${rel}.md`,
        description: String(description).replace(/\s+/g, " ").trim(),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  sections.push({ heading: "Scenarios", links: scenarioLinks });

  // Mistakes section — every non-index page under content/docs/mistakes/
  const mistakeLinks = Object.entries(RAW)
    .filter(([path]) => path.includes("/content/docs/mistakes/"))
    .filter(([path]) => {
      const rel = path
        .replace(/^.*\/content\/docs\//, "")
        .replace(/\.(md|mdx)$/, "");
      return rel !== "mistakes/index";
    })
    .map(([path, raw]) => {
      const rel = path
        .replace(/^.*\/content\/docs\//, "")
        .replace(/\.(md|mdx)$/, "");
      const { data, body } = stripFrontmatter(raw);
      const md = stripMdx(body, { gmtVersion: "" });
      const title = data.title ?? rel;
      const description = data.description ?? md.split("\n")[0] ?? "";
      return {
        title,
        url: `${base}/${rel}.md`,
        description: String(description).replace(/\s+/g, " ").trim(),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  sections.push({ heading: "Mistakes", links: mistakeLinks });

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
