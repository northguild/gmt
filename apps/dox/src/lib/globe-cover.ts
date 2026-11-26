/**
 * Tells a globe when the page draws something over it, so it stops drawing frames nobody sees.
 *
 * Two things cover the home page's Earth. Starlight's search is a modal `<dialog>` inside
 * `<site-search>`; it fires no event when it opens, so its `open` attribute is observed. The
 * mobile menu (`menu-button.ts`) sets `data-mobile-menu-expanded` on the `<body>`. Both are
 * attribute changes, so one `MutationObserver` watches them and nothing polls.
 */

/** The search dialogs Starlight renders; the header carries one and a page could carry more. */
const SEARCH_DIALOG = "site-search dialog";
const MENU_FLAG = "data-mobile-menu-expanded";

/** Whether the search dialog or the mobile menu is open right now. */
export function isCovered(doc: Document): boolean {
  if (doc.body?.hasAttribute(MENU_FLAG)) return true;
  for (const dialog of doc.querySelectorAll<HTMLDialogElement>(SEARCH_DIALOG)) {
    if (dialog.open) return true;
  }
  return false;
}

/**
 * Calls `onChange` with the new state whenever it flips, and once now if it is already covered.
 * Returns the function that stops watching.
 */
export function watchCover(
  doc: Document,
  onChange: (covered: boolean) => void,
): () => void {
  let last = false;
  const report = (): void => {
    const now = isCovered(doc);
    if (now === last) return;
    last = now;
    onChange(now);
  };
  const observer = new MutationObserver(report);
  if (doc.body) {
    observer.observe(doc.body, {
      attributes: true,
      attributeFilter: [MENU_FLAG],
    });
  }
  for (const dialog of doc.querySelectorAll(SEARCH_DIALOG)) {
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
  }
  report();
  return () => observer.disconnect();
}
