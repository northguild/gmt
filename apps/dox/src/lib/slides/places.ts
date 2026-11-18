/**
 * The places a slide can name, and the camera each one means.
 *
 * `Slide`'s `place` prop is a string. `resolvePlace` turns it into one of seven kinds, and a string
 * it cannot turn is a build error (`Slide.astro` calls it while rendering), never a silent default:
 *
 * - an IANA zone name (it holds a `/`, or is `UTC`), looked up in `TZ_COORDINATES`;
 * - a point with no zone of its own, listed below with its coordinates and a cited source;
 * - the keywords `moon`, `overview`, `wall` and `planet`;
 * - `pole:<zone>`, the North Pole seen from straight above, turned so the zone lies under the hour
 *   hand of a 24-hour clock showing the zone's wall time (`poleLng`).
 *
 * `rotationFor` gives the globe rotation `[λ, φ]` (negated longitude and latitude, as d3's
 * `.rotate()` takes it) for a place. Everything here is pure: the instant the Moon needs, the pins an
 * overview centres on and a zone's wall time come in as arguments.
 */
import { COORDINATES_BY_ID } from "~/lib/globe-zones";
import { siderealDeg, moonRaDec, toUnit } from "~/lib/sky-math";

export type PlacePoint = readonly [lng: number, lat: number];

export type Place =
  | { kind: "zone"; zone: string; lng: number; lat: number }
  | {
      kind: "point";
      lng: number;
      lat: number;
      label: string;
      source: string;
    }
  | { kind: "moon" }
  | { kind: "overview" }
  | { kind: "wall" }
  | { kind: "planet" }
  | { kind: "pole"; zone: string; lng: number; lat: number };

/** A place with no time zone of its own. The source sits beside the coordinates. */
interface PointEntry {
  lng: number;
  lat: number;
  label: string;
  source: string;
}

/** Places a zone name cannot stand for. Keys are the strings a slide writes. */
export const POINTS: Readonly<Record<string, PointEntry>> = {
  galicia: {
    // Santiago de Compostela, the capital of Galicia.
    lng: -8.5448,
    lat: 42.8782,
    label: "Galicia",
    source: "GeoNames 3109642, Santiago de Compostela: 42.8782 N, 8.5448 W",
  },
  greenwich: {
    // The Airy transit circle, which marked the Prime Meridian of 1884.
    lng: 0,
    lat: 51.4772,
    label: "Greenwich",
    source:
      "Royal Museums Greenwich, the Airy Transit Circle: 51 deg 28 min 38 sec N, longitude 0",
  },
};

const KEYWORDS = ["moon", "overview", "wall", "planet"] as const;

/** The prefix of a pole place: `pole:Europe/Helsinki`. */
const POLE = "pole:";

/** Whether a string is an IANA zone name the table knows. */
const isZoneName = (s: string): boolean => s.includes("/") || s === "UTC";

function zoneEntry(name: string): { lng: number; lat: number } {
  const zone = COORDINATES_BY_ID.get(name);
  if (!zone)
    throw new Error(
      `Slide place "${name}" is not in the zone coordinate table (src/lib/tz-coordinates.ts)`,
    );
  return zone;
}

export function resolvePlace(place: string): Place {
  const name = place.trim();
  if (name.startsWith(POLE)) {
    const zone = name.slice(POLE.length);
    const { lng, lat } = zoneEntry(zone);
    return { kind: "pole", zone, lng, lat };
  }
  const point = Object.hasOwn(POINTS, name) ? POINTS[name] : undefined;
  if (point) return { kind: "point", ...point };
  if ((KEYWORDS as readonly string[]).includes(name))
    return { kind: name as (typeof KEYWORDS)[number] };
  if (isZoneName(name)) {
    const { lng, lat } = zoneEntry(name);
    return { kind: "zone", zone: name, lng, lat };
  }
  throw new Error(
    `Unknown slide place "${name}": use an IANA zone name, ${POLE}<zone>, or one of ${[
      ...Object.keys(POINTS),
      ...KEYWORDS,
    ].join(", ")}`,
  );
}

