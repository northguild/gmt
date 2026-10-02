/// <reference types="vitest/globals" />

/**
 * The Earth imagery belongs to the dark theme.
 *
 * The Blue Marble is a dark photograph. On the dark page it reads as the planet
 * in space; on the light page it read as a hole, so the light theme keeps the
 * flat vector globe — and a light-theme reader on most pages never downloads
 * the image. The exception is the landing hero: a full-width dark band in the
 * light theme, made a dark island (`.gmt-theme-dark`) so that everything in it,
 * the globe included, takes the dark tokens and draws as it does in dark mode.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const STYLES = path.resolve(import.meta.dirname, "../styles");
const read = (file: string) =>
  readFileSync(path.join(STYLES, file), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

/** The selector lists of every rule block in a stylesheet, comments removed. */
function selectorLists(css: string): string[][] {
  return [...css.matchAll(/([^{}]+)\{/g)].map((match) =>
    match[1]
      .split(",")
      .map((selector) => selector.trim())
      .filter((selector) => selector.length > 0),
  );
}

describe("the landing hero", () => {
  it("is a dark island", () => {
    const hero = readFileSync(
      path.resolve(import.meta.dirname, "../components/HeroGlobe.astro"),
      "utf8",
    );
    expect(hero).toMatch(
      /class="[^"]*\bgmt-herostage\b[^"]*\bgmt-theme-dark\b/,
    );
  });

  it("takes the dark --gmt-* tokens and the --sl-* colours mapped from them", () => {
    /* `gmt-theme.css` maps Starlight's colours from the `--gmt-*` tokens. Those
       are resolved where they are declared, so the mapping has to be
       re-declared on the island too, or Starlight's text inside it keeps the
       light values. */
    for (const file of ["gmt-tokens.css", "gmt-theme.css"]) {
      const dark = selectorLists(read(file)).find((list) =>
        list.includes(":root"),
      );
      expect(dark, file).toContain(".gmt-theme-dark");
    }
  });

  it("is reached by every override that restates a token for the light theme", () => {
    /* The island re-declares the dark values on itself, which beats anything
       inherited, so each `gmt-a11y.css` block that zeroes a token for `:root`
       and the light theme has to name it as well. */
    const lists = selectorLists(read("gmt-a11y.css")).filter(
      (list) => list.includes(":root") && list.includes('[data-theme="light"]'),
    );
    expect(lists.length).toBeGreaterThanOrEqual(3);
    for (const list of lists) expect(list).toContain(".gmt-theme-dark");
  });
});

describe("the light theme", () => {
  it("turns the imagery off, so the flat globe draws and nothing downloads", () => {
    const tokens = read("gmt-tokens.css");
    const light = [...tokens.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((match) =>
      match[1]
        .split(",")
        .map((selector) => selector.trim())
        .includes('[data-theme="light"]'),
    );
    expect(light?.[2]).toMatch(/--gmt-globe-imagery-alpha:\s*0;/);
  });
});
