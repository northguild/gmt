/**
 * The Earth's look: blue, or the photograph's own colours.
 *
 * It is one choice for the whole page, carried by `data-earth` on `<html>`. `gmt-tokens.css`
 * turns `data-earth="natural"` into the two tokens that recolour the globe, and every globe
 * re-reads its theme when the attribute changes, so a switch on one globe moves them all. The
 * choice is remembered per reader in `localStorage`, and `ThemeProvider.astro` applies it
 * before first paint, in the same place Starlight's theme is applied, so there is no flash.
 *
 * Storage can throw (private windows, blocked site data) or be missing; every access is guarded,
 * and the page is correct without it.
 */

export type EarthLook = "blue" | "natural";

/** The attribute on `<html>`. Absent means blue. */
export const EARTH_ATTRIBUTE = "data-earth";

/** The `localStorage` key. `ThemeProvider.astro` reads the same key inline. */
export const EARTH_STORAGE_KEY = "dox:earth";

/** The look the page shows now. */
export function currentEarth(
  root: HTMLElement = document.documentElement,
): EarthLook {
  return root.getAttribute(EARTH_ATTRIBUTE) === "natural" ? "natural" : "blue";
}

/** Show a look on the page, and remember it. */
export function setEarth(
  look: EarthLook,
  root: HTMLElement = document.documentElement,
): void {
  if (look === "natural") root.setAttribute(EARTH_ATTRIBUTE, "natural");
  else root.removeAttribute(EARTH_ATTRIBUTE);
  try {
    if (look === "natural") localStorage.setItem(EARTH_STORAGE_KEY, "natural");
    else localStorage.removeItem(EARTH_STORAGE_KEY);
  } catch {
    // The choice holds for this page; it is just not remembered.
  }
}

/** The remembered look, or blue when nothing is stored or storage is unavailable. */
export function storedEarth(): EarthLook {
  try {
    return localStorage.getItem(EARTH_STORAGE_KEY) === "natural"
      ? "natural"
      : "blue";
  } catch {
    return "blue";
  }
}
