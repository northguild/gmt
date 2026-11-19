/**
 * The deck's lock: a deck shows its first slide alone until the reader types the secret phrase in the
 * info menu's Unlock dialog (`deck-mount.ts`). The unlock is kept in the browser's local storage,
 * so it holds across reloads and every deck on the site. The same menu item then reads Lock, and
 * locking forgets the unlock.
 *
 * The lock keeps the stage's controls on the first slide; it is not access control. The slides are
 * in the page's HTML, and with scripts off the page is the whole article.
 */

/** The secret phrase: the library's package name. */
const UNLOCK_PHRASE = "@northguild/gmt";

/**
 * The local-storage entry, and its value, that mark the slides unlocked. The deck gates set them
 * before a page loads (`unlockDecks` in `scripts/lib/slides-check-helpers.mjs`).
 */
export const UNLOCK_STORAGE_KEY = "gmt-slides-unlocked";
export const UNLOCK_STORAGE_VALUE = "yes";

/** Whether the typed text is the secret phrase; spaces around it are forgiven. */
export function isUnlockPhrase(text: string): boolean {
  return text.trim() === UNLOCK_PHRASE;
}

/** Whether this browser has unlocked the slides. Storage that cannot be read counts as locked. */
export function readUnlocked(win: Window): boolean {
  try {
    return (
      win.localStorage.getItem(UNLOCK_STORAGE_KEY) === UNLOCK_STORAGE_VALUE
    );
  } catch {
    return false;
  }
}

/** Keeps the unlock for the next visit; storage that cannot be written keeps it for this page only. */
export function writeUnlocked(win: Window): void {
  try {
    win.localStorage.setItem(UNLOCK_STORAGE_KEY, UNLOCK_STORAGE_VALUE);
  } catch {
    // Private windows and blocked storage: the unlock lasts until the page closes.
  }
}

/** Locks the slides again, here and on the next visit. */
export function forgetUnlocked(win: Window): void {
  try {
    win.localStorage.removeItem(UNLOCK_STORAGE_KEY);
  } catch {
    // Storage that cannot be written holds no unlock to forget.
  }
}
