/** The blank layer: the stage hidden on a key or a tool, brought back by any step. */
export interface DeckBlank {
  readonly on: boolean;
  set(on: boolean): void;
}

export function mountDeckBlank(o: {
  root: HTMLElement;
  signal: AbortSignal;
  /** The layer over the stage, when the page has one. */
  layer: HTMLElement | null;
  button: HTMLButtonElement | null;
  /** The polite region that says what the screen shows now. */
  live: HTMLElement;
  /** What the region says when the screen comes back: the shown slide. */
  restored: () => string;
}): DeckBlank {
  const { root, layer, button } = o;
  let on = false;
  button?.setAttribute("aria-pressed", "false");
  o.signal.addEventListener(
    "abort",
    () => {
      root.removeAttribute("data-blank");
      if (layer) layer.hidden = true;
    },
    { once: true },
  );
  return {
    get on() {
      return on;
    },
    set(next) {
      if (next === on) return;
      on = next;
      root.toggleAttribute("data-blank", next);
      if (layer) layer.hidden = !next;
      button?.setAttribute("aria-pressed", String(next));
      o.live.textContent = next ? "Screen blanked" : o.restored();
    },
  };
}
