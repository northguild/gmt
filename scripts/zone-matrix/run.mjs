#!/usr/bin/env node
/**
 * Zone matrix runner. Runs the test suites of the date libraries the site compares, and GMT's
 * own as the control, under the zones and Node majors of GMT's CI job (`gmt-matrix` in
 * `.github/workflows/ci.yml`), and writes the record `apps/dox/src/data/zone-matrix.json`.
 * The Dox pages `/compare/zone-matrix/` and `/compare/` read that file.
 *
 *   cd scripts/zone-matrix
 *   pnpm install --ignore-workspace
 *   pnpm matrix --plan                          # list the runs, run nothing
 *   pnpm matrix --suite moment --zone Pacific/Apia --node 24
 *   pnpm matrix                                 # everything: hours
 *
 * Flags: `--suite <id>`, `--zone <name>`, `--node <major>` (each repeatable) narrow the run;
 * `--plan` prints it; `--parallel <P>` runs P test processes at once (default 2) and
 * `--workers <W>` gives each W test workers (default 2).
 *
 * A run with a failure is run a second time; a test failing in only one of the two is `unstable`.
 * A failure is counted only when it is tagged in `tags.mjs`. A reference-zone or unstable failure
 * needs its cause in `causes.mjs`. An untagged failure, an uncaused one, or any GMT failure makes
 * the script exit 1 after the record is written. Node majors are switched with
 * `fnm exec`. See README.md.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadGmt } from "../lib/gmt.mjs";
import { formatJson } from "../lib/format-json.mjs";
import { readCached, writeCached } from "./cache.mjs";
import { buildCell, combineRuns, mergeCells, needsRerun } from "./cells.mjs";
import { CAUSES, causeProblems, matchCauses } from "./causes.mjs";
import { stepCommand } from "./install.mjs";
import { readMatrix } from "./matrix.mjs";
import { parseReport } from "./parsers.mjs";
import { overrideOf, scanPins } from "./pins.mjs";
import { SUITES } from "./suites.mjs";
import { TAGS, matchTags, staleTags, tagProblems } from "./tags.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..", "..");
const WORK = join(HERE, ".work");
const CI = ".github/workflows/ci.yml";
const RECORD =
  process.env.ZONE_MATRIX_RECORD ??
  join(ROOT, "apps/dox/src/data/zone-matrix.json");
const CACHE = join(WORK, "cache");
const PROBE = pathToFileURL(join(HERE, "probe.mjs")).href;
/** The probe's source, hashed into the cache key: a changed probe runs every suite again. */
const PROBE_HASH = createHash("sha256")
  .update(readFileSync(join(HERE, "probe.mjs")))
  .digest("hex")
  .slice(0, 16);
const installOf = (suite) => JSON.stringify(suite.install);

const stop = (code, message) => {
  console.error(message);
  process.exit(code);
};

function flags(argv) {
  const out = {
    suite: [],
    zone: [],
    node: [],
    plan: false,
    parallel: 2,
    workers: 2,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--plan") out.plan = true;
    else if (["--suite", "--zone", "--node"].includes(a))
      out[a.slice(2)].push(argv[++i]);
    else if (a === "--parallel") out.parallel = Number(argv[++i]);
    else if (a === "--workers") out.workers = Number(argv[++i]);
    else stop(2, `unknown flag ${a}`);
  }
  if (!(out.parallel >= 1) || !(out.workers >= 1))
    stop(2, "--parallel and --workers need a number >= 1");
  return out;
}

class StepError extends Error {}

function sh(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 1 << 28,
    ...options,
  });
  if (r.status !== 0) {
    throw new StepError(
      `${cmd} ${args.join(" ")} failed (${r.status})\n${(r.stderr ?? "").slice(-600)}${(r.stdout ?? "").slice(-300)}`,
    );
  }
  return r.stdout.trim();
}

