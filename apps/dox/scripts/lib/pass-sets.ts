/**
 * The element sets that place a close pass outside its table (`Pass.sets`, `sky-orbits.json`):
 * JPL Horizons' osculating elements of the same Small-Body Database solution as the table, at
 * epochs chosen here by measurement. The table places the body within a day of the closest
 * approach; before and after, two-body elements of one epoch fit the integrated orbit only for a
 * while, so the sets hand over to each other where a set stops fitting.
 *
 * A candidate is measured against Horizons' geocentric vectors (light-time corrected) from the
 * camera's orbit point nearest the body, with the sky's own `bodyFromCamera` and the precession it
 * applies, as `rowMagnitudes` does for the table. A set is kept within `SET_TOLERANCE` degrees. Each
 * stretch (the run instant to the table's start, the table's end to the span's end) is covered by
 * the candidate that holds longest from where the last one stopped, so the handoffs are measured
 * instants, never typed. `get` fetches one URL as JSON, so the test stands in the recorded answers.
 */
import { UNIX_EPOCH_JD, DAY_MS } from "../../src/lib/globe/sun";
import {
  EARTH_EQUATORIAL_RADIUS_KM,
  P,
  type Vec3,
} from "../../src/lib/globe/pinhole";
import {
  bodyFromCamera,
  type Orbits,
  type PassSet,
} from "../../src/lib/ephemeris";
import type { KeplerElements } from "../../src/lib/kepler";
import { precessToDate } from "../../src/lib/sky-math";
import { fmt } from "./close-approach";
import { fixed } from "./small-bodies";

type Get = (url: string) => Promise<unknown>;

/** Horizons' osculating elements about the Sun, J2000 ecliptic, au and days, at the Julian dates `<jds>`. */
const ELEMENTS_QUERY =
  "https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='<id>'&EPHEM_TYPE=ELEMENTS&CENTER='500@10'&REF_PLANE=ECLIPTIC&REF_SYSTEM=ICRF&TP_TYPE=ABSOLUTE&CSV_FORMAT=YES&OUT_UNITS=AU-D&TLIST='<jds>'";
/** The truth the sets are measured against: geocentric, ICRF axes, kilometres, light-time corrected, UT rows. */
const TRUTH_QUERY =
  "https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='<id>'&EPHEM_TYPE=VECTORS&CENTER='500@399'&REF_PLANE=FRAME&VEC_TABLE=1&OUT_UNITS=KM-S&VEC_CORR='LT'&TIME_TYPE=UT&CSV_FORMAT=YES&START_TIME='<from>'&STOP_TIME='<to>'&STEP_SIZE='<step>'";

/** The angle a set may stray from Horizons' vectors, degrees: under a pixel of the widest lens, as the planets' series are held. */
export const SET_TOLERANCE = 0.035;
/** Candidate epochs: every this many days across the span, and each of the ladder's offsets (days) before the table and after it. */
const CANDIDATE_DAYS = 60;
const LADDER_DAYS = [1, 2, 4, 8, 16, 32];
/** Epochs per Horizons query, so a URL stays short. */
const BATCH = 50;
/** The truth's step across the span, and hourly within this many days of the table. */
const COARSE_STEP = "10 d";
const FINE_STEP = "60 min";
const FINE_DAYS = 3;

/** One candidate: its elements, rounded as they are shipped. */
type Candidate = KeplerElements;

/** One truth sample: Unix ms and the geocentric position, km. */
interface Sample {
  ms: number;
  p: Vec3;
}

/** The Julian dates of the epochs tried: midnights, so a handoff never depends on a time of day. */
export function candidateJds(
  fromMs: number,
  toMs: number,
  table: { startMs: number; endMs: number },
): number[] {
  const midnight = (ms: number) => Math.floor(ms / DAY_MS) + UNIX_EPOCH_JD;
  const jds = new Set<number>();
  for (let ms = fromMs; ms <= toMs; ms += CANDIDATE_DAYS * DAY_MS)
    jds.add(midnight(ms));
  for (const d of LADDER_DAYS) {
    jds.add(midnight(table.startMs - d * DAY_MS));
    jds.add(midnight(table.endMs + d * DAY_MS));
  }
  return [...jds].sort((a, b) => a - b);
}

/** The elements of a Horizons ELEMENTS reply, one per epoch, rounded as they are shipped; throws if the reply is for another orbit solution. */
export function parseElements(reply: unknown, solution: string): Candidate[] {
  const text = (reply as { result: string }).result;
  if (!text.includes(`JPL#${solution}`))
    throw new Error(`Horizons elements are not solution ${solution}`);
  const body = text.slice(text.indexOf("$$SOE") + 5, text.indexOf("$$EOE"));
  return body
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [jd, , e, , i, node, peri, , n, M, , a] = line
        .split(",")
        .map((c) => Number(c.trim()));
      return {
        a: fixed(a!, 7),
        e: fixed(e!, 7),
        i: fixed(i!, 5),
        node: fixed(node!, 5),
        peri: fixed(peri!, 5),
        M: fixed(M!, 5),
        n: fixed(n!, 8),
        epoch: fixed(jd!, 1),
      };
    });
}

/** A Horizons position table's samples (UT Julian date, then x, y, z in km). */
function parseTruth(reply: unknown): Sample[] {
  const text = (reply as { result: string }).result;
  const body = text.slice(text.indexOf("$$SOE") + 5, text.indexOf("$$EOE"));
  return body
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const c = line.split(",").map((x) => Number(x.trim()));
      return {
        ms: Math.round(((c[0]! - UNIX_EPOCH_JD) * DAY_MS) / 1000) * 1000,
        p: [c[2]!, c[3]!, c[4]!] as Vec3,
      };
    });
}

