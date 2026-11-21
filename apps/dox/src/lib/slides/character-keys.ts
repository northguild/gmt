/**
 * Whether the deck answers its single-character keys: the letters, digits and punctuation in
 * `KEY_TABLE` (N, P, O, ?, B, ., F, T, R, W A S D, Q E and the digits). WCAG 2.1.4 Character Key
 * Shortcuts lets a page keep such keys only if a reader can turn them off; speech input types
 * stray letters, and each one would move the deck. The keys dialog's switch turns them off.
 *
 * The choice is remembered in `localStorage` for every deck and both windows, the deck and the
 * presenter view; `mountKeys` reads it on each key press, so a change in one window holds in the
 * other at once. On is the default: no entry means on. Storage that throws (a private window, a
 * blocked site) leaves the keys on and the switch working for the visit.
 */

/** The `localStorage` key; its only value is `"off"`. */
export const CHARACTER_KEYS_KEY = "gmt-deck-character-keys";
/** The keys dialog's switch (`helpDialog` in `widgets/builders/deck-controls.ts`). */
export const CHARACTER_KEYS_SWITCH_ID = "deck-character-keys";

/** What the visit holds when storage cannot: `null` until storage throws. */
let fallback: boolean | null = null;

export function characterKeysOn(): boolean {
  if (fallback !== null) return fallback;
  try {
    return localStorage.getItem(CHARACTER_KEYS_KEY) !== "off";
  } catch {
    return true;
  }
}

function setCharacterKeys(on: boolean): void {
  try {
    if (on) localStorage.removeItem(CHARACTER_KEYS_KEY);
    else localStorage.setItem(CHARACTER_KEYS_KEY, "off");
    fallback = null;
  } catch {
    fallback = on;
  }
}

/** A key press that types one character: a letter, digit or punctuation mark (not Space). */
export function isCharacterKey(event: Pick<KeyboardEvent, "key">): boolean {
  return event.key.length === 1 && event.key !== " ";
}

/** Shows the stored choice on the switch in `doc`, if it has one, and saves each change. */
export function mountCharacterKeysSwitch(
  doc: Document,
  signal: AbortSignal,
): void {
  const input = doc.getElementById(CHARACTER_KEYS_SWITCH_ID);
  if (!(input instanceof HTMLInputElement)) return;
  input.checked = characterKeysOn();
  input.addEventListener("change", () => setCharacterKeys(input.checked), {
    signal,
  });
}
