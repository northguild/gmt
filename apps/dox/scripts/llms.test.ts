import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const outGen = resolve(
  import.meta.dirname,
  "..",
  "src",
  "generated",
  "reference",
);
const refDir = resolve(
  import.meta.dirname,
  "..",
  "src",
  "content",
  "docs",
  "reference",
);
const mdxExists = existsSync(refDir);

// Import pure helpers (no Astro globals needed)
import { renderLlmsFull, renderLlmsTxt } from "../src/lib/llms";
import { stripFrontmatter, stripMdx } from "../src/lib/page-markdown";

/**
 * The built site, or a reason to stop.
 *
 * These gates read `dist`, so without a build they have nothing to check — and a test that checks
 * nothing still reports as passing. That is not hypothetical: the CI Tests job builds only
 * `@northguild/gmt`, so all three of them had never run there, and a raw `<UpstreamDefects />`
 * reached every text surface with the suite green (CORE-8 review, #253). Locally a skip is the
 * right call, because requiring a 45-second build before `vitest` would be hostile. The same is
 * true of the CI Tests job, which runs this suite across three Node versions and has no reason to
 * build the site three times.
 *
 * So the failure is keyed to `DOX_DIST_REQUIRED`, which `Story consistency` sets on the one step
 * that builds the site first — not to `CI`, which is set everywhere and would turn a legitimate
 * skip into a failure in every other job.
 */
function distDirOrSkip(): string | null {
  const distDir = resolve(import.meta.dirname, "..", "dist");
  if (existsSync(distDir)) return distDir;
  if (process.env.DOX_DIST_REQUIRED) {
    throw new Error(
      "apps/dox/dist is missing, so the text-surface gates would silently pass. " +
        "The step that sets DOX_DIST_REQUIRED must run `pnpm --filter dox run build` first.",
    );
  }
  return null;
}

