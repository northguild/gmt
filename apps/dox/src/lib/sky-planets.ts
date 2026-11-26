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
 * the Moon's disc and the Sun's, drawn after, cover one behind them.
 *
 * What the gate reads: `data-sky-planets` on the stars canvas, one `id x y magnitude` per planet
 * on screen, or `id earth magnitude` for one behind the Earth's disc, joined by `;`, `none` for
 * no planet.
 */
import orbitText from "../assets/sky-orbits.json?raw";
import { bodyFromCamera, raDecOf, type Orbits } from "./ephemeris";
import { apparentMagnitude, COLOUR_INDEX, type PlanetId } from "./magnitude";
import { drawHalo, rgba, type SkyLayer } from "./sky-bodies";
import { cameraAt, skyToScreen } from "./sky-math";
import type { PointSource } from "./sky-registry";
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
const IDS = Object.keys(orbits.bodies) as PlanetId[];
/** A planet's dot may sit this far past the canvas edge and still be drawn, CSS pixels. */
const MARGIN = 4;

type Rotation = readonly [number, number];

/** Each planet seen from the camera at an instant, with its magnitude: the ones at the faint limit or brighter. */
function seen(instantMs: number, rotation: Rotation) {
  const camera = cameraAt(rotation, instantMs);
  return IDS.flatMap((id) => {
    const view = bodyFromCamera(orbits, id, instantMs, camera);
    const V = view && apparentMagnitude(id, view, instantMs);
    return view && V !== null && V <= FAINT ? [{ id, view, V }] : [];
  });
}

const point = { x: 0, y: 0 };

export function createPlanetLayer(): SkyLayer & PointSource {
  const layer: SkyLayer = (
    ctx,
    lens,
    m,
    [width, height, earth],
    rotation,
    instantMs,
    tint,
  ) => {
    const found: string[] = [];
    for (const { id, view, V } of seen(instantMs, rotation)) {
      if (!skyToScreen(lens, m, view.unit, point)) continue;
      const { x, y } = point;
      if (Math.hypot(x - lens.centreX, y - lens.centreY) < earth) {
        found.push(`${id} earth ${V.toFixed(2)}`);
        continue;
      }
      if (
        x < -MARGIN ||
        x > width + MARGIN ||
        y < -MARGIN ||
        y > height + MARGIN
      )
        continue;
      const reach = haloReach(V, lens.dots);
      if (reach) drawHalo(ctx, x, y, reach, tint);
      ctx.fillStyle = rgba(
        classColour(classOf(COLOUR_INDEX[id]), tint),
        (dotStep(V) + 3) / 10,
      );
      ctx.beginPath();
      ctx.arc(x, y, dotRadius(V, lens.dots), 0, 7);
      ctx.fill();
      found.push(`${id} ${x.toFixed(1)} ${y.toFixed(1)} ${V.toFixed(2)}`);
    }
    ctx.canvas.dataset["skyPlanets"] = found.join(";") || "none";
  };
  const source: PointSource = {
    place: (id, instantMs, rotation) => {
      const view = bodyFromCamera(
        orbits,
        id as PlanetId,
        instantMs,
        rotation && cameraAt(rotation, instantMs),
      );
      return view && raDecOf(view.unit);
    },
    drawn: (instantMs, rotation) =>
      seen(instantMs, rotation)
        .map(({ id, V }) => ({ id, V }))
        .sort((a, b) => a.V - b.V),
  };
  return Object.assign(layer, source);
}
