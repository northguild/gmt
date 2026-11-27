#!/usr/bin/env tsx
/**
 * Turns IMCCE's VSOP87B planetary theory into the small series the night sky places the planets
 * from, and the IAU Minor Planet Center's bright minor planets file into the elements it places the
 * small bodies from: `src/assets/sky-orbits.json` and its credit sidecar
 * `src/assets/sky-orbits.source.json`, and a close pass's rows in `src/assets/sky-passes.json`
 * (a lazy chunk's, `sky-pass.ts`). It is run by hand; its output is committed.
 *
 * VSOP87B (Bretagnon and Francou 1988, Astronomy and Astrophysics 202, 309) is IMCCE's
 * heliocentric spherical theory of the J2000 dynamical ecliptic. The script reads the files of
 * the Earth (the observer) and of each planet that can reach the stars' faint limit
 * (`FAINT_LIMIT`, 5.5: Neptune never does), pinned by size and sha256, and:
 *
 * 1. keeps a term when its amplitude, at the largest `t` of the span, still reaches `EPSILON`
 *    (the amplitude times `REACH`, 0.2, to the power of the term's power of `t`; a radius term's limit
 *    is scaled by the planet's semi-major axis, so every coordinate keeps the same angle);
 * 2. rounds each of a kept term's three numbers to the coarsest power of ten that moves the term,
 *    at that same `t`, by at most `ROUNDING` of the limit (the amplitude by itself; the phase and
 *    frequency times the amplitude, the frequency times `t` once more): a large term keeps more
 *    digits than a small one;
 * 3. keeps the planets whose brightest magnitude over the span reaches the faint limit;
 * 4. measures, for each kept planet, the worst angle between the truncated theory and the full
 *    one over the span, in arcseconds, and writes it down.
 *
 * The span is the run instant (gmt's `getUnixNow`) plus and minus 200 years: the series stays
 * inside it, so a re-run moves it on. IMCCE publishes the files for use with attribution and
 * states no further licence; the derived coefficients are shipped with that attribution.
 *
 * The small bodies are the rows of the MPC file for the run instant's year (`mpc-bright.ts`: not
 * near-Earth, a perihelic opposition at or under `FAINT_LIMIT`), kept with their elements and the
 * `ELEMENT_DAYS` either side of the elements' epoch that two-body motion holds for (Vesta against
 * JPL Horizons: 0.010 degrees (0.4 px) within 360 days, 0.035 degrees (1.5 px) at 720, 0.1 to 0.5
 * degrees from 3 to 5 years). Elements age, so the file is pinned by year (`MPC_PINS`) and the
 * yearly refresh is `--small`: it reads the new year's file, replaces only the small bodies and
 * leaves the planets' series as they were. The weekly gate `sky-orbits-fresh` says when to. H and G
 * come per body from JPL's SBDB (`jpl-sbdb.ts`), since the MPC file's G is a default. Pluto's row
 * is the MPC distant file's (`readDistant`); a pass's table is a day wider each side, element sets
 * place it outside the table (`lib/pass-sets.ts`).
 *
 * Run it from `apps/dox`; the files download, or come as `--ear <file>`, `--ven`, ... `--mpc`:
 *     pnpm exec tsx scripts/prepare-sky-orbits.ts [--small] [--ear VSOP87B.ear] ... [--mpc Soft00Bright.txt]
 *
 * Every run (and `--events`, offline, from the files shipped) also writes `src/assets/sky-events.json`:
 * when each point body is bright enough to draw, run instant to +3,650 days (`lib/spells.ts`).
 */
import { pathToFileURL } from "node:url";
import { getUnixNow } from "@northguild/gmt/unix/get";
import { fail, readPinnedSource } from "./prepare-source.mjs";
import { SBDB_QUERY } from "./lib/jpl-sbdb";
import { readJson, writeJson } from "./lib/assets";
import { getJson, passSource, readPasses } from "./lib/passes";
import { fixed, readDistant, readSmall } from "./lib/small-bodies";
import { closestOf, skyEvents } from "./lib/spells";
import { DAY_MS } from "../src/lib/globe/sun";
import { bodyFromCamera, type Orbits, type Series } from "../src/lib/ephemeris";
import type { PassRows } from "../src/lib/sky-pass";
import { apparentMagnitude, type PlanetId } from "../src/lib/magnitude";

