/**
 * The space stage's opening clock and its reveal. Opt-in: a deck whose slides carry no
 * `data-reveal` has no pole, no clock and no reveal, and `mount` does nothing.
 *
 * The first slide with `data-reveal="<zone>"` is where the Earth appears. Before it a 24-hour
 * clock of the zone's wall time stands in the Earth's place (`earth-clock.ts`) and the camera waits
 * over the North Pole, turned so the zone lies under the hour hand (a `pole:<zone>` place), at the
 * slide's own zoom so the clock takes the Earth's size. Stepping onto the reveal breaks the clock
 * away over `REVEAL_MS` (`clock-shatter.ts`): behind it the camera has already turned to the
 * slide's place, and the Earth comes up there from behind the shards, at the clock's centre and
 * size. Under reduced motion, on a deep link past it, or with no globe, the clock is simply gone.
 * The overview always shows the Earth.
 *
 * A slide may ask for the clock again (`data-clock`, the close), and a build may hold it at an
 * instant (`data-clock-at`, a skipped hour).
 */
import type { GlobeEngine, GlobeFraming } from "~/lib/globe/types";
import { prefersReducedMotion } from "~/lib/reduced-motion";
import { SHATTER_MS } from "./clock-shatter";
import { builtAttribute } from "./stage-builds";
import { mountEarthClock, type EarthClock } from "./earth-clock";
import {
  labelOf,
  pointFor,
  resolvePlace,
  rotationFor,
  zoomFor,
  type Place,
  type PlaceContext,
} from "./places";

/** How long the clock takes to break away from in front of the Earth, milliseconds. */
export const REVEAL_MS = SHATTER_MS;

type PolePlace = Extract<Place, { kind: "pole" }>;

/** The camera over the North Pole for a reveal's zone; `null` with no zone or one not in the table. */
function poleOf(zone: string | undefined): PolePlace | null {
  if (!zone) return null;
  try {
    const place = resolvePlace(`pole:${zone}`);
    return place.kind === "pole" ? place : null;
  } catch {
    return null;
  }
}

interface RevealDeps {
  host: HTMLElement | null;
  win: Window | null;
  signal: AbortSignal;
  slideEls: readonly HTMLElement[];
  /** Where in the deck the camera's place sits. */
  homeSlide(): number;
  homeBuild(): number;
  engine(): GlobeEngine | null;
  framing(width: number, height: number): GlobeFraming;
  /** The place the slide names, or the overview while that is open. */
  target(): Place;
  home(): Place;
  overviewOpen(): boolean;
  context(): PlaceContext;
  /** Arranges the wall and the clock pins for a change of place kind. */
  arrange(kind: Place["kind"]): void;
  /** Sends the camera to the place it should look at. */
  fly(hop: boolean): void;
  draw(): void;
  /** Says the camera was just sent to its place, so asking for it again does nothing. */
  commanded(): void;
  syncBusy(): void;
  syncSpin(): void;
}

interface StageReveal {
  /** The slide the Earth first shows on, or -1 with no reveal. */
  at: number;
  /** Whether the clock stands in the Earth's place now. */
  shown(): boolean;
  /** Where the camera looks: over the pole while the clock shows, else the target. */
  aimed(): Place;
  /** Whether the clock is breaking away. */
  running(): boolean;
  /** Puts the clock up or takes it down for the slide on show. */
  show(): void;
  /** Sets the clock over the Earth's disc. */
  fit(): void;
  /** Breaks the clock away from in front of the Earth. */
  start(hop: boolean): void;
  /** Stops a reveal that is running; says whether one was. */
  cancel(): boolean;
  /** Mounts the clock under the space layer; call once the layer is known. */
  mount(): void;
}

