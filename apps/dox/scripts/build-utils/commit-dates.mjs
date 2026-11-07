/**
 * The date each generated page was last changed, read from git.
 *
 * Starlight finds a page's footer date from the page's own file, and a generated page is not
 * tracked, so it has none (`built.md`, "Trap: an untracked page has no footer date"). Each
 * generator writes `lastUpdated:` into the page's frontmatter instead, from the commit date of the
 * files the page is made from. The sitemap's `<lastmod>` copies the footer, so the two cannot
 * disagree.
 *
 * `newestCommit(paths)` runs one `git log --name-only` per process, over the paths
 * it is given, and caches the newest commit time of each path, as Starlight's
 * `getAllNewestCommitDate` does. A later call with a path it has not read runs one more `git log`
 * for those paths only; a generator that passes every input to `loadCommitDates` first costs one.
 * The call reads history only, from `cwd` (the repository root by default); `GIT_DIR` and
 * `GIT_WORK_TREE` direct it at a tree that has no `.git`.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

/** The repository root: this file is `apps/dox/scripts/build-utils/commit-dates.mjs`. */
const REPOSITORY = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Newest commit instant by repo-relative path (`2026-10-19T05:35:38.000Z`), and the paths already
 * read, per `cwd`. Git writes the instant in UTC itself (`TZ=UTC`, `format-local`), so there is no
 * date arithmetic here, and equal-width UTC strings order as instants.
 */
const caches = new Map();

/**
 * @param {string} cwd
 * @returns {{ times: Map<string, string>, read: Set<string> }}
 */
function cacheFor(cwd) {
  let cache = caches.get(cwd);
  if (!cache) {
    cache = { times: new Map(), read: new Set() };
    caches.set(cwd, cache);
  }
  return cache;
}

/**
 * Reads the history of `paths` that this process has not read yet.
 *
 * @param {readonly string[]} paths repo-relative, `/`-separated
 * @param {string} cwd
 */
function readHistory(paths, cwd) {
  const cache = cacheFor(cwd);
  const missing = [...new Set(paths)].filter((path) => !cache.read.has(path));
  if (missing.length === 0) return;
  const log = spawnSync(
    "git",
    [
      "-c",
      "core.quotepath=false",
      "log",
      "--date=format-local:%Y-%m-%dT%H:%M:%S.000Z",
      "--format=t:%cd",
      "--name-only",
      "--",
      ...missing,
    ],
    {
      cwd,
      encoding: "utf8",
      env: { ...process.env, TZ: "UTC" },
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  // No history (not a repository, a shallow clone with no such path) leaves every path without a
  // date, which the caller writes as `lastUpdated: false`.
  for (const path of missing) cache.read.add(path);
  if (log.error || log.status !== 0) return;
  let at = "";
  for (const line of log.stdout.split("\n")) {
    if (line.startsWith("t:")) {
      at = line.slice(2);
    } else if (line !== "") {
      const known = cache.times.get(line) ?? "";
      if (at > known) cache.times.set(line, at);
    }
  }
}

/**
 * Reads the history of every path in one `git log`.
 *
 * @param {readonly string[]} paths repo-relative, `/`-separated
 * @param {{ cwd?: string }} [options]
 */
export function loadCommitDates(paths, options = {}) {
  readHistory(paths, options.cwd ?? REPOSITORY);
}

/**
 * The newest commit time over `paths`.
 *
 * @param {readonly string[]} paths repo-relative, `/`-separated
 * @param {{ cwd?: string }} [options]
 * @returns {string | undefined} an ISO instant in UTC (`2026-10-19T05:35:38.000Z`), or undefined
 *   when no path has a commit
 */
export function newestCommit(paths, options = {}) {
  const cwd = options.cwd ?? REPOSITORY;
  readHistory(paths, cwd);
  const { times } = cacheFor(cwd);
  let newest = "";
  for (const path of paths) {
    const at = times.get(path) ?? "";
    if (at > newest) newest = at;
  }
  return newest === "" ? undefined : newest;
}

/**
 * A digest of every path's newest commit time. A generator that skips unchanged inputs by content
 * adds it to the hash: a file edited and then reverted has its old bytes and a new commit date.
 *
 * @param {readonly string[]} paths repo-relative, `/`-separated
 * @param {{ cwd?: string }} [options]
 * @returns {string}
 */
export function commitDatesKey(paths, options = {}) {
  const cwd = options.cwd ?? REPOSITORY;
  readHistory(paths, cwd);
  const { times } = cacheFor(cwd);
  const lines = [...new Set(paths)]
    .sort()
    .map((path) => `${path}\t${times.get(path) ?? ""}`);
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

/** The frontmatter line for a page: the instant, or `false` when no input has a commit. */
export function lastUpdatedLine(instant) {
  return `lastUpdated: ${instant ?? "false"}`;
}

/**
 * `mdx` with a `lastUpdated:` line at the end of its frontmatter.
 *
 * @param {string} mdx a page that starts with a frontmatter block
 * @param {string | undefined} instant from `newestCommit`
 */
export function withLastUpdated(mdx, instant) {
  const close = mdx.indexOf("\n---\n", 4);
  if (!mdx.startsWith("---\n") || close < 0) {
    throw new Error("[commit-dates] a page has no frontmatter to date.");
  }
  return `${mdx.slice(0, close)}\n${lastUpdatedLine(instant)}${mdx.slice(close)}`;
}
