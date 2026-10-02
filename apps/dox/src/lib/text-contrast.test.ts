/// <reference types="vitest/globals" />

/**
 * The 7:1 body-text target for the text colours a widget reads from tokens.
 *
 * Resolves each token to a hex through the stylesheet (one level of `var()`),
 * per theme, and measures it against the opaque surfaces text sits on. A text
 * colour on a translucent fill is measured against the page behind it, which is
 * the lighter case in light mode and the darker in dark mode; the surfaces below
 * are the extremes.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const STYLES = path.resolve(import.meta.dirname, "..", "styles");
const css = readFileSync(path.join(STYLES, "gmt-tokens.css"), "utf8");

const lightStart = css.indexOf('[data-theme="light"] {');
/* The dark block's selector list is `:root` plus the dark island
   (`:root, .gmt-theme-dark`), so it is found by its first selector rather than
   by an exact header. */
const darkStart = css.search(/^:root\b[^{]*\{/m);
const darkBlock = css.slice(darkStart, lightStart);
const lightBlock = css.slice(lightStart);

function declared(block: string, token: string): string | undefined {
  const matches = [...block.matchAll(new RegExp(`${token}:\\s*([^;]+);`, "g"))];
  return matches.at(-1)?.[1]?.trim();
}

/** A token's hex in a theme, following `var()` aliases (the light theme falls
 *  back to the dark block for tokens it does not redefine). */
function hexOf(token: string, theme: "dark" | "light"): string {
  let name = token;
  for (let hops = 0; hops < 6; hops++) {
    const value =
      (theme === "light" ? declared(lightBlock, name) : undefined) ??
      declared(darkBlock, name);
    if (value === undefined) throw new Error(`no value for ${name}`);
    const alias = /^var\((--[\w-]+)\)$/.exec(value);
    if (alias) {
      name = alias[1]!;
      continue;
    }
    if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name}: ${value}`);
    return value;
  }
  throw new Error(`alias loop at ${token}`);
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const SURFACES: Record<"dark" | "light", string[]> = {
  dark: ["--gmt-void", "--gmt-surface", "--gmt-surface-2"],
  light: ["--gmt-void", "--gmt-surface", "--gmt-surface-2"],
};

// Every token a widget colours text with that this change touched.
const TEXT_TOKENS: Array<[string, "dark" | "light"]> = [
  ["--gmt-cyan-ink", "light"],
  ["--gmt-cyan-ink", "dark"],
  ["--gmt-syntax-num", "light"],
  ["--gmt-syntax-num", "dark"],
  ["--gmt-ice", "dark"],
  ["--gmt-ice", "light"],
];

describe("text tokens against the surfaces they sit on", () => {
  it.each(TEXT_TOKENS)("%s in %s mode clears 7:1", (token, theme) => {
    const fg = hexOf(token, theme);
    /* Code is drawn on a 6% teal wash over the page, never on `--gmt-surface-2`
       (#ececec, the hover and popover fill), so a syntax colour is measured
       against the page and card surfaces only. */
    const surfaces = token.startsWith("--gmt-syntax")
      ? SURFACES[theme].slice(0, 2)
      : SURFACES[theme];
    for (const surface of surfaces) {
      expect(
        ratio(fg, hexOf(surface, theme)),
        `${token} on ${surface}`,
      ).toBeGreaterThanOrEqual(7);
    }
  });
});
