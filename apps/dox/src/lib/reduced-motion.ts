/**
 * The reader's reduced-motion setting, read in one place. Code that runs in a given window (the
 * deck, the presenter view, tests) passes it; code that only ever runs in the page's own window
 * may leave it out.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

type MediaWindow = Pick<Window, "matchMedia">;

/** True when the reader asks for reduced motion; false when the window cannot say. */
export function prefersReducedMotion(
  win: Partial<MediaWindow> = globalThis,
): boolean {
  return win.matchMedia?.(QUERY).matches ?? false;
}
