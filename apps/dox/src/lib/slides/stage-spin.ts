/**
 * The space stage's idle turn: a slide with `data-spin` turns the Earth at the home globe's own
 * idle rate and ramp (`GlobeEngine.setSpin`), once the clock is gone and the wall has broken.
 * Leaving it, the flight to the next slide's place carries the turn on, so the Earth is never
 * stopped or snapped back. Opt-in: a deck with no `data-spin` never turns it.
 */
import type { WallState } from "./ice-wall/wall";
import type { Place } from "./places";
import type { StageState } from "./stage-state";

interface SpinDeps {
  state: StageState;
  host: HTMLElement | null;
  slideEls: readonly HTMLElement[];
  reduced(): boolean;
  /** The clock stands in the Earth's place, or its reveal is running. */
  clockUp(): boolean;
  wallKind(): Place["kind"] | null;
  wallState(): WallState;
}

interface StageSpin {
  /** Whether the slide on show turns the Earth: not in the overview, not while steered. */
  wanted(): boolean;
  /**
   * Keeps the engine's spin in step with the slide and publishes `data-spin` for the deck's gate.
   * Called on every frame and from every change of slide.
   */
  sync(): void;
}

export function createSpin(d: SpinDeps): StageSpin {
  const { state: s } = d;
  /** Whether the engine was last asked to spin the Earth. */
  let spinning = false;

  const wanted = (): boolean =>
    d.slideEls[s.homeAt.slide]?.hasAttribute("data-spin") === true &&
    !d.reduced() &&
    !s.overviewOpen &&
    !s.steering;

  return {
    wanted,
    sync() {
      const engine = s.engine;
      if (!engine) return;
      const want = wanted();
      const wallState = d.wallState();
      const turning =
        want &&
        !d.clockUp() &&
        d.wallKind() !== "wall" &&
        (wallState === "gone" || wallState === "hidden");
      if (turning !== spinning) {
        spinning = turning;
        engine.setSpin(turning);
      }
      if (d.host) {
        if (want) d.host.dataset["spin"] = "on";
        else delete d.host.dataset["spin"];
      }
      if (engine.isSpinning()) s.offPlace = true;
    },
  };
}
