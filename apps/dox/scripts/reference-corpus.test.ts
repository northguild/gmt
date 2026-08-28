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

  it("route manifest matches corpus urls one-to-one", async () => {
    const corpus = JSON.parse(
      readFileSync(resolve(outGen, "gmt-corpus.json"), "utf8"),
    ) as Array<{ url: string }>;
    const mod = await import(resolve(outGen, "route-manifest.ts"));
    const routes = mod.referenceRoutes as Set<string>;
    expect(routes.size).toBe(corpus.length);
    for (const entry of corpus) {
      expect(routes.has(entry.url), `manifest has ${entry.url}`).toBe(true);
    }
  });

  it("every widget seed references a route in the manifest", async () => {
    const mod = await import(resolve(outGen, "route-manifest.ts"));
    const routes = mod.referenceRoutes as Set<string>;
    const seeds = (
      (await import(resolve(outGen, "widget-seeds.ts"))) as {
        widgetSeeds: Array<{ route: string; fnName: string }>;
      }
    ).widgetSeeds;
    expect(seeds.length).toBeGreaterThan(300);
    for (const seed of seeds) {
      expect(routes.has(seed.route), `route for ${seed.fnName}`).toBe(true);
      expect(seed.fnName, `fnName for ${seed.route}`).toBeTruthy();
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
    for (const f of mdxFiles) {
      if (f.endsWith("index.mdx")) continue;
      const content = readFileSync(f, "utf8");
      const slugMatch = content.match(/^slug:\s*"([^"]+)"/m);
      if (!slugMatch) continue;
      const slug = slugMatch[1].startsWith("/")
        ? slugMatch[1]
        : `/${slugMatch[1]}`;
      expect(routes.has(slug), `manifest has slug ${slug} (${f})`).toBe(true);
    }
  });
});
