/**
 * The deck's dialogs, wired the same way in the deck window and the presenter view: the overview,
 * the keys and, in the deck window, the unlock dialog. Each is a `dialog[data-deck-dialog]` that
 * `widgets/builders/deck-controls.ts` renders.
 *
 * Shared here: focus goes back to the element that opened a dialog when it closes, a dialog's
 * close button, the overview's list (one link for each slide in reach; spares in their own list)
 * with the shown slide marked and focused, and a click on one of its links. A window adds what is
 * its own through `listen`.
 */
import { overviewItems } from "~/widgets/builders/deck-controls";
import { setHtml } from "~/widgets/builders/html";
import type { DeckPart } from "./deck-parts";

export interface DeckDialogs {
  /** Opens the named dialog, unless it is missing or already open. */
  open(name: string): void;
  /** Closes the named dialog, if it is open. */
  close(name: string): void;
  /** True while any of them is open. */
  anyOpen(): boolean;
  /** Closes every open dialog. */
  closeAll(): void;
  /** Fills the overview with `parts`: the slides in reach, spares in their own list. */
  fillOverview(parts: readonly DeckPart[]): void;
  /** Runs `open` just after the named dialog opens and `close` just after it closes. */
  listen(name: string, hooks: { open?: () => void; close?: () => void }): void;
}

export function mountDeckDialogs(o: {
  doc: Document;
  /** Where the dialogs are: the deck root, or the presenter's page. */
  scope: ParentNode;
  signal: AbortSignal;
  names: readonly string[];
  /** The shown slide, which the overview marks and focuses. */
  slide: () => number;
  /** A click on an overview link: the slide's id. The overview has closed already. */
  onGoto: (id: string) => void;
  /**
   * Called as a dialog opens, with the focused element; answers where focus goes back to when it
   * closes (and may put away what the dialog opened from). Defaults to the focused element.
   */
  opener?: (active: HTMLElement | null) => HTMLElement | null;
}): DeckDialogs {
  const { doc, scope, signal } = o;
  const dialogs = new Map<string, HTMLDialogElement>();
  for (const name of o.names) {
    const d = scope.querySelector<HTMLDialogElement>(
      `dialog[data-deck-dialog="${name}"]`,
    );
    if (d) dialogs.set(name, d);
  }
  const hooks = new Map<string, { open?: () => void; close?: () => void }>();
  const overview = dialogs.get("overview");
  const list = overview?.querySelector<HTMLElement>("[data-deck-overview]");
  const spareSection = overview?.querySelector<HTMLElement>(
    "[data-deck-overview-spares]",
  );
  const spareList = overview?.querySelector<HTMLElement>(
    "[data-deck-overview-spare]",
  );

  let opener: HTMLElement | null = null;
  for (const [name, d] of dialogs) {
    d.addEventListener(
      "close",
      () => {
        hooks.get(name)?.close?.();
        if (opener?.isConnected) opener.focus();
        opener = null;
      },
      { signal },
    );
    d.querySelector<HTMLElement>('[id$="-close"]')?.addEventListener(
      "click",
      () => d.close(),
      { signal },
    );
  }

  list?.addEventListener(
    "click",
    (event) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[data-deck-goto]",
      );
      if (!link) return;
      event.preventDefault();
      // Closing first returns focus to the opener, so the new slide's panel is not left behind.
      overview?.close();
      o.onGoto(link.dataset["deckGoto"] ?? "");
    },
    { signal },
  );

  const markShown = (d: HTMLDialogElement): void => {
    const links = Array.from(
      d.querySelectorAll<HTMLAnchorElement>("a[data-deck-goto]"),
    );
    links.forEach((a, i) => {
      if (i === o.slide()) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    links[o.slide()]?.focus();
  };

  return {
    open(name) {
      const d = dialogs.get(name);
      if (!d || d.open) return;
      const active =
        doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
      opener = o.opener ? o.opener(active) : active;
      d.showModal();
      hooks.get(name)?.open?.();
      if (d === overview) markShown(d);
    },
    close: (name) => dialogs.get(name)?.close(),
    anyOpen: () => [...dialogs.values()].some((d) => d.open),
    closeAll() {
      for (const d of dialogs.values()) if (d.open) d.close();
    },
    fillOverview(parts) {
      const items = (spare: boolean) =>
        overviewItems(parts.filter((p) => p.spare === spare));
      if (list) setHtml(list, items(false));
      const hasSpares = parts.some((p) => p.spare);
      if (spareList) {
        setHtml(spareList, items(true));
        spareList.hidden = !hasSpares;
      }
      if (spareSection) spareSection.hidden = !hasSpares;
    },
    listen: (name, h) => hooks.set(name, h),
  };
}