export function createReveal(d: RevealDeps): StageReveal {
  const { host, win } = d;
  const at = d.slideEls.findIndex((el) => el.dataset["reveal"]);
  const pole = poleOf(d.slideEls[at]?.dataset["reveal"]);
  /** The clock in the Earth's place before the reveal; `null` in a deck with none. */
  let clock: EarthClock | null = null;
  /** The timer of the clock turning into the Earth; 0 when no reveal runs. */
  let timer = 0;

  /**
   * The UTC instant the slide's builds hold the clock at: the highest reached build's
   * `data-clock-at`, or `null` when no reached build holds it.
   */
  const heldAt = (): string | null =>
    builtAttribute(d.slideEls[d.homeSlide()], "clock-at", d.homeBuild());

  const shown = (): boolean =>
    clock !== null &&
    pole !== null &&
    !d.overviewOpen() &&
    (d.homeSlide() < at ||
      d.slideEls[d.homeSlide()]?.dataset["clock"] !== undefined ||
      heldAt() !== null);

  /**
   * Sets the clock over the Earth's disc: the engine's own measure once it is up, else where the
   * Earth will be (the framing at the slide's zoom), so the clock stands right from first paint.
   */
  function fit(): void {
    if (!clock) return;
    const engine = d.engine();
    if (engine) {
      clock.fit(engine.getCentre());
      return;
    }
    // The engine's own measure of the space layer, so the globe takes over without a jump.
    const frame = d.framing(host?.clientWidth ?? 0, host?.clientHeight ?? 0);
    clock.fit({
      x: frame.cx,
      y: frame.cy,
      radius: frame.radius * zoomFor(d.target()),
    });
  }

  function show(): void {
    clock?.hold(heldAt());
    clock?.set(shown() ? "on" : "off");
    fit();
    d.syncSpin();
  }

  function cancel(): boolean {
    if (!timer) return false;
    win?.clearTimeout(timer);
    timer = 0;
    d.syncBusy();
    return true;
  }

  /**
   * While the clock still hides the Earth, the camera turns straight to the slide's place (a hop
   * of one millisecond with no dip lands on the next frame), so the Earth comes up behind the
   * shards where it will stay and nothing moves after. After `REVEAL_MS` the clock is gone and the
   * wall is arranged. Under reduced motion, with no globe or no window to time it, the clock goes
   * at once.
   */
  function start(hop: boolean): void {
    const engine = d.engine();
    if (
      !engine ||
      !win ||
      !clock ||
      !pole ||
      prefersReducedMotion(win) ||
      d.overviewOpen()
    ) {
      d.arrange(d.home().kind);
      show();
      d.fly(hop);
      return;
    }
    const ctx = d.context();
    const target = d.target();
    const zoom = zoomFor(target);
    engine.setZoom(zoom);
    engine.flyTo(rotationFor(target, ctx), {
      hop: { durationMs: 1, dipZoom: zoom },
    });
    clock.set("shatter");
    const goal = pointFor(target, ctx);
    if (host) {
      host.dataset["target"] = `${goal[0].toFixed(2)} ${goal[1].toFixed(2)}`;
      host.dataset["flight"] = "moving";
    }
    d.commanded();
    d.draw();
    const id = win.setTimeout(() => {
      if (timer !== id) return;
      timer = 0;
      clock?.set("off");
      d.arrange(d.home().kind);
      d.fly(false);
      d.syncBusy();
    }, REVEAL_MS);
    timer = id;
    d.syncBusy();
  }

  return {
    at,
    shown,
    aimed: () => (shown() && pole ? pole : d.target()),
    running: () => timer !== 0,
    show,
    fit,
    start,
    cancel,
    mount: () => {
      if (!pole || !host) return;
      clock = mountEarthClock(host, {
        signal: d.signal,
        zone: pole.zone,
        city: labelOf({ ...pole, kind: "zone" }),
      });
      // Until the globe is up nothing else moves the clock when the window changes size.
      win?.addEventListener(
        "resize",
        () => {
          if (!d.engine()) fit();
        },
        { signal: d.signal },
      );
    },
  };
}
