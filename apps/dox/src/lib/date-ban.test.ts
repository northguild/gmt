/// <reference types="vitest/globals" />

/**
 * Nothing in this repo reaches for the native `Date`.
 *
 * GMT exists because `Date` is the wrong tool for a date, and a documentation site that used it to
 * render its own "last checked" stamp would be arguing against itself. `apps/dox`'s `oxlint` config
 * lists `apps/**` for the gmt-oxlint plugin but doesn't catch these (its relative-path resolution is
 * CWD-sensitive when oxlint runs from `apps/dox`), so this source scan is the enforcement.
 *
 * It covers the site's own modules and components, and the repo scripts that write dates into
 * committed files. Two things are not violations and are skipped:
 *
 * - **Comments.** Explaining why GMT is used instead of `Date` necessarily names `Date`.
 * - **A line marked `date-ban: <reason>`.** Elapsed time is not a date: a stopwatch wants a
 *   monotonic `performance.now()`, and a file's `mtimeMs` is epoch milliseconds from the
 *   filesystem. Those stay, with the reason on the line.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// .../apps/dox/src/lib/date-ban.test.ts -> apps/dox -> the repo root.
const DOX = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const REPO = dirname(dirname(DOX));

const DATE_BAN = /\bnew\s+Date\b|\bDate\.(now|UTC|parse)\b/;
const SCANNED_EXTENSIONS = new Set([".ts", ".astro", ".mjs"]);

/**
 * Files whose *content* is about `Date` rather than using it: prompt copy telling an agent never to
 * call it, the home page's demonstration of what it gets wrong, and a competitor's description.
 */
const EXEMPT_FILES = new Set([
  "src/lib/agent-prompt.ts",
  "src/components/WhyDateBug.astro",
  "src/data/library-comparison.ts",
]);

const ROOTS = [join(DOX, "src"), join(DOX, "scripts"), join(REPO, "scripts")];

function walk(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    if (!SCANNED_EXTENSIONS.has(extname(name))) return [];
    if (name.includes(".test.") || name.endsWith(".d.ts")) return [];
    return [full];
  });
}

/**
 * Each line as both the raw text and the code left once comments are gone.
 *
 * The ban is tested against `code` so that explaining it never trips it, and the `date-ban:` marker
 * is looked for in `raw` — the marker lives in a trailing comment, which `code` has removed.
 */
function lines(text: string): Array<{ raw: string; code: string }> {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((raw) => ({ raw, code: raw.replace(/\/\/.*$/, "") }));
}

describe("Date ban", () => {
  const files = ROOTS.flatMap(walk)
    .map((full) => relative(REPO, full))
    .filter((rel) => !EXEMPT_FILES.has(relative("apps/dox", rel)))
    .sort();

  it("scans the site, its build scripts and the repo scripts", () => {
    expect(files.length).toBeGreaterThan(30);
    expect(files).toContain("apps/dox/src/lib/dst-inspector.ts");
    expect(files).toContain("apps/dox/src/components/UpstreamTracker.astro");
    expect(files).toContain("scripts/upstream.mjs");
  });

  for (const rel of ROOTS.flatMap(walk)
    .map((full) => relative(REPO, full))
    .filter((r) => !EXEMPT_FILES.has(relative("apps/dox", r)))
    .sort()) {
    it(`${rel} never constructs a native Date`, () => {
      const offending = lines(readFileSync(join(REPO, rel), "utf8"))
        .map((line, index) => ({ ...line, number: index + 1 }))
        .filter(
          ({ raw, code }) => DATE_BAN.test(code) && !raw.includes("date-ban:"),
        )
        .map(({ code, number }) => `${number}: ${code.trim()}`);

      expect(offending).toEqual([]);
    });
  }
});
