/**
 * Which bodies come close enough to the Earth to show in the night sky, and their tabulated
 * geocentric state vectors, from JPL: the close-approach API (`cad.api`), the Small-Body Database
 * (`jpl-sbdb.ts`) and the Horizons API. Used by `scripts/prepare-sky-orbits.ts`; the parsers and
 * the selection are pure, so their test runs on recorded answers (`scripts/fixtures/sky-orbits/`).
 *
 * An approach is kept in two steps. The cheap bound reads the CAD row alone: the brightest the
 * body could be from any camera point, `H + 5 log10(r delta)` at phase 0 with r 1 au, delta the
 * least distance from the camera's orbit. It is a prefilter, as it ignores the phase. The exact
 * bound reads Horizons' rows: the brightest the body is from the camera's orbit point nearest it
 * at each row, by the sky's own magnitude law and geometry. A window is the rows within
 * `WINDOW_MARGIN` of the faint limit, plus `PAD_MS` each side.
 */
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { DAY_MS, UNIX_EPOCH_JD } from "../../src/lib/globe/sun";
import {
  EARTH_EQUATORIAL_RADIUS_KM,
  P,
  type Vec3,
} from "../../src/lib/globe/pinhole";
import { bodyFromCamera, type Orbits } from "../../src/lib/ephemeris";
import { hgMagnitude } from "../../src/lib/magnitude";
import { passPlacer, type PassTable } from "../../src/lib/pass-table";
import { precessToDate } from "../../src/lib/sky-math";
import type { SmallId } from "../../src/lib/magnitude";

/** The query, the Earth's approaches within `dist-max` au between two dates. */
export const CAD_QUERY =
  "https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.002&date-min=<from>&date-max=<to>&body=Earth";
/** Horizons' vector table: geocentric, ICRF axes, kilometres, UT rows, `<step>` apart (`TABLE_STEP` for a window's). */
export const HORIZONS_QUERY =
  "https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='<id>'&EPHEM_TYPE=VECTORS&CENTER='500@399'&REF_PLANE=FRAME&VEC_TABLE=2&OUT_UNITS=KM-S&VEC_CORR=NONE&TIME_TYPE=UT&CSV_FORMAT=YES&START_TIME='<from>'&STOP_TIME='<to>'&STEP_SIZE='<step>'";

/** The step of the rows a window is found with. */
export const WINDOW_STEP = "10 min";
/**
 * The shipped table: the window and this much either side, rows `TABLE_STEP` apart. A body just
 * outside the window is still near enough that two-body elements err, so the table runs on, where
 * the rows are coarser: 20 minutes holds a worst error under 0.2 km against Horizons.
 */
export const TABLE_PAD_MS = 86_400_000;
export const TABLE_STEP = "20 min";

/** The window, days after the run instant, that approaches are asked for. */
export const LOOKAHEAD_DAYS = 3650;
/** The geostationary camera's distance from the Earth's centre, km. */
const CAMERA_KM = P * EARTH_EQUATORIAL_RADIUS_KM;
const KM_PER_AU = 149_597_870.7;
/** The least distance from the camera the bound allows, km (the camera can sit inside a body's miss distance). */
const MIN_RANGE_KM = 1000;
/** A window opens where the bound reaches the faint limit plus this, magnitudes. */
export const WINDOW_MARGIN = 0.5;
/** Rows are 10 minutes apart; a window reaches this far past its last bright row. */
export const STEP_MS = 600_000;
const PAD_MS = 1_800_000;

export interface Approach {
  des: string;
  orbitId: string;
  /** Closest approach, Unix ms, and the distance of the Earth's centre from the body there, km. */
  ms: number;
  distKm: number;
  /** Speed at infinity, km/s. */
  vInf: number;
  H: number;
}

export const fmt = (ms: number, withTime: boolean) =>
  convertUnixToUtc(ms)
    .slice(0, withTime ? 16 : 10)
    .replace("T", " ");

export const cadUrl = (fromMs: number, toMs: number): string =>
  CAD_QUERY.replace("<from>", fmt(fromMs, false)).replace(
    "<to>",
    fmt(toMs, false),
  );

/** The approaches of a CAD reply (fields by name). */
export function parseApproaches(reply: unknown): Approach[] {
  const { fields, data } = reply as { fields: string[]; data: string[][] };
  const at = (name: string) => fields.indexOf(name);
  return data.map((row) => ({
    des: row[at("des")]!,
    orbitId: row[at("orbit_id")]!,
    ms: (Number(row[at("jd")]) - UNIX_EPOCH_JD) * DAY_MS,
    distKm: Number(row[at("dist")]) * KM_PER_AU,
    vInf: Number(row[at("v_inf")]),
    H: Number(row[at("h")]),
  }));
}

