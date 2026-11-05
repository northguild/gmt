import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { distDirOrSkip } from "./dist-dir";

/**
 * The heading font ships inside the built stylesheet, so it never arrives after first layout.
 * Needs a build; returns early without one and throws under `DOX_DIST_REQUIRED`. Each test reads
 * the build itself: a `describe` body runs at collection, even when its tests are skipped.
 */

/** The built pages folder, or `null` with no build. */
function site(): string | null {
  const dist = distDirOrSkip();
  return dist === null ? null : join(dist, "gmt");
}

/** Every page of the built site. */
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

describe("the display font in the built site", () => {
  it("is declared once, in a stylesheet, as the vendored file's own bytes", () => {
    const root = site();
    if (root === null) return;
    const astro = join(root, "_astro");
    const faces = readdirSync(astro)
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(join(astro, f), "utf8"))
      .flatMap(
        (css) =>
          css.match(/@font-face\s*{[^}]*font-family:\s*Michroma[^}]*}/g) ?? [],
      );
    const vendored = readFileSync(
      join(
        import.meta.dirname,
        "../public/fonts/michroma-latin-400-normal.woff2",
      ),
    );
    expect(faces).toHaveLength(1);
    const uri = /url\(\s*["']?(data:font\/woff2;base64,[A-Za-z0-9+/=]+)/.exec(
      faces[0],
    )?.[1];
    expect(uri, "the face's src is a data:font/woff2 URI").toBeDefined();
    const bytes = Buffer.from((uri ?? "").split(",")[1], "base64");
    expect(bytes.equals(vendored)).toBe(true);
    expect(faces[0]).toMatch(/font-display:\s*optional/);
  });

  it("is preloaded by no page: the file is in the stylesheet", () => {
    const root = site();
    if (root === null) return;
    const all = pages(root);
    expect(all.length).toBeGreaterThan(100);
    const preloading = all.filter((page) => {
      const head = readFileSync(page, "utf8").split("</head>")[0];
      return /<link\b[^>]*michroma[^>]*>/i.test(head);
    });
    expect(preloading).toEqual([]);
  });
});
