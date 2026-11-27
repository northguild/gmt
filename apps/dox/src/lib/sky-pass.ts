/**
 * The close passes, a lazy chunk of its own: `sky-planets.ts` imports it only when the instant is
 * inside a pass's window (`Pass.startMs` to `endMs` in `sky-orbits.json`), because a day's rows
 * (`sky-passes.json`, written by `scripts/prepare-sky-orbits.ts`) and what draws a body nearer than
 * the Moon (its canvas above the globe, the Moon's distance) are bytes no other visit needs.
 */
import rowsText from "../assets/sky-passes.json?raw";
import type { Orbits, PassPlacer } from "./ephemeris";
import { RAD } from "./globe/pinhole";
import { passPlacer, type PassTable } from "./pass-table";
import { AU } from "./sky-math";
import { MOON_K, moonRaDec } from "./sky-moon";

/** Each pass's rows and step; the start is the pass's, in `sky-orbits.json`. */
export type PassRows = Record<string, Omit<PassTable, "startMs">>;

/** What the planet layer takes from the chunk. */
export interface PassKit {
  /** A pass's place (`ephemeris.ts`'s `bodyFromCamera` takes it). */
  place: PassPlacer;
  /** `near` resized to the stars canvas, cleared, in CSS pixels; null with none. */
  surface(
    near: HTMLCanvasElement | null | undefined,
    stars: HTMLCanvasElement,
    dpr: number,
  ): CanvasRenderingContext2D | null;
  /** Whether a body `delta` au from the camera is nearer than the Moon is to the Earth's centre, so it is drawn over the Moon. */
  nearerThanMoon(instantMs: number, delta: number): boolean;
}

/** The kit for every pass of `orbits`: its window's start joined to its rows. */
export const loadPasses = (orbits: Orbits): PassKit => {
  const rows: PassRows = JSON.parse(rowsText);
  return {
    place: passPlacer(
      Object.fromEntries(
        Object.entries(orbits.passes).map(([id, { startMs }]) => [
          id,
          { startMs, ...rows[id]! },
        ]),
      ),
    ),
    surface: (near, stars, dpr) => {
      const ctx = near?.getContext("2d");
      if (!near || !ctx) return null;
      if (near.width !== stars.width) near.width = stars.width;
      if (near.height !== stars.height) near.height = stars.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, near.width, near.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    },
    nearerThanMoon: (instantMs, delta) =>
      delta * AU < 1 / Math.sin((moonRaDec(instantMs).radius / MOON_K) * RAD),
  };
};
