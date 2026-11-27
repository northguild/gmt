/**
 * When the small bodies' elements in `src/assets/sky-orbits.json` need replacing. A row holds the
 * elements' `epoch` (a Julian date) and the `days` either side of it the sky draws the body for
 * (`ELEMENT_DAYS` in `prepare-sky-orbits.ts`), so a row is good until `epoch + days`.
 * `sky-orbits-fresh.mjs` runs this on the clock; the function itself takes the instant, so its test
 * needs none. A close pass (`passes`) is stale for two other reasons: JPL has solved the body's
 * orbit again (its current SBDB solution id is not the recorded one), or its window has ended.
 */

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;

/** The days before the end of a row's validity at which the gate starts to fail. */
export const WARN_DAYS = 90;

/**
 * The rows that end within `WARN_DAYS` of `nowMs` (or ended already), each as
 * `{ id, daysLeft }` with `daysLeft` negative once it has ended.
 *
 * @param {Record<string, { epoch: number; days: number }>} small the `small` rows of the orbits
 * @param {number} nowMs the Unix instant to judge at
 */
export function staleSmallBodies(small, nowMs) {
  return Object.entries(small)
    .map(([id, { epoch, days }]) => ({
      id,
      daysLeft: Math.floor(epoch + days - (nowMs / DAY_MS + UNIX_EPOCH_JD)),
    }))
    .filter(({ daysLeft }) => daysLeft <= WARN_DAYS);
}

/**
 * The passes whose window ended before `nowMs`, each as `{ id, daysAgo }`.
 *
 * @param {Record<string, { endMs: number }>} passes the `passes` of the orbits
 * @param {number} nowMs the Unix instant to judge at
 */
export function endedPasses(passes, nowMs) {
  return Object.entries(passes)
    .map(([id, { endMs }]) => ({
      id,
      daysAgo: Math.floor((nowMs - endMs) / DAY_MS),
    }))
    .filter(({ daysAgo }) => daysAgo >= 0);
}

/** The orbit solution id of an SBDB reply, or null when it has none. */
export const solutionId = (reply) => reply?.orbit?.orbit_id ?? null;

/**
 * The passes whose recorded solution is not the one JPL holds now, each as `{ id, recorded, current }`.
 *
 * @param {Record<string, string>} recorded each pass's recorded solution id, from the sidecar, by pass id
 * @param {Record<string, string | null>} current each body's current solution id, by pass id
 */
export function changedSolutions(recorded, current) {
  return Object.entries(recorded)
    .filter(([id, solution]) => current[id] !== solution)
    .map(([id, solution]) => ({
      id,
      recorded: solution,
      current: current[id] ?? null,
    }));
}
