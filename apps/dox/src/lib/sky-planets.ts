/**
 * The planets of the night sky, a lazy chunk loaded with the bodies' maps (`space-sky.ts`), so the
 * first paint never carries the series: `createPlanetLayer` makes the one object that is both the
 * layer the sky draws between the stars and the bodies (`SkyLayer`) and the source the registry's
 * point rows read (`PointSource`).
 *
 * A planet is drawn as a star is, by the stars' own law (`sky-stars.ts`): a dot of its magnitude's
 * radius and brightness, a halo when it is brighter than -1, its colour class from its B-V mixed
 * toward the sky's tint. Seen from the globe's camera (`bodyFromCamera`), it is drawn when its
 * magnitude there is at the faint limit or brighter. The Earth's clip hides one behind the globe;
 * the Moon's disc and the Sun's, drawn after, cover one behind them. A small body is drawn
 * the same way: placed from its elements within the days they are good for, its magnitude from the
 * H, G system, its colour the class of a star with no B-V.
 *
 * A body inside the camera's orbit (a close pass, `Orbits.passes`; its states are the lazy chunk
 * `sky-pass.ts`, loaded inside the pass's window) can be nearer than the Earth's
 * near surface or than the Moon, so it is drawn on the page's `near` canvas, above the globe, the
 * Moon and the Sun, and not on the stars canvas below them; the layer sizes that canvas to the
 * stars canvas and clears it on each draw, hiding it while nothing is on it. The Earth hides any body whose ray from the camera
 * meets its sphere first (`earthCover`).
 *
 * What the gate reads: `data-sky-planets` on the stars canvas, one `id x y magnitude` per body on
 * screen, `id earth magnitude` for one behind the Earth, or `id behind magnitude` for one behind
 * the image plane, joined by `;`, `none` for no body. The held body, when too faint to draw, is
 * ringed instead of drawn, as `id ring x y magnitude`; no other faint body is drawn or listed.
 */
import orbitText from "../assets/sky-orbits.json?raw";
import {
  bodyFromCamera,
  earthCover,
  raDecOf,
  type Orbits,
  type PassPlacer,
} from "./ephemeris";
import { COLOUR_INDEX, type PlanetId, viewMagnitude } from "./magnitude";
import type { SkyLayer } from "./sky-bodies";
import { drawHalo, rgba } from "./sky-halo";
import { cameraAt, skyToScreen } from "./sky-math";
import type { PassKit } from "./sky-pass";
import type { PointId, PointSource } from "./sky-registry";
import {
  classColour,
  classOf,
  dotRadius,
  dotStep,
  FAINT,
  haloReach,
} from "./sky-stars";

/* The series arrive as text: a built bundle keeps a JSON import as an object literal with its
   whitespace, and `JSON.parse` of the compact text is both smaller and faster to parse. */
const orbits: Orbits = JSON.parse(orbitText);
const IDS = [
  ...Object.keys(orbits.bodies),
  ...Object.keys(orbits.small),
  ...Object.keys(orbits.passes),
] as PointId[];
/** A planet's dot may sit this far past the canvas edge and still be drawn, CSS pixels. */
const MARGIN = 4;

type Rotation = readonly [number, number];

/** Each body the camera can place at an instant, with its magnitude, a faint one too. A pass is placed by `placePass` once its chunk has loaded. */
function seen(instantMs: number, rotation: Rotation, placePass?: PassPlacer) {
  const camera = cameraAt(rotation, instantMs);
  return IDS.flatMap((id) => {
    const view = bodyFromCamera(orbits, id, instantMs, camera, placePass);
    const V = view && viewMagnitude(orbits, id, view, instantMs);
    return view && V !== null ? [{ id, view, V, camera }] : [];
  });
}

const point = { x: 0, y: 0 };

/**
 * `signal` ends the layer: a pass's chunk that resolves after it changes nothing. `redraw` runs once
 * that chunk has loaded, so the sky draws the pass it could not yet.
 */
