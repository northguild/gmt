import type { APIRoute, GetStaticPaths } from "astro";
import { gmtVersion } from "~/generated/versions";
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

const pages = Object.entries(RAW).flatMap(([path, raw]) => {
  const rel = path
    .replace(/^.*\/content\/docs\//, "")
    .replace(/\.(md|mdx)$/, "");
  if (rel === "index") return []; // splash homepage — skip
  const { data, body } = stripFrontmatter(raw);
  const slug = data.slug ?? rel; // reference pages carry explicit slug:
  const isReference = path.includes("/content/docs/reference/");
  const md = isReference ? body : stripMdx(body, { gmtVersion });
  return [
    { slug, markdown: pageToMarkdown({ title: data.title ?? slug, body: md }) },
  ];
});

export const getStaticPaths: GetStaticPaths = () =>
  pages.map((p) => ({
    params: { slug: p.slug },
    props: { markdown: p.markdown },
  }));

export const GET: APIRoute = ({ props }) =>
  new Response(props.markdown as string, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
