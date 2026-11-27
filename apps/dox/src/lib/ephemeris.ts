/**
 * The planets' places: truncated VSOP87B (Bretagnon and Francou 1988; IMCCE), the series in
 * `src/assets/sky-orbits.json` made by `scripts/prepare-sky-orbits.ts`; and a small body's, from
 * its two-body orbit (`kepler.ts`, the Minor Planet Center's elements in the same file). Pure; the
 * data is passed in, so the lazy planet chunk and the generator share this code.
 *
 * A series is VSOP87B's own sum, heliocentric spherical coordinates of the J2000 dynamical
 * ecliptic: `L`, `B` and `R` are each a list by power of `t` of flat triplets `[A, B, C, ...]`,
 * summed as `A cos(B + C t)` times `t` to that power, `t` in Julian millennia from J2000.0.
 *
 * `bodyFromCamera` gives a planet as Horizons' astrometric place (QUANTITIES 1): one light-time
 * step, no aberration or nutation, in the J2000 equator, then turned to the equator of date
 * (`precessToDate`) like the Sun and the Moon, and seen from the globe's camera (`cameraAt`). The
 * instant is Unix milliseconds taken as TDB, which UTC trails by under 70 s: under 0.2 px for
 * Mercury, the fastest.
 */
import { DAY_MS, J2000_JD, UNIX_EPOCH_JD } from "./globe/sun";
import { RAD, type Vec3 } from "./globe/pinhole";
import { keplerPosition, type KeplerElements } from "./kepler";
import type { DwarfId, PlanetId, SmallId } from "./magnitude";
import type { PointId } from "./sky-registry";
import { AU, precessToDate, type RaDec, type Unit } from "./sky-math";

/** One coordinate's series: the triplets `[A, B, C, ...]` of each power of `t`, lowest first. */
type Powers = readonly (readonly number[])[];

export interface Series {
  L: Powers;
  B: Powers;
  R: Powers;
}

/**
 * A dwarf planet's elements as `sky-orbits.json` holds them: the Minor Planet Center's. The body is
 * placed within `days` of the epoch only, since two-body elements drift from the true orbit
 * (measured against Horizons: 0.035 degrees at 720 days, 0.1 to 0.5 degrees from 3 to 5 years), so a validity is
 * always relative to the epoch.
 */
interface DwarfElements extends KeplerElements {
  days: number;
}

/** An asteroid's: the same, with the IAU H, G system's magnitude pair. */
interface SmallElements extends DwarfElements {
  /** The IAU H, G system's absolute magnitude and slope parameter. */
  H: number;
  G: number;
}

/**
 * One osculating-element set of a pass's orbit solution: two-body elements for the instants from
 * `fromMs` up to `toMs` (Unix milliseconds), the sets of a pass abutting. The generator measures
 * each set's span against Horizons' vectors, so it is good within the error it records.
 */
export interface PassSet extends KeplerElements {
  fromMs: number;
  toMs: number;
}

/**
 * A close pass as `sky-orbits.json` holds it: when its tabulated states exist (`startMs` to
 * `endMs`, Unix milliseconds), the IAU H, G magnitude pair of the orbit solution they come from
 * (the sidecar records the solution), and, in order, the element sets that place the body outside
 * that window. The states themselves are the lazy chunk `sky-pass.ts`'s, loaded only inside the
 * window, because a day's rows are bytes no other visitor needs; the sets are a few hundred bytes,
 * so the eager sky carries them and the body has a place at every instant a set covers.
 */
export interface Pass {
  startMs: number;
  endMs: number;
  H: number;
  G: number;
  sets: PassSet[];
}

/**
 * Where a pass's body is at an instant, as the Earth's heliocentric place at the instant the light left (`earthAt`, au of date, as a function of the days back) plus the body's geocentric table: au, equatorial axes of date; null outside the table. `pass-table.ts` makes it.
 */
export type PassPlacer = (
  id: PointId,
  instantMs: number,
  earthAt: (daysBack: number) => Vec3,
  camera: Vec3,
) => Vec3 | null;

/** What `sky-orbits.json` holds. */
export interface Orbits {
  /** The years the series is truncated for, Unix milliseconds. */
  span: { from: number; to: number };
  /** The Earth's series: the observer's. */
  earth: Series;
  /** Each planet that reaches the faint limit: its series, brightest magnitude over the span, and measured worst error from the Earth, arcseconds. */
  bodies: Partial<Record<PlanetId, Series & { peak: number; worst: number }>>;
  /** Each asteroid that can reach the faint limit, and each dwarf planet: its elements. */
  small: Partial<
    Record<SmallId, SmallElements> & Record<DwarfId, DwarfElements>
  >;
  /** Each close pass: its tabulated states. */
  passes: Partial<Record<SmallId, Pass>>;
}

/** The au (IAU 2012 B2) and the speed of light, kilometres and kilometres per second. */
export const KM_PER_AU = 149_597_870.7;
export const LIGHT_KM_S = 299_792.458;
/** Light's travel time for one au, in days. */
const LIGHT_DAYS_PER_AU = KM_PER_AU / LIGHT_KM_S / 86_400;
/** The J2000 mean obliquity, degrees (IAU 1976: 84381.448"). */
const OBLIQUITY = 84_381.448 / 3600;
const MILLENNIUM_DAYS = 365_250;

const sum = (powers: Powers, t: number): number =>
  powers.reduce((total, terms, k) => {
    let part = 0;
    for (let i = 0; i < terms.length; i += 3)
      part += terms[i]! * Math.cos(terms[i + 1]! + terms[i + 2]! * t);
    return total + part * t ** k;
  }, 0);

