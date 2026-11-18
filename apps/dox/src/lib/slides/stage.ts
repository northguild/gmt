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
 * Places come from the slides (`data-place`, `places.ts`). The route is read from the page in
 * document order: every place a slide or a build names, as pins and as arcs between the pins in the
 * order the talk visits them. Time comes from gmt, imported after first paint.
 *
 * The camera moves only where the talk changes section. Inside one section time moves instead: a
 * slide or build names a `lapse` (`time-lapse.ts`), which scrubs the sun across the Earth and dates
 * the lapse's pins in their own zones, and a slide may light every upstream filing as a pin
 * (`filing-pins.ts`). Both end at once under reduced motion.
 *
 * A deck may open on a clock instead of the planet: the first slide with `data-reveal="<zone>"` is
 * where the Earth appears. Before it a 24-hour clock of the zone's wall time stands in the Earth's
 * place (`earth-clock.ts`) and the camera waits over the North Pole, turned so the zone lies under
 * the hour hand (a `pole:<zone>` place), at the slide's own zoom so the clock takes the Earth's
 * size. Stepping onto the reveal turns the clock into the Earth over `REVEAL_MS` (the hour marks
 * onto the meridians, the meridians drawn in, the Earth faded in under them); then the wall breaks
 * and the camera flies on. Under reduced motion, on a deep link past it, or with no globe, the
 * clock is simply gone. The overview always shows the Earth.
 */
import type {
  GlobeArc,
  GlobeEngine,
  GlobeFraming,
  GlobeMarker,
  Rgba,
} from "~/lib/globe/types";
import { hopDuration } from "~/lib/globe/controller";
import {
  labelFont,
  parseColour,
  readTheme,
  rendererOverride,
} from "~/lib/globe/globe-theme";
import {
  drawWithoutGlobe,
  followGlobe,
  loadClock,
  loadSky,
} from "~/lib/space-sky";
import { mountEarthClock, type EarthClock } from "./earth-clock";
import { mountIceWall, type IceWall } from "./ice-wall/wall";
import { wirePlanetZones } from "./planet-zones";
import { showText } from "./type-out";
import { clockLabel, loadZonedNow, nearestZones, WALL_PINS } from "./clocks";
import {
  decodeSteps,
  pinsAfter,
  runCount,
  type FilingStep,
} from "./filing-pins";
import {
  dateOf,
  isLapseName,
  lapseLabel,
  loadLapseTools,
  planLapse,
  runLapse,
  type LapseFrame,
  type LapseTools,
} from "./time-lapse";
import {
  arcDegrees,
  getPlanetZones,
  isGeographic,
  labelOf,
  meridianTurn,
  pointFor,
  resolvePlace,
  rotationFor,
  zoomFor,
  type Place,
  type PlacePoint,
} from "./places";

export interface StageAt {
  /** Zero-based slide and how many of its builds are shown. */
  slide: number;
  build: number;
}

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
   * Plays the named time-lapse (`LAPSES`), or with `null` returns the sun to now. Asking for the
   * lapse already playing or played does nothing, so every step may call it.
   */
  lapse(name: string | null): void;
  /** Lights the filings as pins and runs the count up, or clears them. */
  pinFilings(on: boolean): void;
  destroy(): void;
}

/** One place a slide or a build names, in the order the talk visits them. */
interface Stop {
  key: string;
  place: Extract<Place, { kind: "zone" | "point" }>;
  slide: number;
  build: number;
}

const HOP_DIP_ZOOM = 0.6;
/** A move shorter than this many degrees is not worth a flight. */
const MIN_HOP_DEG = 1;
const ARC_ALTITUDE = 0.15;

const LAYOUT_FULL = "full";

/** The Earth turns once while the shards land: 360 degrees at this rate, then back to the place. */
const TURN_DEG_PER_S = 30;
const TURN_MS = 12000;
/** How often the clock pins' labels are read again, milliseconds. */
const CLOCK_REFRESH_MS = 20000;
/** The count waits this long for the flight to the overview to settle, milliseconds. */
const FILINGS_DELAY_MS = 2200;
/** How long the clock takes to turn into the Earth before the camera flies on, milliseconds. */
export const REVEAL_MS = 2200;

type PolePlace = Extract<Place, { kind: "pole" }>;

