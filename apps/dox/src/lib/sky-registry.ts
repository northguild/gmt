/**
 * The one table of the sky's bodies, `SKY_BODIES`. Everything that is about a body by name reads
 * its row: where it is (`place`), how far its box reaches (`reach`, for the camera's aim), the map
 * and painter a textured disc takes (`map`, `make`). Its order is the Look at bar's.
 * A body is added as one more row; `SkyBodyId` is the union of the ids, so a row's key anywhere
 * else is checked against it.
 *
 * The columns too heavy for the eager chunk live beside the table, keyed by these ids and typed
 * `satisfies Partial<Record<SkyBodyId, ...>>`: the rotations (`body-rotation.ts`), the magnitude
 * laws (`magnitude.ts`) and the series (`src/assets/sky-orbits.json`). A point's place comes from
 * the lazy planet layer (`sky-planets.ts`), which hands itself over through `providePoints` once
 * it has loaded: until then a point row has no place.
 */
import { paintLook } from "./look";
import {
  GLARE_RADII,
  ICE_TINT,
  type MoonPainter,
  type Rgb,
  type SunPainter,
} from "./sky-bodies";
import type { SkyMap } from "./sky-map";
import { SUN_RADIUS, sunRaDec, type RaDec } from "./sky-math";
import { moonFromCamera, moonRaDec } from "./sky-moon";

/** The camera's rotation `[lambda, phi]`, degrees. */
type Rotation = readonly [number, number];

/** A body's place and angular radius (0 for a point), degrees. */
type BodyPlace = RaDec & { radius: number };

interface Row {
  id: string;
  name: string;
  /** The box reaches this many disc radii past a disc (the Sun's glare). */
  reach: number;
}

interface DiscRow extends Row {
  kind: "disc";
  /** Where the disc is, seen from the camera when `rotation` is given (the Moon's parallax). */
  place(instantMs: number, rotation?: Rotation): BodyPlace;
  /** The `SkyInputs` field naming the disc's map, and the painter its lazy chunk makes from it. */
  map: "sunMap" | "moonMap";
  make(map: SkyMap): Promise<SunPainter | MoonPainter>;
}

interface PointRow extends Row {
  kind: "point";
  /** The astronomical symbol on the point's Look at button. */
  symbol: string;
  /**
   * What the body is, said beside its name. The name label says it always; the Look at bar and
   * the events list say only a group other than the planets, the sky's ordinary points
   * (`groupTag` in `sky-events.ts`).
   */
  group: "Planet" | "Dwarf planet" | "Asteroid";
  /** Where the point is, or null before `providePoints` (and for a body the source does not hold). */
  place(instantMs: number, rotation?: Rotation): BodyPlace | null;
}

/** The Sun's tint in the natural look: its own near-white levels, untinted. */
const WHITE: Rgb = [255, 255, 255];

const disc = <const I extends string>(
  id: I,
  row: Omit<DiscRow, "id" | "kind">,
): DiscRow & { id: I } => ({ id, kind: "disc", ...row });

const point = <const I extends string>(
  id: I,
  name: string,
  symbol: string,
  group: PointRow["group"],
): PointRow & { id: I } => ({
  id,
  name,
  symbol,
  group,
  kind: "point",
  reach: 0,
  place: (instantMs, rotation) => {
    const found = source?.place(id, instantMs, rotation);
    return found ? { ...found, radius: 0 } : null;
  },
});

/** Sun first, as it is drawn first, then the Moon in front of it, then the planets by distance from the Sun, the dwarf planet, then the asteroids. */
export const SKY_BODIES = [
  disc("sun", {
    name: "Sun",
    reach: GLARE_RADII,
    place: (instantMs) => ({ ...sunRaDec(instantMs), radius: SUN_RADIUS }),
    map: "sunMap",
    make: async (map) =>
      (await import("./sun-paint")).createSunPainter(map, undefined, () =>
        paintLook() === "natural" ? WHITE : ICE_TINT,
      ),
  }),
  disc("moon", {
    name: "Moon",
    reach: 0,
    place: (instantMs, rotation) =>
      rotation ? moonFromCamera(instantMs, rotation) : moonRaDec(instantMs),
    map: "moonMap",
    make: async (map) =>
      (await import("./body-paint")).createMoonPainter(map, undefined, () =>
        paintLook() === "natural" ? null : ICE_TINT,
      ),
  }),
  point("mercury", "Mercury", "\u263F", "Planet"),
  point("venus", "Venus", "\u2640", "Planet"),
  point("mars", "Mars", "\u2642", "Planet"),
  point("jupiter", "Jupiter", "\u2643", "Planet"),
  point("saturn", "Saturn", "\u2644", "Planet"),
  point("uranus", "Uranus", "\u2645", "Planet"),
  point("neptune", "Neptune", "\u2646", "Planet"),
  point("pluto", "Pluto", "\u2647", "Dwarf planet"),
  point("vesta", "Vesta", "\u26B6", "Asteroid"),
  /* No astronomical symbol exists for it: its initial. */
  point("apophis", "Apophis", "A", "Asteroid"),
] as const;

export type SkyBody = (typeof SKY_BODIES)[number];
export type SkyBodyId = SkyBody["id"];
export type DiscId = Extract<SkyBody, { kind: "disc" }>["id"];
export type PointId = Extract<SkyBody, { kind: "point" }>["id"];

/** A body's row. */
export const bodyRow = <I extends SkyBodyId>(
  id: I,
): Extract<SkyBody, { id: I }> =>
  SKY_BODIES.find((row) => row.id === id) as Extract<SkyBody, { id: I }>;

/** What the lazy planet layer gives the rest of the sky. */
export interface PointSource {
  /** A point's place seen from the camera `rotation` (the geocentre with none) at an instant, or null for a body it does not hold. */
  place(id: string, instantMs: number, rotation?: Rotation): RaDec | null;
  /** Every point the layer can place from the camera at an instant, brightest first: id and magnitude, a body too faint to draw among them. */
  placed(instantMs: number, rotation: Rotation): { id: PointId; V: number }[];
  /** Those of `placed` bright enough to draw. */
  drawn(instantMs: number, rotation: Rotation): { id: PointId; V: number }[];
}

/** The source of a layer that failed to load: it holds no body, and the list stops waiting for it. */
export const EMPTY_POINTS: PointSource = {
  place: () => null,
  placed: () => [],
  drawn: () => [],
};

let source: PointSource | null = null;

/** The planet layer hands itself over once loaded, and takes itself back (null) when its sky goes. */
export const providePoints = (next: PointSource | null): void => {
  source = next;
};

/** The source now, or null while the layer has not loaded. */
export const pointSource = (): PointSource | null => source;

let held: SkyBodyId | null = null;
let onHold: (() => void) | null = null;

/**
 * The body the Look at view holds (null for none), for the planet layer's ring on a held body too
 * faint to draw. `watchHold` runs when it changes, so a sky at rest draws the ring or drops it.
 */
export const holdBody = (id: SkyBodyId | null): void => {
  held = id;
  onHold?.();
};

export const heldBody = (): SkyBodyId | null => held;

/** The one watcher of `holdBody`, the sky's redraw; null takes it away with the sky. */
export const watchHold = (callback: (() => void) | null): void => {
  onHold = callback;
};
