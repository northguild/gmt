/**
 * The left sidebar's arrival cue: `open` when a page that shows Starlight's sidebar follows one that
 * did not, `close` when one that does not follows one that did, nothing when it stays.
 *
 * "The page before" is a `sessionStorage` flag, `dox:sidebar`, which every page writes as it loads
 * (and as it is restored from the back/forward cache) with whether its own sidebar is on screen.
 * It is read before it is overwritten, so it always holds the page that was left, for a link, back,
 * forward and a restored page alike. `navigation.activation.from` says only where the reader came
 * from, not what that page showed, and a `pagehide` write is skipped by mobile browsers that kill
 * a page without firing it. Nothing is read on a tab's first page (no flag): no cue.
 *
 * Reads no clock. Nothing here makes a sound; `cue.ts` plays the result once audio is running.
 */
const KEY = "dox:sidebar";

/** Whether the sidebar is on screen: wide layout, not the closed mobile menu. */
export function sidebarShown(): boolean {
  const pane = document.querySelector(".sidebar-pane");
  if (!pane) return false;
  const style = getComputedStyle(pane);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const box = pane.getBoundingClientRect();
  return box.width > 0 && box.right > 0 && box.left < window.innerWidth;
}

/**
 * Record this page's sidebar and return the cue it earns. `fromSite` is false for an arrival from
 * another origin (or none), which earns nothing, but the flag is still written.
 */
export function noteSidebar(fromSite: boolean): "open" | "close" | null {
  const now = sidebarShown();
  let before: string | null = null;
  try {
    before = sessionStorage.getItem(KEY);
    sessionStorage.setItem(KEY, now ? "1" : "0");
  } catch {
    return null;
  }
  if (!fromSite || before === null) return null;
  const was = before === "1";
  if (was === now) return null;
  return now ? "open" : "close";
}