/** The camera over the North Pole for a reveal's zone; `null` with no zone or one not in the table. */
function poleOf(zone: string | undefined): PolePlace | null {
  if (!zone) return null;
  try {
    const place = resolvePlace(`pole:${zone}`);
    return place.kind === "pole" ? place : null;
  } catch {
    // `Slide.astro` fails the build for a reveal zone the table does not hold.
    return null;
  }
}

const keyOf = (place: Stop["place"]): string =>
  place.kind === "zone" ? place.zone : place.label;

/** Every geographic place the page names, slides and builds, in document order. */
export function readStops(root: HTMLElement): Stop[] {
  const stops: Stop[] = [];
  const add = (raw: string | undefined, slide: number, build: number): void => {
    if (!raw) return;
    let place: Place;
    try {
      place = resolvePlace(raw);
    } catch {
      // `Slide.astro` and `Build.astro` fail the build for a bad place; nothing to show here.
      return;
    }
    if (isGeographic(place))
      stops.push({ key: keyOf(place), place, slide, build });
  };
  root.querySelectorAll<HTMLElement>("[data-slide]").forEach((el, i) => {
    add(el.dataset["place"], i, 0);
    el.querySelectorAll<HTMLElement>("[data-build]").forEach((b) =>
      add(b.dataset["place"], i, Number(b.dataset["build"]) || 1),
    );
  });
  return stops;
}

/** Whether a stop has been reached at a position in the deck. */
const reached = (stop: Stop, at: StageAt): boolean =>
  stop.slide < at.slide || (stop.slide === at.slide && stop.build <= at.build);

interface Leg {
  from: Stop["place"];
  to: Stop["place"];
  /** The stop that ends the leg. */
  end: Stop;
}

/** The arcs: one per pair of consecutive stops at different places. */
export function legsOf(stops: readonly Stop[]): Leg[] {
  const legs: Leg[] = [];
  for (let i = 1; i < stops.length; i += 1) {
    const prev = stops[i - 1]!;
    const stop = stops[i]!;
    if (prev.key !== stop.key)
      legs.push({ from: prev.place, to: stop.place, end: stop });
  }
  return legs;
}

const lngLat = (place: Stop["place"]): PlacePoint => [place.lng, place.lat];

/** Keeps a canvas out of the tab order and the accessibility tree: the slides are the content. */
/**
 * Writes the camera's state on the space layer, on a change only: `data-flight` is `moving` or
 * `rest`, and `data-rotation` is the settled `lng lat` in degrees (`data-target`, set when a
 * flight starts, is the `lng lat` it is bound for; `moving` covers the clock's reveal too). The
 * deck's gate reads them
 * (`scripts/slides-check.mjs`) to see that a flight lands on its slide's place and stops asking
 * for frames.
 */
function publishView(
  host: HTMLElement,
  globe: GlobeEngine,
  holding: boolean,
): void {
  const view = globe.getView();
  // The reveal before a flight counts as moving: the camera is not on its place yet.
  const flight = view.moving || holding ? "moving" : "rest";
  if (host.dataset["flight"] !== flight) host.dataset["flight"] = flight;
  if (view.moving) return;
  const rotation = `${(-view.rotation[0]).toFixed(2)} ${(-view.rotation[1]).toFixed(2)}`;
  if (host.dataset["rotation"] !== rotation)
    host.dataset["rotation"] = rotation;
}

function hardenCanvases(host: HTMLElement): void {
  for (const canvas of host.querySelectorAll<HTMLCanvasElement>(
    ":scope > canvas",
  )) {
    canvas.removeAttribute("tabindex");
    canvas.removeAttribute("role");
    canvas.removeAttribute("aria-label");
    canvas.setAttribute("aria-hidden", "true");
  }
}