/** Runs a command on the given Node major. Resolves with the exit code and both streams. */
function onNode(major, cmd, args, { cwd, env }) {
  return new Promise((resolve) => {
    const child = spawn(
      "fnm",
      ["exec", `--using=${major}`, "--", cmd, ...args],
      {
        cwd,
        env: { ...process.env, ...env },
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (error) =>
      resolve({ code: 127, stdout, stderr: String(error) }),
    );
  });
}

/** The full version and the time-zone data (`process.versions.tz`) of a Node major. */
const nodeInfoOf = (major) => {
  const [version, tzdata] = sh("fnm", [
    "exec",
    `--using=${major}`,
    "--",
    "node",
    "-p",
    "process.version + ' ' + process.versions.tz",
  ]).split(" ");
  return { version, tzdata };
};

/** Clones the pinned commit and checks it; returns the checkout directory. */
function checkout(suite) {
  if (suite.local) return ROOT;
  const dir = join(WORK, `${suite.id}@${suite.commit.slice(0, 12)}`);
  if (!existsSync(join(dir, ".git"))) {
    mkdirSync(dir, { recursive: true });
    sh("git", ["init", "-q"], { cwd: dir });
    sh("git", ["remote", "add", "origin", suite.repository], { cwd: dir });
    sh("git", ["fetch", "--depth=1", "-q", "origin", suite.commit], {
      cwd: dir,
    });
    sh("git", ["checkout", "-q", "FETCH_HEAD"], { cwd: dir });
  }
  const head = sh("git", ["rev-parse", "HEAD"], { cwd: dir });
  if (head !== suite.commit)
    throw new StepError(
      `${suite.id}: checkout is ${head}, expected ${suite.commit}`,
    );
  // The marker holds the install steps it was made with, so changed steps install again.
  const done = join(dir, ".zone-matrix-installed");
  if (!existsSync(done) || readFileSync(done, "utf8") !== installOf(suite)) {
    for (const step of suite.install) {
      console.error(`${suite.id}: ${step.cmd} ${step.args.join(" ")}`);
      // The clone sits under this folder, whose package.json names another pnpm; the suite's own
      // lockfile decides what is installed, so the version check is off and the folder's workspace file is ignored.
      const { cmd, args } = stepCommand(step, dir);
      sh("fnm", ["exec", "--using=24", "--", cmd, ...args], {
        cwd: join(dir, step.cwd ?? "."),
      });
    }
    writeFileSync(done, installOf(suite));
  }
  return dir;
}

/** Confirms the reference zone's source line is in the checkout, so it cannot go stale. */
function verifyReference(suite, dir) {
  const source = suite.reference.source;
  if (!source) return "none: the project's CI sets no zone, so UTC";
  const text = readFileSync(join(dir, source.file), "utf8");
  if (!text.includes(source.pattern)) {
    throw new StepError(
      `${suite.id}: ${source.file} no longer contains ${source.pattern}; update suites.mjs`,
    );
  }
  return `${source.file}: ${source.pattern}`;
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".yarn",
]);
const SCAN_EXT = /\.(?:[cm]?[jt]sx?|json|ya?ml|toml)$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) yield* walk(path);
    else if (SCAN_EXT.test(name) && stat.size < 2_000_000) yield path;
  }
}

function pinsOf(suite, dir) {
  if (suite.local) return [];
  const files = [];
  for (const path of walk(dir))
    files.push({ file: relative(dir, path), text: readFileSync(path, "utf8") });
  return scanPins(files);
}

async function runOnce(suite, dir, major, zone, workers, key, attempt) {
  const parts = {
    ...key,
    zone,
    command: suite.display,
    install: installOf(suite),
    probe: PROBE_HASH,
    attempt,
  };
  const hit = readCached(CACHE, parts);
  if (hit) return hit;
  const run = await execOnce(suite, dir, major, zone, workers);
  writeCached(CACHE, parts, run);
  return run;
}

/** Runs a cell, and once more when it fails; see `combineRuns`. */
async function runTwiceOnFailure(suite, dir, major, zone, workers, key) {
  const first = await runOnce(suite, dir, major, zone, workers, key, 1);
  if (!needsRerun(first)) return first;
  const second = await runOnce(suite, dir, major, zone, workers, key, 2);
  const joined = combineRuns(first, second);
  for (const id of joined.result.unstable)
    console.error(
      `  unstable on Node ${major} ${zone}: ${id}\n    ${joined.result.messages[id] ?? "(the report gives no message)"}`,
    );
  return joined;
}

async function execOnce(suite, dir, major, zone, workers) {
  const tmp = mkdtempSync(join(WORK, "out-"));
  const out = join(tmp, "report.json");
  const probe = join(tmp, "zones.txt");
  try {
    const { cwd, args } = suite.argv({ out, workers });
    const env = {
      TZ: zone,
      ZONE_PROBE_FILE: probe,
      NODE_OPTIONS:
        `--import=${PROBE} ${process.env.NODE_OPTIONS ?? ""}`.trim(),
    };
    const run = await onNode(major, "node", args, { cwd: join(dir, cwd), env });
    let result;
    if (suite.parser === "json") {
      const file = existsSync(out) ? readFileSync(out, "utf8") : "";
      result = parseReport("json", { file, root: join(dir, cwd) });
      if (result.couldNotRun)
        result.couldNotRun += `; exit ${run.code}; ${run.stderr.slice(-300).trim()}`;
    } else {
      result = parseReport(suite.parser, {
        stdout: run.stdout,
        stderr: run.stderr,
      });
    }
    const seen = existsSync(probe)
      ? readFileSync(probe, "utf8").split("\n").filter(Boolean)
      : [];
    return { result, seen };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Runs `jobs` (functions returning promises) with at most `limit` at once. */
async function pool(jobs, limit) {
  const results = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        results[i] = await jobs[i]();
      }
    }),
  );
  return results;
}

