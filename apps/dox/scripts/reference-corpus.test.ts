import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mdxHeadings, mdxIds } from "./build-reference";
import { indexRoutes } from "./build-utils/reference-urls";
import { headingAnchors } from "./build-utils/type-usage";
import type { CorpusEntry } from "../src/reference-types";

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

function readCorpus(): CorpusEntry[] {
  return JSON.parse(
    readFileSync(resolve(outGen, "gmt-corpus.json"), "utf8"),
  ) as CorpusEntry[];
}

/** The MDX file that serves a route: `/reference/a/b/c` is `a/b/c.mdx`. */
function mdxOf(route: string): string {
  return resolve(refDir, `${route.replace(/^\/reference\//, "")}.mdx`);
}

describe("reference corpus", () => {
  it("has a non-empty corpus", () => {
    const corpus = JSON.parse(
      readFileSync(resolve(outGen, "gmt-corpus.json"), "utf8"),
    ) as Array<{ url: string; name: string; kind: string }>;
    expect(corpus.length).toBeGreaterThan(400);
  });

  it("regex MDX pages exist with a pattern literal", () => {
    if (!mdxExists) return;
    const yearMdx = readFileSync(
      resolve(refDir, "regex", "date", "year.mdx"),
      "utf8",
    );
    expect(yearMdx).toContain("const year: RegExp");
    expect(yearMdx).toContain("year.test(");
  });

  it("every corpus entry has a url, name, kind, and sourcePath", () => {
    const corpus = JSON.parse(
      readFileSync(resolve(outGen, "gmt-corpus.json"), "utf8"),
    ) as Array<Record<string, string>>;
    for (const entry of corpus) {
      expect(entry.url, `entry ${entry.name} url`).toMatch(/^\/reference\//);
      expect(entry.name, `entry name`).toBeTruthy();
      expect(entry.kind, `entry ${entry.name} kind`).toMatch(
        /^(function|type|regex)$/,
      );
      expect(entry.sourcePath, `entry ${entry.name} sourcePath`).toMatch(
        /^packages\/gmt\/src\//,
      );
    }
  });

  it("route manifest is the unique pages of the corpus plus the index routes above them", async () => {
    const corpus = readCorpus();
    const mod = await import(resolve(outGen, "route-manifest.ts"));
    const routes = mod.referenceRoutes as Set<string>;
    const pages = new Set(corpus.map((e) => e.page));
    // Several types share their function's page, so there are fewer pages than entries.
    expect(pages.size).toBeLessThan(corpus.length);
    const indexes = indexRoutes(pages);
    expect(indexes).toContain("/reference");
    expect(indexes).toContain("/reference/types");
    expect([...routes].sort()).toEqual([...pages, ...indexes].sort());
    // The manifest is written sorted.
    expect([...routes]).toEqual([...routes].sort());
  });

  it("gives every entry a page with no fragment, and a url that is that page or an anchor on it", () => {
    for (const entry of readCorpus()) {
      expect(entry.page, entry.name).toMatch(/^\/reference\/[^#]+$/);
      if (entry.inlineOn === undefined) {
        expect(entry.url, entry.name).toBe(entry.page);
      } else {
        expect(entry.kind, entry.name).toBe("type");
        expect(entry.url, entry.name).toMatch(
          new RegExp(`^${entry.page}#[a-z0-9-]+$`),
        );
      }
    }
  });

  it("documents a type on one page of its own, or on the page of the one function that uses it", () => {
    const corpus = readCorpus();
    const functions = new Map(
      corpus.filter((e) => e.kind === "function").map((e) => [e.url, e]),
    );
    const types = corpus.filter((e) => e.kind === "type");
    const inline = types.filter((e) => e.inlineOn !== undefined);
    const shared = types.filter((e) => e.inlineOn === undefined);
    expect(inline.length).toBeGreaterThan(0);
    expect(shared.length).toBeGreaterThan(0);

    for (const entry of shared) {
      expect(entry.url, entry.name).toBe(`/reference/types/${entry.name}`);
    }
    for (const entry of inline) {
      const owner = functions.get(entry.page);
      expect(owner, `${entry.name} sits on a function page`).toBeDefined();
      expect(owner!.name, entry.name).toBe(entry.inlineOn);
    }
    // No two entries share a link.
    expect(new Set(corpus.map((e) => e.url)).size).toBe(corpus.length);
  });

  it("every inline type's anchor is an id on its function's page: its heading, or its Options block", () => {
    if (!mdxExists) return;
    const inline = readCorpus().filter((e) => e.inlineOn !== undefined);
    let headed = 0;
    let inOptions = 0;
    for (const entry of inline) {
      const mdx = readFileSync(mdxOf(entry.page), "utf8");
      const fragment = entry.url.slice(entry.page.length + 1);
      // The id exists on the page, once.
      const ids = mdxIds(mdx);
      expect(
        ids.filter((id) => id === fragment),
        `${entry.page} has #${fragment} once`,
      ).toHaveLength(1);

      const headings = mdxHeadings(mdx);
      const anchors = headingAnchors(headings);
      // Under `## Types`, so a type named like an earlier section is not mistaken for it.
      const types = headings.indexOf("Types");
      const at = types < 0 ? -1 : headings.indexOf(entry.name, types + 1);
      if (at >= 0) {
        // Documented under its own heading, whose id is the anchor.
        expect(anchors[at], entry.name).toBe(fragment);
        headed++;
      } else {
        // Documented by an Options block: the anchor is set on an element there, followed
        // by the type's import line, and the type is not repeated under a heading.
        const options = mdx.slice(
          mdx.indexOf("\n## Options\n"),
          mdx.indexOf("\n## ", mdx.indexOf("\n## Options\n") + 1),
        );
        expect(options, entry.name).toContain(`<a id="${fragment}"></a>`);
        expect(options, entry.name).toContain(
          `import type { ${entry.name} } from`,
        );
        expect(mdx, entry.name).not.toContain(`### ${entry.name}\n`);
        inOptions++;
      }
      // An inline type has no page of its own, old or new.
      expect(existsSync(mdxOf(`/reference/types/${entry.name}`))).toBe(false);
      expect(
        existsSync(
          mdxOf(`/reference/${entry.namespace}/${entry.module}/${entry.name}`),
        ),
      ).toBe(false);
    }
    expect(headed).toBeGreaterThan(0);
    expect(inOptions).toBeGreaterThan(0);
  });

  it("carries the members of a type that has them, each with its name and description", () => {
    const corpus = readCorpus();
    const withMembers = corpus.filter((e) => e.members !== undefined);
    expect(withMembers.length).toBeGreaterThan(0);
    for (const entry of withMembers) {
      expect(entry.kind, entry.name).toBe("type");
      expect(entry.members!.length, entry.name).toBeGreaterThan(0);
      for (const member of entry.members!) {
        expect(member.name, entry.name).toBeTruthy();
        expect(typeof member.description, entry.name).toBe("string");
      }
    }
    const calendar = corpus.find((e) => e.name === "BusinessCalendar")!;
    expect(calendar.members!.map((m) => m.name)).toEqual([
      "weekend",
      "holidays",
      "timeZone",
    ]);
  });

  it("no two routes differ only by case", async () => {
    // macOS and Windows write `Foo.mdx` and `foo.mdx` to the same file, so such a pair
    // would ship as one page and a dangling sidebar slug.
    const mod = await import(resolve(outGen, "route-manifest.ts"));
    const routes = mod.referenceRoutes as Set<string>;
    const folded = new Map<string, string>();
    for (const route of routes) {
      const clash = folded.get(route.toLowerCase());
      expect(clash, `${route} collides with ${clash}`).toBeUndefined();
      folded.set(route.toLowerCase(), route);
    }
  });

  it("every MDX page slug is in the route manifest", async () => {
    if (!mdxExists) return;
    const mod = await import(resolve(outGen, "route-manifest.ts"));
    const routes = mod.referenceRoutes as Set<string>;
    const { readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const mdxFiles: string[] = [];
    function walk(dir: string) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(dir, e.name));
        else if (e.name.endsWith(".mdx")) mdxFiles.push(join(dir, e.name));
      }
    }
    walk(refDir);
    expect(mdxFiles.length).toBeGreaterThan(400);
    const slugs = new Set<string>();
    for (const f of mdxFiles) {
      const content = readFileSync(f, "utf8");
      const slugMatch = content.match(/^slug:\s*"([^"]+)"/m);
      // Index pages included: every generated page states its slug.
      expect(slugMatch, `${f} has a slug`).not.toBeNull();
      const slug = slugMatch![1].startsWith("/")
        ? slugMatch![1]
        : `/${slugMatch![1]}`;
      expect(routes.has(slug), `manifest has slug ${slug} (${f})`).toBe(true);
      slugs.add(slug);
    }
    // And the other way round: no route without a page behind it.
    expect([...routes].filter((r) => !slugs.has(r))).toEqual([]);
  });

  it("has an index page at every level, each with the block form of sidebar order", () => {
    if (!mdxExists) return;
    const corpus = readCorpus();
    for (const route of indexRoutes(corpus.map((e) => e.page))) {
      const file = resolve(
        refDir,
        route.replace(/^\/reference\/?/, ""),
        "index.mdx",
      );
      expect(existsSync(file), `${route} has ${file}`).toBe(true);
      const mdx = readFileSync(file, "utf8");
      expect(mdx, route).toContain(`slug: ${JSON.stringify(route.slice(1))}`);
      expect(mdx, route).toMatch(/^sidebar:\n {2}order: 0$/m);
    }
  });
});
