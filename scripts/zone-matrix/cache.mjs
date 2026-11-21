/**
 * Finished runs are kept under `.work/cache/`, one file per run, keyed by suite, commit, Node
 * version, time-zone data, zone, command, the suite's install steps, the probe's source, the
 * attempt (a failing run is run a second time) and, for a suite run one process at a time, `serial`.
 * A change to any of them runs the suite again. A rerun reuses them, so a failure late in the
 * matrix never costs the hours already spent. A run that could not run is never kept, so a rerun tries it again.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const cacheKey = ({
  suite,
  commit,
  nodeVersion,
  tzdata,
  zone,
  command,
  install,
  probe,
  attempt,
  serial,
}) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        suite,
        commit,
        nodeVersion,
        tzdata,
        zone,
        command,
        install,
        probe,
        attempt,
        // Only when set, so the keys of the suites that run in parallel stay as they were.
        ...(serial ? ["serial"] : []),
      ]),
    )
    .digest("hex")
    .slice(0, 32);

export function readCached(dir, parts) {
  const file = join(dir, `${cacheKey(parts)}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Keeps a finished run; returns whether it was kept. */
export function writeCached(dir, parts, run) {
  if (run.result.couldNotRun) return false;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${cacheKey(parts)}.json`), JSON.stringify(run));
  return true;
}
