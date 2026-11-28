/**
 * Weekly gate: the small bodies' elements are not about to run out, and the close passes are
 * current.
 *
 * `src/assets/sky-orbits.json` holds each small body's osculating elements and the days either
 * side of their epoch the sky draws the body for (`prepare-sky-orbits.ts`); past that the body
 * drops out of the sky. This fails once the clock (gmt's `getUnixNow`) is within `WARN_DAYS` of a
 * row's end, so the refresh lands before the reader sees Vesta vanish. A close pass (`passes`) fails
 * when its window has ended, and when JPL's Small-Body Database now holds a different orbit solution
 * for the body than the one recorded (one request per pass, the only network the gate uses). The
 * pull-request tier never reads the date or the network, so only the weekly run can fail on either.
 *
 * The refresh, from `apps/dox`, with the MPC file of the new year pinned in `MPC_PINS`:
 *
 *     pnpm exec tsx scripts/prepare-sky-orbits.ts --small
 *
 * It replaces the small bodies and the passes and leaves the planets' series as they were. Then check the pins
 * in `sky-planets.test.ts` and the pin note in `context/dox/built/tier-4-globe.md`.
 *
 * Usage: `node scripts/sky-orbits-fresh.mjs` (no browser, no built site). The one page it names,
 * the landing page, is the one that draws the sky.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGmt } from "../../../scripts/lib/gmt.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";
import {
  changedSolutions,
  endedPasses,
  solutionId,
  staleSmallBodies,
  WARN_DAYS,
} from "./lib/orbits-fresh.mjs";

const GATE = "sky-orbits-fresh";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await applyPageContract({ gate: GATE, pages: ["/"] });

const read = (file) =>
  JSON.parse(readFileSync(path.join(APP, "src/assets", file), "utf8"));
const { small, passes } = read("sky-orbits.json");
const { passSource } = read("sky-orbits.source.json");
const { getUnixNow } = await loadGmt();
const now = getUnixNow();
const stale = staleSmallBodies(small, now);
const REFRESH = "Refresh: see the header of scripts/sky-orbits-fresh.mjs.";

/** The recorded solution id of each pass, and the current one of its body, from the SBDB query the sidecar records. */
const recorded = {};
const current = {};
for (const id of Object.keys(passes)) {
  const { designation, queries, solution } = passSource.bodies[id];
  recorded[id] = solution;
  const reply = await fetch(
    queries.photometry.replace("<name>", designation),
  ).then((res) => (res.ok ? res.json() : null));
  current[id] = solutionId(reply);
}

for (const { id, daysLeft } of stale) {
  const message =
    daysLeft < 0
      ? `${id}: its elements ended ${-daysLeft} days ago, so the sky no longer draws it`
      : `${id}: its elements end in ${daysLeft} days (the gate fails within ${WARN_DAYS})`;
  console.error(`${GATE}: ${message}. ${REFRESH}`);
  recordFinding({
    gate: GATE,
    rule: "elements-ending",
    page: "/",
    target: `body:${id}`,
    message,
  });
}

const passFindings = [
  ...endedPasses(passes, now).map(({ id, daysAgo }) => ({
    id,
    rule: "pass-ended",
    message: `${id}: its close-pass window ended ${daysAgo} days ago`,
  })),
  ...changedSolutions(recorded, current).map(({ id, recorded, current }) => ({
    id,
    rule: "solution-changed",
    message: `${id}: JPL's orbit solution is ${current ?? "missing"}, the recorded one is ${recorded}`,
  })),
];
for (const { id, rule, message } of passFindings) {
  console.error(`${GATE}: ${message}. ${REFRESH}`);
  recordFinding({ gate: GATE, rule, page: "/", target: `body:${id}`, message });
}

const measured = Object.keys(small).length + Object.keys(passes).length;
recordMeasured(GATE, measured);
if (stale.length === 0 && passFindings.length === 0)
  console.log(
    `${GATE}: ${measured} bodies, elements valid beyond ${WARN_DAYS} days, passes current`,
  );
process.exit(
  stale.length > 0 || passFindings.length > 0 || measured === 0 ? 1 : 0,
);
