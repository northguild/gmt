/**
 * The page's native layers, put into the Escape order (`esc-layers.ts`) without each one asking.
 *
 * - A `[popover]` is open while `:popover-open` matches. Its opener is the button whose
 *   `popovertarget` names it, so the credits popovers, the licence popover and any later one
 *   join the order the day they are written.
 * - A `<dialog>` is open while it has `open`. Starlight's search dialog returns to its own button.
 * - A `<details>` outside the navigation counts only while focus is inside it (the licence note,
 *   a tool's calls), and returns to its `<summary>`. The sidebar's groups are navigation state,
 *   not layers, and Escape leaves them alone.
 *
 * Elements that arrive later (a React island, a widget mount) are picked up as they appear and
 * dropped as they go.
 */
import { registerEscLayer, type EscRegistration } from "./esc-layers";

const SELECTOR = "[popover], dialog, details";

function popoverOpen(el: Element): boolean {
  try {
    return el.matches(":popover-open");
  } catch {
    return false;
  }
}

function layerFor(
  el: HTMLElement,
): Parameters<typeof registerEscLayer>[0] | null {
  const doc = el.ownerDocument;
  if (el.matches("[popover]") && el.getAttribute("popover") !== "manual") {
    return {
      el,
      isOpen: () => popoverOpen(el),
      close: () => el.hidePopover(),
      opener: () =>
        el.id
          ? doc.querySelector<HTMLElement>(
              `[popovertarget="${CSS.escape(el.id)}"]`,
            )
          : null,
    };
  }
  if (el instanceof HTMLDialogElement) {
    return {
      el,
      isOpen: () => el.open,
      close: () => el.close(),
      opener: () =>
        el
          .closest("site-search")
          ?.querySelector<HTMLElement>("[data-open-modal]") ?? null,
    };
  }
  if (el instanceof HTMLDetailsElement) {
    if (el.closest("nav, [data-esc-skip]")) return null;
    return {
      el,
      focusOnly: true,
      isOpen: () => el.open,
      close: () => {
        el.open = false;
      },
      opener: () => el.querySelector<HTMLElement>(":scope > summary"),
    };
  }
  return null;
}

/** Watches `doc` until `signal` aborts. */
export function watchNativeEscLayers(doc: Document, signal: AbortSignal): void {
  const known = new Map<Element, EscRegistration>();
  const add = (el: Element): void => {
    if (known.has(el) || !(el instanceof HTMLElement)) return;
    const layer = layerFor(el);
    if (layer) known.set(el, registerEscLayer(layer, signal, doc));
  };
  const scan = (root: ParentNode): void => {
    if (root instanceof Element && root.matches(SELECTOR)) add(root);
    root.querySelectorAll(SELECTOR).forEach(add);
  };
  const drop = (): void => {
    for (const [el, reg] of known) {
      if (!el.isConnected) {
        reg.remove();
        known.delete(el);
      }
    }
  };
  scan(doc);
  const win = doc.defaultView;
  if (!win) return;
  const observer = new win.MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((n) => {
        if (n instanceof win.Element) scan(n);
      });
    }
    drop();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  signal.addEventListener(
    "abort",
    () => {
      observer.disconnect();
      for (const reg of known.values()) reg.remove();
      known.clear();
    },
    { once: true },
  );
}
