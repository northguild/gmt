/**
 * The stage's camera commands: where the deck asks it to go (`goTo`), the overview, the held rate
 * (`steer`) and the way home. They read and write the stage's shared state and drive the reveal, the
 * wall and the flight; none of them draws or flies by itself.
 */
import type { WallState } from "./ice-wall/wall";
import { CLEAR_MS } from "./ice-wall/wall-run";
import { resolvePlace, type Place } from "./places";
import type { StageAt, StageState } from "./stage-state";

interface MovesDeps {
  state: StageState;
  reveal: {
    at: number;
    shown(): boolean;
    show(): void;
    cancel(): boolean;
    start(hop: boolean, afterMs?: number): void;
  };
  wall: {
    kind(): Place["kind"] | null;
    state(): WallState;
    arrange(kind: Place["kind"]): void;
  };
  spinWanted(): boolean;
  fly(hop: boolean): void;
  draw(): void;
}

interface StageMoves {
  goTo(place: string, options?: { hop?: boolean; at?: StageAt }): void;
  overview(open: boolean): void;
  steer(vector: { lng: number; lat: number; zoom: number }): void;
  returnHome(): void;
}

export function createMoves(d: MovesDeps): StageMoves {
  const { state: s, reveal, wall, fly, draw } = d;
  let lastRaw = "";
  /** Whether a place was asked for yet: the first is where the deck opens, which is no reveal. */
  let visited = false;
  return {
    goTo(raw, options) {
      let next: Place;
      try {
        next = resolvePlace(raw);
      } catch {
        return;
      }
      const before = s.homeAt;
      // A build that stands the clock up or lets it go moves the camera though the place is the same.
      const shownBefore = reveal.shown();
      const samePlace = raw === lastRaw;
      const first = !visited;
      visited = true;
      lastRaw = raw;
      s.home = next;
      if (options?.at) s.homeAt = options.at;
      // A spinning slide has no place to hold, so the camera's last command stays good for it.
      const same =
        samePlace &&
        !s.overviewOpen &&
        (s.commanded || d.spinWanted()) &&
        !s.steering &&
        reveal.shown() === shownBefore &&
        (!(s.offPlace || s.engine?.isSpinning()) || d.spinWanted());
      const hop = options?.hop ?? false;
      // A reveal still running is overtaken: the camera is not on its place yet.
      const overtaken = reveal.cancel();
      // Past the reveal onto a slide that keeps the clock (a jump to the close), the clock stays.
      if (
        !first &&
        !overtaken &&
        before.slide < reveal.at &&
        s.homeAt.slide >= reveal.at &&
        !reveal.shown()
      ) {
        // Leaving the wall, by a step or a jump, breaks it first; the clock behind it shatters
        // into the Earth once the wall's last shard has faded.
        if (wall.kind() === "wall") wall.arrange(next.kind);
        const breaking = ["approach", "breaking"].includes(wall.state());
        reveal.start(hop, breaking ? CLEAR_MS : 0);
        return;
      }
      wall.arrange(next.kind);
      reveal.show();
      if (same && !overtaken) {
        draw();
        return;
      }
      fly(hop);
    },
    overview(open) {
      if (open === s.overviewOpen) return;
      s.overviewOpen = open;
      // The overview shows the Earth: a reveal running ends at once, and the wall breaks.
      if (reveal.cancel()) wall.arrange(s.home.kind);
      reveal.show();
      fly(true);
    },
    steer(vector) {
      const moving = vector.lng !== 0 || vector.lat !== 0 || vector.zoom !== 0;
      s.steering = moving;
      if (moving) s.commanded = false;
      s.engine?.steer(vector);
    },
    returnHome() {
      if ((s.commanded || d.spinWanted()) && !s.steering) return;
      fly(true);
    },
  };
}
