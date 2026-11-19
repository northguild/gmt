/**
 * The space stage, mounted once the deck's own data is in. `mountDeck` is synchronous and wires
 * the deck at once; the stage's places, lapses and planet zones come from the deck's runtime
 * (`src/slides/deck-runtime.ts`, looked up by `data-deck-slug`), which loads on demand. This hands
 * back a stage right away, keeps every call made before the real one is up, and replays them in
 * order once it is, so the route the stage records is the one the deck walked.
 */
import { loadDeckRuntime } from "~/slides/deck-runtime";
import { NO_STAGE_DATA } from "./stage-data";
import { mountSpaceStage, type SpaceStage } from "./stage";

/** Mounts the stage for the deck `root` belongs to; a deck with no runtime gets an empty one. */
export function mountDeckStage(
  root: HTMLElement,
  o: { signal: AbortSignal },
): SpaceStage {
  let stage: SpaceStage | null = null;
  /** What was asked before the stage came up, in order. */
  const queue: ((s: SpaceStage) => void)[] = [];
  const send = (call: (s: SpaceStage) => void): void => {
    if (stage) call(stage);
    else queue.push(call);
  };

  const slug = root.dataset["deckSlug"] ?? "";
  void loadDeckRuntime(slug)
    .catch(() => null)
    .then((runtime) => {
      if (o.signal.aborted) return;
      stage = mountSpaceStage(root, {
        signal: o.signal,
        data: runtime?.stage ?? NO_STAGE_DATA,
      });
      for (const call of queue.splice(0)) call(stage);
    });

  return {
    goTo: (place, options) => send((s) => s.goTo(place, options)),
    overview: (open) => send((s) => s.overview(open)),
    steer: (vector) => send((s) => s.steer(vector)),
    returnHome: () => send((s) => s.returnHome()),
    lapse: (name) => send((s) => s.lapse(name)),
    pinFilings: (on) => send((s) => s.pinFilings(on)),
    destroy: () => {
      queue.length = 0;
      stage?.destroy();
      stage = null;
    },
  };
}
