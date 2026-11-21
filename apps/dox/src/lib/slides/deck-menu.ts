/**
 * The info button and its popover of tools (`deckControls`): the tools that open a dialog, blank
 * the stage or go fullscreen. Unlock is `deck-lock.ts`'s own tool.
 */
import type { DeckBlank } from "./deck-blank";
import type { DeckDialogs } from "./deck-dialogs";
import type { DeckFullscreen } from "./deck-fullscreen";

interface DeckMenu {
  /** Puts the popover away before a tool does its work. */
  close(): void;
  /** Where focus returns to after a dialog the tool opened: the info button, once the menu is hidden. */
  opener(active: HTMLElement | null): HTMLElement | null;
}

export function createDeckMenu(root: HTMLElement): DeckMenu {
  const button = root.querySelector<HTMLButtonElement>("#deck-menu");
  const panel = root.querySelector<HTMLElement>("#deck-menu-panel");
  const close = (): void => {
    if (panel?.matches(":popover-open")) panel.hidePopover();
  };
  return {
    close,
    opener: (active) => {
      const from = active !== null && panel?.contains(active) ? button : active;
      close();
      return from;
    },
  };
}

/** Wires the tools' buttons. */
export function wireDeckTools(o: {
  root: HTMLElement;
  signal: AbortSignal;
  menu: DeckMenu;
  dialogs: DeckDialogs;
  blank: DeckBlank;
  fullscreen: DeckFullscreen;
}): void {
  const click = (selector: string, fn: () => void): void =>
    o.root
      .querySelector(selector)
      ?.addEventListener("click", fn, { signal: o.signal });
  click("#deck-overview", () => o.dialogs.open("overview"));
  click("#deck-help", () => o.dialogs.open("help"));
  click("#deck-blank", () => {
    o.menu.close();
    o.blank.set(!o.blank.on);
  });
  click("#deck-fullscreen", () => {
    o.menu.close();
    o.fullscreen.toggle();
  });
}