function gmtState() {
  const version = JSON.parse(
    readFileSync(join(ROOT, "packages/gmt/package.json"), "utf8"),
  ).version;
  const commit = sh("git", ["rev-parse", "HEAD"], { cwd: ROOT });
  const dirty =
    sh("git", ["status", "--porcelain", "--", "packages/gmt"], {
      cwd: ROOT,
    }) !== "";
  return { version, commit: dirty ? `${commit}+dirty` : commit };
}

function loadRecord() {
  if (!existsSync(RECORD))
    return { matrix: null, tags: {}, untagged: [], suites: [] };
  return JSON.parse(readFileSync(RECORD, "utf8"));
}

/** Sorts every recorded failure by the tag map. Returns the tags in use and what has none. */
function classify(record) {
  const tags = {};
  const untagged = new Set();
  const used = new Set();
  for (const suite of record.suites) {
    for (const cell of suite.cells) {
      const m = matchTags(suite, cell.failed, cell.zone, TAGS);
      Object.assign(tags, m.tagged);
      m.untagged.forEach((k) => untagged.add(k));
      m.used.forEach((k) => used.add(k));
    }
  }
  return { tags, untagged: [...untagged].sort(), used };
}

/** Finds the cause of every failure that counts as neither kind: at the reference zone, or unstable. */
function explain(record) {
  const causes = {};
  const uncaused = new Set();
  const used = new Set();
  const add = (suite, ids, node) => {
    const m = matchCauses(suite, ids, node, CAUSES);
    Object.assign(causes, m.caused);
    m.uncaused.forEach((k) => uncaused.add(k));
    m.used.forEach((k) => used.add(k));
  };
  for (const suite of record.suites) {
    for (const run of suite.reference.runs)
      add(suite, [...run.failed, ...(run.unstable ?? [])], run.node);
    for (const cell of suite.cells) add(suite, cell.unstable ?? [], cell.node);
  }
  return { causes, uncaused: [...uncaused].sort(), used };
}