/** Whether a place is a spot on the Earth, so it gets a pin and a leg of the route. */
export const isGeographic = (
  place: Place,
): place is Extract<Place, { kind: "zone" | "point" }> =>
  place.kind === "zone" || place.kind === "point";

/** What a pin or a label calls a geographic place. */
export const labelOf = (
  place: Extract<Place, { kind: "zone" | "point" }>,
): string =>
  place.kind === "point"
    ? place.label
    : (place.zone.split("/").pop() ?? place.zone).replaceAll("_", " ");

/**
 * The zones the `planet` camera centres on and the ice wall's shards land on: the zones GMT's CI
 * runs in (the zone-matrix data, slice 4c, is their owner) less UTC, which has no place on the
 * map, and nine more spread over the sunlit and night sides so the Earth reads as a whole planet.
 * `planet-zones.ts` calls `setPlanetZones` with the zone matrix's own zones when the stage mounts,
 * and this default is what the camera uses until then.
 */
export const PLANET_ZONES: readonly string[] = [
  "Pacific/Niue",
  "America/New_York",
  "Europe/London",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Shanghai",
  "Australia/Lord_Howe",
  "Pacific/Chatham",
  "Pacific/Apia",
  "Europe/Helsinki",
  "Europe/Madrid",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Asia/Manila",
  "America/Sao_Paulo",
  "America/Mexico_City",
];

let planetZones: readonly string[] = PLANET_ZONES;

/** Replaces the `planet` zones. An unknown zone throws, so a typo in the data cannot pass quietly. */
export function setPlanetZones(zones: readonly string[]): void {
  for (const zone of zones) {
    if (!COORDINATES_BY_ID.has(zone))
      throw new Error(`Planet zone "${zone}" is not in the coordinate table`);
  }
  planetZones = [...zones];
}

export const getPlanetZones = (): readonly string[] => planetZones;

/** The pins of the planet zones, as `[lng, lat]`. */
export function planetPins(): PlacePoint[] {
  return planetZones.flatMap((id) => {
    const zone = COORDINATES_BY_ID.get(id);
    return zone ? [[zone.lng, zone.lat] as PlacePoint] : [];
  });
}

/** The Moon's view is this far off the line from the Earth's centre to the Moon, degrees. */
export const MOON_OFFSET_DEG = 15;

/** Half the angle the Earth fills from 6.61 radii, degrees: `asin(1 / 6.61)`. */
export const EARTH_HALF_ANGLE_DEG = (Math.asin(1 / 6.61) * 180) / Math.PI;

const RAD = Math.PI / 180;

type V3 = [number, number, number];

/** The point `[lng, lat]` of an Earth-fixed unit vector. */
function pointOf(v: V3): PlacePoint {
  return [
    Math.atan2(v[1], v[0]) / RAD,
    Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD,
  ];
}

/**
 * The sub-point of the camera for the Moon view: the antipode of the sublunar point, turned
 * `MOON_OFFSET_DEG` towards north so the Moon, which then sits behind the Earth, clears the limb.
 * The Moon's longitude on the Earth is its right ascension less the sidereal time.
 */
export function moonCameraPoint(instantMs: number): PlacePoint {
  const { ra, dec } = moonRaDec(instantMs);
  const moon = toUnit(ra - siderealDeg(instantMs), dec);
  const anti: V3 = [-moon[0], -moon[1], -moon[2]];
  const [lng, lat] = pointOf(anti);
  const sinLat = Math.sin(lat * RAD);
  const north: V3 = [
    -sinLat * Math.cos(lng * RAD),
    -sinLat * Math.sin(lng * RAD),
    Math.cos(lat * RAD),
  ];
  const a = MOON_OFFSET_DEG * RAD;
  return pointOf([
    Math.cos(a) * anti[0] + Math.sin(a) * north[0],
    Math.cos(a) * anti[1] + Math.sin(a) * north[1],
    Math.cos(a) * anti[2] + Math.sin(a) * north[2],
  ]);
}