const RAD = Math.PI / 180;

/** The stars' faint limit: the dimmest magnitude a planet is kept for. */
const FAINT_LIMIT = 5.5;
/** The span either side of the run instant, years. */
const SPAN_YEARS = 200;
/** The smallest angle a kept term makes, radians (2e-6 for the Earth, 8e-6 for a planet: about 0.4 and 1.6 arcseconds). */
const EPSILON = { earth: 2e-6, planet: 8e-6 };
/** The share of a term's limit that rounding one of its numbers may move it by. */
const ROUNDING = 0.25;
/** The span's reach from J2000, Julian millennia: the `t` the limits are measured at. */
const REACH = 0.2;
/** Sampling steps over the span, days: for the brightest magnitude, and for the worst error. */
const PEAK_STEP = 10;
const ERROR_STEP = 20;

/** The pinned files: each planet's, the series' semi-major axis (au) and the Earth's. */
const SOURCES = {
  earth: [
    "ear",
    343_406,
    "30a05a74b8bf65aeffffea7d329934b648dfbe186a06f6cce12b0d9403f896bb",
    1,
  ],
  mercury: [
    "mer",
    949_753,
    "cc3c03bb5ca5257983e5f311c22b5cea43da504a27f0bb8a09281c6da0f7c10f",
    0.387_098,
  ],
  venus: [
    "ven",
    229_824,
    "fcff361adbdb3a9947c7e0cbe45e9ac45585987983fc891c92462e15a532e8e4",
    0.723_332,
  ],
  mars: [
    "mar",
    853_594,
    "1e39273409b7fac1262d2e4682856b5c8f18ea745540c77c90b0a16dba8d14cf",
    1.523_679,
  ],
  jupiter: [
    "jup",
    484_519,
    "408b5938ab39e661940b4253579f4a7a65f206926d98bec20e46aebb06cdd159",
    5.202_603,
  ],
  saturn: [
    "sat",
    848_939,
    "c790102e7d698c4a2de125e3eb8e87b19c7d6ee1cc2082440ef9689633da5d6a",
    9.554_909,
  ],
  uranus: [
    "ura",
    702_639,
    "a71943b2a514c03ab6e6e4071a6cccc13fd42c9879910f71630df04b8fbe1066",
    19.218_446,
  ],
} as const satisfies Record<string, readonly [string, number, string, number]>;

const urlOf = (ext: string) =>
  `https://ftp.imcce.fr/pub/ephem/planets/vsop87/VSOP87B.${ext}`;

/** The days either side of a small body's epoch that its two-body elements are drawn for (measured, above). */
const ELEMENT_DAYS = 720;

type Powers = number[][];

/**
 * A VSOP87B file's terms: `[L, B, R]` each a list by power of `t` of the flat triplets
 * `[A, B, C, ...]`. A header line names the variable (1 to 3) and the power; every term line
 * ends with its amplitude, phase and frequency.
 */
function parseSeries(text: string): Series {
  const out: Powers[] = [[], [], []];
  let into: number[] | null = null;
  for (const line of text.split("\n")) {
    const header = /VARIABLE\s+([123])\s+\(LBR\)\s+\*T\*\*(\d)/.exec(line);
    if (header) {
      into = [];
      (out[Number(header[1]) - 1] as Powers)[Number(header[2])] = into;
      continue;
    }
    const tokens = line.trim().split(/\s+/);
    if (!into || tokens.length < 3) continue;
    into.push(...tokens.slice(-3).map(Number));
  }
  const [L, B, R] = out as [Powers, Powers, Powers];
  return { L, B, R };
}

/** `x` at the coarsest power of ten no larger than `step`. */
const toStep = (x: number, step: number) =>
  fixed(x, Math.max(0, Math.ceil(-Math.log10(step))));