export function createPlanetLayer({
  near,
  signal,
  redraw,
  held,
}: {
  near?: HTMLCanvasElement | null;
  signal?: AbortSignal;
  redraw?: () => void;
  /** The body the Look at view holds: when it is too faint to draw, a ring marks where it is. */
  held?: () => string | null;
} = {}): SkyLayer & PointSource {
  /* A pass's states and what draws it are a chunk of their own, asked for once, the first time the instant is inside a pass's window; until it resolves the pass is not drawn. */
  let kit: PassKit | undefined;
  let asked = false;
  const passes = (instantMs: number): PassKit | undefined => {
    if (
      !asked &&
      Object.values(orbits.passes).some(
        ({ startMs, endMs }) => instantMs >= startMs && instantMs <= endMs,
      )
    ) {
      asked = true;
      import("./sky-pass").then(
        (chunk) => {
          if (signal?.aborted) return;
          kit = chunk.loadPasses(orbits);
          redraw?.();
        },
        () => {},
      );
    }
    return kit;
  };
  const layer: SkyLayer = (
    ctx,
    lens,
    m,
    [width, height, earth, dpr],
    rotation,
    instantMs,
    tint,
  ) => {
    const found: string[] = [];
    const pass = passes(instantMs);
    const over = pass?.surface(near, ctx.canvas, dpr);
    let lit = false;
    const bodies = seen(instantMs, rotation, pass?.place);
    for (const { id, view, V, camera } of bodies) {
      const faint = V > FAINT;
      if (faint && id !== held?.()) continue;
      const cover = earth ? earthCover(camera, view) : null;
      if (cover === "behind") {
        found.push(`${id} earth ${V.toFixed(2)}`);
        continue;
      }
      if (!skyToScreen(lens, m, view.unit, point)) {
        found.push(`${id} behind ${V.toFixed(2)}`);
        continue;
      }
      const { x, y } = point;
      if (
        x < -MARGIN ||
        x > width + MARGIN ||
        y < -MARGIN ||
        y > height + MARGIN
      )
        continue;
      /* Over the Earth, the Moon and the Sun, or under them with the stars. */
      const on =
        (cover === "front" || pass?.nearerThanMoon(instantMs, view.delta)
          ? over
          : null) ?? ctx;
      lit ||= on === over;
      /* A small body has no B-V: index 0 is the stars' own class for a missing one. */
      /* The held body is too faint to draw: a ring (8 CSS px, inside the Look at aim's `POINT_BOX`) of the canvas's default 1 px line, in the colour of a body at the limit. */
      /* A faint body is too faint for a halo, so it gets none. */
      const reach = haloReach(V, lens.dots);
      if (reach) drawHalo(on, x, y, reach, tint);
      on.beginPath();
      on.arc(x, y, faint ? 8 : dotRadius(V, lens.dots), 0, 7);
      /* A ring is stroked, a body filled. */
      on.strokeStyle = on.fillStyle = rgba(
        classColour(classOf(COLOUR_INDEX[id as PlanetId] ?? 0), tint),
        faint ? 1 : (dotStep(V) + 3) / 10,
      );
      on[faint ? "stroke" : "fill"]();
      found.push(
        `${id}${faint ? " ring" : ""} ${x.toFixed(1)} ${y.toFixed(1)} ${V.toFixed(2)}`,
      );
    }
    ctx.canvas.dataset["skyPlanets"] = found.join(";") || "none";
    /* The near canvas covers the whole sky over the globe, so while it holds nothing it is hidden (it starts so in the markup): an empty layer still costs the compositor a full-screen blend on every frame the globe moves. */
    if (near) near.hidden = !lit;
  };
  const source: PointSource = {
    place: (id, instantMs, rotation) => {
      const view = bodyFromCamera(
        orbits,
        id as PointId,
        instantMs,
        rotation && cameraAt(rotation, instantMs),
        passes(instantMs)?.place,
      );
      return view && raDecOf(view.unit);
    },
    placed: (instantMs, rotation) =>
      seen(instantMs, rotation, passes(instantMs)?.place).sort(
        (a, b) => a.V - b.V,
      ),
    drawn: (instantMs, rotation) =>
      source.placed(instantMs, rotation).filter(({ V }) => V <= FAINT),
  };
  return Object.assign(layer, source);
}