async function main() {
  const f = flags(process.argv.slice(2));
  const problems = [...tagProblems(TAGS), ...causeProblems(CAUSES)];
  if (problems.length) stop(1, `tags.mjs, causes.mjs:\n${problems.join("\n")}`);

  const matrix = readMatrix(join(ROOT, CI));
  const zones = f.zone.length ? f.zone : matrix.zones;
  const nodes = f.node.length ? f.node : matrix.node;
  for (const z of zones)
    if (!matrix.zones.includes(z)) stop(2, `${z} is not in the ci.yml matrix`);
  for (const n of nodes)
    if (!matrix.node.includes(n))
      stop(2, `Node ${n} is not in the ci.yml matrix`);
  const suites = f.suite.length
    ? SUITES.filter((s) => f.suite.includes(s.id))
    : SUITES;
  if (!suites.length) stop(2, `no suite matches ${f.suite.join(", ")}`);

  if (f.plan) {
    for (const s of suites) {
      for (const n of nodes) {
        const ref = s.reference.zone;
        const list = [...new Set([ref, ...zones])];
        console.log(
          `${s.id}  node ${n}  reference ${ref}  zones ${list.join(", ")}`,
        );
      }
    }
    console.log(
      `${suites.length * nodes.length * new Set([...zones, ...suites.map((s) => s.reference.zone)]).size} runs at most`,
    );
    return;
  }

  mkdirSync(WORK, { recursive: true });
  const { getUtcNow, parseDateFromUtc } = await loadGmt();
  const ranOn = parseDateFromUtc(getUtcNow());
  const nodeInfo = Object.fromEntries(nodes.map((n) => [n, nodeInfoOf(n)]));
  const record = loadRecord();
  record.matrix = { ci: CI, zones: matrix.zones, node: matrix.node };

  const failedSuites = [];
  for (const suite of suites) {
    const meta = suite.local
      ? gmtState()
      : { version: suite.version, commit: suite.commit };
    const refZone = suite.reference.zone;
    let dir;
    let sourceNote = "not checked";
    let pins = [];
    let setupError = null;
    try {
      dir = checkout(suite);
      sourceNote = verifyReference(suite, dir);
      pins = pinsOf(suite, dir);
    } catch (error) {
      if (!(error instanceof StepError)) throw error;
      setupError = error.message.split("\n")[0];
      failedSuites.push(`${suite.id}: ${setupError}`);
      console.error(`${suite.id}: could not set up: ${error.message}`);
    }
    const codePins = pins.filter((p) => p.level === "code");
    console.error(`${suite.id} ${meta.version}: ${pins.length} pins found`);
    const keyOf = (n) => ({
      suite: suite.id,
      commit: meta.commit,
      nodeVersion: nodeInfo[n].version,
      tzdata: nodeInfo[n].tzdata,
      ...(suite.serial ? { serial: true } : {}),
    });
    // A suite whose test command writes into its clone runs one test process at a time.
    const limit = suite.serial ? 1 : f.parallel;
    const unrun = (reason) => ({
      result: { tests: 0, failed: [], couldNotRun: reason },
      seen: [],
    });
    const runFor = (n, zone) =>
      setupError
        ? Promise.resolve(unrun(`setup failed: ${setupError}`))
        : runTwiceOnFailure(suite, dir, n, zone, f.workers, keyOf(n));

    const reference = {};
    const refRuns = await pool(
      nodes.map((n) => () => runFor(n, refZone)),
      limit,
    );
    nodes.forEach((n, i) => (reference[n] = refRuns[i]));

    const jobs = [];
    for (const n of nodes) {
      for (const zone of zones) {
        jobs.push(async () => {
          const run = zone === refZone ? reference[n] : await runFor(n, zone);
          const override = overrideOf(zone, run.seen, codePins);
          const cell = buildCell({
            node: n,
            nodeVersion: nodeInfo[n].version,
            tzdata: nodeInfo[n].tzdata,
            zone,
            ranOn,
            result: run.result,
            reference: reference[n].result.failed,
            override,
          });
          console.error(
            `  node ${n} ${zone}: ${cell.tests} tests, ${cell.failed.length} failed` +
              `${cell.couldNotRun ? ", could not run" : ""}${cell.overriddenBy ? ", zone overridden" : ""}`,
          );
          return cell;
        });
      }
    }
    const cells = await pool(jobs, limit);
    if (!setupError && cells.some((c) => c.couldNotRun))
      failedSuites.push(`${suite.id}: some cells could not run`);

    const old = record.suites.find(
      (s) => s.id === suite.id && s.version === meta.version,
    );
    const entry = {
      id: suite.id,
      name: suite.name,
      version: meta.version,
      repository: suite.repository,
      commit: meta.commit,
      command: `TZ=<zone> ${suite.display}`,
      ownCommand: suite.ownCommand,
      reference: {
        zone: refZone,
        source: sourceNote,
        runs: nodes.map((n) => ({
          node: n,
          nodeVersion: nodeInfo[n].version,
          tzdata: nodeInfo[n].tzdata,
          tests: reference[n].result.tests,
          failed: reference[n].result.failed,
          unstable: reference[n].result.unstable ?? [],
          ...(reference[n].result.couldNotRun
            ? { couldNotRun: reference[n].result.couldNotRun }
            : {}),
        })),
      },
      pins: pins.map(({ file, line, text }) => ({ file, line, text })),
      cells: mergeCells(old?.cells ?? [], cells),
    };
    record.suites = [...record.suites.filter((s) => s !== old), entry];
  }

  const { tags, untagged, used } = classify(record);
  record.tags = tags;
  record.untagged = untagged;
  const explained = explain(record);
  record.causes = explained.causes;
  record.uncaused = explained.uncaused;
  writeFileSync(RECORD, formatJson(record));

  const versions = new Set(record.suites.map((s) => `${s.id}@${s.version}`));
  const stale = staleTags(TAGS, used).filter((k) =>
    versions.has(k.split(" | ")[0]),
  );
  if (stale.length && suites.length === SUITES.length)
    console.error(`stale tags:\n${stale.join("\n")}`);
  const staleCauses = Object.keys(CAUSES).filter(
    (k) => !explained.used.has(k) && versions.has(k.split(" | ")[0]),
  );
  if (staleCauses.length && suites.length === SUITES.length)
    console.error(`stale causes:\n${staleCauses.join("\n")}`);
  const gmt = record.suites.find((s) => s.id === "gmt");
  const gmtFailed =
    gmt?.cells.filter(
      (c) =>
        c.failed.length ||
        c.alsoFailsAtReference.length ||
        (c.unstable ?? []).length,
    ) ?? [];
  if (gmtFailed.length) {
    stop(
      1,
      `GMT, the control, fails in ${gmtFailed.map((c) => `${c.zone} (Node ${c.node})`).join(", ")}: a GMT bug, unless the Node's time-zone data is older than the tests expect (see tzdata in the record; use the newest release of each Node major). The record is written but must not be committed.`,
    );
  }
  if (failedSuites.length)
    stop(
      1,
      `some runs could not run; a rerun reuses the finished ones:\n${failedSuites.join("\n")}`,
    );
  if (untagged.length)
    stop(1, `untagged failures; add each to tags.mjs:\n${untagged.join("\n")}`);
  if (record.uncaused.length)
    stop(
      1,
      `failures counted as neither kind with no cause; add each to causes.mjs:\n${record.uncaused.join("\n")}`,
    );
}

await main();
