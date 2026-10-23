import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { distDirOrSkip } from "./dist-dir";

/**
 * The data-credits button is on every drawing of third-party data and nowhere else (CORE-88).
 * The page's HTML holds the globe's and the time-zone map's; the Canada map adds its own when
 * the client draws it, so its page holds none (`data-credits-check.mjs` covers that one in a
 * browser). Needs a build; returns early without one and throws under `DOX_DIST_REQUIRED`.
 */
const TRIGGER = /popovertarget="[a-z0-9-]*data-credits"/g;

/** Page (relative to `dist/gmt/`) → the panel ids it holds and the labels each lists. */
const EXPECTED: Record<string, { id: string; labels: string[] }[]> = {
  "index.html": [
    {
      id: "globe-data-credits",
      labels: ["Time zone boundaries", "Earth imagery"],
    },
  ],
  "tools/zoned-earth/index.html": [
    {
      id: "globe-data-credits",
      labels: ["Time zone boundaries", "Earth imagery"],
    },
  ],
  "why-gmt/index.html": [
    { id: "tz-map-data-credits", labels: ["Time zone boundaries"] },
  ],
  "check/canada-2026-clock-change/index.html": [],
  "check/morocco-2026-clock-change/index.html": [],
};

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

describe("the built site's data credits", () => {
  it("every drawing page has the panels it should, with their labels", () => {
    const root = distDirOrSkip();
    if (root === null) return;
    const pages = resolve(root, "gmt");
    for (const [page, panels] of Object.entries(EXPECTED)) {
      const html = readFileSync(resolve(pages, page), "utf8");
      expect(html.match(TRIGGER)?.length ?? 0, `${page}: buttons`).toBe(
        panels.length,
      );
      for (const { id, labels } of panels) {
        expect(html, `${page}: button for ${id}`).toContain(
          `popovertarget="${id}"`,
        );
        expect(
          html.split(`id="${id}"`).length - 1,
          `${page}: panels ${id}`,
        ).toBe(1);
        // Count inside the credits panel only: the Canada page's pin panel has <dt> rows of its own.
        const panel =
          html.match(new RegExp(`id="${id}"[^>]*>[\\s\\S]*?</dl>`))?.[0] ?? "";
        for (const label of labels)
          expect(panel, page).toContain(`<dt>${label}</dt>`);
        expect(panel.match(/<dt>/g)?.length, `${page}: rows`).toBe(
          labels.length,
        );
      }
    }
  });

  it("the globe's button is the last of its control stack", () => {
    const root = distDirOrSkip();
    if (root === null) return;
    const html = readFileSync(resolve(root, "gmt", "index.html"), "utf8");
    const stack =
      html.match(
        /<div class="gmt-globe-zoom"[^>]*>[\s\S]*?<\/dl><\/div>/,
      )?.[0] ?? "";
    expect(stack).toContain('aria-label="Globe controls"');
    const buttons = [
      ...stack.matchAll(/<button [^>]*aria-label="([^"]+)"/g),
    ].map((m) => m[1]);
    expect(buttons).toEqual([
      "Zoom in",
      "Zoom out",
      "Reset zoom",
      "Data credits",
    ]);
  });

  it("no other page has one, and the old page placement is gone", () => {
    const root = distDirOrSkip();
    if (root === null) return;
    const pages = resolve(root, "gmt");
    const allowed = new Set(Object.keys(EXPECTED));
    const stray = walk(pages)
      .map((f) => relative(pages, f))
      .filter((f) => !allowed.has(f))
      .filter((f) => readFileSync(resolve(pages, f), "utf8").match(TRIGGER));
    expect(stray).toEqual([]);
    for (const page of allowed) {
      const html = readFileSync(resolve(pages, page), "utf8");
      expect(html, page).not.toContain('data-placement="page"');
      expect(html, page).not.toContain('id="gmt-data-credits"');
    }
    expect(
      readFileSync(resolve(pages, "why-gmt/index.html"), "utf8").match(
        /Earth imagery/g,
      ),
    ).toBeNull();
  });
});
