import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import report from "../generated/bundle-size.json";
import { bundleCells, bundleRows } from "../lib/bundle-size";
import {
  formatBytes,
  polyfillFigures,
  polyfillSets,
} from "../lib/bundle-size-figures";
import { pageExpressionValues } from "../lib/page-expression-values";
import { stripMdx } from "../lib/page-markdown";

const budgets = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "..",
      "scripts",
      "bundle-size.budgets.json",
    ),
    "utf8",
  ),
) as { entries: Record<string, { minified: number }> };

type Row = { minified: number; gzipped: number; budget: number | null };
const entries = report.entries as Record<string, Row>;

describe("the bundle-size figures", () => {
  it("name the budgeted entries and the floor, and no others", () => {
    expect(Object.keys(entries).sort()).toEqual(
      [...Object.keys(budgets.entries), report.floor].sort(),
    );
  });

  it("carry the budget the repository's file states", () => {
    for (const [name, row] of Object.entries(entries)) {
      expect(row.budget, name).toBe(budgets.entries[name]?.minified ?? null);
    }
  });

  it("keep every budgeted entry within its budget", () => {
    for (const [name, row] of Object.entries(entries)) {
      if (row.budget === null) continue;
      expect(row.minified, name).toBeLessThanOrEqual(row.budget);
    }
  });

  it("measure the floor as the smallest entry", () => {
    const floor = entries[report.floor].minified;
    for (const [name, row] of Object.entries(entries)) {
      expect(row.minified, name).toBeGreaterThanOrEqual(floor);
    }
  });
});

describe("the polyfill sets", () => {
  it("list the shipped set first and the previous set second", () => {
    const flags = (
      report as { polyfills: { shipped: boolean }[] }
    ).polyfills.map((p) => p.shipped);
    expect(flags).toEqual([true, false]);
  });

  it("repeat the top-level entries in the shipped set, without the budget", () => {
    const shipped = (
      report as {
        polyfills: {
          entries: Record<string, { minified: number; gzipped: number }>;
        }[];
      }
    ).polyfills[0].entries;
    const top = Object.fromEntries(
      Object.entries(entries).map(([name, { minified, gzipped }]) => [
        name,
        { minified, gzipped },
      ]),
    );
    expect(shipped).toEqual(top);
  });
});

