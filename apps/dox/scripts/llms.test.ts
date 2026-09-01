import { existsSync, readFileSync } from "node:fs";
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
  });
});