describe("llms.txt surface", () => {
  it("has a non-empty corpus to build sections from", () => {
    const corpus = JSON.parse(
      readFileSync(resolve(outGen, "gmt-corpus.json"), "utf8"),
    ) as Array<{
      url: string;
      name: string;
      namespace: string;
      description: string;
    }>;
    expect(corpus.length).toBeGreaterThan(400);
  });

  it("renderLlmsTxt produces spec-compliant output", () => {
    const sections = [
      {
        heading: "Reference — duration",
        links: [
          {
            title: "absDuration",
            url: "/reference/duration/calculate/absDuration.md",
            description: "Absolute value of a duration",
          },
        ],
      },
      { heading: "Guides", links: [{ title: "Install", url: "/install.md" }] },
    ];
    const output = renderLlmsTxt({
      title: "@northguild/gmt",
      summary: "Temporal-first date and time utilities.",
      sections,
    });

    // H1 title
    expect(output).toMatch(/^# @northguild\/gmt$/m);
    // Blockquote summary
    expect(output).toMatch(/^> Temporal-first/m);
    // Section heading
    expect(output).toContain("## Reference — duration");
    expect(output).toContain("## Guides");
    // Link format: - [title](url): description
    expect(output).toContain(
      "- [absDuration](/reference/duration/calculate/absDuration.md): Absolute value of a duration",
    );
    expect(output).toContain("- [Install](/install.md)");
  });

  it("renderLlmsFull includes page markdown bodies", () => {
    const pages = [
      {
        title: "absDuration",
        url: "/reference/duration/calculate/absDuration.md",
        markdown: "# absDuration\n\nAbsolute value of a duration.\n",
      },
    ];
    const output = renderLlmsFull({
      title: "@northguild/gmt",
      summary: "Temporal-first date and time utilities.",
      pages,
    });

    expect(output).toMatch(/^# @northguild\/gmt$/m);
    expect(output).toContain("> Temporal-first");
    expect(output).toContain("## absDuration");
    expect(output).toContain(
      "> source: /reference/duration/calculate/absDuration.md",
    );
    expect(output).toContain("# absDuration\n\nAbsolute value of a duration.");
  });

  it("manifest integrity: every reference URL in llms.txt exists in route-manifest", async () => {
    if (!mdxExists) return;

    const corpus = JSON.parse(
      readFileSync(resolve(outGen, "gmt-corpus.json"), "utf8"),
    ) as Array<{
      url: string;
      name: string;
      namespace: string;
      description: string;
    }>;
    const mod = await import(resolve(outGen, "route-manifest.ts"));
    const routes = mod.referenceRoutes as Set<string>;

    // Build the same sections llms.txt.ts builds
    const byNs = new Map<string, typeof corpus>();
    for (const entry of corpus) {
      if (!byNs.has(entry.namespace)) byNs.set(entry.namespace, []);
      byNs.get(entry.namespace)!.push(entry);
    }

    const sections: Array<{
      heading: string;
      links: Array<{ title: string; url: string; description?: string }>;
    }> = [];
    for (const [ns, entries] of byNs) {
      entries.sort((a, b) => a.name.localeCompare(b.name));
      const links = entries.map((e) => ({
        title: e.name,
        url: `https://gmt-dox.northguild.workers.dev${e.url}.md`,
        description: e.description,
      }));
      sections.push({ heading: `Reference — ${ns}`, links });
    }

    // Build the same sections llms.txt.ts builds — derive guide links from
    // the same glob so the test validates the source's actual output.
    const RAW_PAGES = import.meta.glob("../src/content/docs/**/*.{md,mdx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const guideLinks = Object.entries(RAW_PAGES)
      .filter(([path]) => path.includes("/content/docs/guides/"))
      .map(([path, raw]) => {
        const rel = path
          .replace(/^.*\/content\/docs\//, "")
          .replace(/\.(md|mdx)$/, "");
        if (rel === "guides/index") return null;
        const { data } = stripFrontmatter(raw);
        return {
          title: data.title ?? rel,
          url: `https://gmt-dox.northguild.workers.dev/${rel}.md`,
          description: data.title ?? "",
        };
      })
      .filter(
        (l): l is { title: string; url: string; description: string } =>
          l != null,
      )
      .sort((a, b) => a.title.localeCompare(b.title));
    sections.push({ heading: "Guides", links: guideLinks });

    const output = renderLlmsTxt({
      title: "@northguild/gmt",
      summary: "Temporal-first date and time utilities.",
      sections,
    });

    // Extract all URLs from markdown links ](url)
    const linkUrls =
      output.match(/\]\(([^)]+)\)/g)?.map((m) => m.slice(2, -1)) ?? [];

    // Build the guide and mistake allow-lists from the same glob.
    const guideAllowList = new Set<string>();
    const mistakeAllowList = new Set<string>();
    for (const path of Object.keys(RAW_PAGES)) {
      if (path.includes("/content/docs/guides/")) {
        const rel = path
          .replace(/^.*\/content\/docs\//, "")
          .replace(/\.(md|mdx)$/, "");
        if (rel === "guides/index") continue;
        guideAllowList.add(`/${rel}.md`);
      }
      if (path.includes("/content/docs/mistakes/")) {
        const rel = path
          .replace(/^.*\/content\/docs\//, "")
          .replace(/\.(md|mdx)$/, "");
        if (rel === "mistakes/index") continue;
        mistakeAllowList.add(`/${rel}.md`);
      }
    }
    for (const url of linkUrls) {
      if (url.includes("/reference/")) {
        // Strip leading site origin and .md suffix
        const slug = url
          .replace(/^https:\/\/gmt-dox\.northguild\.workers\.dev/, "")
          .replace(/\.md$/, "");
        expect(routes.has(slug), `manifest has ${slug}`).toBe(true);
      } else if (url.includes("/mistakes/")) {
        const slug = url.replace(
          /^https:\/\/gmt-dox\.northguild\.workers\.dev/,
          "",
        );
        expect(
          mistakeAllowList.has(slug),
          `mistake allow-list has ${slug}`,
        ).toBe(true);
      } else {
        // Guide URLs checked against allow-list (keep .md for guides)
        const slug = url.replace(
          /^https:\/\/gmt-dox\.northguild\.workers\.dev/,
          "",
        );
        expect(guideAllowList.has(slug), `guide allow-list has ${slug}`).toBe(
          true,
        );
      }
    }
  });

  it("llms.txt format: H1, > summary, ## sections", () => {
    const corpus = JSON.parse(
      readFileSync(resolve(outGen, "gmt-corpus.json"), "utf8"),
    ) as Array<{
      url: string;
      name: string;
      namespace: string;
      description: string;
    }>;

    const byNs = new Map<string, typeof corpus>();
    for (const entry of corpus) {
      if (!byNs.has(entry.namespace)) byNs.set(entry.namespace, []);
      byNs.get(entry.namespace)!.push(entry);
    }

    const sections: Array<{
      heading: string;
      links: Array<{ title: string; url: string }>;
    }> = [];
    for (const [ns, entries] of byNs) {
      entries.sort((a, b) => a.name.localeCompare(b.name));
      const links = entries.map((e) => ({
        title: e.name,
        url: `https://gmt-dox.northguild.workers.dev${e.url}.md`,
      }));
      sections.push({ heading: `Reference — ${ns}`, links });
    }
    sections.push({
      heading: "Guides",
      links: [
        {
          title: "Install",
          url: "https://gmt-dox.northguild.workers.dev/install.md",
        },
        {
          title: "Core Rules",
          url: "https://gmt-dox.northguild.workers.dev/core-rules.md",
        },
      ],
    });

    const output = renderLlmsTxt({
      title: "@northguild/gmt",
      summary: "Temporal-first date and time utilities.",
      sections,
    });

    // H1
    expect(output.startsWith("# @northguild/gmt")).toBe(true);
    // Blockquote summary (line index 2: H1, blank, then >)
    expect(output.split("\n")[2]?.startsWith("> ")).toBe(true);
    // One ## per namespace + Guides
    const sectionHeadings = output.match(/^## /gm);
    expect(sectionHeadings?.length).toBe(
      corpus.length > 0 ? new Set(corpus.map((e) => e.namespace)).size + 1 : 0,
    );
  });

  describe("stripMdx", () => {
    it("removes import/export lines", () => {
      const input = `---
title: "Install"
slug: "install"
---
import { Card } from "@astrojs/starlight/components";

Some content.

export const meta = {};
`;
      const { body } = stripFrontmatter(input);
      const result = stripMdx(body, { gmtVersion: "1.0.0" });
      expect(result).not.toMatch(/^import\s/m);
      expect(result).not.toMatch(/^export\s/m);
    });

    it("removes Starlight component tags keeping inner text", () => {
      const input = `<Card title="Getting Started">
Install the package with npm.
</Card>

<Aside type="info">
Note about installation.
</Aside>`;
      const result = stripMdx(input, { gmtVersion: "1.0.0" });
      expect(result).not.toMatch(/<Card/);
      expect(result).not.toMatch(/<\/Card>/);
      expect(result).not.toMatch(/<Aside/);
      expect(result).toContain("Install the package with npm.");
      expect(result).toContain("Note about installation.");
    });

    it("substitutes {gmtVersion}", () => {
      const input = "Current version: {gmtVersion}";
      const result = stripMdx(input, { gmtVersion: "2.5.0" });
      expect(result).toContain("2.5.0");
      expect(result).not.toContain("{gmtVersion}");
    });

    it('removes a multi-line import in full, leaving no `} from "..."` remnant', () => {
      // The old regex (`/^\s*import\s.+$/gm`) only matched an import's first
      // line, so a multi-line named import left every continuation line —
      // including the closing `} from "...";` — behind as literal text.
      const input = `import UpstreamTracker from "../../components/UpstreamTracker.astro";
import {
  filingsByKind,
  handledInGmt,
  totalFilings,
  unaffectingGmt,
} from "../../data/upstream-filings";

Some content that must survive.`;
      const result = stripMdx(input, { gmtVersion: "1.0.0" });
      expect(result).not.toMatch(/import/);
      expect(result).not.toMatch(/\}\s*from\s*["']/);
      expect(result).not.toContain("filingsByKind");
      expect(result).toContain("Some content that must survive.");
    });
  });

  describe("stripFrontmatter", () => {
    it("parses simple key-value pairs", () => {
      const input = `---
title: "My Page"
description: "A description"
slug: "my-page"
---
Body text here.`;
      const { data, body } = stripFrontmatter(input);
      expect(data.title).toBe("My Page");
      expect(data.description).toBe("A description");
      expect(data.slug).toBe("my-page");
      expect(body.trim()).toBe("Body text here.");
    });

    it("returns raw content when no frontmatter", () => {
      const input = "Just plain markdown.";
      const { data, body } = stripFrontmatter(input);
      expect(data).toEqual({});
      expect(body).toBe("Just plain markdown.");
    });
  });

  // Optional: dist-file checks (only when build output exists)
  describe("dist files (build-only)", () => {
    it("llms.txt and llms-full.txt exist in dist", () => {
      const distLlms = resolve(import.meta.dirname, "..", "dist", "llms.txt");
      const distLlmsFull = resolve(
        import.meta.dirname,
        "..",
        "dist",
        "llms-full.txt",
      );
      if (!existsSync(distLlms) || !existsSync(distLlmsFull)) {
        // Skip if not built yet
        return;
      }
      const llms = readFileSync(distLlms, "utf8");
      const llmsFull = readFileSync(distLlmsFull, "utf8");
      expect(llms).toMatch(/^# @northguild\/gmt$/m);
      expect(llms).toContain("> ");
      expect(llmsFull).toMatch(/^# @northguild\/gmt$/m);
      expect(llmsFull.length).toBeGreaterThan(llms.length);
    });

    it("sample .md route exists and is clean markdown", () => {
      const distMd = resolve(
        import.meta.dirname,
        "..",
        "dist",
        "reference",
        "zoned",
        "calculate",
        "startOfZoned.md",
      );
      if (!existsSync(distMd)) return;
      const md = readFileSync(distMd, "utf8");
      expect(md).toMatch(/^# startOfZoned$/m);
      expect(md).not.toMatch(/^---$/m); // no frontmatter
    });

    it("HTML pages still exist alongside .md routes", () => {
      const distHtml = resolve(
        import.meta.dirname,
        "..",
        "dist",
        "reference",
        "zoned",
        "calculate",
        "startOfZoned",
        "index.html",
      );
      if (!existsSync(distHtml)) return;
      const html = readFileSync(distHtml, "utf8");
      expect(html).toContain("<!DOCTYPE html>");
    });

    /** Every `.md` file under `dist`, recursively. */
    function allDistMdFiles(dir: string): string[] {
      const found: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) found.push(...allDistMdFiles(full));
        else if (entry.name.endsWith(".md")) found.push(full);
      }
      return found;
    }

    /**
     * The page text with every fenced code block removed.
     *
     * A code sample is allowed to contain anything a code sample contains, `import` lines and
     * their `} from "x";` closing line included — the mistake and scenario cards are made of
     * such samples. Only the prose around them is MDX that should have been stripped.
     */
    const proseOnly = (text: string): string =>
      text.replace(/^```[\s\S]*?^```/gm, "");

    it('no built .md or llms-full.txt leaves a stray `} from "..."` behind', () => {
      // The exact shape a multi-line import left when only its first line was
      // stripped: `import {\n  a,\n} from "x";` became a standalone leftover
      // `} from "x";` line.
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const strayImportRe = /^\}[ \t]*from[ \t]*["']/m;

      for (const file of allDistMdFiles(distDir)) {
        const text = proseOnly(readFileSync(file, "utf8"));
        expect(text, `${file} has a leftover import line`).not.toMatch(
          strayImportRe,
        );
        expect(text, `${file} has a leftover import statement`).not.toMatch(
          /^[ \t]*import[ \t]/m,
        );
      }

      const llmsFull = resolve(distDir, "llms-full.txt");
      if (existsSync(llmsFull)) {
        expect(
          proseOnly(readFileSync(llmsFull, "utf8")),
          "llms-full.txt has a leftover import line",
        ).not.toMatch(strayImportRe);
      }
    });

    it("the /upstream/ page carries no unresolved JSX expression in its .md, llms-full.txt or retrieval chunk", () => {
      // `upstream.mdx` used to compute its summary counts inline
      // (`{totalFilings}`, `{prs}`, a `{coversAll ? … : …}` ternary) —
      // `stripMdx` never evaluates JSX, so all three shipped as literal
      // braces. The counts now live in `UpstreamTracker.astro`, computed
      // from the same `upstream-filings.ts` data and rendered live; the MDX
      // body carries no expression beyond the supported `{gmtVersion}`.
      const distDir = resolve(import.meta.dirname, "..", "dist");
      const placeholderRe = /\{(totalFilings|prs|coversAll)\b/;

      const distMd = resolve(distDir, "upstream.md");
      if (existsSync(distMd)) {
        expect(readFileSync(distMd, "utf8")).not.toMatch(placeholderRe);
      }

      const llmsFull = resolve(distDir, "llms-full.txt");
      if (existsSync(llmsFull)) {
        expect(readFileSync(llmsFull, "utf8")).not.toMatch(placeholderRe);
      }

      const retrievalChunks = resolve(distDir, "retrieval-chunks.json");
      if (existsSync(retrievalChunks)) {
        const chunks = JSON.parse(
          readFileSync(retrievalChunks, "utf8"),
        ) as Array<{ url: string; text: string }>;
        const upstreamChunks = chunks.filter((c) =>
          c.url.startsWith("/upstream/"),
        );
        expect(upstreamChunks.length).toBeGreaterThan(0);
        for (const chunk of upstreamChunks) {
          expect(chunk.text).not.toMatch(placeholderRe);
          expect(chunk.text).not.toMatch(/^\}[ \t]*from[ \t]*["']/m);
          expect(chunk.text).not.toMatch(/^\s*import\s/m);
        }
      }
    });

    /*
     * The splash pages state every figure as an expression over the stats modules, and the
     * mistake and scenario cards hold their code samples in JSX props. Both are source text in
     * the `.md`, `llms-full.txt` and retrieval surfaces, which are built from the raw `.mdx`, so
     * both used to ship as JSX. `stripMdx` now evaluates the figures and renders the cards.
     *
     * A few brace pairs in these pages are prose and must survive: the `{yyyy}`, `{MM}` and
     * `{dd}` pattern tokens the formatting guides describe, and the `{RelativeUnit}` type name.
     */
    const PROSE_BRACES =
      /^\{(yyyy|MM|dd|HH|mm|ss|RelativeUnit|[A-Z][A-Za-z]*Unit)\}$/;

    const unresolvedExpressions = (text: string): string[] =>
      (text.match(/\{[A-Za-z_][^}\n]{0,80}\}/g) ?? []).filter(
        (found) => !PROSE_BRACES.test(found),
      );

    it("no built text surface carries an unevaluated JSX expression", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;

      for (const name of readdirSync(distDir).filter((f) =>
        f.endsWith(".md"),
      )) {
        expect({
          file: name,
          left: unresolvedExpressions(
            readFileSync(resolve(distDir, name), "utf8"),
          ),
        }).toEqual({ file: name, left: [] });
      }

      const llmsFull = resolve(distDir, "llms-full.txt");
      if (existsSync(llmsFull)) {
        expect(unresolvedExpressions(readFileSync(llmsFull, "utf8"))).toEqual(
          [],
        );
      }

      const retrievalChunks = resolve(distDir, "retrieval-chunks.json");
      if (existsSync(retrievalChunks)) {
        const chunks = JSON.parse(
          readFileSync(retrievalChunks, "utf8"),
        ) as Array<{ url: string; text: string }>;
        for (const chunk of chunks) {
          expect({
            url: chunk.url,
            left: unresolvedExpressions(chunk.text),
          }).toEqual({ url: chunk.url, left: [] });
        }
      }
    });

    /**
     * Any capitalised tag, not a list of the ones we remembered.
     *
     * This used to name nine components — exactly the nine `renderMdxComponents` handles — so it
     * mirrored the handler list instead of checking it, and `<UpstreamDefects />` shipped raw into
     * every text surface while the gate stayed green (CORE-8 review, #253). A lowercase HTML tag is
     * fine in Markdown; an uppercase one is a component that never rendered.
     *
     * The lookbehind keeps TypeScript generics out: a signature like `RoundingOptions<DateUnit>`
     * in a documented result is not a tag, and a `<` that follows an identifier character never
     * opens one.
     */
    const rawComponentTags = (text: string): string[] =>
      text.match(/(?<![A-Za-z0-9_])<\/?[A-Z][A-Za-z0-9]*(?=[\s/>])/g) ?? [];

    it("no built text surface carries a raw component tag", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;

      for (const name of readdirSync(distDir).filter((f) =>
        f.endsWith(".md"),
      )) {
        expect({
          file: name,
          left: rawComponentTags(readFileSync(resolve(distDir, name), "utf8")),
        }).toEqual({ file: name, left: [] });
      }

      const llmsFull = resolve(distDir, "llms-full.txt");
      if (existsSync(llmsFull)) {
        expect(rawComponentTags(readFileSync(llmsFull, "utf8"))).toEqual([]);
      }

      const retrievalChunks = resolve(distDir, "retrieval-chunks.json");
      if (existsSync(retrievalChunks)) {
        const chunks = JSON.parse(
          readFileSync(retrievalChunks, "utf8"),
        ) as Array<{ url: string; text: string }>;
        for (const chunk of chunks) {
          expect({
            url: chunk.url,
            left: rawComponentTags(chunk.text),
          }).toEqual({ url: chunk.url, left: [] });
        }
      }
    });

    it("a rendered mistake card keeps its code samples whole", () => {
      const llmsFull = resolve(
        import.meta.dirname,
        "..",
        "dist",
        "llms-full.txt",
      );
      if (!existsSync(llmsFull)) return;

      const text = readFileSync(llmsFull, "utf8");
      // The import line of a sample sits at column 0 inside a fence: the import rule has to
      // leave fenced code alone, or the sample loses the line that names the function.
      expect(text).toContain('import { isBeforeDate } from "@northguild/gmt";');
      expect(text).toContain("### Using string comparison for dates");
    });
  });
});
