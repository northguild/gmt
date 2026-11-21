/**
 * The route the talk flies, read from the page: every geographic place a slide or a build names, in
 * document order, as stops; the pins (one per distinct place); and the legs between consecutive
 * stops. Pure: the stage draws them (`stage-markers.ts`).
 */
import {
  isGeographic,
  resolvePlace,
  type Place,
  type PlacePoint,
} from "./places";
import type { StageAt } from "./stage-state";

/** One place a slide or a build names, in the order the talk visits them. */
export interface Stop {
  key: string;
  place: Extract<Place, { kind: "zone" | "point" }>;
  slide: number;
  build: number;
}

export interface Leg {
  from: Stop["place"];
  to: Stop["place"];
  /** The stop that ends the leg. */
  end: Stop;
}

export const keyOf = (place: Stop["place"]): string =>
  place.kind === "zone" ? place.zone : place.label;

export const lngLat = (place: Stop["place"]): PlacePoint => [
  place.lng,
  place.lat,
];

/** Every geographic place the page names, slides and builds, in document order. */
export function readStops(root: HTMLElement): Stop[] {
  const stops: Stop[] = [];
  const add = (raw: string | undefined, slide: number, build: number): void => {
    if (!raw) return;
    let place: Place;
    try {
      place = resolvePlace(raw);
    } catch {
      // The deck's own test resolves every place its slides name; nothing to show here.
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

/** One pin per distinct place, in the order first visited. */
export function pinsOf(stops: readonly Stop[]): Map<string, Stop["place"]> {
  const pins = new Map<string, Stop["place"]>();
  for (const stop of stops)
    if (!pins.has(stop.key)) pins.set(stop.key, stop.place);
  return pins;
}

/** Whether a stop has been reached at a position in the deck. */
export const reached = (stop: Stop, at: StageAt): boolean =>
  stop.slide < at.slide || (stop.slide === at.slide && stop.build <= at.build);

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
