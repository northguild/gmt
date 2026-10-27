import type { APIRoute } from "astro";
import { SITE_URL } from "~/lib/site";
import { corpus } from "~/generated/reference/corpus";
import {
  referenceSections,
  renderLlmsTxt,
  type LlmsLink,
  type LlmsSection,
} from "~/lib/llms";
import { stripFrontmatter, stripMdx } from "~/lib/page-markdown";
import {
  docsRelativePath,
  industryPages,
  migratePages,
  topLevelPages,
} from "~/lib/top-level-pages";
import { pageExpressionValues } from "~/lib/page-expression-values";

/** The splash pages' figures, evaluated once per build. */
const values = pageExpressionValues();

const RAW = import.meta.glob("../content/docs/**/*.{md,mdx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** What the first line under the title says the package is. */
const SUMMARY =
  'GMT (`@northguild/gmt`) is a date and time library for JavaScript and TypeScript built on TC39 Temporal. Functions take ISO 8601 strings and return ISO 8601 strings or plain values; invalid input returns a typed fallback (`""`, `null`, `false` or `[]`) instead of throwing.';

/** One list entry for a page: its title, its `.md` twin and its description on one line. */
function linkTo(base: string, slug: string, source: string): LlmsLink {
  const { data, body } = stripFrontmatter(source);
  const md = stripMdx(body, { gmtVersion: "", values });
  const description = data.description ?? md.split("\n")[0] ?? "";
  return {
    title:
      data["hero.title"] && slug === "index"
        ? data["hero.title"]
        : (data.title ?? slug),
    url: `${base}/${slug}.md`,
    description: String(description).replace(/\s+/g, " ").trim(),
  };
}

/** The pages of one directory of `content/docs/`, index page first, the rest by title. */
function directoryLinks(
  base: string,
  directory: string,
  { indexFirst }: { indexFirst: boolean },
): LlmsLink[] {
  const pages = Object.entries(RAW)
    .map(([path, source]) => ({ slug: docsRelativePath(path), source }))
    .filter(({ slug }) => slug.startsWith(`${directory}/`));
  const index = pages.filter(({ slug }) => slug === `${directory}/index`);
  const rest = pages
    .filter(({ slug }) => slug !== `${directory}/index`)
    .map(({ slug, source }) => linkTo(base, slug, source))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [
    ...(indexFirst
      ? index.map(({ slug, source }) => linkTo(base, slug, source))
      : []),
    ...rest,
  ];
}

export const GET: APIRoute = () => {
  const base = SITE_URL;

  // Top-level pages in sidebar order: Install leads on its own, the rest are "Start here".
  const top = topLevelPages(RAW).map(({ slug, source }) => ({
    slug,
    link: linkTo(base, slug, source),
  }));
  const install = top.filter(({ slug }) => slug === "install");
  const startHere = top.filter(({ slug }) => slug !== "install");

  const migrateLinks = migratePages(RAW).map(({ slug, source }) =>
    linkTo(base, slug, source),
  );

  const industryLinks = industryPages(RAW).map(({ slug, source }) =>
    linkTo(base, slug, source),
  );

  const [referenceIndex, ...referenceNamespaces] = referenceSections(
    corpus,
    base,
  );

  const sections: LlmsSection[] = [
    { heading: "Install", links: install.map(({ link }) => link) },
    {
      heading: "Tools",
      links: directoryLinks(base, "tools", { indexFirst: true }),
    },
    {
      heading: "Checks",
      links: directoryLinks(base, "check", { indexFirst: true }),
    },
    { heading: "Start here", links: startHere.map(({ link }) => link) },
    { heading: "Migrate", links: migrateLinks },
    // The guides index is a list of the guides below it.
    {
      heading: "Guides",
      links: directoryLinks(base, "guides", { indexFirst: false }),
    },
    referenceIndex,
    ...referenceNamespaces,
    { heading: "Industries", links: industryLinks },
    {
      heading: "Scenarios",
      links: directoryLinks(base, "scenarios", { indexFirst: false }),
    },
    {
      heading: "Mistakes",
      links: directoryLinks(base, "mistakes", { indexFirst: false }),
    },
  ];

  return new Response(
    renderLlmsTxt({
      title: "@northguild/gmt",
      summary: SUMMARY,
      sections: sections.filter((section) => section.links.length > 0),
    }),
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
};
