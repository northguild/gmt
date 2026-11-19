/**
 * The deck's space stage: the real sky and the Earth behind the slides, and the camera that goes
 * from place to place as the talk steps.
 *
 * Layers, bottom to top: the sky (two canvases), the globe canvas, the slide stage. All of it is
 * `aria-hidden` and decoration: the slides carry every word. The globe's canvas is never focusable,
 * so the engine's own arrow keys never run; drag orbits, and the keys are the deck's (`keys.ts`).
 *
 * Mount order: slide text paints first (it is server-rendered); then the sky starts; then the globe
 * mounts. Neither is waited for. If the globe cannot start on either renderer the sky is drawn once
 * without it, and if the sky fails the slides read on the void. No failure is shown to the reader.
 *
 * Places come from the slides (`data-place`, `places.ts`; the deck's own named places arrive in
 * its stage data, `stage-data.ts`). The route is read from the page in document order: every place
 * a slide or a build names, as pins and as arcs between the pins in the order the talk visits
 * them. Time comes from gmt, imported after first paint (`gmt-loader.ts`).
 *
 * This file is the core every deck gets: it reads the route, keeps the camera's place, and drives
 * the parts. The sky and the globe come up in `stage-boot.ts`, the camera is `stage-camera.ts`, the
 * pins and arcs are drawn by `stage-markers.ts` from the route (`stage-route.ts`), and the ice
 * wall and the clock pins it leaves are `stage-wall.ts` and `stage-clocks.ts`. Four features are
 * opt-in modules a deck uses by what its slides carry: the time-lapses (`stage-lapse.ts`,
 * `data-lapse`), the opening clock and reveal (`stage-reveal.ts`, `data-reveal`), the filing pins
 * (`stage-filings.ts`, `data-pins="filings"`) and the idle turn (`stage-spin.ts`, `data-spin`). A
 * page without them never runs them.
 *
 * A slide with `data-spin` turns the Earth at the home globe's idle rate and ramp (`setSpin`), once
 * the clock is gone and the wall has broken. Leaving it, the flight to the next slide's place
 * takes over at the speed the Earth is turning, with no dip: the turn flows into the flight and
 * the flight settles on the place. Under reduced motion nothing turns.
 *
 * The Earth and the clock sit in the right third on every slide and never move sideways. Motion
 * that would cross the slides' text (the wall's break) shows as `data-stage-busy` on the deck root:
 * the arriving slide's text waits for it to end, then fades in. The clock's shards stay in the
 * right third, so the text fades in while they fly.
 */
import { prefersReducedMotion } from "~/lib/reduced-motion";
import type { PlacePoint } from "./places";
import { createClockPins } from "./stage-clocks";
import { builtAttribute } from "./stage-builds";
import { bootStage } from "./stage-boot";
import { createFlight, framingOf, publishView } from "./stage-camera";
import { createFilings } from "./stage-filings";
import { createLapse } from "./stage-lapse";
import { drawRoute } from "./stage-markers";
import { createMoves } from "./stage-moves";
import { createReveal } from "./stage-reveal";
import { legsOf, lngLat, pinsOf, readStops } from "./stage-route";
import { createSpin } from "./stage-spin";
import { applyStageData, type DeckStageData } from "./stage-data";
import { newStageState, targetOf, type StageAt } from "./stage-state";
import { createStageWall } from "./stage-wall";

export interface SpaceStage {
  /**
   * Moves the camera to a place string. `hop` flies a lifted arc; without it the move is the
   * engine's plain ease. Asking for the place the camera already holds and has not been moved from
   * does nothing, so every step may call it. `at` says where in the deck the place sits, which
   * decides the legs of the route already flown.
   */
  goTo(place: string, options?: { hop?: boolean; at?: StageAt }): void;
  /** The `O` dialog: the whole route lit, then back to the slide's place. */
  overview(open: boolean): void;
  /** Holds a camera rate (degrees and zoom units per second); zeros stop it. */
  steer(vector: { lng: number; lat: number; zoom: number }): void;
  /** Flies back to the slide's place, unless the camera is already there. */
  returnHome(): void;
  /**
   * Plays the named time-lapse (the deck's `lapses`), or with `null` returns the sun to now. Asking for the
   * lapse already playing or played does nothing, so every step may call it.
   */
  lapse(name: string | null): void;
  /** Lights the filings as pins and runs the count up, or clears them. */
  pinFilings(on: boolean): void;
  destroy(): void;
}