const angleBetween = (a: Vec3, b: Vec3): number => {
  const cross = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  return (
    (Math.atan2(Math.hypot(...cross), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) *
      180) /
    Math.PI
  );
};

/** How far, degrees, a candidate's view of the body strays from the truth at a sample, from the camera's orbit point nearest the body. */
function errorAt(orbits: Orbits, id: string, c: Candidate, t: Sample): number {
  const [x, y, z] = precessToDate(t.p, t.ms);
  const size = Math.hypot(x, y, z);
  const camera = [x, y, z].map((v) => (v / size) * P) as Vec3;
  /* The set alone places the body: a table that is never in range, one set that is always in force. */
  const view = bodyFromCamera(
    {
      ...orbits,
      small: {},
      passes: {
        [id]: {
          startMs: Infinity,
          endMs: -Infinity,
          H: 0,
          G: 0,
          sets: [{ ...c, fromMs: -Infinity, toMs: Infinity }],
        },
      },
    },
    id as keyof Orbits["passes"],
    t.ms,
    camera,
  );
  if (!view) return Infinity;
  const from: Vec3 = [
    x - camera[0] * EARTH_EQUATORIAL_RADIUS_KM,
    y - camera[1] * EARTH_EQUATORIAL_RADIUS_KM,
    z - camera[2] * EARTH_EQUATORIAL_RADIUS_KM,
  ];
  const length = Math.hypot(...from);
  return angleBetween(view.unit, from.map((v) => v / length) as Vec3);
}

/**
 * The sets that cover `fromMs` to `toMs`, in order: from where the last stopped, the candidate that
 * stays within `SET_TOLERANCE` longest, handing over at the last sample it holds. Each set records
 * its worst measured error. Throws where no candidate holds.
 */
export function chain(
  candidates: Candidate[],
  samples: Sample[],
  fromMs: number,
  toMs: number,
  error: (c: Candidate, t: Sample) => number,
): { set: PassSet; worst: number }[] {
  const out: { set: PassSet; worst: number }[] = [];
  let start = fromMs;
  while (start < toMs) {
    const ahead = samples.filter((t) => t.ms >= start && t.ms <= toMs);
    let best: { c: Candidate; end: number; worst: number } | null = null;
    for (const c of candidates) {
      let end = start;
      let worst = 0;
      let held = true;
      for (const t of ahead) {
        const e = error(c, t);
        if (e > SET_TOLERANCE) {
          held = false;
          break;
        }
        end = t.ms;
        worst = Math.max(worst, e);
      }
      if (held) end = toMs;
      if (end > start && (!best || end > best.end)) best = { c, end, worst };
    }
    if (!best)
      throw new Error(
        `no element set holds within ${SET_TOLERANCE} degrees from ${fmt(start, true)}`,
      );
    out.push({
      set: { ...best.c, fromMs: start, toMs: best.end },
      worst: fixed(best.worst, 4),
    });
    start = best.end;
  }
  return out;
}

/** The recorded queries of a run, for the sidecar. */
export interface SetQueries {
  elements: string;
  truth: string;
  /** The truth's step across the span and within `FINE_DAYS` of the table. */
  truthSteps: { span: string; near: string };
}

/**
 * The sets of one pass: before its table (from the run instant) and after it (to the span's end),
 * with each one's measured worst error. `solution` is the SBDB orbit solution the table is from;
 * Horizons' answers must name it.
 */
export async function readSets(
  designation: string,
  id: string,
  solution: string,
  nowMs: number,
  spanEndMs: number,
  table: { startMs: number; endMs: number },
  orbits: Orbits,
  get: Get,
) {
  /* Horizons' times are whole minutes: the first set starts at the run instant's minute, so a sample sits on it. */
  const from = Math.floor(nowMs / 60_000) * 60_000;
  const jds = candidateJds(from, spanEndMs, table);
  const candidates: Candidate[] = [];
  for (let i = 0; i < jds.length; i += BATCH)
    candidates.push(
      ...parseElements(
        await get(
          ELEMENTS_QUERY.replace("<id>", designation).replace(
            "<jds>",
            jds.slice(i, i + BATCH).join(" "),
          ),
        ),
        solution,
      ),
    );
  const truthUrl = (from: number, to: number, step: string) =>
    TRUTH_QUERY.replace("<id>", designation)
      .replace("<from>", fmt(from, true))
      .replace("<to>", fmt(to, true))
      .replace("<step>", step);
  const fine = FINE_DAYS * DAY_MS;
  const samples = new Map<number, Sample>();
  for (const url of [
    truthUrl(from, spanEndMs, COARSE_STEP),
    truthUrl(table.startMs - fine, table.endMs + fine, FINE_STEP),
  ])
    for (const s of parseTruth(await get(url))) samples.set(s.ms, s);
  const sorted = [...samples.values()].sort((a, b) => a.ms - b.ms);
  const error = (c: Candidate, t: Sample) => errorAt(orbits, id, c, t);
  const found = [
    ...chain(candidates, sorted, from, table.startMs, error),
    ...chain(candidates, sorted, table.endMs, spanEndMs, error),
  ];
  return {
    sets: found.map(({ set }) => set),
    worst: found.map(({ worst }) => worst),
    queries: {
      elements: ELEMENTS_QUERY,
      truth: TRUTH_QUERY,
      truthSteps: { span: COARSE_STEP, near: FINE_STEP },
    } satisfies SetQueries,
  };
}
