/** Fullscreen for the deck root alone, so the site header is not in it. */
export interface DeckFullscreen {
  active(): boolean;
  enter(): void;
  toggle(): void;
}

export function mountDeckFullscreen(o: {
  root: HTMLElement;
  doc: Document;
  signal: AbortSignal;
  button: HTMLButtonElement | null;
  /** The polite region, told when the browser refuses. */
  live: HTMLElement;
}): DeckFullscreen {
  const { root, doc, button } = o;
  const active = (): boolean => doc.fullscreenElement === root;
  const can = typeof root.requestFullscreen === "function";
  if (!can && button) button.disabled = true;
  button?.setAttribute("aria-pressed", "false");
  const enter = (): void => {
    if (!can || active()) return;
    root.requestFullscreen().catch(() => {
      o.live.textContent = "Fullscreen is not available here";
    });
  };
  doc.addEventListener(
    "fullscreenchange",
    () => {
      root.toggleAttribute("data-fullscreen", active());
      button?.setAttribute("aria-pressed", String(active()));
    },
    { signal: o.signal },
  );
  o.signal.addEventListener(
    "abort",
    () => root.removeAttribute("data-fullscreen"),
    { once: true },
  );
  return {
    active,
    enter,
    toggle: () => {
      if (active()) void doc.exitFullscreen();
      else enter();
    },
  };
}
