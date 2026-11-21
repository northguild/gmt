/**
 * The lock (`unlock.ts`): until this browser has unlocked the slides, the deck reaches its first
 * slide alone. The menu's Unlock tool opens the Unlock dialog; the secret phrase opens every slide
 * and keeps the unlock; the same tool then reads Lock, with a shut padlock, and one click hides
 * every slide after the first again and forgets the unlock. An unlock or a lock in another tab
 * reaches this one.
 */
import type { DeckDialogs } from "./deck-dialogs";
import {
  forgetUnlocked,
  isUnlockPhrase,
  readUnlocked,
  UNLOCK_STORAGE_KEY,
  writeUnlocked,
} from "./unlock";

export function mountDeckLock(o: {
  root: HTMLElement;
  win: Window;
  signal: AbortSignal;
  dialogs: DeckDialogs;
  /** How many slides there are; the deck is unlocked when its reach is that many. */
  total: number;
  reach: () => number;
  /** Opens every slide (`true`) or only the first, and moves the page to follow. */
  setReach: (open: boolean) => void;
  /** Puts away the info menu before a tool does its work. */
  closeMenu: () => void;
  live: HTMLElement;
}): void {
  const { root, win, signal } = o;
  /** The Unlock dialog, which holds the phrase field. */
  const dialog = root.querySelector<HTMLDialogElement>(
    'dialog[data-deck-dialog="unlock"]',
  );
  const tool = root.querySelector<HTMLButtonElement>("#deck-unlock");
  const label = tool?.querySelector("[data-deck-tool-label]") ?? null;
  const field =
    dialog?.querySelector<HTMLInputElement>("#deck-unlock-code") ?? null;
  const alert =
    dialog?.querySelector<HTMLElement>("[data-deck-unlock-error]") ?? null;
  const unlocked = (): boolean => o.reach() === o.total;

  /** Names the tool for what a click does next; `data-unlocked` picks its padlock (`slides.css`). */
  const nameTool = (open: boolean): void => {
    tool?.toggleAttribute("data-unlocked", open);
    if (label) label.textContent = open ? "Lock" : "Unlock";
  };
  /** Marks the root locked (the stylesheet hides the pager) and names the tool, from the reach. */
  const show = (): void => {
    root.toggleAttribute("data-locked", !unlocked());
    nameTool(unlocked());
  };
  const setLock = (open: boolean): void => {
    if (open === unlocked()) return;
    o.setReach(open);
    show();
    o.live.textContent = open
      ? "Every slide is unlocked"
      : "The slides are locked: only the first one shows";
  };
  const clearPhrase = (): void => {
    if (field) {
      field.value = "";
      field.removeAttribute("aria-invalid");
    }
    if (alert) alert.textContent = "";
  };
  const tryUnlock = (): void => {
    if (!field || !alert) return;
    if (!isUnlockPhrase(field.value)) {
      alert.textContent = "That secret phrase does not unlock the slides.";
      field.setAttribute("aria-invalid", "true");
      field.select();
      return;
    }
    writeUnlocked(win);
    clearPhrase();
    o.dialogs.close("unlock");
    setLock(true);
  };

  o.dialogs.listen("unlock", {
    open: () => {
      clearPhrase();
      field?.focus();
    },
  });
  tool?.addEventListener(
    "click",
    () => {
      if (!unlocked()) return o.dialogs.open("unlock");
      o.closeMenu();
      forgetUnlocked(win);
      setLock(false);
    },
    { signal },
  );
  dialog
    ?.querySelector("#deck-unlock-go")
    ?.addEventListener("click", tryUnlock, { signal });
  field?.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      tryUnlock();
    },
    { signal },
  );
  // An unlock or a lock in another tab of this site reaches this one too.
  win.addEventListener(
    "storage",
    (event) => {
      if (event.key === UNLOCK_STORAGE_KEY || event.key === null)
        setLock(readUnlocked(win));
    },
    { signal },
  );
  signal.addEventListener(
    "abort",
    () => {
      root.removeAttribute("data-locked");
      nameTool(false);
    },
    { once: true },
  );

  show();
}
