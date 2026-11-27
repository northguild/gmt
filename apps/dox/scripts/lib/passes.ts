/**
 * The close passes of `sky-orbits.json` and their credit: asks JPL's close-approach API for the
 * Earth's approaches from the run instant on, keeps those the sky can show (`close-approach.ts`),
 * and for each reads the Small-Body Database solution and Horizons' state vectors. `get` fetches
 * one URL as JSON, so the test and the recorded fixtures stand in for the network.
 */
import { fail } from "../prepare-source.mjs";
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import type { Orbits, Pass } from "../../src/lib/ephemeris";
import type { PassRows } from "../../src/lib/sky-pass";
import type { SmallId } from "../../src/lib/magnitude";
import {
  askedSpan,
  cadUrl,
  CAD_QUERY,
  horizonsUrl,
  HORIZONS_QUERY,
  LOOKAHEAD_DAYS,
  parseApproaches,
  parseVectors,
  prefilter,
  rowMagnitudes,
  TABLE_PAD_MS,
  TABLE_STEP,
  trimWindow,
  WINDOW_STEP,
  windowOf,
} from "./close-approach";
import { readSets, SET_TOLERANCE, type SetQueries } from "./pass-sets";
import {
  parsePhotometry,
  parseSolution,
  sbdbUrl,
  SBDB_QUERY,
} from "./jpl-sbdb";
import { fixed } from "./small-bodies";

export type Get = (url: string) => Promise<unknown>;

/** What the sidecar records of one pass. */
interface PassSource {
  designation: string;
  solution: string;
  epoch: number;
  solutionDate: string;
  observations: number;
  producer: string;
  closestApproach: string;
  closestKm: number;
  peak: number;
  /** The span brighter than the limit plus the margin, and the table shipped: that and a day either side. */
  window: { from: string; to: string };
  table: { from: string; to: string };
  /** Each element set: its Horizons epoch (a Julian date), the span it holds and its worst measured error, degrees. */
  sets: { epoch: number; from: string; to: string; worstDegrees: number }[];
  tolerance: number;
  queries: {
    approaches: string;
    photometry: string;
    vectors: string;
    steps: { window: string; table: string };
  } & SetQueries;
}

/** One JPL API answer as JSON. */
export const getJson: Get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) fail("prepare-sky-orbits", `${url}: HTTP ${res.status}`);
  return res.json();
};

/** The close passes' source as the sidecar records it (see `lib/passes.ts`). */
export const passSource = (bodies: object) => ({
  title:
    "Close-approach positions: JPL Horizons state vectors of JPL SBDB solutions",
  publisher: "NASA JPL Solar System Dynamics",
  page: "https://ssd.jpl.nasa.gov/",
  bodies,
});

/** The slope parameter the IAU H, G system assumes for a body with none fitted. */
const DEFAULT_G = 0.15;
const DAY_MS = 86_400_000;

/** The passes brighter than `limit` from `nowMs` on: their windows (`sky-orbits.json`), their rows (`sky-passes.json`) and the sidecar's record. */
export async function readPasses(
  nowMs: number,
  limit: number,
  orbits: Orbits,
  get: Get,
): Promise<{
  passes: Orbits["passes"];
  rows: PassRows;
  sources: Record<string, PassSource>;
}> {
  const approaches = parseApproaches(
    await get(cadUrl(nowMs, nowMs + LOOKAHEAD_DAYS * DAY_MS)),
  );
  const passes: Orbits["passes"] = {};
  const rows: PassRows = {};
  const sources: Record<string, PassSource> = {};
  for (const a of prefilter(approaches, limit)) {
    const sbdb = await get(sbdbUrl(a.des));
    const fitted = parsePhotometry(sbdb);
    const solution = parseSolution(sbdb);
    if (!solution)
      throw new Error(`JPL SBDB has no orbit solution for ${a.des}`);
    /* A body with no fitted G is judged with the H, G system's default; one that qualifies stops the run, as its G is not guessed. */
    const photometry = fitted ?? { H: a.H, G: DEFAULT_G };
    const name = String(
      (sbdb as { object?: { shortname?: string } }).object?.shortname ?? a.des,
    ).replace(/^\d+\s+/, "");
    const id = name.toLowerCase() as SmallId;
    const span = askedSpan(a, limit);
    const vectors = horizonsUrl(a.des, span.from, span.to);
    const table = parseVectors(await get(vectors));
    const magnitudes = rowMagnitudes(table, photometry, orbits, id);
    const window = trimWindow(table, magnitudes, limit);
    if (!window) continue;
    if (!fitted)
      throw new Error(
        `${a.des} is bright enough for the sky but JPL SBDB has no fitted G for it`,
      );
    /* The shipped table: the window and a day either side, at a coarser, uniform step. */
    const wide = parseVectors(
      await get(
        horizonsUrl(
          a.des,
          window.startMs - TABLE_PAD_MS,
          windowOf(window).endMs + TABLE_PAD_MS,
          TABLE_STEP,
        ),
      ),
    );
    const found = await readSets(
      a.des,
      id,
      solution.id,
      nowMs,
      nowMs + LOOKAHEAD_DAYS * DAY_MS,
      windowOf(wide),
      orbits,
      get,
    );
    passes[id] = {
      ...windowOf(wide),
      ...photometry,
      sets: found.sets,
    } satisfies Pass;
    rows[id] = { stepMs: wide.stepMs, rows: wide.rows };
    sources[id] = {
      designation: a.des,
      solution: solution.id,
      epoch: solution.epoch,
      solutionDate: solution.date,
      observations: solution.observations,
      producer: solution.producer,
      closestApproach: convertUnixToUtc(Math.round(a.ms / 60_000) * 60_000),
      closestKm: Math.round(a.distKm),
      peak: fixed(Math.min(...magnitudes), 2),
      window: {
        from: convertUnixToUtc(window.startMs),
        to: convertUnixToUtc(windowOf(window).endMs),
      },
      table: {
        from: convertUnixToUtc(wide.startMs),
        to: convertUnixToUtc(windowOf(wide).endMs),
      },
      sets: found.sets.map((set, k) => ({
        epoch: set.epoch,
        from: convertUnixToUtc(set.fromMs),
        to: convertUnixToUtc(set.toMs),
        worstDegrees: found.worst[k]!,
      })),
      tolerance: SET_TOLERANCE,
      queries: {
        approaches: CAD_QUERY,
        photometry: SBDB_QUERY,
        vectors: HORIZONS_QUERY,
        steps: { window: WINDOW_STEP, table: TABLE_STEP },
        ...found.queries,
      },
    };
  }
  return { passes, rows, sources };
}
