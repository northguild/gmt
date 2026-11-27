/**
 * The spells of `src/assets/sky-events.json`: when each point body of `sky-orbits.json` is bright
 * enough to draw (V at or under the faint limit) from the Earth's centre, over the run instant and
 * the 3,650 days after it (`LOOKAHEAD_DAYS`, the close passes' window). Nothing searches in the
 * reader's browser; `prepare-sky-orbits.ts` writes this file with the orbits.
 *
 * A planet or a small body is stepped a day and each edge found to the hour; a pass is stepped by
 * its table's 10 minutes and each edge found to the minute. The magnitude is the layer's own
 * (`viewMagnitude`, the same `bodyFromCamera`), so the file and the sky cannot disagree. A small
 * body is searched past the days its elements are good for (`Infinity` here): a date to the day
 * needs V to about 0.05 mag, and the distance error of an aged orbit moves V far less (measured
 * against Horizons in `prepare-sky-orbits.test.ts`).
 */
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { bodyFromCamera, type Orbits } from "../../src/lib/ephemeris";
import { DAY_MS } from "../../src/lib/globe/sun";
import { viewMagnitude } from "../../src/lib/magnitude";
import { passPlacer } from "../../src/lib/pass-table";
import type { PassRows } from "../../src/lib/sky-pass";
import type { PointId } from "../../src/lib/sky-registry";
import type { SkyEventData } from "../../src/lib/sky-events";
import { LOOKAHEAD_DAYS } from "./close-approach";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const STEP_PASS_MS = 600_000;

/** The instant between `a` and `b`, where `visible` changes, to within `edge` ms (rounded to a multiple of it). */
function crossing(
  visible: (ms: number) => boolean,
  a: number,
  b: number,
  edge: number,
): number {
  const was = visible(a);
  let [lo, hi] = [a, b];
  while (hi - lo > edge) {
    const mid = (lo + hi) / 2;
    if (visible(mid) === was) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2 / edge) * edge;
}

/** The runs of `from` to `to` where `visible` holds: sampled every `step`, edges found to `edge`. */
export function spells(
  visible: (ms: number) => boolean,
  from: number,
  to: number,
  step: number,
  edge: number,
): [number, number][] {
  const out: [number, number][] = [];
  let open: number | null = visible(from) ? from : null;
  let last = from;
  while (last < to) {
    const at = Math.min(last + step, to);
    const now = visible(at);
    if (now !== (open !== null)) {
      const edgeMs = Math.min(
        Math.max(crossing(visible, last, at, edge), last),
        at,
      );
      if (now) open = edgeMs;
      else {
        out.push([open!, edgeMs]);
        open = null;
      }
    }
    last = at;
  }
  if (open !== null) out.push([open, to]);
  return out;
}

/** Closest approaches by body, Unix ms, from the sidecar's records (UTC to the minute). */
export const closestOf = (
  sources: Record<string, { closestApproach: string }>,
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(sources).map(([id, { closestApproach }]) => [
      id,
      convertUtcToUnix(closestApproach, {
        epochUnit: "milliseconds",
      }) as number,
    ]),
  );

/**
 * Every point body's spells, sorted by start. `rare` is a source's, never a name's: true for the
 * small bodies and the passes, false for the planets.
 */
export function skyEvents(
  orbits: Orbits,
  rows: PassRows,
  closest: Record<string, number>,
  nowMs: number,
  limit: number,
): SkyEventData {
  const spanEndMs = nowMs + LOOKAHEAD_DAYS * DAY_MS;
  /* Past its days an element set still dates a spell; the layer's own check is the days, so lift it here. */
  const search: Orbits = {
    ...orbits,
    small: Object.fromEntries(
      Object.entries(orbits.small).map(([id, s]) => [
        id,
        { ...s, days: Infinity },
      ]),
    ),
  };
  const tables = Object.fromEntries(
    Object.entries(orbits.passes).map(([id, { startMs }]) => [
      id,
      { startMs, ...rows[id]! },
    ]),
  );
  const placer = passPlacer(tables);
  const events: SkyEventData["events"] = [];
  for (const id of [
    ...Object.keys(orbits.bodies),
    ...Object.keys(orbits.small),
    ...Object.keys(orbits.passes),
  ] as PointId[]) {
    const pass = orbits.passes[id as keyof Orbits["passes"]];
    const visible = (ms: number): boolean => {
      const view = bodyFromCamera(search, id, ms, undefined, placer);
      return !!view && viewMagnitude(search, id, view, ms) <= limit;
    };
    const rare = !(id in orbits.bodies);
    for (const [startMs, endMs] of pass
      ? spells(
          visible,
          Math.max(nowMs, pass.startMs),
          Math.min(spanEndMs, pass.endMs),
          STEP_PASS_MS,
          MINUTE_MS,
        )
      : spells(visible, nowMs, spanEndMs, DAY_MS, HOUR_MS))
      events.push({
        id,
        rare,
        startMs,
        endMs,
        ...(pass && closest[id] !== undefined
          ? { closestMs: closest[id] }
          : {}),
        unit: pass ? "minute" : "day",
      });
  }
  events.sort((a, b) => a.startMs - b.startMs || (a.id < b.id ? -1 : 1));
  return { spanEndMs, events };
}
