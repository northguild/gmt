import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every widget root names itself: `data-widget="<slug>"`, `role="region"` and an accessible
 * name. The gates find a widget by that slug and the finding key (`widget:<slug> › …`) reads
 * it, so a root without it is invisible to both. The list is read from the filesystem, so a
 * new mount is covered the day it lands.
 */
const LIB = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = join(LIB, "..", "components");

const mounts = readdirSync(LIB).filter((f) => f.endsWith("-mount.ts"));
const sourceOf = (file: string) => readFileSync(join(LIB, file), "utf8");

/** A mount that draws a root of its own (the rest only fill a host a component draws). */
const rootsOf = (source: string) =>
  [...source.matchAll(/<div class="[^"]*\bgmt-widget not-content"[^>]*>/g)].map(
    (m) => m[0],
  );

describe("widget roots", () => {
  const withRoot = mounts.filter((f) => rootsOf(sourceOf(f)).length > 0);

  it("finds the mounts that draw a root", () => {
    expect(withRoot.length).toBeGreaterThan(0);
  });

  for (const file of withRoot) {
    const slug = file.replace(/-mount\.ts$/, "");
    it(`${slug} carries its slug, a region role and a name`, () => {
      for (const root of rootsOf(sourceOf(file))) {
        expect(root).toContain(`data-widget="${slug}"`);
        expect(root).toContain('role="region"');
        expect(root).toMatch(/aria-label="[^"]+"/);
      }
    });
  }

  it("keeps the slugs unique", () => {
    const slugs = withRoot.map((f) => f.replace(/-mount\.ts$/, ""));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("names the globe, the scrubber and the playground", () => {
    expect(sourceOf("globe-mount.ts")).toContain('data-widget="globe"');
    expect(readFileSync(join(LIB, "multi-zone-scrubber.ts"), "utf8")).toContain(
      '"multi-zone-scrubber"',
    );
    const playground = readFileSync(
      join(COMPONENTS, "PlaygroundForm.astro"),
      "utf8",
    );
    expect(playground).toContain('data-widget="playground"');
    expect(playground).toContain('role="region"');
  });
});
