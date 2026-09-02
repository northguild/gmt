import type { APIContext, APIRoute } from "astro";
import { gmtVersion } from "~/generated/versions";
import { renderLlmsFull } from "~/lib/llms";
import {
  pageToMarkdown,
  stripFrontmatter,
  stripMdx,
} from "~/lib/page-markdown";

const RAW = import.meta.glob("../content/docs/**/*.{md,mdx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const GET: APIRoute = ({ site }: APIContext) => {
  const base =
    site?.toString().replace(/\/$/, "") ??
    "https://gmt-dox.northguild.workers.dev";

  // Build guide pages: every non-index page under content/docs/guides/
  const guidePages = Object.entries(RAW)
    .filter(([path]) => path.includes("/content/docs/guides/"))
    .map(([path, raw]) => {
      const rel = path
        .replace(/^.*\/content\/docs\//, "")
        .replace(/\.(md|mdx)$/, "");
      if (rel === "guides/index") return null;

      const { data, body } = stripFrontmatter(raw);
      const md = stripMdx(body, { gmtVersion });
      const title = data.title ?? rel;
      return {
        title,
        url: `${base}/${rel}.md`,
        markdown: pageToMarkdown({ title, body: md }),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null)
    .sort((a, b) => a.title.localeCompare(b.title));

  // Scenario pages: every non-index page under content/docs/scenarios/
  const scenarioPages = Object.entries(RAW)
    .filter(([path]) => path.includes("/content/docs/scenarios/"))
    .map(([path, raw]) => {
      const rel = path
        .replace(/^.*\/content\/docs\//, "")
        .replace(/\.(md|mdx)$/, "");
      if (rel === "scenarios/index") return null;

      const { data, body } = stripFrontmatter(raw);
      const md = stripMdx(body, { gmtVersion });
      const title = data.title ?? rel;
      return {
        title,
        url: `${base}/${rel}.md`,
        markdown: pageToMarkdown({ title, body: md }),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null)
    .sort((a, b) => a.title.localeCompare(b.title));

  // Mistake pages: every non-index page under content/docs/mistakes/
  const mistakePages = Object.entries(RAW)
    .filter(([path]) => path.includes("/content/docs/mistakes/"))
    .map(([path, raw]) => {
      const rel = path
        .replace(/^.*\/content\/docs\//, "")
        .replace(/\.(md|mdx)$/, "");
      if (rel === "mistakes/index") return null;

      const { data, body } = stripFrontmatter(raw);
      const md = stripMdx(body, { gmtVersion });
      const title = data.title ?? rel;
      return {
        title,
        url: `${base}/${rel}.md`,
        markdown: pageToMarkdown({ title, body: md }),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null)
    .sort((a, b) => a.title.localeCompare(b.title));

  // Start-here pages (why-gmt, core-rules, install)
  const startSlugs = ["why-gmt", "core-rules", "install"];
  const startPages = startSlugs
    .map((slug) => {
      const rawKey = Object.keys(RAW).find((k) => {
        const rel = k
          .replace(/^.*\/content\/docs\//, "")
          .replace(/\.(md|mdx)$/, "");
        return rel === slug;
      });
      if (!rawKey) return null;

      const raw = RAW[rawKey];
      const { data, body } = stripFrontmatter(raw);
      const md = stripMdx(body, { gmtVersion });
      return {
        title: data.title ?? slug,
        url: `${base}/${slug}.md`,
        markdown: pageToMarkdown({ title: data.title ?? slug, body: md }),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  // Reference pages (sorted by slug)
  const refPages = Object.entries(RAW)
    .filter(([path]) => path.includes("/content/docs/reference/"))
    .map(([path, raw]) => {
      const rel = path
        .replace(/^.*\/content\/docs\//, "")
        .replace(/\.(md|mdx)$/, "");
      if (rel === "index") return null; // skip barrel pages

      const { data, body } = stripFrontmatter(raw);
      const slug = data.slug ?? rel;
      const md = stripMdx(body, { gmtVersion });
      return {
        title: data.title ?? rel,
        url: `${base}/${slug}.md`,
        markdown: pageToMarkdown({ title: data.title ?? rel, body: md }),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null)
    .sort((a, b) => a.url.localeCompare(b.url));

  const allPages = [
    ...startPages,
    ...guidePages,
    ...scenarioPages,
    ...mistakePages,
    ...refPages,
  ];

  return new Response(
    renderLlmsFull({
      title: "@northguild/gmt",
      summary:
        "Temporal-first date and time utilities with timezone support and polyfill integration.",
      pages: allPages,
    }),
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
};
