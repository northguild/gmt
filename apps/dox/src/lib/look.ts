/**
 * The page's look: ice-tinted, or the imagery's own colours ("Natural colours").
 *
 * It is one choice for the whole page and all three bodies, carried by `data-look` on `<html>`.
 * `gmt-tokens.css` turns `data-look="natural"` into the two tokens that recolour the Earth, the
 * Moon's and the Sun's painters read it, and `watchTheme` (`globe/globe-theme.ts`) re-reads every
 * globe and sky when it changes. The choice is remembered per reader in `localStorage`, and
 * `ThemeProvider.astro` applies it before first paint, in the same place Starlight's theme is
 * applied, so there is no flash.
 *
 * Storage can throw (private windows, blocked site data) or be missing; every access is guarded,
 * and the page is correct without it.
 */

export type Look = "ice" | "natural";

/** The attribute on `<html>`. Absent means ice. */
export const LOOK_ATTRIBUTE = "data-look";

/** The `localStorage` key. `ThemeProvider.astro` reads the same key inline. */
export const LOOK_STORAGE_KEY = "dox:look";

/** The look the page shows now. */
export function currentLook(
  root: HTMLElement = document.documentElement,
): Look {
  return root.getAttribute(LOOK_ATTRIBUTE) === "natural" ? "natural" : "ice";
}

/** The look a body paints: the page's, but ice under raised contrast, where the switch is hidden. */
export function paintLook(): Look {
  return !globalThis.matchMedia?.("(prefers-contrast: more)").matches &&
    document.documentElement.getAttribute(LOOK_ATTRIBUTE) === "natural"
    ? "natural"
    : "ice";
}

/** Show a look on the page, and remember it. */
export function setLook(
  look: Look,
  root: HTMLElement = document.documentElement,
): void {
  if (look === "natural") root.setAttribute(LOOK_ATTRIBUTE, "natural");
  else root.removeAttribute(LOOK_ATTRIBUTE);
  try {
    if (look === "natural") localStorage.setItem(LOOK_STORAGE_KEY, "natural");
    else localStorage.removeItem(LOOK_STORAGE_KEY);
  } catch {
    // The choice holds for this page; it is just not remembered.
  }
}