/** The terms of one coordinate's series kept for `limit`, rounded. */
function keep(powers: Series["L"], limit: number): Powers {
  const move = limit * ROUNDING;
  return powers.map((terms, k) => {
    const kept: number[] = [];
    for (let i = 0; i < terms.length; i += 3) {
      const reach = Math.abs(terms[i]!) * REACH ** k;
      if (reach < limit) continue;
      kept.push(
        toStep(terms[i]!, move / REACH ** k),
        toStep(terms[i + 1]!, move / reach),
        toStep(terms[i + 2]!, move / (reach * REACH)),
      );
    }
    return kept;
  });
}

/** A series truncated at `epsilon` (radians) for a planet of semi-major axis `a` (au), then rounded. */
export function truncate(series: Series, epsilon: number, a: number): Series {
  return {
    L: keep(series.L, epsilon),
    B: keep(series.B, epsilon),
    R: keep(series.R, epsilon * a),
  };
}

/** The planets that reach `limit`: the ids whose brightest magnitude is at or under it. */
function selectBodies<T extends string>(
  peaks: Record<T, number>,
  limit: number,
): T[] {
  return (Object.keys(peaks) as T[]).filter((id) => peaks[id] <= limit);
}

const hasAny = (s: Series) => s.L.length + s.B.length + s.R.length > 0;

/** The angle between two unit vectors, arcseconds. */
const angle = (a: readonly number[], b: readonly number[]) =>
  (Math.acos(Math.min(1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!)) /
    RAD) *
  3600;

/** The Orbits built from the pinned files at the run instant. */
async function build(
  now: number,
): Promise<{ orbits: Orbits; full: Orbits; files: object[] }> {
  const files: object[] = [];
  const read = async (id: keyof typeof SOURCES) => {
    const [ext, bytes, sha256, a] = SOURCES[id];
    const url = urlOf(ext);
    const data = await readPinnedSource({
      name: `prepare-sky-orbits ${id}`,
      url,
      bytes,
      sha256,
      flag: ext,
    });
    files.push({ body: id, url, bytes, sha256 });
    const full = parseSeries(data.toString("latin1"));
    if (!hasAny(full)) fail("prepare-sky-orbits", `no terms read from ${url}`);
    return {
      full,
      kept: truncate(full, id === "earth" ? EPSILON.earth : EPSILON.planet, a),
    };
  };
  const earth = await read("earth");
  const span = {
    from: now - SPAN_YEARS * 365.2425 * DAY_MS,
    to: now + SPAN_YEARS * 365.2425 * DAY_MS,
  };
  const ids = Object.keys(SOURCES).filter((id) => id !== "earth") as PlanetId[];
  const all = Object.fromEntries(
    await Promise.all(ids.map(async (id) => [id, await read(id)])),
  );
  const orbits = (pick: "full" | "kept"): Orbits => ({
    span,
    earth: earth[pick],
    bodies: Object.fromEntries(
      ids.map((id) => [id, { ...all[id][pick], peak: 0, worst: 0 }]),
    ),
    small: {},
    passes: {},
  });
  return { orbits: orbits("kept"), full: orbits("full"), files };
}

/** Each planet's brightest magnitude over the span, and the worst angle of the truncation, arcseconds. */
function measure(orbits: Orbits, full: Orbits) {
  const peaks = {} as Record<PlanetId, number>;
  const worst = {} as Record<PlanetId, number>;
  for (const id of Object.keys(orbits.bodies) as PlanetId[]) {
    peaks[id] = Infinity;
    worst[id] = 0;
    for (
      let ms = orbits.span.from;
      ms <= orbits.span.to;
      ms += PEAK_STEP * DAY_MS
    ) {
      const view = bodyFromCamera(orbits, id, ms)!;
      peaks[id] = Math.min(peaks[id], apparentMagnitude(id, view, ms));
      if (Math.round((ms - orbits.span.from) / DAY_MS) % ERROR_STEP === 0)
        worst[id] = Math.max(
          worst[id],
          angle(view.unit, bodyFromCamera(full, id, ms)!.unit),
        );
    }
  }
  return { peaks, worst };
}

/** `sky-events.json`: the spells of the point bodies of `orbits`, searched from the run instant. */
const writeEvents = (
  now: number,
  orbits: Orbits,
  rows: PassRows,
  sources: Parameters<typeof closestOf>[0],
) =>
  writeJson(
    "sky-events.json",
    skyEvents(orbits, rows, closestOf(sources), now, FAINT_LIMIT),
  );

