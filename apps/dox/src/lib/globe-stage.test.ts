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

/** Custom properties declared in the first block whose selectors include `selector`. */
function tokensOf(css: string, selector: string): Set<string> {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((part) => part.trim());
    if (!selectors.includes(selector)) continue;
    return new Set([...match[2].matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  }
  throw new Error(`no block for ${selector}`);
}

/** The body of the `@media` block whose condition is `condition`. */
function mediaBlock(css: string, condition: string): string {
  const start = css.indexOf(`@media ${condition} {`);
  if (start < 0) throw new Error(`no @media ${condition} block`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) {
      return css.slice(css.indexOf("{", start) + 1, i);
    }
  }
  throw new Error(`unclosed @media ${condition} block`);
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

  it("has a dark value to return to for every token the light theme sets", () => {
    /* The island re-declares the dark block on itself. A token that only the
       light block sets has nothing to re-declare, so inside the island it
       would keep the light value. */
    for (const file of ["gmt-tokens.css", "gmt-theme.css"]) {
      const css = read(file);
      const dark = tokensOf(css, ":root");
      const lightOnly = [...tokensOf(css, '[data-theme="light"]')].filter(
        (token) => !dark.has(token),
      );
      expect(lightOnly, file).toEqual([]);
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

describe("the accessibility switches", () => {
  /* A busy photograph behind the markers costs contrast that raised contrast
     asks for, and a canvas is not repainted in the forced palette. Under both,
     the imagery is off — for `:root`, the light theme and the dark island — and
     at 0 it is never downloaded. Pinned here because only the manual smoke
     exercises it otherwise. */
  for (const condition of [
    "(prefers-contrast: more)",
    "(forced-colors: active)",
  ]) {
    it(`turns the imagery off under ${condition}`, () => {
      const block = mediaBlock(read("gmt-a11y.css"), condition);
      const rule = [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((match) =>
        /--gmt-globe-imagery-alpha\s*:\s*0\s*;/.test(match[2]),
      );
      expect(
        rule,
        `${condition} sets --gmt-globe-imagery-alpha: 0`,
      ).toBeDefined();
      const selectors = rule![1].split(",").map((part) => part.trim());
      expect(selectors).toEqual(
        expect.arrayContaining([
          ":root",
          '[data-theme="light"]',
          ".gmt-theme-dark",
        ]),
      );
    });
  }
});
