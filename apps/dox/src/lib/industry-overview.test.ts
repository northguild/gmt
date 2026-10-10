/// <reference types="vitest/globals" />

/**
 * The text on an industry namespace's overview page: every industry layer has some, every
 * function it names exists in that layer, every link leads to a page, and the wording keeps
 * the owner's content rules.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import corpus from "../generated/reference/gmt-corpus.json";
import { INDUSTRY_OVERVIEWS, overviewFunctionNames } from "./industry-overview";
import { INDUSTRY_LAYER_IDS, industryTag } from "./industry-tags";

const DOCS_DIR = path.resolve(import.meta.dirname, "..", "content", "docs");

/** The content file a site path (`/tools/dwell-ledger/`) is served from, if any. */
function contentFile(href: string): string | undefined {
  const rel = href.replace(/^\/|\/$/g, "");
  return [`${rel}.mdx`, `${rel}.md`, `${rel}/index.mdx`]
    .map((file) => path.join(DOCS_DIR, file))
    .find(existsSync);
}

const everyText = (id: string) => {
  const overview = INDUSTRY_OVERVIEWS[id]!;
  return [
    overview.about,
    ...overview.solves.flatMap((p) => [p.problem, p.answer]),
  ];
};

describe("industry overviews", () => {
  it("has text for every industry layer and for nothing else", () => {
    expect(Object.keys(INDUSTRY_OVERVIEWS).sort()).toEqual(
      [...INDUSTRY_LAYER_IDS].sort(),
    );
  });

  it.each(INDUSTRY_LAYER_IDS)("%s: states three to five problems", (id) => {
    const { solves } = INDUSTRY_OVERVIEWS[id]!;
    expect(solves.length).toBeGreaterThanOrEqual(3);
    expect(solves.length).toBeLessThanOrEqual(5);
  });

  it.each(INDUSTRY_LAYER_IDS)(
    "%s: names only functions the layer exports, and names at least one per problem",
    (id) => {
      const exported = new Set(
        corpus
          .filter((e) => e.namespace === id && e.kind === "function")
          .map((e) => e.name),
      );
      for (const point of INDUSTRY_OVERVIEWS[id]!.solves) {
        const names = overviewFunctionNames(point.answer);
        expect(names.length, point.answer).toBeGreaterThan(0);
        expect(
          names.filter((name) => !exported.has(name)),
          point.answer,
        ).toEqual([]);
      }
    },
  );

  it.each(INDUSTRY_LAYER_IDS)(
    "%s: every link leads to a page, and each part ends its sentence",
    (id) => {
      for (const point of INDUSTRY_OVERVIEWS[id]!.solves) {
        expect(point.problem, "problem ends with a full stop").toMatch(/\.$/);
        expect(point.answer, "answer ends with a full stop").toMatch(/\.$/);
        expect(point.problem, "problem names no function").not.toMatch(/\{\{/);
        for (const link of point.see) {
          expect(contentFile(link.href), link.href).toBeDefined();
        }
      }
    },
  );

  it.each(INDUSTRY_LAYER_IDS)(
    "%s: points at the guide the tag names, under that guide's own title",
    (id) => {
      const guide = industryTag(id)!.guide;
      expect(guide, "the tag has a guide").toBeDefined();
      const file = contentFile(guide!);
      expect(file).toBeDefined();
      const title = readFileSync(file!, "utf8").match(
        /^title:\s*"?(.*?)"?\s*$/m,
      )?.[1];
      expect(INDUSTRY_OVERVIEWS[id]!.guideTitle).toBe(title);
    },
  );

  it.each(INDUSTRY_LAYER_IDS)(
    "%s: states no number, names no law, and does not call the library GMT",
    (id) => {
      for (const text of everyText(id)) {
        // A figure typed here would go stale; the pages state none. A function name (`{{..}}`)
        // and the standard's own name (X12) are not figures.
        expect(text.replace(/\{\{\w+\}\}|\bX12\b/g, ""), "digit").not.toMatch(
          /\d/,
        );
        expect(text, "GMT").not.toMatch(/\bGMT\b/);
        expect(text, "law").not.toMatch(
          /\b(act|statute|regulation|regulator|docket|section|§|cfr|usc)\b/i,
        );
      }
    },
  );
});

describe("generated reference pages", () => {
  const REFERENCE = path.join(DOCS_DIR, "reference");
  const pages = (readdirSync(REFERENCE, { recursive: true }) as string[])
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const source = readFileSync(path.join(REFERENCE, file), "utf8");
      const industries = source
        .match(/^---\n([\s\S]*?)\n---/)?.[1]
        ?.match(/^industries: \[(.*)\]$/m)?.[1];
      return { file, namespace: file.split("/")[0]!, industries };
    });

  it("tags every page of an industry namespace, its overview and module indexes included, with that industry", () => {
    for (const id of INDUSTRY_LAYER_IDS) {
      const own = pages.filter((p) => p.namespace === id);
      expect(own.length, id).toBeGreaterThan(0);
      expect(
        own.filter((p) => p.industries !== id).map((p) => p.file),
        id,
      ).toEqual([]);
    }
  });

  it("tags no page of a general namespace, and not the reference root", () => {
    const general = pages.filter(
      (p) =>
        p.namespace !== "types" && !INDUSTRY_LAYER_IDS.includes(p.namespace),
    );
    expect(general.length).toBeGreaterThan(0);
    expect(general.filter((p) => p.industries).map((p) => p.file)).toEqual([]);
  });

  it("tags a shared type only with an industry layer", () => {
    const tagged = pages.filter((p) => p.namespace === "types" && p.industries);
    expect(
      tagged.filter((p) => !INDUSTRY_LAYER_IDS.includes(p.industries!)),
    ).toEqual([]);
  });
});