/** The cheap bound's brightest magnitude (phase 0, r 1 au): see the header. */
export function boundMagnitude({
  H,
  distKm,
}: Pick<Approach, "H" | "distKm">): number {
  const range = Math.max(Math.abs(distKm - CAMERA_KM), MIN_RANGE_KM);
  return H + 5 * Math.log10(range / KM_PER_AU);
}

/** The approaches whose cheap bound reaches `limit`. */
export const prefilter = (approaches: Approach[], limit: number): Approach[] =>
  approaches.filter((a) => boundMagnitude(a) <= limit);

/**
 * The span the table is asked for: on a straight line at the speed at infinity (the slowest the
 * body goes), the time it takes to come from where the cheap bound has it at `limit` plus the margin.
 */
export function askedSpan(
  a: Approach,
  limit: number,
): { from: number; to: number } {
  const reachKm =
    KM_PER_AU * 10 ** ((limit + WINDOW_MARGIN - a.H) / 5) + CAMERA_KM;
  const half = Math.ceil(((reachKm / a.vInf) * 1000) / STEP_MS) * STEP_MS;
  const mid = Math.round(a.ms / STEP_MS) * STEP_MS;
  return { from: mid - half, to: mid + half };
}

export const horizonsUrl = (
  id: string,
  fromMs: number,
  toMs: number,
  step = WINDOW_STEP,
): string =>
  HORIZONS_QUERY.replace("<id>", id)
    .replace("<from>", fmt(fromMs, true))
    .replace("<to>", fmt(toMs, true))
    .replace("<step>", step);

/** A Horizons vector table's rows, as a pass table: Unix ms from the UT Julian date, state to 0.1 km and 1e-5 km/s. */
export function parseVectors(reply: unknown): PassTable {
  const text = (reply as { result: string }).result;
  const body = text.slice(text.indexOf("$$SOE") + 5, text.indexOf("$$EOE"));
  const lines = body.split("\n").filter((line) => line.trim());
  const rows: number[] = [];
  let startMs = NaN;
  let stepMs = NaN;
  let last = NaN;
  for (const line of lines) {
    const cells = line.split(",").map((c) => c.trim());
    const ms =
      Math.round(((Number(cells[0]) - UNIX_EPOCH_JD) * DAY_MS) / 1000) * 1000;
    if (Number.isNaN(startMs)) startMs = ms;
    else if (Number.isNaN(stepMs)) stepMs = ms - startMs;
    else if (ms - last !== stepMs)
      throw new Error("Horizons rows are not evenly spaced");
    last = ms;
    rows.push(
      ...cells
        .slice(2, 8)
        .map((c, k) => Number(Number(c).toFixed(k < 3 ? 1 : 5))),
    );
  }
  if (rows.length < 12)
    throw new Error("Horizons returned fewer than two rows");
  return { startMs, stepMs, rows };
}

/** A table's window: its first and last row's instants. */
export const windowOf = ({ startMs, stepMs, rows }: PassTable) => ({
  startMs,
  endMs: startMs + (rows.length / 6 - 1) * stepMs,
});

/**
 * The brightest magnitude at each row (from the camera's orbit point nearest the body, at that
 * row's instant), by the sky's own geometry and law: the same `bodyFromCamera` the layer runs.
 */
export function rowMagnitudes(
  table: PassTable,
  { H, G }: { H: number; G: number },
  orbits: Orbits,
  id: SmallId,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < table.rows.length / 6; i++) {
    const ms = table.startMs + i * table.stepMs;
    const p = table.rows.slice(i * 6, i * 6 + 3) as unknown as Vec3;
    const [x, y, z] = precessToDate(p, ms);
    const size = Math.hypot(x, y, z);
    const camera = [x, y, z].map((c) => (c / size) * P) as Vec3;
    const view = bodyFromCamera(
      {
        ...orbits,
        passes: { [id]: { ...windowOf(table), H, G, sets: [] } },
      },
      id,
      ms,
      camera,
      passPlacer({ [id]: table }),
    );
    out.push(view ? hgMagnitude(H, G, view) : Infinity);
  }
  return out;
}

/** The table cut to its window (rows at or under `limit` plus the margin, padded), or null when no row reaches it. */
export function trimWindow(
  table: PassTable,
  magnitudes: number[],
  limit: number,
): PassTable | null {
  const bright = magnitudes.flatMap((v, i) =>
    v <= limit + WINDOW_MARGIN ? [i] : [],
  );
  if (bright.length === 0) return null;
  const pad = Math.ceil(PAD_MS / table.stepMs);
  const first = Math.max(0, bright[0]! - pad);
  const end = Math.min(magnitudes.length - 1, bright[bright.length - 1]! + pad);
  return {
    startMs: table.startMs + first * table.stepMs,
    stepMs: table.stepMs,
    rows: table.rows.slice(first * 6, (end + 1) * 6),
  };
}