async function main() {
  const now = getUnixNow();
  if (process.argv.includes("--events"))
    return writeEvents(
      now,
      readJson("sky-orbits.json"),
      readJson("sky-passes.json"),
      readJson("sky-orbits.source.json").passSource.bodies,
    );
  const refresh = process.argv.includes("--small");
  const {
    file,
    bodies: smallBodies,
    ...bright
  } = await readSmall(now, FAINT_LIMIT, ELEMENT_DAYS);
  const distant = await readDistant(now, ELEMENT_DAYS);
  const small = { ...bright.small, ...distant.small };
  const smallSource = {
    title: "MPC bright minor planets, osculating elements",
    publisher: "IAU Minor Planet Center",
    page: "https://www.minorplanetcenter.net/iau/Ephemerides/Bright/",
    file,
    elementDays: ELEMENT_DAYS,
    photometry: SBDB_QUERY,
    bodies: smallBodies,
  };
  if (refresh) {
    const kept = readJson("sky-orbits.json");
    const { passes, rows, sources } = await readPasses(
      now,
      FAINT_LIMIT,
      kept,
      getJson,
    );
    writeJson("sky-orbits.json", { ...kept, small, passes });
    writeJson("sky-passes.json", rows);
    writeEvents(now, { ...kept, small, passes }, rows, sources);
    writeJson(
      "sky-orbits.source.json",
      {
        ...readJson("sky-orbits.source.json"),
        smallSource,
        distantSource: distant.source,
        passSource: passSource(sources),
      },
      2,
    );
    console.log(Object.keys({ ...small, ...passes }).join(", "));
    return;
  }
  const { orbits, full, files } = await build(now);
  const { peaks, worst } = measure(orbits, full);
  const kept = selectBodies(peaks, FAINT_LIMIT);
  const bodies: Orbits["bodies"] = {};
  for (const id of kept)
    bodies[id] = {
      ...orbits.bodies[id]!,
      peak: fixed(peaks[id], 2),
      worst: fixed(worst[id], 1),
    };
  const { passes, rows, sources } = await readPasses(
    now,
    FAINT_LIMIT,
    orbits,
    getJson,
  );
  const result: Orbits = {
    span: orbits.span,
    earth: orbits.earth,
    bodies,
    small,
    passes,
  };
  writeJson("sky-orbits.json", result);
  writeJson("sky-passes.json", rows);
  writeEvents(now, result, rows, sources);
  writeJson(
    "sky-orbits.source.json",
    {
      name: "Planets for the Dox night sky",
      source: {
        title: "VSOP87B, heliocentric spherical coordinates, J2000 ecliptic",
        publisher: "IMCCE, Observatoire de Paris",
        page: "https://ftp.imcce.fr/pub/ephem/planets/vsop87/",
        reference:
          "Bretagnon and Francou 1988, Astronomy and Astrophysics 202, 309-315",
        files,
      },
      credit: "Bretagnon, P. and Francou, G., IMCCE (VSOP87)",
      license:
        "IMCCE publishes the files for use with attribution; no further licence is stated",
      changes: `Terms smaller than ${EPSILON.planet} rad (${EPSILON.earth} rad for the Earth) at the span's ends dropped, each kept number rounded to the coarsest power of ten that moves its term by at most ${ROUNDING} of that limit, for ${SPAN_YEARS} years either side of the run.`,
      generator: "apps/dox/scripts/prepare-sky-orbits.ts",
      span: orbits.span,
      faintLimit: FAINT_LIMIT,
      bodies: Object.fromEntries(
        kept.map((id) => [
          id,
          { peak: bodies[id]!.peak, worstArcseconds: bodies[id]!.worst },
        ]),
      ),
      omitted: Object.keys(peaks).filter(
        (id) => !kept.includes(id as PlanetId),
      ),
      smallSource,
      distantSource: distant.source,
      passSource: passSource(sources),
    },
    2,
  );
  console.log(
    kept
      .map(
        (id) => `${id}: peak ${bodies[id]!.peak}, worst ${bodies[id]!.worst}"`,
      )
      .join("\n"),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