/** Mounts the stage under the deck's root. Never throws; with no space layer it does nothing. */
export function mountSpaceStage(
  root: HTMLElement,
  o: { signal: AbortSignal },
): SpaceStage {
  wirePlanetZones();
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
  /** The slide the Earth first shows on, and the clock's zone; -1 and `null` with no reveal. */
  const revealAt = slideEls.findIndex((el) => el.dataset["reveal"]);
  const pole = poleOf(slideEls[revealAt]?.dataset["reveal"]);

  /* The pins: one per distinct place, in the order first visited. */
  const pins = new Map<string, Stop["place"]>();
  for (const stop of stops)
    if (!pins.has(stop.key)) pins.set(stop.key, stop.place);
  const pinPoints: PlacePoint[] = Array.from(pins.values(), lngLat);

  let engine: GlobeEngine | null = null;
  let lastRaw = "";
  let steering = false;
  let now: () => number = () => 0;
  let home: Place = { kind: "overview" };
  let homeAt: StageAt = { slide: 0, build: 0 };
  let overviewOpen = false;
  /** Whether the camera was last sent to `home` and nothing has moved it since. */
  let commanded = false;
  let centred = false;
  let colours: { cyan: Rgba; teal: Rgba } | null = null;
  let theme: ReturnType<typeof readTheme> | null = null;
  let wall: IceWall | null = null;
  /** The kind of place the wall and the clocks were last arranged for. */
  let shownKind: Place["kind"] | null = null;
  /** Zones that carry a clock pin, with the label each shows. */
  const clockOn = new Set<string>();
  const clockLabels = new Map<string, string>();
  let zonedNow:
    | ((zone: string, o?: { smallestUnit?: "minute" }) => string)
    | null = null;
  let clockTimer = 0;
  let turnPending = false;
  let turnTimer = 0;
  /** The clock in the Earth's place before the reveal; `null` in a deck with none. */
  let earthClock: EarthClock | null = null;
  /** The timer of the clock turning into the Earth; 0 when no reveal runs. */
  let revealTimer = 0;
  /** Whether a place was asked for yet: the first is where the deck opens, which is no reveal. */
  let visited = false;

  /** The sun's instant while a lapse plays or holds its end; `null` is now. */
  let sunMs: number | null = null;
  let lapseTools: LapseTools | null = null;
  let wantedLapse: string | null = null;
  let activeLapse: string | null = null;
  let lapseStop: (() => void) | null = null;
  let lapseZones: readonly string[] = [];
  let lapseStamps: Readonly<Record<string, string>> = {};
  /** Zones lit for the filing pins, with the filings each holds so far. */
  let filingCounts = new Map<string, number>();
  let filingsOn = false;
  let filingStop: (() => void) | null = null;
  let filingTimer = 0;
  const filingSteps: FilingStep[] = decodeSteps(
    root.querySelector<HTMLElement>("[data-filing-steps]")?.dataset[
      "filingSteps"
    ] ?? "",
  );

  const reduced = (): boolean =>
    win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const target = (): Place => (overviewOpen ? { kind: "overview" } : home);

  /**
   * The UTC instant the slide's builds hold the clock at: the highest reached build's
   * `data-clock-at`, or `null` when no reached build holds it.
   */
  const heldAt = (): string | null => {
    let at: string | null = null;
    let highest = 0;
    const builds =
      slideEls[homeAt.slide]?.querySelectorAll<HTMLElement>(
        "[data-build][data-clock-at]",
      ) ?? [];
    for (const b of builds) {
      const n = Number(b.dataset["build"]);
      if (n <= homeAt.build && n > highest) {
        highest = n;
        at = b.dataset["clockAt"] ?? null;
      }
    }
    return at;
  };

  /**
   * Whether the clock stands in the Earth's place: on a slide before the reveal, on one past it
   * that asks for the clock again (`data-clock`, the close), or from a build that holds it at an
   * instant (`data-clock-at`, the GMT slide's skipped hour), outside the overview.
   */
  const clockShown = (): boolean =>
    earthClock !== null &&
    pole !== null &&
    !overviewOpen &&
    (homeAt.slide < revealAt ||
      slideEls[homeAt.slide]?.dataset["clock"] !== undefined ||
      heldAt() !== null);

  /** Where the camera looks: over the pole while the clock shows, else the target. */
  const aimed = (): Place => (clockShown() && pole ? pole : target());

  const lit = (): "all" | "current" =>
    target().kind === "overview" ? "all" : "current";

  /** Pins and arcs for the camera's place and position in the deck. */
  function draw(): void {
    if (!engine || !theme || !colours) return;
    const place = target();
    const all = lit() === "all";
    const reachedStops = stops.filter((s) => reached(s, homeAt));
    const current = isGeographic(place) ? keyOf(place) : undefined;
    const markers: GlobeMarker[] = [];
    for (const [key, p] of pins) {
      if (clockOn.has(key)) continue;
      const on = all || key === current;
      markers.push({
        id: `pin-${key}`,
        position: lngLat(p),
        radius: on ? 6 : 3.5,
        color: on ? theme.markerPrimary : theme.markerOther,
        ...(on ? { label: labelOf(p) } : {}),
        ...(key === current
          ? { ring: { radius: 11, width: 1.5, color: theme.markerPrimary } }
          : {}),
      });
    }
    const dated = new Set(lapseZones);
    for (const zone of new Set([...clockOn, ...dated])) {
      const place = resolvePlace(zone);
      if (!isGeographic(place)) continue;
      if (dated.has(zone)) {
        // A zone the lapse dates: its own local date and time, ringed, so the flip is the picture.
        markers.push({
          id: `clock-${zone}`,
          position: lngLat(place),
          radius: 7,
          color: theme.markerPrimary,
          label: lapseLabel(labelOf(place), lapseStamps[zone] ?? ""),
          ring: { radius: 12, width: 1.5, color: theme.markerPrimary },
        });
      } else if (activeLapse !== null) {
        // The other clocks hold still as dots while time moves, so the dated pins read alone.
        markers.push({
          id: `clock-${zone}`,
          position: lngLat(place),
          radius: 3.5,
          color: theme.markerOther,
        });
      } else {
        markers.push({
          id: `clock-${zone}`,
          position: lngLat(place),
          radius: 6,
          color: theme.markerPrimary,
          label: clockLabels.get(zone) ?? labelOf(place),
        });
      }
    }
    for (const [zone, count] of filingCounts) {
      const place = resolvePlace(zone);
      if (!isGeographic(place)) continue;
      markers.push({
        id: `filing-${zone}`,
        position: lngLat(place),
        radius: 5 + Math.min(count, 4),
        color: theme.markerPrimary,
        label: `${labelOf(place)} ${count}`,
      });
    }
    const flown = legs.filter((l) => reachedStops.includes(l.end));
    const arcs: GlobeArc[] = [];
    legs.forEach((leg, i) => {
      const isFlown = flown.includes(leg);
      if (!all && !isFlown) return;
      const isCurrent = isFlown && flown[flown.length - 1] === leg;
      arcs.push({
        id: `leg-${i}`,
        from: lngLat(leg.from),
        to: lngLat(leg.to),
        color: all || isCurrent ? colours!.cyan : colours!.teal,
        width: 2,
        altitude: ARC_ALTITUDE,
      });
    });
    engine.setMarkers(markers);
    engine.setArcs(arcs);
  }

  /** The overview centres on the route and on every zone a filing names. */
  const filingPoints: PlacePoint[] = filingSteps.flatMap((s) => {
    if (s.zone === null) return [];
    try {
      const place = resolvePlace(s.zone);
      return isGeographic(place) ? [lngLat(place)] : [];
    } catch {
      return [];
    }
  });
  /** A zone's wall time as minutes since its midnight, read by gmt; `null` until gmt is in. */
  const wallMinutes = (zone: string): number | null => {
    const m = zonedNow ? /T(\d{2}):(\d{2})/.exec(zonedNow(zone)) : null;
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const context = () => ({
    instantMs: now(),
    pins: [...pinPoints, ...filingPoints],
    wallMinutes,
  });

  /** Stops a reveal that is running; says whether one was. */
  function cancelReveal(): boolean {
    if (!revealTimer) return false;
    win?.clearTimeout(revealTimer);
    revealTimer = 0;
    return true;
  }

  /** Sends the camera to the place it should look at. */
  function fly(hop: boolean): void {
    if (!engine) return;
    const place = aimed();
    const rotation = rotationFor(place, context());
    const view = engine.getView();
    const here: PlacePoint = [-view.rotation[0], -view.rotation[1]];
    const goal = pointFor(place, context());
    const arc = arcDegrees(here, goal);
    // The slide's zoom even over the pole, so the clock is the size the Earth will be.
    engine.setZoom(zoomFor(target()));
    if (host)
      host.dataset["target"] = `${goal[0].toFixed(2)} ${goal[1].toFixed(2)}`;
    if (hop && arc >= MIN_HOP_DEG && !reduced()) {
      engine.flyTo(rotation, {
        hop: { durationMs: hopDuration(arc), dipZoom: HOP_DIP_ZOOM },
      });
    } else {
      engine.flyTo(rotation);
    }
    commanded = true;
    draw();
  }

  /**
   * Sets the clock over the Earth's disc: the engine's own measure once it is up, else where the
   * Earth will be (the framing at the slide's zoom), so the clock stands right from first paint.
   */
  function fitClock(): void {
    if (!earthClock) return;
    if (engine) {
      earthClock.fit(engine.getCentre());
      return;
    }
    // The engine's own measure of the space layer, so the globe takes over without a jump.
    const frame = framing(host?.clientWidth ?? 0, host?.clientHeight ?? 0);
    earthClock.fit({
      x: frame.cx,
      y: frame.cy,
      radius: frame.radius * zoomFor(target()),
    });
  }

  function showClock(): void {
    earthClock?.hold(heldAt());
    earthClock?.set(clockShown() ? "on" : "off");
    fitClock();
  }

  /**
   * Turns the clock into the Earth: the camera turns to where the hand is now (it moved while the
   * clock showed), the clock's marks turn onto the meridians under them and the Earth fades in;
   * after `REVEAL_MS` the clock is gone, the wall breaks and the camera flies on. Under reduced
   * motion, with no globe or no window to time it, the clock goes at once.
   */
  function reveal(hop: boolean): void {
    if (!engine || !win || !earthClock || !pole || reduced() || overviewOpen) {
      arrange(home.kind);
      showClock();
      fly(hop);
      return;
    }
    const ctx = context();
    engine.setZoom(zoomFor(target()));
    engine.flyTo(rotationFor(pole, ctx));
    earthClock.set("morph", meridianTurn(pointFor(pole, ctx)[0]));
    const goal = pointFor(target(), ctx);
    if (host) {
      host.dataset["target"] = `${goal[0].toFixed(2)} ${goal[1].toFixed(2)}`;
      host.dataset["flight"] = "moving";
    }
    commanded = true;
    draw();
    const id = win.setTimeout(() => {
      if (revealTimer !== id) return;
      revealTimer = 0;
      earthClock?.set("off");
      arrange(home.kind);
      fly(hop);
    }, REVEAL_MS);
    revealTimer = id;
  }

  const framing = (w: number, h: number): GlobeFraming => {
    const sx = stageEl?.offsetLeft ?? 0;
    const sy = stageEl?.offsetTop ?? 0;
    const sw = stageEl?.clientWidth || w;
    const sh = stageEl?.clientHeight || h;
    // Zoom 1 fills the right third of the stage, and the middle of it behind a full-width slide.
    return centred
      ? {
          cx: sx + sw / 2,
          cy: sy + sh / 2,
          radius: Math.min(0.42 * sh, 0.3 * sw),
        }
      : {
          cx: sx + (sw * 5) / 6,
          cy: sy + sh / 2,
          radius: Math.min(0.42 * sh, 0.15 * sw),
        };
  };

  /** Reads every lit clock's local time again, and draws when a label changed. */
  function refreshClocks(): void {
    if (!zonedNow || activeLapse !== null) return;
    let changed = false;
    for (const zone of clockOn) {
      const label = clockLabel(zone, zonedNow);
      if (clockLabels.get(zone) !== label) {
        clockLabels.set(zone, label);
        changed = true;
      }
    }
    if (changed) draw();
  }

  /** Publishes how many clock pins are lit, for the deck's gate. */
  function publishClocks(): void {
    if (host) host.dataset["clocks"] = String(clockOn.size);
  }

  /** Publishes whether the Earth's turn is waiting or running, for the deck's gate. */
  function publishTurn(on: boolean): void {
    if (!host) return;
    if (on) host.dataset["turn"] = "on";
    else delete host.dataset["turn"];
  }

  function lightClock(zone: string): void {
    if (clockOn.has(zone)) return;
    clockOn.add(zone);
    publishClocks();
    if (!clockTimer && win)
      clockTimer = win.setInterval(refreshClocks, CLOCK_REFRESH_MS);
    refreshClocks();
    draw();
  }

  function clearClocks(): void {
    clockOn.clear();
    publishClocks();
    clockLabels.clear();
    if (clockTimer) win?.clearInterval(clockTimer);
    clockTimer = 0;
  }

  function stopTurn(): void {
    turnPending = false;
    publishTurn(false);
    if (turnTimer) win?.clearTimeout(turnTimer);
    turnTimer = 0;
  }

  /** The twelve zones nearest the planet camera's point become the shards' pins. */
  function shardZones(): string[] {
    const zones = getPlanetZones();
    const from = pointFor({ kind: "planet" }, context());
    return nearestZones(zones, from, WALL_PINS);
  }

  /** Starts the Earth's turn once the camera has settled on the planet. */
  function beginTurn(): void {
    if (!engine || !win) return;
    turnPending = false;
    commanded = false;
    engine.steer({ lng: TURN_DEG_PER_S, lat: 0, zoom: 0 });
    turnTimer = win.setTimeout(() => {
      turnTimer = 0;
      publishTurn(false);
      engine?.steer({ lng: 0, lat: 0, zoom: 0 });
      fly(false);
    }, TURN_MS);
  }

  /** Arranges the wall and the clocks for a change of place kind. */
  function arrange(next: Place["kind"]): void {
    const prev = shownKind;
    if (!wall || prev === next) return;
    shownKind = next;
    stopTurn();
    if (next === "wall") {
      clearClocks();
      if (prev === "planet") wall.restore();
      else wall.show(zoomFor({ kind: "wall" }) / (engine?.getZoom() || 1));
      draw();
    } else if (next === "planet") {
      if (prev === "wall") {
        clearClocks();
        wall.flyThrough(shardZones());
      } else {
        wall.hide();
        for (const zone of getPlanetZones()) lightClock(zone);
      }
    } else {
      wall.hide();
      clearClocks();
      draw();
    }
  }

  async function mountWall(globe: GlobeEngine): Promise<void> {
    const images = Array.from(
      root.querySelectorAll<HTMLImageElement>("[data-wall-pane] img"),
    );
    if (!host || !theme || images.length === 0) return;
    try {
      await Promise.all(images.map((image) => image.decode()));
    } catch {
      return;
    }
    if (signal.aborted) return;
    wall = mountIceWall({
      layer: host,
      engine: globe,
      panes: images.map((image) => ({
        id:
          image.closest<HTMLElement>("[data-wall-pane]")?.dataset["wallPane"] ??
          image.src,
        image,
      })),
      ice: theme.label,
      stageWidth: () => stageEl?.clientWidth ?? 0,
      signal,
      reduced,
      target: (zone) => {
        const place = resolvePlace(zone);
        if (!isGeographic(place)) return null;
        const at = globe.project(lngLat(place));
        return [at.x, at.y];
      },
      onPin: lightClock,
      onBreak: () => {
        // The twelve shards light their own pins as they land; the rest are lit now and come
        // round during the turn.
        const shards = new Set(shardZones());
        for (const zone of getPlanetZones())
          if (!shards.has(zone)) lightClock(zone);
        if (!reduced()) {
          turnPending = true;
          publishTurn(true);
        }
      },
    });
    void loadZonedNow().then((fn) => {
      zonedNow = fn;
      refreshClocks();
    });
    arrange(target().kind);
  }

  /** Publishes the lapse for the deck's gate and for the slides' own visuals. */
  function publishLapse(name: string | null, frame: LapseFrame | null): void {
    if (host) {
      if (name) host.dataset["lapse"] = name;
      else delete host.dataset["lapse"];
    }
    if (name && frame)
      root.dispatchEvent(
        new CustomEvent("gmt-lapse", {
          detail: {
            name,
            ms: frame.ms,
            done: frame.done,
            dates: Object.fromEntries(
              Object.entries(frame.stamps).map(([zone, stamp]) => [
                zone,
                dateOf(stamp),
              ]),
            ),
          },
        }),
      );
  }

  function stopLapse(): void {
    lapseStop?.();
    lapseStop = null;
  }

  /** Starts the wanted lapse once gmt is in; with none wanted, puts the sun back to now. */
  function applyLapse(): void {
    if (wantedLapse === activeLapse) return;
    stopLapse();
    activeLapse = null;
    lapseZones = [];
    lapseStamps = {};
    sunMs = null;
    publishLapse(null, null);
    const name = wantedLapse;
    if (name === null || !isLapseName(name) || !lapseTools) {
      engine?.requestRender();
      draw();
      return;
    }
    const plan = planLapse(name, lapseTools);
    if (plan === null) {
      engine?.requestRender();
      return;
    }
    activeLapse = name;
    lapseZones = plan.zones;
    let seen = "";
    lapseStop = runLapse({
      plan,
      tools: lapseTools,
      win: win ?? {
        requestAnimationFrame: () => 0,
        cancelAnimationFrame: () => {},
      },
      reduced: reduced(),
      onFrame: (frame) => {
        sunMs = frame.ms;
        lapseStamps = frame.stamps;
        const key = JSON.stringify(frame.stamps);
        if (key !== seen || frame.done) {
          seen = key;
          publishLapse(name, frame);
          draw();
        }
        engine?.requestRender();
      },
    });
  }

  function stopFilings(): void {
    filingStop?.();
    filingStop = null;
    if (filingTimer) win?.clearTimeout(filingTimer);
    filingTimer = 0;
  }

  const countOutput = (): HTMLElement | null =>
    root.querySelector<HTMLElement>("[data-filing-count]");

  function setFilings(on: boolean): void {
    if (on === filingsOn) return;
    filingsOn = on;
    stopFilings();
    const total = filingSteps.length;
    const output = countOutput();
    // One digit per flap: a count shorter than the total leaves its leading flaps blank.
    const show = (n: number): void => {
      if (output)
        showText(output, String(n).padStart(String(total).length, " "));
    };
    if (!on || total === 0 || !win) {
      filingCounts = new Map();
      show(total);
      if (host) delete host.dataset["filings"];
      draw();
      return;
    }
    const play = (): void => {
      filingTimer = 0;
      filingStop = runCount({
        total,
        win,
        reduced: reduced(),
        onStep: (n) => {
          filingCounts = pinsAfter(filingSteps, n);
          show(n);
          if (host) host.dataset["filings"] = String(n);
          draw();
        },
      });
    };
    show(0);
    if (reduced()) play();
    else filingTimer = win.setTimeout(play, FILINGS_DELAY_MS);
  }

  const handle: SpaceStage = {
    goTo(raw, options) {
      let next: Place;
      try {
        next = resolvePlace(raw);
      } catch {
        return;
      }
      const before = homeAt;
      // A build that stands the clock up or lets it go moves the camera though the place is the same.
      const shownBefore = clockShown();
      const samePlace = raw === lastRaw;
      const first = !visited;
      visited = true;
      lastRaw = raw;
      home = next;
      if (options?.at) homeAt = options.at;
      const same =
        samePlace &&
        !overviewOpen &&
        commanded &&
        !steering &&
        clockShown() === shownBefore;
      const hop = options?.hop ?? false;
      // A reveal still running is overtaken: the camera is not on its place yet.
      const overtaken = cancelReveal();
      const full = slideEls[homeAt.slide]?.dataset["layout"] === LAYOUT_FULL;
      if (full !== centred) {
        centred = full;
        engine?.refit();
      }
      // Past the reveal onto a slide that keeps the clock (a jump to the close), the clock stays.
      if (
        !first &&
        !overtaken &&
        before.slide < revealAt &&
        homeAt.slide >= revealAt &&
        !clockShown()
      ) {
        reveal(hop);
        return;
      }
      arrange(next.kind);
      showClock();
      if (same && !overtaken) {
        draw();
        return;
      }
      fly(hop);
    },
    overview(open) {
      if (open === overviewOpen) return;
      overviewOpen = open;
      // The overview shows the Earth: a reveal running ends at once, and the wall breaks.
      if (cancelReveal()) arrange(home.kind);
      showClock();
      fly(true);
    },
    steer(vector) {
      const moving = vector.lng !== 0 || vector.lat !== 0 || vector.zoom !== 0;
      steering = moving;
      if (moving) commanded = false;
      engine?.steer(vector);
    },
    returnHome() {
      if (commanded && !steering) return;
      fly(true);
    },
    lapse(name) {
      wantedLapse = name;
      applyLapse();
    },
    pinFilings: setFilings,
    destroy: () => own.abort(),
  };

  if (!host || signal.aborted) return handle;

  root.setAttribute("data-space", "");

  if (pole) {
    earthClock = mountEarthClock(host, {
      signal,
      zone: pole.zone,
      city: labelOf({ ...pole, kind: "zone" }),
    });
    // Until the globe is up nothing else moves the clock when the window changes size.
    win?.addEventListener(
      "resize",
      () => {
        if (!engine) fitClock();
      },
      { signal },
    );
  }

  const stars = host.querySelector<HTMLCanvasElement>(
    '[data-sky-canvas="stars"]',
  );
  const band = host.querySelector<HTMLCanvasElement>(
    '[data-sky-canvas="band"]',
  );
  const sky =
    stars && band && host.dataset["skySrc"]
      ? loadSky({
          stars,
          band,
          host,
          src: host.dataset["skySrc"],
          milkyWay: host.dataset["milkyWay"],
          signal,
        })
      : Promise.resolve(null);

  const watcher =
    typeof MutationObserver === "function"
      ? new MutationObserver(() => hardenCanvases(host))
      : null;

  async function boot(): Promise<void> {
    if (!host) return;
    let created: GlobeEngine | null = null;
    try {
      // The wall time is read before the camera is placed: over the pole the zone sits under the hand.
      const [time, zoned] = await Promise.all([
        loadClock(),
        loadZonedNow().catch(() => null),
      ]);
      if (signal.aborted) return;
      now = time.getUnixNow;
      zonedNow ??= zoned;
      void loadLapseTools().then(
        (tools) => {
          if (signal.aborted) return;
          lapseTools = tools;
          applyLapse();
        },
        () => {},
      );
      const { createGlobeEngine } = await import("~/lib/globe/engine");
      if (signal.aborted) return;
      theme = readTheme(host);
      const style = getComputedStyle(host);
      const token = (name: string, fallback: Rgba): Rgba =>
        parseColour(style.getPropertyValue(name).trim()) ?? fallback;
      colours = {
        cyan: token("--gmt-cyan", theme.markerPrimary),
        teal: token("--gmt-teal", theme.markerOther),
      };
      watcher?.observe(host, { childList: true });
      const motion = win?.matchMedia?.("(prefers-reduced-motion: reduce)");
      created = await createGlobeEngine(host, {
        renderer: rendererOverride(),
        sunInstant: () => sunMs ?? time.getUnixNow(),
        theme,
        labelFont: labelFont(host),
        ariaLabel: "The Earth and the night sky behind the slides",
        initialRotation: rotationFor(aimed(), context()),
        zoomRange: [0.5, 4],
        // The slide's zoom from the first frame, so the clock over the Earth keeps its size.
        initialZoom: zoomFor(target()),
        reducedMotion: () => motion?.matches ?? false,
        ambient: false,
        maxDpr: 1.5,
        pauseWhenHidden: host,
        framing,
        ...(stageEl ? { framingWatch: [stageEl] } : {}),
        ...(host.dataset["earth"] ? { imageryUrl: host.dataset["earth"] } : {}),
      });
    } catch {
      created = null;
    }
    if (signal.aborted) {
      created?.destroy();
      return;
    }
    if (!created) {
      host.dataset["globe"] = "none";
      void drawWithoutGlobe(sky, host, signal);
      return;
    }
    engine = created;
    hardenCanvases(host);
    created.onInteract(() => {
      commanded = false;
    });
    host.dataset["globe"] = "ready";
    fly(false);
    // The engine has one frame slot and the sky's follow loop needs it, so the stage owns the slot
    // and runs the loop from it, then publishes the camera's state (`publishView`).
    let follow: (() => void) | null = null;
    const globe = created;
    globe.onFrame(() => {
      follow?.();
      fitClock();
      publishView(host, globe, revealTimer !== 0);
      if (!wall) return;
      const view = globe.getView();
      if (shownKind === "wall")
        wall.setDepth(zoomFor({ kind: "wall" }) / (view.zoom || 1));
      if (turnPending && !view.moving) beginTurn();
      if (wall.state === "whole") {
        // Where each pane's centre is and how wide a pane is, for the gate's pixel check (`scripts/slides-check.mjs`).
        const centres = wall
          .paneCentres()
          .map((c) => `${c[0].toFixed(1)},${c[1].toFixed(1)}`)
          .join(" ");
        if (host.dataset["wallCentres"] !== centres)
          host.dataset["wallCentres"] = centres;
        const paneWidth = wall.paneWidth().toFixed(1);
        if (host.dataset["wallPaneWidth"] !== paneWidth)
          host.dataset["wallPaneWidth"] = paneWidth;
      }
    });
    void mountWall(globe);
    void followGlobe({
      sky,
      globe: {
        getRotation: () => globe.getRotation(),
        getZoom: () => globe.getZoom(),
        getCentre: () => globe.getCentre(),
        onFrame: (callback) => {
          follow = callback;
        },
      },
      origin: host,
      surface: host,
      signal,
    });
  }

  void boot();

  signal.addEventListener(
    "abort",
    () => {
      watcher?.disconnect();
      stopLapse();
      stopFilings();
      stopTurn();
      cancelReveal();
      clearClocks();
      wall?.destroy();
      wall = null;
      engine?.destroy();
      engine = null;
      root.removeAttribute("data-space");
      delete host.dataset["globe"];
    },
    { once: true },
  );

  return handle;
}