/** The heliocentric position of a series at `t` Julian millennia from J2000.0: au, equatorial axes of J2000. */
function vsopPosition(series: Series, t: number): Vec3 {
  const l = sum(series.L, t);
  const b = sum(series.B, t);
  const r = sum(series.R, t);
  const flat = r * Math.cos(b);
  return toEquator([flat * Math.cos(l), flat * Math.sin(l), r * Math.sin(b)]);
}

/** Axes of the J2000 ecliptic turned to the J2000 equator. */
function toEquator([x, y, z]: Vec3): Vec3 {
  const [c, s] = [Math.cos(OBLIQUITY * RAD), Math.sin(OBLIQUITY * RAD)];
  return [x, y * c - z * s, y * s + z * c];
}

/** A body from the camera: the direction (unit, equatorial axes of date), its distance from the camera and from the Sun, au, and the phase angle, degrees. */
export interface PlanetView {
  unit: Vec3;
  delta: number;
  r: number;
  phase: number;
}

/** A direction's right ascension (0 to 360) and declination, degrees. */
export const raDecOf = ([x, y, z]: Unit): RaDec => ({
  ra: (Math.atan2(y, x) / RAD + 360) % 360,
  dec: Math.asin(Math.max(-1, Math.min(1, z))) / RAD,
});

export const minus = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

/**
 * A body's heliocentric place at an instant, J2000 equatorial axes, au, as a function of how many
 * days earlier the light left it; null when `orbits` holds nothing for the body, or the body is a
 * small one outside the days its elements are good for, or a pass outside every one of its sets.
 */
function heliocentric(
  orbits: Orbits,
  id: PointId,
  instantMs: number,
): ((daysBack: number) => Vec3) | null {
  const days = instantMs / DAY_MS;
  const planet = orbits.bodies[id as PlanetId];
  if (planet) {
    const t = (days + UNIX_EPOCH_JD - J2000_JD) / MILLENNIUM_DAYS;
    return (back) => vsopPosition(planet, t - back / MILLENNIUM_DAYS);
  }
  const jd = days + UNIX_EPOCH_JD;
  const small = orbits.small[id as SmallId];
  const set =
    small && Math.abs(jd - small.epoch) <= small.days
      ? small
      : orbits.passes[id as SmallId]?.sets.find(
          (s) => s.fromMs <= instantMs && instantMs < s.toMs,
        );
  if (!set) return null;
  return (back) => toEquator(keplerPosition(set, jd - back));
}

/**
 * A body as the camera sees it at an instant. `camera` is the camera's offset from the Earth's
 * centre, Earth radii in the equatorial axes of date (`cameraAt`); none is the geocentre. Null
 * when `orbits` holds no series for the body, a small body's elements do not reach the instant, or
 * the body is a pass whose element sets do not reach it, and either it is outside the table or
 * `placePass` is absent (its chunk has not loaded) or has no table for the instant. Inside the
 * table the table places a pass; outside it, the element set that covers the instant does.
 */
export function bodyFromCamera(
  orbits: Orbits,
  id: PointId,
  instantMs: number,
  camera: Vec3 = [0, 0, 0],
  placePass?: PassPlacer,
): PlanetView | null {
  const pass = orbits.passes[id as SmallId];
  const tabled = !!pass && instantMs >= pass.startMs && instantMs <= pass.endMs;
  const at = tabled ? null : heliocentric(orbits, id, instantMs);
  if (!tabled && !at) return null;
  const t = (instantMs / DAY_MS + UNIX_EPOCH_JD - J2000_JD) / MILLENNIUM_DAYS;
  const earth = vsopPosition(orbits.earth, t);
  const over = (v: Vec3): Vec3 => precessToDate(v, instantMs);
  const eye = over(earth).map((c, i) => c + camera[i]! / AU) as Vec3;
  /* A pass's table is geocentric; any other body, and a pass outside its table, is placed by its
     orbit, one light-time step: the body where it was when the light left it, `delta` au away at
     the instant. */
  const place = tabled
    ? placePass?.(
        id,
        instantMs,
        (back) => over(vsopPosition(orbits.earth, t - back / MILLENNIUM_DAYS)),
        camera,
      )
    : over(at!(LIGHT_DAYS_PER_AU * Math.hypot(...minus(at!(0), earth))));
  if (!place) return null;
  const v = minus(place, eye);
  const delta = Math.hypot(...v);
  const r = Math.hypot(...place);
  /* The phase angle sits at the body, between the Sun (the origin) and the camera. */
  const cos =
    (place[0] * v[0] + place[1] * v[1] + place[2] * v[2]) / (r * delta);
  return {
    unit: v.map((c) => c / delta) as Vec3,
    delta,
    r,
    phase: Math.acos(Math.min(1, Math.max(-1, cos))) / RAD,
  };
}

/**
 * Where the Earth stands between the camera and a body: `behind` when the camera's ray to the body
 * meets the Earth's sphere (radius 1) before it reaches the body, so the body is hidden; `front`
 * when the ray crosses the Earth's disc but the body is nearer than the Earth's near surface, so it
 * is seen over the Earth; null when the ray misses the Earth. `camera` is in Earth radii, `delta`
 * au as in `PlanetView`.
 */
export function earthCover(
  camera: Vec3,
  { unit, delta }: Pick<PlanetView, "unit" | "delta">,
): "behind" | "front" | null {
  const along = camera[0] * unit[0] + camera[1] * unit[1] + camera[2] * unit[2];
  const into =
    along * along - (camera[0] ** 2 + camera[1] ** 2 + camera[2] ** 2 - 1);
  /* The near surface is at `-along - sqrt(into)` from the camera; behind the camera there is none. */
  const near = -along - Math.sqrt(into);
  if (!(into >= 0) || near < 0) return null;
  return delta * AU > near ? "behind" : "front";
}
