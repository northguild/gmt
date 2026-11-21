import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { findSecret } from "../src/lib/slides/recording-capture";
import { DECKS } from "../src/slides/decks";
import { builtSlides } from "./built-deck";
import { distDirOrSkip } from "./dist-dir";

/**
 * Every deck as built, against the rules all decks keep. A deck's own outline is its
 * `src/slides/<slug>/built.test.ts`. Needs a build; returns early without one and throws under
 * `DOX_DIST_REQUIRED`.
 */

/** The text files under a folder: images, fonts and models cannot hold a key worth reading. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter(
      (e) =>
        e.isFile() && /\.(html|js|mjs|css|json|txt|xml|svg|map)$/.test(e.name),
    )
    .map((e) => join(e.parentPath, e.name));
}

describe.each(DECKS)("the built deck $slug", (entry) => {
  it("names each slide once", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const ids = builtSlides(dist, entry.slug).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives the spares no minutes and every other slide some", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    for (const slide of builtSlides(dist, entry.slug))
      expect(slide.minutes === null, slide.id).toBe(slide.spare);
  });

  it("puts the spares after the talk's slides", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const spares = builtSlides(dist, entry.slug).map((s) => s.spare);
    expect(spares).toEqual([...spares].sort((a, b) => Number(a) - Number(b)));
  });

  it("runs as long as the registry says", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const sum = builtSlides(dist, entry.slug).reduce(
      (total, s) => total + (s.minutes ?? 0),
      0,
    );
    expect(sum).toBe(entry.minutes + entry.qa);
  });

  it("has speaker notes on every slide", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    for (const slide of builtSlides(dist, entry.slug))
      expect(slide.html, slide.id).toMatch(/<aside[^>]*data-notes/);
  });
});

describe("the built site and the recordings", () => {
  it("hold no dev key", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const secrets = ["DOX_DEV_KEY"];
    if (process.env["DOX_DEV_KEY"]) secrets.push(process.env["DOX_DEV_KEY"]);
    const files = [
      ...filesUnder(dist),
      ...DECKS.flatMap((d) =>
        filesUnder(
          join(import.meta.dirname, "..", "src", "slides", d.slug, "recorded"),
        ),
      ),
    ];
    const found = files.flatMap((file) => {
      const what = findSecret(readFileSync(file, "utf8"), secrets);
      return what === null ? [] : [`${relative(dist, file)}: ${what}`];
    });
    expect(found).toEqual([]);
  });
});