/** The angle between two points on the Earth, degrees. */
export function arcDegrees(a: PlacePoint, b: PlacePoint): number {
  const [x1, y1, z1] = toUnit(a[0], a[1]);
  const [x2, y2, z2] = toUnit(b[0], b[1]);
  const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
  return Math.acos(dot) / RAD;
}

/** The point the mean of several points sits over: a vector mean, so the date line is no seam. */
export function meanPoint(points: readonly PlacePoint[]): PlacePoint {
  if (points.length === 0) return [0, 0];
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lng, lat] of points) {
    x += Math.cos(lat * RAD) * Math.cos(lng * RAD);
    y += Math.cos(lat * RAD) * Math.sin(lng * RAD);
    z += Math.sin(lat * RAD);
  }
  const length = Math.hypot(x, y, z);
  if (length < 1e-9) return [points[0]![0], points[0]![1]];
  return pointOf([x / length, y / length, z / length]);
}

export interface PlaceContext {
  /** The instant the Moon is placed at, epoch milliseconds. */
  instantMs: number;
  /** Every pin of the deck's route, for the overview and the wall. */
  pins: readonly PlacePoint[];
  /** A zone's wall time now, as minutes since its midnight, or `null` while it is not known. */
  wallMinutes?: (zone: string) => number | null;
}

/** Wraps a longitude into -180 up to 180. */
const wrap = (lng: number): number => ((((lng + 180) % 360) + 360) % 360) - 180;

/**
 * The camera longitude over the North Pole that puts `lng` under a 24-hour hour hand at
 * `minutes` past midnight. Looking down on the pole, meridian `m` points straight down when the
 * camera's longitude is `m`, and east runs anticlockwise, so the meridian at `α` degrees
 * clockwise from the top is the camera's longitude plus 180 less `α`. The hand's `α` is
 * `minutes / 4` (a turn a day). With no wall time the hand is taken at noon, straight down.
 *
 * The 24 hour marks fall on meridians 15 degrees apart, but the hours run clockwise and the
 * longitudes anticlockwise, so the clock's numerals do not name the meridians under them.
 */
export function poleLng(lng: number, minutes: number | null): number {
  const alpha = minutes === null ? 180 : minutes / 4;
  return wrap(lng - 180 + alpha);
}

/**
 * The clockwise turn, in degrees, that carries a 24-hour dial's hour marks onto the meridians
 * under them when the camera looks down on the North Pole from longitude `cameraLng`. Meridian
 * `m` sits `180 + cameraLng - m` degrees clockwise from the top, so every meridian a multiple of
 * 15 degrees round is `cameraLng` past a mark, modulo 15. The shorter way round is taken: the
 * turn lies in -7.5 up to 7.5.
 */
export function meridianTurn(cameraLng: number): number {
  const ahead = ((cameraLng % 15) + 15) % 15;
  return ahead > 7.5 ? ahead - 15 : ahead;
}

/** The point on the Earth the camera looks down on for a place. */
export function pointFor(place: Place, ctx: PlaceContext): PlacePoint {
  switch (place.kind) {
    case "zone":
    case "point":
      return [place.lng, place.lat];
    case "moon":
      return moonCameraPoint(ctx.instantMs);
    case "overview":
    case "wall":
      return meanPoint(ctx.pins);
    case "planet": {
      const pins = planetPins();
      return meanPoint(pins.length > 0 ? pins : ctx.pins);
    }
    case "pole":
      return [poleLng(place.lng, ctx.wallMinutes?.(place.zone) ?? null), 90];
  }
}

/** The globe rotation `[λ, φ]` for a place. */
export function rotationFor(place: Place, ctx: PlaceContext): [number, number] {
  const [lng, lat] = pointFor(place, ctx);
  return [-lng, -lat];
}

/** The zoom a place wants; the Earth fills the right third at 1. */
export function zoomFor(place: Place): number {
  switch (place.kind) {
    case "moon":
      return 0.7;
    case "overview":
    case "wall":
    case "planet":
      return 0.8;
    default:
      return 1;
  }
}
