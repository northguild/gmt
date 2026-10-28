/**
 * Token-contrast helpers shared by the tests that measure a colour token
 * against the surfaces it sits on. Reads `gmt-tokens.css` per theme, follows
 * `var()` aliases, and applies the WCAG 2.2 relative-luminance formula.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export const STYLES = path.resolve(import.meta.dirname, "..", "styles");
export const css = readFileSync(path.join(STYLES, "gmt-tokens.css"), "utf8");

const lightStart = css.indexOf('[data-theme="light"] {');
/* The dark block's selector list is `:root` plus the dark island
   (`:root, .gmt-theme-dark`), so it is found by its first selector rather than
   by an exact header. */
const darkStart = css.search(/^:root\b[^{]*\{/m);
export const darkBlock = css.slice(darkStart, lightStart);
export const lightBlock = css.slice(lightStart);

function declared(block: string, token: string): string | undefined {
  const matches = [...block.matchAll(new RegExp(`${token}:\\s*([^;]+);`, "g"))];
  return matches.at(-1)?.[1]?.trim();
}

/** A token's hex in a theme, following `var()` aliases (the light theme falls
 *  back to the dark block for tokens it does not redefine). */
export function hexOf(token: string, theme: "dark" | "light"): string {
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

export function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
