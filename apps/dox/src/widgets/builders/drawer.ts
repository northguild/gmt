/**
 * drawer: a non-modal region that slides in beside the page, with its own close.
 *
 * Pattern: Disclosure https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/, with a detached
 * panel: the opener lives elsewhere on the page (the caller's toggle button), so the drawer
 * renders only the close and the region. The close comes first, so a keyboard reader reaches it
 * before the list. Closed, the region is `inert` and `visibility: hidden` once its exit ends,
 * never `display: none`, so a virtualised list inside keeps its measured size. Open, it is a
 * `role="region"` named by `label`, with no focus trap.
 *
 * `wireDrawer` owns the toggle's `aria-expanded`, `inert`, the close click and Escape. Escape
 * goes through the site's order (`lib/esc-layers.ts`): a list or a panel open inside the drawer
 * closes first, and the press that closes the drawer returns focus to the toggle. Which
 * interaction may open it is the caller's.
 */
import { registerEscLayer } from "~/lib/esc-layers";
import { edgeControl } from "./edge-control";
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";
import styles from "./drawer.module.css";

export interface DrawerOptions extends GateOption {
  /** Unique id of the region. The close is `${id}-close`. */
  id: string;
  /** The region's name. Required. */
  label: string;
  /** The close button's name. Required. */
  closeLabel: string;
  /** The region's content. */
  children: SafeHtml;
  /** Extra class on the region, from the caller's own module. */
  className?: string;
  /** Extra class on the close, from the caller's own module, to place it. */
  closeClassName?: string;
}

export function drawer(o: DrawerOptions): SafeHtml {
  return html`<div class="${styles.root}" data-drawer data-open="false" ${gateAttr(o.gate)}
    >${edgeControl({
      id: `${o.id}-close`,
      label: o.closeLabel,
      direction: 1,
      controls: o.id,
      className: `${styles.close} ${o.closeClassName ?? ""}`,
    })}<div
      class="${styles.region} ${o.className ?? ""}"
      id="${o.id}"
      role="region"
      aria-label="${o.label}"
      inert
      >${o.children}</div
    ></div
  >`;
}

export interface DrawerWire {
  signal: AbortSignal;
  /** The button that opens it. It keeps `aria-expanded` and gets focus back on a close. */
  toggle: HTMLButtonElement;
  /**
   * An element that is out of the way while the drawer is open: it is `inert` for the whole open
   * state and comes back before focus returns to the toggle, which may live inside it.
   */
  inertWhenOpen?: HTMLElement;
  onToggle?: (open: boolean) => void;
}

export interface DrawerHandle {
  /** Whether it is open. */
  readonly expanded: boolean;
  /** Open it. `focus` is the element to move focus to, or null to leave focus where it is. */
  open(focus?: HTMLElement | null): void;
  /**
   * Close it. Focus returns to the toggle only if it was inside the drawer, and only when
   * `returnFocus` is not false: a press elsewhere on the page leaves focus where the reader put it.
   */
  close(returnFocus?: boolean): void;
}

export function wireDrawer(el: HTMLElement, o: DrawerWire): DrawerHandle {
  const root = el.matches("[data-drawer]")
    ? el
    : el.closest<HTMLElement>("[data-drawer]");
  const region = root?.querySelector<HTMLElement>('[role="region"]');
  const close = root?.querySelector<HTMLButtonElement>("button");
  if (!root || !region || !close)
    throw new Error("drawer markup is missing its close or region");
  const { signal, toggle } = o;

  let isOpen = false;
  const set = (
    next: boolean,
    focus: HTMLElement | null = null,
    returnFocus = true,
  ): void => {
    if (next === isOpen) return;
    const hadFocus =
      region.contains(el.ownerDocument.activeElement) ||
      close === el.ownerDocument.activeElement;
    isOpen = next;
    root.dataset.open = String(next);
    region.toggleAttribute("inert", !next);
    o.inertWhenOpen?.toggleAttribute("inert", next);
    toggle.setAttribute("aria-expanded", String(next));
    if (next) focus?.focus();
    else if (hadFocus && returnFocus) toggle.focus();
    o.onToggle?.(next);
  };

  toggle.setAttribute("aria-controls", region.id);
  toggle.setAttribute("aria-expanded", "false");
  close.addEventListener("click", () => set(false), { signal });
  registerEscLayer(
    {
      el: root,
      isOpen: () => isOpen,
      close: () => set(false),
      opener: () => toggle,
    },
    signal,
    root.ownerDocument,
  ).changed();

  return {
    get expanded() {
      return isOpen;
    },
    open: (focus = null) => set(true, focus),
    close: (returnFocus = true) => set(false, null, returnFocus),
  };
}
