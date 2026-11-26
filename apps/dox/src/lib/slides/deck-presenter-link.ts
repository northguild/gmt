/**
 * The deck window's side of the presenter view: a second window on one `BroadcastChannel`
 * (`sync.ts`). This window is the one source of truth: it posts its state after every change (a
 * step, the blank layer, fullscreen, the globe's renderer, the reduced-motion setting, the demo's
 * source) and runs the steps the presenter posts. `open` opens the presenter window.
 *
 * Every change goes out through one path: the carousel's own steps and the controller's moves
 * both end in a change of the page's mark, which the observer sees.
 *
 * Seam for the live agents: the demo panels announce their demo on the deck root (`gmt-demo`:
 * `{ id, source }`, or `null` when it ends) and `setDemo` does the same from code.
 */
import { withBase } from "~/lib/site";
import {
  mountDeckSync,
  PRESENTER_WINDOW,
  type DeckEnv,
  type DemoState,
  type StateMessage,
  type StepMessage,
} from "./sync";

interface DeckPresenterLink {
  /** Tells the presenter window the state now. */
  publish(): void;
  /** Tells the presenter which demo runs and where its answers come from; `null` when none does. */
  setDemo(demo: DemoState): void;
  /** Opens the presenter window. */
  open(): void;
}

export function mountPresenterLink(o: {
  root: HTMLElement;
  win: Window;
  signal: AbortSignal;
  /** The deck's address segment, `/slides/<slug>/`. */
  slug: string;
  state: () => { slide: number; build: number };
  blanked: () => boolean;
  fullscreen: () => boolean;
  /** Runs one step the presenter sent, through the same moves as the keys. */
  step: (message: StepMessage) => void;
}): DeckPresenterLink {
  const { root, win, signal } = o;
  let demo: DemoState = null;
  const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)");
  const spaceHost = root.querySelector<HTMLElement>("[data-deck-space]");

  /** The globe's renderer as the stage published it. */
  const renderer = (): DeckEnv["renderer"] => {
    const globe = spaceHost?.dataset["globe"];
    if (globe === "none") return "sky";
    if (globe !== "ready") return "pending";
    return spaceHost?.dataset["globeRenderer"] === "webgpu"
      ? "webgpu"
      : "canvas2d";
  };
  const snapshot = (): StateMessage => ({
    type: "state",
    slide: o.state().slide,
    build: o.state().build,
    blanked: o.blanked(),
    demo,
    env: {
      renderer: renderer(),
      reducedMotion: reducedMotion?.matches ?? false,
      fullscreen: o.fullscreen(),
    },
  });

  const sync = mountDeckSync({
    slug: o.slug,
    signal,
    snapshot,
    step: o.step,
  });
  const publish = (): void => sync?.publish();

  const watch = new MutationObserver(publish);
  for (const el of [spaceHost, root])
    if (el)
      watch.observe(el, {
        attributes: true,
        attributeFilter: [
          "data-globe",
          "data-globe-renderer",
          "data-fullscreen",
          "data-blank",
        ],
      });
  signal.addEventListener("abort", () => watch.disconnect(), { once: true });
  reducedMotion?.addEventListener("change", publish, { signal });

  const setDemo = (next: DemoState): void => {
    demo = next;
    publish();
  };
  root.addEventListener(
    "gmt-demo",
    (e) => setDemo((e as CustomEvent<DemoState>).detail ?? null),
    { signal },
  );

  return {
    publish,
    setDemo,
    open: () => {
      win.open(withBase(`/slides/${o.slug}/presenter/`), PRESENTER_WINDOW);
    },
  };
}
