/// <reference types="vitest/globals" />

/**
 * Nothing in this repo reaches for the native `Date`.
 *
 * GMT exists because `Date` is the wrong tool for a date, and a documentation site that used it to
 * render its own "last checked" stamp would be arguing against itself. The gmt-oxlint plugin bans
 * these APIs too, but it cannot parse `.astro`, so this source scan runs as well as the plugin
 * rather than instead of it.
 *
 * It covers the site's own modules and components, the Worker behind the chat, the library source,
 * and the repo scripts that write dates into committed files. Tests are scanned too: a fixture
 * built from `Date.UTC(2026, 5, 16)` reads as May and means June, which is the exact confusion GMT
 * exists to remove. Three things are not violations and are skipped:
 *
 * - **Comments.** Explaining why GMT is used instead of `Date` necessarily names `Date`.
 * - **A line marked `date-ban: <reason>`.** Elapsed time is not a date: a stopwatch wants a
 *   monotonic `performance.now()`, and a file's `mtimeMs` is epoch milliseconds from the
 *   filesystem. An independent oracle is not a date either — a test that checks GMT's output by
 *   parsing it with GMT proves nothing. Those stay, with the reason on the line.
 * - **Vendored source.** Code copied unmodified from upstream is reviewed as "copied", not linted
 *   as our own — the same carve-out `oxlint.config.ts` makes.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// .../apps/dox/src/lib/date-ban.test.ts -> apps/dox -> the repo root.
const DOX = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const REPO = dirname(dirname(DOX));

const DATE_BAN = /\bnew\s+Date\b|\bDate\.(now|UTC|parse)\b/;
const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".astro", ".mjs"]);

/**
 * Files whose *content* is about `Date` rather than using it: prompt copy telling an agent never to
 * call it, the home page's demonstration of what it gets wrong, and a competitor's description.
 */
const EXEMPT_FILES = new Set([
  "src/lib/agent-prompt.ts",
  "src/components/WhyDateBug.astro",
  "src/data/library-comparison.ts",
]);

/**
 * Vendored, unmodified shadcn/AI Elements registry source (DOX-C0, #171). Mirrors the ignore list
 * in `oxlint.config.ts` — if one grows, so does the other.
 */
const VENDORED = ["apps/dox/src/components/ai-elements/", "apps/dox/src/components/ui/"];

const ROOTS = [
  join(DOX, "src"),
  join(DOX, "scripts"),
  join(DOX, "worker"),
  join(REPO, "scripts"),
  join(REPO, "packages/gmt/src"),
];

function walk(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    if (!SCANNED_EXTENSIONS.has(extname(name))) return [];
    if (name.endsWith(".d.ts")) return [];
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

const FILES = ROOTS.flatMap(walk)
  .map((full) => relative(REPO, full))
  .filter((rel) => !EXEMPT_FILES.has(relative("apps/dox", rel)))
  .filter((rel) => !VENDORED.some((prefix) => rel.startsWith(prefix)))
  .sort();

describe("Date ban", () => {
  it("scans the site, the Worker, the library, and every build script", () => {
    expect(FILES.length).toBeGreaterThan(30);
    expect(FILES).toContain("apps/dox/src/lib/dst-inspector.ts");
    expect(FILES).toContain("apps/dox/src/components/UpstreamTracker.astro");
    expect(FILES).toContain("scripts/upstream.mjs");
    // The Worker holds the rate limiter and every `resetsAt` the API emits; it went unscanned
    // once, and that is where every native `Date` in this repo had collected.
    expect(FILES).toContain("apps/dox/worker/index.ts");
    expect(FILES).toContain("apps/dox/worker/usage.ts");
    // The library itself, and the tests that build its fixtures.
    expect(FILES).toContain("packages/gmt/src/index.ts");
    expect(FILES).toContain("packages/gmt/src/unix/calculate/setUnix.test.ts");
  });

  for (const rel of FILES) {
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
