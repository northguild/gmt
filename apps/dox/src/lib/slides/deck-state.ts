/**
 * Where the deck is, for the slides' own visuals. `deck-mount.ts` writes the slide id and the
 * reached build to the deck root and dispatches `gmt-deck-state`; a visual reads the state once on
 * mount (a deep link opens mid-deck) and again on each event.
 */

export interface DeckState {
  /** The slide's id, as in the URL hash. */
  id: string;
  /** How many builds of that slide have been reached. */
  build: number;
}

/** Records the state on `root`. */
export function writeDeckState(root: HTMLElement, state: DeckState): void {
  root.dataset["stateId"] = state.id;
  root.dataset["stateBuild"] = String(state.build);
}

function readDeckState(root: HTMLElement): DeckState | null {
  const id = root.dataset["stateId"];
  return id ? { id, build: Number(root.dataset["stateBuild"] ?? 0) } : null;
}

/** Calls `fn` with the current state, if any, and with each later one until `signal` aborts. */
export function onDeckState(
  root: HTMLElement,
  signal: AbortSignal,
  fn: (state: DeckState) => void,
): void {
  const now = readDeckState(root);
  if (now) fn(now);
  root.addEventListener(
    "gmt-deck-state",
    (event) => {
      const detail = (event as CustomEvent<Partial<DeckState>>).detail;
      if (typeof detail?.id === "string")
        fn({ id: detail.id, build: Number(detail.build ?? 0) });
    },
    { signal },
  );
}

/** True when the element's slide is `state.id` and its build (0 for none) has been reached. */
export function isActive(el: HTMLElement, state: DeckState): boolean {
  const slide = el.closest<HTMLElement>("[data-slide]");
  if (slide === null || slide.id !== state.id) return false;
  const build = Number(
    el.closest<HTMLElement>("[data-build]")?.dataset["build"] ?? 0,
  );
  return state.build >= build;
}
