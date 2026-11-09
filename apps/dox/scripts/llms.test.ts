import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

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
import {
  isReferenceIndex,
  namespaceEntries,
  namespaceIndexLinks,
  namespaceSections,
  namespaceTitle,
  withoutLinks,
  renderLlmsFull,
  renderLlmsTxt,
  type LlmsSection,
} from "../src/lib/llms";
import { namespaceSummary } from "../src/lib/namespace-summary";
import type { CorpusEntry } from "../src/reference-types";

const BASE = "https://northguild.dev/gmt";

function readCorpus(): CorpusEntry[] {
  return JSON.parse(
    readFileSync(resolve(outGen, "gmt-corpus.json"), "utf8"),
  ) as CorpusEntry[];
}
import { INDUSTRY_TAG_IDS, industryTag } from "../src/lib/industry-tags";
import { stripFrontmatter, stripMdx } from "../src/lib/page-markdown";

import { distDirOrSkip as distRootOrSkip } from "./dist-dir";

/** The built pages: `dist/gmt`, or null without a build. */
function distDirOrSkip(): string | null {
  const root = distRootOrSkip();
  return root === null ? null : resolve(root, "gmt");
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

  it("withoutLinks keeps a description's words and drops its links", () => {
    expect(
      withoutLinks(
        "Read from [UNECE's D.21B page](http://web.archive.org/web/x/tred2379.htm); see `x`.",
      ),
    ).toBe("Read from UNECE's D.21B page; see `x`.");
    expect(withoutLinks("No link here.")).toBe("No link here.");
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

    const mod = await import(resolve(outGen, "route-manifest.ts"));
    const routes = mod.referenceRoutes as Set<string>;

    // The sections llms.txt.ts builds, from the function it builds them with.
    const namespaces = namespaceEntries(readCorpus());
    // The namespace files' own URLs are not routes of the manifest; their entries are.
    const sections: LlmsSection[] = [
      {
        heading: "Reference",
        links: namespaceIndexLinks(namespaces, BASE, namespaceSummary).slice(
          0,
          1,
        ),
      },
      ...namespaces.flatMap((ns) => namespaceSections(ns, BASE)),
    ];

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
          url: `https://northguild.dev/gmt/${rel}.md`,
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
    expect(linkUrls).toContain(`${BASE}/reference.md`);
    for (const url of linkUrls) {
      if (/\/reference(\/|\.md$)/.test(url)) {
        // Strip leading site origin and .md suffix
        const slug = url
          .replace(/^https:\/\/northguild\.dev\/gmt/, "")
          .replace(/\.md$/, "");
        expect(routes.has(slug), `manifest has ${slug}`).toBe(true);
      } else if (url.includes("/mistakes/")) {
        const slug = url.replace(/^https:\/\/northguild\.dev\/gmt/, "");
        expect(
          mistakeAllowList.has(slug),
          `mistake allow-list has ${slug}`,
        ).toBe(true);
      } else {
        // Guide URLs checked against allow-list (keep .md for guides)
        const slug = url.replace(/^https:\/\/northguild\.dev\/gmt/, "");
        expect(guideAllowList.has(slug), `guide allow-list has ${slug}`).toBe(
          true,
        );
      }
    }
  });

  it("gives every corpus namespace its own one-sentence summary", () => {
    const namespaces = namespaceEntries(readCorpus()).map((n) => n.namespace);
    expect(namespaces.length).toBeGreaterThanOrEqual(18);
    const boilerplate = /^The \S+ namespace of @northguild\/gmt, by module\.?$/;
    for (const namespace of namespaces) {
      const summary = namespaceSummary(namespace);
      expect(summary, namespace).not.toMatch(boilerplate);
      expect(summary.length, namespace).toBeGreaterThanOrEqual(30);
      expect(summary.length, namespace).toBeLessThanOrEqual(160);
      expect(summary.endsWith("."), namespace).toBe(true);
    }
    expect(new Set(namespaces.map(namespaceSummary)).size).toBe(
      namespaces.length,
    );
  });

  it("words an industry's namespace differently from the industry's own definition", () => {
    for (const id of ["workforce", "transport", "intermodal", "gnss"]) {
      expect(namespaceSummary(id), id).not.toBe(industryTag(id)!.definition);
    }
  });

  it("fails for a namespace with no authored summary", () => {
    expect(() => namespaceSummary("no-such-namespace")).toThrow(/no summary/);
  });

  it("llms.txt format: H1, > summary, ## sections", () => {
    const corpus = readCorpus();
    const namespaces = namespaceEntries(corpus);
    const sections: LlmsSection[] = [
      {
        heading: "Reference",
        links: namespaceIndexLinks(namespaces, BASE, namespaceSummary),
      },
      {
        heading: "Guides",
        links: [
          { title: "Install", url: "https://northguild.dev/gmt/install.md" },
        ],
      },
      {
        heading: "Optional",
        links: [{ title: "Changelog", url: `${BASE}/c.md` }],
      },
    ];

    const output = renderLlmsTxt({
      title: "@northguild/gmt",
      summary: "Temporal-first date and time utilities.",
      sections,
    });

    // Exactly one H1, then the blockquote summary (line index 2).
    expect(output.match(/^# /gm)).toHaveLength(1);
    expect(output.startsWith("# @northguild/gmt")).toBe(true);
    expect(output.split("\n")[2]?.startsWith("> ")).toBe(true);
    // No namespace section in the root file; Optional is last.
    expect(output).not.toMatch(/^## Reference — /m);
    const headings = [...output.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual(["Reference", "Guides", "Optional"]);
    expect(headings.at(-1)).toBe("Optional");
    // The Reference section holds reference.md plus one link per namespace that has a page.
    const links = sections[0].links.map((l) => l.url);
    expect(links).toEqual([
      `${BASE}/reference.md`,
      ...new Set(
        corpus
          .filter((e) => e.inlineOn === undefined)
          .map((e) => `${BASE}/reference/${e.namespace}/llms.txt`),
      ),
    ]);
  });

  it("links each reference entry to the .md twin of its page, and skips types with no page", () => {
    const corpus = readCorpus();
    const inline = corpus.filter((e) => e.inlineOn !== undefined);
    expect(inline.length).toBeGreaterThan(0);

    const namespaces = namespaceEntries(corpus);
    const links = namespaces.flatMap((ns) =>
      namespaceSections(ns, BASE).flatMap((s) => s.links),
    );
    expect(links).toHaveLength(corpus.length - inline.length);
    const urls = links.map((l) => l.url);
    // No fragment, and no file listed twice.
    for (const url of urls) expect(url).toMatch(/^[^#]+\.md$/);
    expect(new Set(urls).size).toBe(urls.length);
    for (const entry of inline) {
      expect(urls, entry.name).not.toContain(`${BASE}${entry.url}.md`);
    }
  });

  it("namespaceEntries skips an inline type and groups a shared one under Types", () => {
    const entry = (over: Partial<CorpusEntry>): CorpusEntry => ({
      url: "",
      page: "",
      name: "",
      namespace: "transport",
      module: "calculate",
      kind: "type",
      signature: "",
      description: "",
      sourcePath: "",
      examples: [],
      ...over,
    });
    const namespaces = namespaceEntries([
      entry({
        name: "dwellTime",
        kind: "function",
        url: "/reference/transport/calculate/dwellTime",
        page: "/reference/transport/calculate/dwellTime",
        description: "Measure a dwell.",
      }),
      entry({
        name: "Dwell",
        url: "/reference/transport/calculate/dwellTime#dwell",
        page: "/reference/transport/calculate/dwellTime",
        inlineOn: "dwellTime",
      }),
      entry({
        name: "Interval",
        namespace: "types",
        url: "/reference/types/Interval",
        page: "/reference/types/Interval",
      }),
    ]);
    expect(namespaces.map((n) => n.namespace)).toEqual(["transport", "types"]);
    expect(namespaceSections(namespaces[0], "https://x.test")).toEqual([
      {
        heading: "calculate",
        links: [
          {
            title: "dwellTime",
            url: "https://x.test/reference/transport/calculate/dwellTime.md",
            description: "Measure a dwell.",
          },
        ],
      },
    ]);
    expect(namespaceSections(namespaces[1], "https://x.test")).toEqual([
      {
        heading: "Types",
        links: [
          {
            title: "Interval",
            url: "https://x.test/reference/types/Interval.md",
            description: "",
          },
        ],
      },
    ]);
    expect(namespaceTitle("types")).toBe("@northguild/gmt shared types");
    expect(namespaceTitle("zoned")).toBe("@northguild/gmt/zoned");
  });

  it("isReferenceIndex names the generated index pages and nothing else", () => {
    for (const rel of [
      "reference/index",
      "reference/types/index",
      "reference/plain/index",
      "reference/plain/calculate/index",
    ]) {
      expect(isReferenceIndex(rel), rel).toBe(true);
    }
    for (const rel of [
      "reference/plain/calculate/addDate",
      "reference/types/Interval",
      "guides/index",
      "index",
      "reference/regex/date/index-of",
    ]) {
      expect(isReferenceIndex(rel), rel).toBe(false);
    }
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

    it("drops the icon the API Reference root puts beside an industry, keeping the line", () => {
      const input = `import Icon from "../../../components/Icon.astro";

- <Icon name="industry-transport" size="1.1em" class="gmt-ref-industry-icon" /> [Transport](/reference/transport): Legs and dwell.`;
      const result = stripMdx(input, { gmtVersion: "1.0.0" }).trim();
      expect(result).not.toMatch(/<Icon|import/);
      expect(result.replace(/\s+/g, " ")).toBe(
        "- [Transport](/gmt/reference/transport/): Legs and dwell.",
      );
    });

    it("renders a tool page's layout to prose, its key point named and its widget gone", () => {
      const input = `<ToolLayout useCase="multi-leg freight ETAs">
  <Fragment slot="keypoint">Every handoff is an exact instant.</Fragment>
  <Fragment slot="intro">Each leg is a departure, a duration and a zone.</Fragment>

  <DeliveryScheduler fullbleed />

  <Fragment slot="after">**Worth trying:** a missed connection.</Fragment>
</ToolLayout>`;
      const result = stripMdx(input, { gmtVersion: "1.0.0" });
      expect(result).toContain("**Key point — multi-leg freight ETAs**");
      expect(result).toContain("Every handoff is an exact instant.");
      expect(result).toContain(
        "Each leg is a departure, a duration and a zone.",
      );
      expect(result).toContain("**Worth trying:** a missed connection.");
      expect(result).not.toMatch(/(?<![A-Za-z0-9_])<\/?[A-Z]/);
    });

    /*
     * The same question the built-surface gate asks further down, asked of the source instead, so
     * it needs no build and runs in every `vitest`. The built gate is skipped when `dist` is
     * missing, which is right for a 45-second build but means a component added to a page and not
     * to `renderMdxComponents` is invisible locally until CI builds the site. Every page's `.md`
     * is this same `stripMdx` over this same file, so a tag left here is a tag that ships.
     */
    it("leaves no raw component tag in any page's source once stripped", () => {
      const docsDir = resolve(
        import.meta.dirname,
        "..",
        "src",
        "content",
        "docs",
      );
      const pages = (
        readdirSync(docsDir, { recursive: true }) as string[]
      ).filter((f) => /\.mdx?$/.test(f));
      expect(pages.length).toBeGreaterThan(0);

      const left = pages.flatMap((name) => {
        const { body } = stripFrontmatter(
          readFileSync(resolve(docsDir, name), "utf8"),
        );
        const tags =
          stripMdx(body, { gmtVersion: "1.0.0" }).match(
            /(?<![A-Za-z0-9_])<\/?[A-Z][A-Za-z0-9]*(?=[\s/>])/g,
          ) ?? [];
        return tags.length > 0 ? [{ file: name, tags }] : [];
      });
      expect(left).toEqual([]);
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
      const distLlms = resolve(
        import.meta.dirname,
        "..",
        "dist",
        "gmt",
        "llms.txt",
      );
      const distLlmsFull = resolve(
        import.meta.dirname,
        "..",
        "dist",
        "gmt",
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

    it("llms.txt opens with the summary and lists its sections in order", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const llms = readFileSync(resolve(distDir, "llms.txt"), "utf8");
      expect(llms.split("\n")[2]).toMatch(
        /^> GMT \(`@northguild\/gmt`\) is a date and time library for JavaScript and TypeScript built on TC39 Temporal\./,
      );
      const headings = [...llms.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
      const at = (heading: string): number => {
        const found = headings.indexOf(heading);
        expect(found, `${heading} is a section`).toBeGreaterThanOrEqual(0);
        return found;
      };
      const order = [
        "Start here",
        "Guides",
        "Reference",
        "Industries",
        "Tools",
        "Scenarios",
        "Mistakes",
        "Migrate",
        "Checks",
        "Optional",
      ].map(at);
      expect(headings).not.toContain("Install");
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(headings.at(-1)).toBe("Optional");
      expect(headings.filter((h) => h.startsWith("Reference — "))).toEqual([]);
      expect(llms.match(/^# /gm)).toHaveLength(1);
    });

    /** The root file's size budget: the llmstxt.org rule that the file fits in context. Never raised; move detail into a subpath file instead. */
    const ROOT_BUDGET = 64 * 1024;

    /** The URLs a text file links, and the file in `dist/gmt` each names. */
    const linkedFiles = (distDir: string, text: string) =>
      [...text.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)].map((m) => {
        const url = m[1]!.replace(/#.*$/, "");
        expect(url.startsWith(`${BASE}/`), url).toBe(true);
        const path = url.slice(BASE.length + 1);
        return {
          url,
          file: resolve(distDir, path === "" ? "index.html" : path),
        };
      });

    const rootSize = (() => {
      const distDir = distDirOrSkip();
      const file = distDir && resolve(distDir, "llms.txt");
      return file && existsSync(file) ? statSync(file).size : "not built";
    })();

    it(`llms.txt is at most 64 KiB (${rootSize} bytes now)`, () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      expect(statSync(resolve(distDir, "llms.txt")).size).toBeLessThanOrEqual(
        ROOT_BUDGET,
      );
    });

    it("every link in llms.txt and in each namespace llms.txt resolves to a file in dist/gmt", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const files = [
        resolve(distDir, "llms.txt"),
        ...namespaceEntries(readCorpus()).map(({ namespace }) =>
          resolve(distDir, "reference", namespace, "llms.txt"),
        ),
      ];
      const missing = files.flatMap((file) =>
        linkedFiles(distDir, readFileSync(file, "utf8"))
          .filter(({ file: target }) => !existsSync(target))
          .map(({ url }) => `${relative(distDir, file)}: ${url}`),
      );
      expect(missing).toEqual([]);
    });

    it("each namespace llms.txt opens with an H1 and a blockquote that links the root file, and the root links every one", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const root = readFileSync(resolve(distDir, "llms.txt"), "utf8");
      const section = root.slice(root.indexOf("\n## Reference\n"));
      const rootLinks = new Set(
        linkedFiles(
          distDir,
          section.slice(0, section.indexOf("\n## Industries")),
        )
          .map(({ url }) => url)
          .filter((url) => url.endsWith("/llms.txt")),
      );
      const namespaces = namespaceEntries(readCorpus()).map((n) => n.namespace);
      expect(namespaces.length).toBeGreaterThan(0);
      // The directory holds exactly the corpus's namespaces, each linked once from the root.
      expect(
        readdirSync(resolve(distDir, "reference"), { withFileTypes: true })
          .filter(
            (d) =>
              d.isDirectory() &&
              existsSync(resolve(distDir, "reference", d.name, "llms.txt")),
          )
          .map((d) => d.name)
          .sort(),
      ).toEqual([...namespaces].sort());
      expect([...rootLinks].sort()).toEqual(
        namespaces.map((ns) => `${BASE}/reference/${ns}/llms.txt`).sort(),
      );
      for (const ns of namespaces) {
        const lines = readFileSync(
          resolve(distDir, "reference", ns, "llms.txt"),
          "utf8",
        ).split("\n");
        expect(lines[0], ns).toBe(`# ${namespaceTitle(ns)}`);
        expect(lines[2], ns).toMatch(/^> /);
        expect(lines[2], ns).toContain(`(${BASE}/llms.txt)`);
      }
    });

    it("lists each non-inline entry's .md twin in exactly one namespace llms.txt", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const corpus = readCorpus();
      const listed = new Map<string, number>();
      for (const { namespace } of namespaceEntries(corpus)) {
        const text = readFileSync(
          resolve(distDir, "reference", namespace, "llms.txt"),
          "utf8",
        );
        for (const { url } of linkedFiles(distDir, text)) {
          if (url.endsWith(".md")) listed.set(url, (listed.get(url) ?? 0) + 1);
        }
      }
      const wrong = corpus
        .filter((e) => e.inlineOn === undefined)
        .map((e) => `${BASE}${e.page}.md`)
        .filter((url) => listed.get(url) !== 1);
      expect(wrong).toEqual([]);
    });

    it("llms.txt lists Install first under Start here, and compare, bundle-size and upstream under Migrate", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const llms = readFileSync(resolve(distDir, "llms.txt"), "utf8");
      const section = (heading: string): string[] => {
        const start = llms.indexOf(`\n## ${heading}\n`);
        expect(start, `${heading} is a section`).toBeGreaterThanOrEqual(0);
        const rest = llms.slice(start + heading.length + 5);
        const end = rest.search(/^## /m);
        return (end < 0 ? rest : rest.slice(0, end))
          .split("\n")
          .filter((line) => line.startsWith("- ["));
      };
      const startHere = section("Start here");
      expect(startHere[0]).toMatch(/\/install\.md\)/);
      const migrate = section("Migrate");
      for (const slug of [
        "compare",
        "bundle-size",
        "upstream",
        "native-engines",
      ]) {
        const link = new RegExp(`/${slug}\\.md\\)`);
        expect(
          migrate.some((line) => link.test(line)),
          `${slug} is under Migrate`,
        ).toBe(true);
        expect(
          startHere.some((line) => link.test(line)),
          `${slug} is not under Start here`,
        ).toBe(false);
      }
    });

    it("llms-full.txt follows the sidebar: a guide after the start pages, the migrate pages last", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const full = readFileSync(resolve(distDir, "llms-full.txt"), "utf8");
      const urls = [...full.matchAll(/^> source: (\S+)$/gm)].map((m) => m[1]!);
      const path = (url: string) => url.replace(/^.*\/gmt\//, "");
      expect(urls.length).toBeGreaterThan(0);
      const lastStart = urls.findIndex((url) => path(url) === "why-gmt.md");
      expect(lastStart).toBeGreaterThanOrEqual(0);
      expect(path(urls[lastStart + 1]!)).toMatch(/^guides\//);
      const firstMigrate = urls.findIndex((url) =>
        url.endsWith("migrate/index.md"),
      );
      expect(firstMigrate).toBeGreaterThan(lastStart);
      for (const url of urls.slice(firstMigrate)) {
        expect(path(url), url).toMatch(
          /^(migrate\/|compare\/behaviour\.md$|compare\.md$|bundle-size\.md$|upstream\.md$|native-engines\.md$)/,
        );
      }
    });

    it("llms.txt links the changelog, and neither llms-full.txt nor the retrieval chunks carry it", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const llms = readFileSync(resolve(distDir, "llms.txt"), "utf8");
      expect(llms).toMatch(/^## Optional$/m);
      // Each package's index page is linked; its release-line pages are not (the index lists them).
      const routes = [
        "changelog/index",
        "changelog/gmt-eslint/index",
        "changelog/gmt-oxlint/index",
        "changelog/gmt-biome/index",
      ];
      for (const route of routes) {
        expect(llms, `llms.txt links ${route}`).toMatch(
          new RegExp(`^- \\[[^\\]]*\\]\\(https://[^)]*/${route}\\.md\\)`, "m"),
        );
      }
      expect(llms).not.toMatch(/\/changelog\/(?:[\w-]+\/)?\d+-\d+\.md/);
      const full = readFileSync(resolve(distDir, "llms-full.txt"), "utf8");
      expect(full).not.toContain("## @burglekitt/");
      const chunksPath = resolve(distDir, "retrieval-chunks.json");
      if (existsSync(chunksPath)) {
        const chunks = JSON.parse(readFileSync(chunksPath, "utf8")) as Array<{
          url: string;
        }>;
        expect(
          chunks.filter((chunk) => chunk.url.startsWith("/changelog/")),
        ).toEqual([]);
      }
    });

    it("the changelog's .md twin keeps the memorial plate's logo and sentence without its wrapper", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const twin = readFileSync(
        resolve(distDir, "changelog", "index.md"),
        "utf8",
      );
      expect(twin).toContain(
        "![The @burglekitt organization logo](/gmt/burglekitt-logo.png)",
      );
      expect(twin).toMatch(
        /\*\*In memoriam: @burglekitt\.\*\* .*\[install @northguild\/gmt\]\(\/gmt\/install\/\)/,
      );
      expect(twin).not.toContain("<div");
    });

    describe("the Industry line of a twin matches the tags its page shows", () => {
      const docs = resolve(import.meta.dirname, "..", "src", "content", "docs");

      /** The `industries` a generated page declares, as the labels its twin prints. */
      const declared = (file: string): string[] =>
        (/^industries: \[(.*)\]$/m.exec(readFileSync(file, "utf8"))?.[1] ?? "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);

      /** The first line of a twin after its heading that starts `Industry:`, or undefined. */
      const industryLine = (twin: string): string | undefined =>
        twin.split("\n").find((line) => line.startsWith("Industry: "));

      /** Every function page under one namespace, as `[file, twin path]`. */
      const pagesOf = (namespace: string): [string, string][] => {
        const root = resolve(docs, "reference", namespace);
        return readdirSync(root, { recursive: true, withFileTypes: true })
          .filter(
            (f) =>
              f.isFile() && f.name.endsWith(".mdx") && f.name !== "index.mdx",
          )
          .map((f): [string, string] => {
            const file = resolve(f.parentPath, f.name);
            const slug = /^slug: "(.*)"$/m.exec(
              readFileSync(file, "utf8"),
            )![1]!;
            return [file, `${slug}.md`];
          });
      };

      it("says Core on a general function and Workforce on a workforce one", () => {
        const distDir = distDirOrSkip();
        if (distDir === null || !mdxExists) return;
        const [, plain] = pagesOf("plain")[0]!;
        const [, workforce] = pagesOf("workforce")[0]!;
        expect(
          industryLine(readFileSync(resolve(distDir, plain), "utf8")),
        ).toBe("Industry: Core");
        expect(
          industryLine(readFileSync(resolve(distDir, workforce), "utf8")),
        ).toBe("Industry: Workforce");
      });

      it("says Core, Workforce on a shared type that general and workforce functions both reach", () => {
        const distDir = distDirOrSkip();
        if (distDir === null || !mdxExists) return;
        const types = resolve(docs, "reference", "types");
        const shared = readdirSync(types)
          .filter((name) => name.endsWith(".mdx") && name !== "index.mdx")
          .find((name) => {
            const ids = declared(resolve(types, name));
            return ids.includes("core") && ids.includes("workforce");
          });
        expect(
          shared,
          "a type that Core and workforce functions share",
        ).toBeDefined();
        const twin = readFileSync(
          resolve(distDir, "reference", "types", `${shared!.slice(0, -4)}.md`),
          "utf8",
        );
        expect(industryLine(twin)).toBe("Industry: Core, Workforce");
      });

      it("lists Core first on the tools index, then each industry a tool declares", () => {
        const distDir = distDirOrSkip();
        if (distDir === null) return;
        const tools = resolve(docs, "tools");
        const used = new Set(
          readdirSync(tools)
            .filter((name) => name.endsWith(".mdx") && name !== "index.mdx")
            .flatMap((name) => declared(resolve(tools, name))),
        );
        const expected = INDUSTRY_TAG_IDS.filter((id) => used.has(id)).map(
          (id) => industryTag(id)!.label,
        );
        expect(expected[0]).toBe("Core");
        expect(
          industryLine(
            readFileSync(resolve(distDir, "tools", "index.md"), "utf8"),
          ),
        ).toBe(`Industry: ${expected.join(", ")}`);
      });

      it("gives the home page no Industry line", () => {
        const distDir = distDirOrSkip();
        if (distDir === null) return;
        expect(
          industryLine(readFileSync(resolve(distDir, "index.md"), "utf8")),
        ).toBeUndefined();
      });
    });

    it("no llms.txt line ends in a bare `>` or `: >`", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const llms = readFileSync(resolve(distDir, "llms.txt"), "utf8");
      for (const line of llms.split("\n").slice(3)) {
        expect(line, line).not.toMatch(/(?:^|: | )>$/);
      }
    });

    it("the home page has a Markdown twin", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const twin = resolve(distDir, "index.md");
      expect(existsSync(twin), "index.md").toBe(true);
      expect(readFileSync(twin, "utf8")).toMatch(/^# @northguild\/gmt$/m);
    });

    // The two pages with layout `<div>`s and indented cards: no wrapper survives, and no prose
    // line outside a fence is indented, which Markdown would read as a code block.
    it.each(["index.md", "why-gmt.md"])("%s keeps no layout HTML", (file) => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;
      const prose = readFileSync(resolve(distDir, file), "utf8").replace(
        /^[ \t]*```[\s\S]*?^[ \t]*```/gm,
        "",
      );
      expect(prose).not.toMatch(/^[ \t]*<\/?div\b/m);
      expect(prose).not.toMatch(/^(?: {4}|\t)\S/m);
    });

    it("sample .md route exists and is clean markdown", () => {
      const distMd = resolve(
        import.meta.dirname,
        "..",
        "dist",
        "gmt",
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
        "gmt",
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
        // The changelog is the release record, verbatim: its entries indent code fences inside
        // list items, which `proseOnly` does not strip.
        if (file.includes(`${sep}changelog${sep}`)) continue;
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
      const distDir = resolve(import.meta.dirname, "..", "dist", "gmt");
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

    /**
     * Every `.md` the build wrote, at any depth.
     *
     * Both gates below used to read `readdirSync(distDir)`, which lists one directory. That is the
     * four pages at the root of `dist`; the other 792 — every tool, guide, scenario, mistake and
     * reference page — sit in subdirectories and were never opened. So the gates passed while each
     * `/tools/*.md` shipped its widget as a raw tag (`<BillingDeadlines fullbleed />`), which is
     * exactly what "no built text surface carries a raw component tag" exists to stop.
     */
    const builtMarkdown = (distDir: string): string[] =>
      (readdirSync(distDir, { recursive: true }) as string[]).filter((f) =>
        f.endsWith(".md"),
      );

    it("no built text surface carries an unevaluated JSX expression", () => {
      const distDir = distDirOrSkip();
      if (distDir === null) return;

      for (const name of builtMarkdown(distDir)) {
        // The changelog is the release record, verbatim: its code samples hold braces.
        if (name.startsWith("changelog/")) continue;
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

      for (const name of builtMarkdown(distDir)) {
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
        "gmt",
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

/**
 * Every `.md` URL the site hands out resolves to a built file.
 *
 * `llms.txt`, `llms-full.txt` and `_redirects` each build `.md` URLs on their own, and the twin
 * route decides where the files are. When the two disagreed, `reference/workforce.md` and
 * `reference.md` went to 404 while every page's own alternate link still resolved.
 */
describe("dist .md links resolve (build-only)", () => {
  const SITE = "https://northguild.dev";

  /** The built file a `/gmt/….md` path names, or a redirect's target followed to the end. */
  function resolveMd(
    dist: string,
    path: string,
    redirects: Map<string, string>,
  ): boolean {
    const seen = new Set<string>();
    let current = path;
    while (!existsSync(resolve(dist, `.${current}`))) {
      const next = redirects.get(current);
      if (next === undefined || seen.has(current)) return false;
      seen.add(current);
      current = next;
    }
    return true;
  }

  /** The `_redirects` rules: source path to target path. */
  function redirectRules(dist: string): Map<string, string> {
    return new Map(
      readFileSync(resolve(dist, "_redirects"), "utf8")
        .split("\n")
        .map((line) => line.trim().split(/\s+/))
        .filter((parts) => parts.length >= 2 && parts[0]?.startsWith("/"))
        .map((parts): [string, string] => [parts[0] ?? "", parts[1] ?? ""]),
    );
  }

  it.each(["llms.txt", "llms-full.txt"])(
    "every .md link in %s is a built file",
    (file) => {
      const dist = distRootOrSkip();
      if (dist === null) return;
      const text = readFileSync(resolve(dist, "gmt", file), "utf8");
      const urls = [
        ...new Set(
          text.match(/https:\/\/northguild\.dev\/gmt\/[^\s)>"]*?\.md\b/g) ?? [],
        ),
      ];
      expect(urls.length).toBeGreaterThan(100);
      const missing = urls.filter(
        (url) => !existsSync(resolve(dist, `.${url.slice(SITE.length)}`)),
      );
      expect(missing).toEqual([]);
    },
  );

  it("every _redirects rule to a .md twin ends at a built file", () => {
    const dist = distRootOrSkip();
    if (dist === null) return;
    const redirects = redirectRules(dist);
    const twins = [...redirects].filter(([, target]) => target.endsWith(".md"));
    expect(twins.length).toBeGreaterThan(0);
    const broken = twins
      .filter(([, target]) => !resolveMd(dist, target, redirects))
      .map(([source, target]) => `${source} -> ${target}`);
    expect(broken).toEqual([]);
  });
});
