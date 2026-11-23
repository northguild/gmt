/**
 * The safe-area guide: a layer over the stage (`Deck.astro`, `.gmt-deck-guide`) that the `G` key
 * shows. Its two outlines and corner marks are drawn in CSS from the safe-area tokens; this module
 * turns the layer on and off and writes the one line it needs a script for, the window's size:
 * `1920 x 1080 CSS px at 2x, fullscreen`. The line is read when the guide opens and on every
 * `resize` while it is open. The guide never moves the stage or the shown slide.
 */
interface DeckGuide {
  toggle(): void;
}

export function mountDeckGuide(o: {
  /** The guide layer, when the page has one. */
  el: HTMLElement | null;
  signal: AbortSignal;
}): DeckGuide {
  const { el } = o;
  const doc = el?.ownerDocument;
  const win = doc?.defaultView;
  const line = el?.querySelector<HTMLElement>("[data-guide-size]");
  const write = (): void => {
    if (!win || !doc || !line) return;
    line.textContent = `${win.innerWidth} x ${win.innerHeight} CSS px at ${win.devicePixelRatio}x, ${
      doc.fullscreenElement ? "fullscreen" : "windowed"
    }`;
  };
  /** Listens for `resize` while the guide is open; one controller per opening. */
  let open: AbortController | null = null;
  const hide = (): void => {
    if (el) el.hidden = true;
    open?.abort();
    open = null;
  };
  o.signal.addEventListener("abort", hide, { once: true });
  return {
    toggle() {
      if (!el || !win || o.signal.aborted) return;
      if (!el.hidden) return hide();
      el.hidden = false;
      write();
      open = new AbortController();
      win.addEventListener("resize", write, {
        signal: AbortSignal.any([o.signal, open.signal]),
      });
    },
  };
}
