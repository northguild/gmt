/**
 * The deck's one brain pick, shared by every Dox slide. Each slide's chat starts afresh when the
 * slide is left (`DeckDox`), and each slide has its own chat, so a pick held in the chat would be
 * lost on the way to the next Dox slide. The presenter picks a brain once, on any Dox slide, and
 * every Dox slide sends its live questions to it.
 *
 * Kept for the tab in `sessionStorage`, so a reload mid-talk keeps it; a browser that refuses
 * storage still shares the pick within the page.
 */

/** The `sessionStorage` key for the pick. */
export const DECK_BRAIN_KEY = "gmt-deck-brain";

let pick: string | null = read();
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(DECK_BRAIN_KEY) ?? null;
  } catch {
    return null;
  }
}

/** The presenter's explicit pick, or null for whichever brain has budget. */
export function getDeckBrain(): string | null {
  return pick;
}

export function setDeckBrain(brainId: string | null): void {
  if (brainId === pick) return;
  pick = brainId;
  try {
    if (brainId === null) sessionStorage.removeItem(DECK_BRAIN_KEY);
    else sessionStorage.setItem(DECK_BRAIN_KEY, brainId);
  } catch {
    // Storage refused: the pick still holds for this page.
  }
  for (const listener of listeners) listener();
}

/** Calls `listener` on every change; returns the call that stops it. */
export function subscribeDeckBrain(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