/** Mounts the stage under the deck's root. Never throws; with no space layer it does nothing. */
export function mountSpaceStage(
  root: HTMLElement,
  o: { signal: AbortSignal; data: DeckStageData },
): SpaceStage {
  applyStageData(o.data);
  const own = new AbortController();
  const signal = AbortSignal.any([o.signal, own.signal]);
  const win = root.ownerDocument.defaultView;
  const host = root.querySelector<HTMLElement>("[data-deck-space]");
  const stageEl = root.querySelector<HTMLElement>("[data-deck-stage]");
  const slideEls = Array.from(
    root.querySelectorAll<HTMLElement>("[data-slide]"),
  );
  const stops = readStops(root);
  const legs = legsOf(stops);
  const pins = pinsOf(stops);
  const pinPoints: PlacePoint[] = Array.from(pins.values(), lngLat);
  const s = newStageState();

  const reduced = (): boolean => prefersReducedMotion(win ?? {});
  const framing = framingOf(stageEl);
  const draw = (): void => {
    if (!s.engine || !s.theme || !s.colours) return;
    const { markers, arcs } = drawRoute({
      target: targetOf(s),
      homeAt: s.homeAt,
      stops,
      legs,
      pins,
      theme: s.theme,
      colours: s.colours,
      clocks,
      lapse: {
        zones: sun.zones(),
        stamps: sun.stamps(),
        playing: sun.active() !== null,
      },
      filings: filings.counts(),
    });
    s.engine.setMarkers(markers);
    s.engine.setArcs(arcs);
  };
  /** What the camera needs to place a place: the lapse's Moon, the pins to centre on, the clocks. */
  const context = () => ({
    instantMs: sun.moonInstant(
      builtAttribute(slideEls[s.homeAt.slide], "lapse", s.homeAt.build) ??
        slideEls[s.homeAt.slide]?.dataset["lapse"] ??
        null,
    ),
    pins: [...pinPoints, ...filings.points],
    wallMinutes: clocks.wallMinutes,
  });

  const sun = createLapse({
    root,
    host,
    win,
    defs: o.data.lapses,
    now: () => s.now(),
    engine: () => s.engine,
    draw,
  });
  const filings = createFilings({ root, host, win, draw });
  const clocks = createClockPins({
    host,
    win,
    zonedNow: () => s.zonedNow,
    lapsePlaying: () => sun.active() !== null,
    draw,
  });
  const wall = createStageWall({
    state: s,
    root,
    host,
    stageEl,
    signal,
    reduced,
    clocks,
    context,
    draw,
  });
  const spin = createSpin({
    state: s,
    host,
    slideEls,
    reduced,
    clockUp: () => reveal.shown() || reveal.running(),
    wallKind: wall.kind,
    wallState: wall.state,
  });
  const fly = createFlight({
    state: s,
    host,
    reduced,
    aimed: () => reveal.aimed(),
    context,
    draw,
  });
  const reveal = createReveal({
    host,
    win,
    signal,
    slideEls,
    homeSlide: () => s.homeAt.slide,
    homeBuild: () => s.homeAt.build,
    engine: () => s.engine,
    framing,
    target: () => targetOf(s),
    home: () => s.home,
    overviewOpen: () => s.overviewOpen,
    context,
    arrange: wall.arrange,
    fly,
    draw,
    commanded: () => {
      s.commanded = true;
    },
    syncBusy: wall.syncBusy,
    syncSpin: spin.sync,
  });

  const moves = createMoves({
    state: s,
    reveal,
    wall,
    spinWanted: spin.wanted,
    fly,
    draw,
  });
  const handle: SpaceStage = {
    ...moves,
    lapse: sun.set,
    pinFilings: filings.set,
    destroy: () => own.abort(),
  };

  if (!host || signal.aborted) return handle;

  root.setAttribute("data-space", "");
  reveal.mount();
  void bootStage({
    state: s,
    host,
    stageEl,
    signal,
    reduced,
    framing,
    aimed: reveal.aimed,
    context,
    sun,
    wall,
    fly,
    frame: (globe) => {
      reveal.fit();
      spin.sync();
      publishView(host, globe, reveal.running());
      wall.follow(globe);
    },
  });

  signal.addEventListener(
    "abort",
    () => {
      sun.stop();
      filings.stop();
      reveal.cancel();
      root.removeAttribute("data-stage-busy");
      clocks.clear();
      wall.destroy();
      s.engine?.destroy();
      s.engine = null;
      root.removeAttribute("data-space");
      delete host.dataset["globe"];
    },
    { once: true },
  );

  return handle;
}
