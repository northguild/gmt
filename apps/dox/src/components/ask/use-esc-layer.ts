/**
 * A React component's way into the site's Escape order (`lib/esc-layers.ts`).
 *
 * The layer is registered once, reads the latest props through a ref, and tells the helper when
 * `open` flips, since React state is not something it can see in the document.
 */
import { useEffect, useRef } from "react";
import { registerEscLayer, type EscRegistration } from "~/lib/esc-layers";

export interface UseEscLayer {
  /** Whether it is open; a function is read each time, for a state the screen can hide. */
  open: boolean | (() => boolean);
  /** Shuts the layer (set its state to closed). */
  close: () => void;
  /** The control that opened it. */
  opener?: () => HTMLElement | null;
  /** Whether a node is inside the layer, for portalled content. */
  contains?: (node: Node) => boolean;
  /** The layer's root, when it has one in the tree. */
  el?: () => Element | null;
  /** The component puts focus back itself. */
  returnsFocus?: boolean;
  /** Closes only when nothing else is open. */
  base?: boolean;
}

export function useEscLayer(layer: UseEscLayer): void {
  const latest = useRef(layer);
  latest.current = layer;
  const registration = useRef<EscRegistration | null>(null);

  useEffect(() => {
    const reg = registerEscLayer({
      get el() {
        return latest.current.el?.() ?? null;
      },
      get returnsFocus() {
        return latest.current.returnsFocus === true;
      },
      get base() {
        return latest.current.base === true;
      },
      isOpen: () => {
        const { open } = latest.current;
        return typeof open === "function" ? open() : open;
      },
      close: () => latest.current.close(),
      opener: () => latest.current.opener?.() ?? null,
      contains: (node) => latest.current.contains?.(node) ?? false,
    });
    registration.current = reg;
    return () => {
      registration.current = null;
      reg.remove();
    };
  }, []);

  // After every render: the cost is a read of each registered layer.
  useEffect(() => {
    registration.current?.changed();
  });
}
