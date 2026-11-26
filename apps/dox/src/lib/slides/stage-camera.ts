/**
 * The space stage's camera: where the Earth sits in the stage (`framing`), the flight to a place
 * (`createFlight`), the state it publishes for the deck's gate (`publishView`), and the canvases it
 * keeps out of the accessibility tree.
 */
import type { GlobeEngine, GlobeFraming } from "~/lib/globe/types";
import { hopDuration } from "~/lib/globe/controller";
import {
  arcDegrees,
  pointFor,
  rotationFor,
  zoomFor,
  type Place,
  type PlaceContext,
  type PlacePoint,
} from "./places";
import { targetOf, type StageState } from "./stage-state";

const HOP_DIP_ZOOM = 0.6;
/** A move shorter than this many degrees is not worth a flight. */
const MIN_HOP_DEG = 1;

/**
 * The Earth's place in the stage: the right third on every layout, whatever the zoom. The stage is
 * read as drawn, from its box against the deck's: a phone lays the stage out at 1024px and scales
 * it with a transform (`slides-phone.css`), where its offsets and client sizes are the unscaled ones.
 */
export const framingOf =
  (stageEl: HTMLElement | null) =>
  (w: number, h: number): GlobeFraming => {
    const box = stageEl?.getBoundingClientRect();
    const deck = stageEl?.offsetParent?.getBoundingClientRect();
    const sx = box && deck ? box.left - deck.left : 0;
    const sy = box && deck ? box.top - deck.top : 0;
    const sw = box?.width || w;
    const sh = box?.height || h;
    // Zoom 1 fills the right third of the stage, on every slide: the clock and the Earth never
    // move sideways, and the slides' content fits the two thirds on the left.
    return {
      cx: sx + (sw * 5) / 6,
      cy: sy + sh / 2,
      radius: Math.min(0.42 * sh, 0.15 * sw),
    };
  };

interface FlightDeps {
  state: StageState;
  host: HTMLElement | null;
  reduced(): boolean;
  /** Where the camera looks: over the pole while the clock shows, else the target. */
  aimed(): Place;
  context(): PlaceContext;
  draw(): void;
}

/** Sends the camera to the place it should look at; `hop` flies a lifted arc. */
export function createFlight(d: FlightDeps): (hop: boolean) => void {
  const { state: s } = d;
  return (hop) => {
    const engine = s.engine;
    if (!engine) return;
    s.offPlace = false;
    const place = d.aimed();
    const rotation = rotationFor(place, d.context());
    const view = engine.getView();
    const here: PlacePoint = [-view.rotation[0], -view.rotation[1]];
    const goal = pointFor(place, d.context());
    const arc = arcDegrees(here, goal);
    // The slide's zoom even over the pole, so the clock is the size the Earth will be.
    engine.setZoom(zoomFor(targetOf(s)));
    if (d.host)
      d.host.dataset["target"] = `${goal[0].toFixed(2)} ${goal[1].toFixed(2)}`;
    // A turning Earth flies on at its own speed: a hop would stop it dead and dip the camera.
    if (hop && arc >= MIN_HOP_DEG && !d.reduced() && !engine.isSpinning()) {
      engine.flyTo(rotation, {
        hop: { durationMs: hopDuration(arc), dipZoom: HOP_DIP_ZOOM },
      });
    } else {
      engine.flyTo(rotation);
    }
    s.commanded = true;
    d.draw();
  };
}

/**
 * Writes the camera's state on the space layer, on a change only: `data-flight` is `moving` or
 * `rest`, and `data-rotation` is the settled `lng lat` in degrees (`data-target`, set when a
 * flight starts, is the `lng lat` it is bound for; `moving` covers the clock's reveal too). The
 * deck's gate reads them
 * (`scripts/slides-check.mjs`) to see that a flight lands on its slide's place and stops asking
 * for frames.
 */
export function publishView(
  host: HTMLElement,
  globe: GlobeEngine,
  holding: boolean,
): void {
  const view = globe.getView();
  // The reveal before a flight counts as moving: the camera is not on its place yet.
  const flight = view.moving || holding ? "moving" : "rest";
  if (host.dataset["flight"] !== flight) host.dataset["flight"] = flight;
  // A spinning Earth is not on any place, so there is no settled rotation to publish.
  if (view.moving || globe.isSpinning()) return;
  const rotation = `${(-view.rotation[0]).toFixed(2)} ${(-view.rotation[1]).toFixed(2)}`;
  if (host.dataset["rotation"] !== rotation)
    host.dataset["rotation"] = rotation;
}

/** Keeps a canvas out of the tab order and the accessibility tree: the slides are the content. */
export function hardenCanvases(host: HTMLElement): void {
  for (const canvas of host.querySelectorAll<HTMLCanvasElement>(
    ":scope > canvas",
  )) {
    canvas.removeAttribute("tabindex");
    canvas.removeAttribute("role");
    canvas.removeAttribute("aria-label");
    canvas.setAttribute("aria-hidden", "true");
  }
}