describe("the first GMT release on the shipped polyfill", () => {
  // The pages name it before it is published, so it is worked out from the last release on the
  // previous polyfill. Until the release, the pending changesets must make it a minor one; after
  // it, the changelog must hold it.
  const root = resolve(import.meta.dirname, "..", "..", "..", "..");
  const gmtDir = resolve(root, "packages", "gmt");
  const { previous } = polyfillSets();
  const current = (
    JSON.parse(readFileSync(resolve(gmtDir, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;

  it("is the minor release after the last one on the previous polyfill", () => {
    const [major, minor] = previous.gmt.split(".").map(Number);
    expect(polyfillFigures.firstShippedGmt).toBe(`${major}.${minor + 1}.0`);
  });

  it("is the release the pending changesets make, or one the changelog holds", () => {
    if (current === previous.gmt) {
      const changesets = resolve(root, ".changeset");
      const bumps = readdirSync(changesets)
        .filter((name) => name.endsWith(".md") && name !== "README.md")
        .flatMap((name) => {
          const text = readFileSync(resolve(changesets, name), "utf8");
          const head = /^---\n([\s\S]*?)\n?---/.exec(text)?.[1] ?? "";
          const bump = /^"@northguild\/gmt":\s*(major|minor|patch)\s*$/m.exec(
            head,
          );
          return bump ? [bump[1]] : [];
        });
      expect(bumps).toContain("minor");
      expect(bumps).not.toContain("major");
    } else {
      const changelog = readFileSync(resolve(gmtDir, "CHANGELOG.md"), "utf8");
      expect(changelog).toMatch(
        new RegExp(
          `^## ${polyfillFigures.firstShippedGmt.replaceAll(".", "\\.")}$`,
          "m",
        ),
      );
    }
  });
});

describe("the floor row's import line", () => {
  it("names the shipped polyfill's import", () => {
    const shipped = (
      report as { polyfills: { shipped: boolean; import: string }[] }
    ).polyfills.find((p) => p.shipped);
    const floorRow = bundleRows().find((r) => r.name === report.floor);
    expect(floorRow?.importLine).toBe(
      `import { Temporal } from "${shipped?.import}"`,
    );
  });
});

describe("the over-the-polyfill columns", () => {
  it("use the one byte format, so a small amount is not rounded to 0.4 kB", () => {
    for (const row of bundleRows()) {
      if (row.overMin === null || row.overGz === null) continue;
      const cells = bundleCells(row);
      expect(cells[3]).toBe(formatBytes(row.overMin));
      expect(cells[4]).toBe(formatBytes(row.overGz));
    }
  });
});

describe("the /bundle-size page", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "content", "docs", "bundle-size.mdx"),
    "utf8",
  );
  const text = stripMdx(source, { values: pageExpressionValues() });
  const { shipped, previous } = polyfillSets();

  it("names both polyfill packages as literals", () => {
    expect(source).toContain(`\`${shipped.package}\``);
    expect(source).toContain(`\`${previous.package}\``);
  });

  it("states the figures in its lead, from the data", () => {
    expect(text).toContain(polyfillFigures.floorGzipped);
    expect(text).toContain(polyfillFigures.floorMinified);
    expect(text).toContain(`\`${polyfillFigures.smallestName}\``);
    expect(text).toContain(polyfillFigures.previousFloorGzipped);
    expect(text).toContain(polyfillFigures.floorDifferenceGzipped);
  });

  it("types no version of its own", () => {
    expect(source).not.toContain(shipped.version);
    expect(source).not.toContain(previous.version);
    expect(source).not.toContain(previous.gmt);
  });

  it("states the previous release by the published GMT it was measured on", () => {
    expect(text).toContain(`\`@northguild/gmt\` ${previous.gmt}`);
  });

  it("holds the captions of both charts in the text surfaces", () => {
    expect(text).toMatch(/Gzipped size of each polyfill on its own/);
    expect(text).toMatch(/Minified size of each polyfill on its own/);
    expect(text).toMatch(/Gzipped size of each single-function import/);
    expect(text).toMatch(/Minified size of each single-function import/);
  });

  it("leaves no expression, component tag or total-across-entries figure in the text", () => {
    expect(text).not.toMatch(/\{[A-Za-z]/);
    expect(text).not.toMatch(/<[A-Z][A-Za-z]*[\s/>]/);
    expect(text).not.toMatch(/total across/i);
  });

  it("avoids words that age or sell", () => {
    expect(text).not.toMatch(
      /\b(now|new|old|recently|used to|switched|lean|tiny|huge|just)\b/i,
    );
  });

  it("links the other reasons on the upstream page", () => {
    expect(text).toContain("/upstream/#why-this-polyfill");
  });

  it("lists the comparison table with both packages in its header", () => {
    expect(text).toContain(shipped.package);
    expect(text).toContain(previous.package);
  });
});

describe("the /upstream page's reasons for the polyfill", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "content", "docs", "upstream.mdx"),
    "utf8",
  );
  const text = stripMdx(source, { values: pageExpressionValues() });
  const section = text.slice(
    text.indexOf("## Why this polyfill"),
    text.indexOf("## What we sent"),
  );

  it("states the three reasons, with the size figures from the data", () => {
    expect(section).toContain("bounded time");
    expect(section).toContain("maintained release line");
    expect(section).toContain(polyfillFigures.floorGzipped);
    expect(section).toContain(polyfillFigures.previousFloorGzipped);
    expect(section).toContain(polyfillFigures.floorDifferenceGzipped);
  });

  it("types no size and no version of its own", () => {
    const { shipped, previous } = polyfillSets();
    const own = source.slice(
      source.indexOf("## Why this polyfill"),
      source.indexOf("## What we sent"),
    );
    expect(own).not.toContain(shipped.version);
    expect(own).not.toContain(previous.version);
    expect(own).not.toMatch(/\d+(\.\d+)?\s?kB/);
  });
});
