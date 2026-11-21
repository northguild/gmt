/** Builds one cell of the record, merges new cells into a suite, and joins a run with its rerun. */

/**
 * A run that fails is run once more. A test that fails in both runs is a failure; a test that
 * fails in only one is `unstable` and counts as neither kind. When the second run could not run,
 * that is the result, so the pair is tried again next time.
 * @param {{ result: { tests: number, failed: string[], couldNotRun?: string }, seen: string[] }} first
 * @param {{ result: { tests: number, failed: string[], couldNotRun?: string }, seen: string[] }} second
 */
export function combineRuns(first, second) {
  if (second.result.couldNotRun) return second;
  const a = new Set(first.result.failed);
  const b = new Set(second.result.failed);
  const all = [...new Set([...a, ...b])].sort();
  return {
    result: {
      tests: Math.max(first.result.tests, second.result.tests),
      failed: all.filter((id) => a.has(id) && b.has(id)),
      unstable: all.filter((id) => a.has(id) !== b.has(id)),
      messages: { ...second.result.messages, ...first.result.messages },
    },
    seen: [...first.seen, ...second.seen],
  };
}

/** Whether a run needs its second run: it ran and something failed. */
export const needsRerun = (run) =>
  !run.result.couldNotRun && run.result.failed.length > 0;

/**
 * @param {object} a
 * @param {string} a.node major, "22"
 * @param {string} a.nodeVersion full, "v22.22.2"
 * @param {string} a.tzdata the Node's time-zone data, `process.versions.tz`, "2026e"
 * @param {string} a.zone
 * @param {string} a.ranOn ISO date
 * @param {{ tests: number, failed: string[], unstable?: string[], couldNotRun?: string }} a.result
 * @param {string[]} a.reference failed ids at the reference zone on this Node
 * @param {{ file: string|null, line: number|null, zone: string } | null} a.override
 */
export function buildCell({
  node,
  nodeVersion,
  tzdata,
  zone,
  ranOn,
  result,
  reference,
  override,
}) {
  const known = new Set(reference);
  const cell = {
    node,
    nodeVersion,
    tzdata,
    tz: zone,
    zone,
    ranOn,
    tests: result.tests,
    failed: [],
    alsoFailsAtReference: [],
    unstable: [],
  };
  if (result.couldNotRun) {
    cell.couldNotRun = result.couldNotRun;
    return cell;
  }
  if (override) {
    // The suite replaced the zone, so these results are not from the requested zone.
    cell.overriddenBy = override;
    return cell;
  }
  for (const id of [...new Set(result.failed)].sort()) {
    (known.has(id) ? cell.alsoFailsAtReference : cell.failed).push(id);
  }
  // A test that fails at the reference zone is known there, whether or not it fails here twice.
  for (const id of [...new Set(result.unstable ?? [])].sort()) {
    (known.has(id) ? cell.alsoFailsAtReference : cell.unstable).push(id);
  }
  cell.alsoFailsAtReference.sort();
  return cell;
}

/** Replaces cells with the same node and zone, keeps the rest, and orders them. */
export function mergeCells(existing, added) {
  const key = (c) => `${c.node}|${c.zone}`;
  const map = new Map(existing.map((c) => [key(c), c]));
  for (const c of added) map.set(key(c), c);
  return [...map.values()].sort(
    (a, b) => Number(a.node) - Number(b.node) || a.zone.localeCompare(b.zone),
  );
}
