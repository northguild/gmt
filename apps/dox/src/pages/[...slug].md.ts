import type { APIRoute, GetStaticPaths } from "astro";
import { gmtVersion } from "~/generated/versions";
import {
  pageToMarkdown,
  stripFrontmatter,
  stripMdx,
} from "~/lib/page-markdown";
import { docsRelPath, markdownTwinSlug } from "~/lib/md-twin";
import { pageExpressionValues } from "~/lib/page-expression-values";

/** The splash pages' figures, evaluated once per build. */
const values = pageExpressionValues();

const RAW = import.meta.glob("../content/docs/**/*.{md,mdx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const pages = Object.entries(RAW).flatMap(([path, raw]) => {
  const rel = docsRelPath(path);
  const { data, body } = stripFrontmatter(raw);
  // A page with a `slug:` (the generated reference) is served at it; the home page at `index.md`.
  const slug = markdownTwinSlug(
    data.slug ?? rel.replace(/(?:^|\/)index$/, ""),
    path,
  );
  const md = stripMdx(body, { gmtVersion, values });
  return [
    {
      slug,
      markdown: pageToMarkdown({
        // The home page's `title` is the page's `<title>`; its heading is the package name.
        title:
          (rel === "index" ? data["hero.title"] : undefined) ??
          data.title ??
          slug,
        body: md,
        industries: data.industries,
      }),
    },
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
