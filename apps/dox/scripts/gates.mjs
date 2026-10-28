#!/usr/bin/env node
/**
 * The Dox gate runner: build once, serve once, run only the gates and pages the diff touches, and
 * print one screen.
 *
 *     pnpm --filter dox gates [--all] [--against <ref>] [--only <gate,...>] [--pages <path,...>]
 *                             [--browsers chromium,webkit] [--themes dark,light]
 *                             [--tier pr|nightly|local] [--retries 1] [--shard <i>/<n>]
 *                             [--baseline <path to base apps/dox>] [--no-build] [--plan] [--json]
 *
 * In order: lock (`.gates/lock`), early exit when no file the site depends on changed, build
 * (`packages/gmt` only when its `dist` is missing, the site with a private Vite cache), serve
 * `dist` on a free port, select, run the selected gates one after another (the clock-still gates
 * flake under load), retry a failed gate on its failing pages, report. Exit 0 when nothing FAILed,
 * 1 when a gate failed or measured nothing, 2 for usage, a live lock, a failed build or a gate that
 * exited 2.
 *
 * Every gate script speaks the page contract (`gates/contract.mjs`, `gates/findings.mjs`); the
 * gates and their tiers are data in `gates/registry.mjs`, the selection is `gates/select.mjs`.
 * Time is measured with `performance.now()` because the date-ban scans this folder.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPages } from "./gates/graph.mjs";
import {
  GATES,
  inTier,
  SAMPLE,
  inputIndex,
  scriptIndex,
  TIERS,
} from "./gates/registry.mjs";
import { formatGatesScreen } from "./gates/screen.mjs";
import { isRelevant, selectPages } from "./gates/select.mjs";
import { appendStepSummary } from "./gates/step-summary.mjs";
import { serveStatic } from "./lib/static-server.mjs";

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const DOX = path.resolve(SCRIPTS, "..");
const ROOT = path.resolve(DOX, "../..");
const GATES_DIR = path.join(DOX, ".gates");
const LOCK = path.join(GATES_DIR, "lock");
const DIST = path.join(DOX, "dist");
const KNOWN_BROWSERS = ["chromium", "webkit", "firefox"];
const KNOWN_THEMES = ["dark", "light"];
const GATE_TIMEOUT_MS = 90 * 60_000;
/** Exit code `run` reports for a child it stopped at the timeout. */
const TIMED_OUT = 124;

const t0 = performance.now();
const elapsed = () => performance.now() - t0;

// --- arguments -------------------------------------------------------------------------------

function usage(message) {
  if (message) console.error(`gates: ${message}`);
  console.error(
    "usage: pnpm --filter dox gates [--all] [--against <ref>] [--only <gate,...>] [--pages <path,...>]\n" +
      "                               [--browsers chromium,webkit] [--themes dark,light] [--tier pr|nightly|local]\n" +
      "                               [--retries 1] [--shard <i>/<n>] [--baseline <path>] [--no-build] [--plan] [--json]",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const o = {
    all: false,
    against: null,
    only: null,
    pages: null,
    browsers: ["chromium", "webkit"],
    themes: ["dark", "light"],
    tier: "local",
    retries: 1,
    shard: null,
    baseline: null,
    noBuild: false,
    plan: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) usage(`${a} needs a value`);
      return v;
    };
    const list = () => next().split(",").filter(Boolean);
    if (a === "--all") o.all = true;
    else if (a === "--against") o.against = next();
    else if (a === "--only") o.only = list();
    else if (a === "--pages") o.pages = list();
    else if (a === "--browsers") o.browsers = list();
    else if (a === "--themes") o.themes = list();
    else if (a === "--tier") o.tier = next();
    else if (a === "--retries") o.retries = Number(next());
    else if (a === "--shard") {
      const m = /^(\d+)\/(\d+)$/.exec(next());
      if (!m || Number(m[1]) < 1 || Number(m[1]) > Number(m[2])) {
        usage("--shard needs <i>/<n> with 1 <= i <= n, e.g. 1/3");
      }
      o.shard = { i: Number(m[1]), n: Number(m[2]) };
    } else if (a === "--baseline") o.baseline = path.resolve(next());
    else if (a === "--no-build") o.noBuild = true;
    else if (a === "--plan") o.plan = true;
    else if (a === "--json") o.json = true;
    else usage(`unknown argument ${a}`);
  }
  if (!TIERS.includes(o.tier)) usage(`--tier is one of ${TIERS.join(", ")}`);
  if (!Number.isInteger(o.retries) || o.retries < 0)
    usage("--retries needs a whole number");
  if (
    o.browsers.length === 0 ||
    o.browsers.some((b) => !KNOWN_BROWSERS.includes(b))
  ) {
    usage(`--browsers takes ${KNOWN_BROWSERS.join(", ")}`);
  }
  if (
    o.themes.length === 0 ||
    o.themes.some((t) => !KNOWN_THEMES.includes(t))
  ) {
    usage(`--themes takes ${KNOWN_THEMES.join(", ")}`);
  }
  const ids = GATES.map((g) => g.id);
  for (const id of o.only ?? [])
    if (!ids.includes(id)) usage(`unknown gate "${id}" (${ids.join(", ")})`);
  if (o.baseline && !existsSync(path.join(o.baseline, "dist/gmt/index.html"))) {
    usage(
      `--baseline ${o.baseline} has no built dist/gmt/index.html (build the base tree first)`,
    );
  }
  return o;
}

const opts = parseArgs(process.argv.slice(2));

// --- small helpers ---------------------------------------------------------------------------

function git(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function logTail(file, lines) {
  try {
    return readFileSync(file, "utf8").trimEnd().split("\n").slice(-lines);
  } catch {
    return [];
  }
}

/** Every `index.html` folder under `dist/gmt`, as site paths. For gates that list from `dist`. */
function pagesFromDist() {
  const out = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory())
        walk(path.join(dir, entry.name), `${rel}${entry.name}/`);
      else if (entry.name === "index.html") out.push(rel);
    }
  };
  walk(path.join(DIST, "gmt"), "/");
  return out.sort();
}

const listCache = new Map();
/** A gate's pages, from its own `--list-pages` (never copied into the registry). */
function listPages(gate) {
  if (listCache.has(gate.id)) return listCache.get(gate.id);
  let pages;
  if (gate.pages === "dist") pages = pagesFromDist();
  else {
    const r = spawnSync(
      process.execPath,
      [path.join(SCRIPTS, gate.script), "--list-pages"],
      {
        cwd: DOX,
        encoding: "utf8",
      },
    );
    if (r.status !== 0) {
      console.error(`gates: ${gate.script} --list-pages failed\n${r.stderr}`);
      process.exit(2);
    }
    pages = JSON.parse(r.stdout);
  }
  listCache.set(gate.id, pages);
  return pages;
}

// --- lock, cleanup ---------------------------------------------------------------------------

let locked = false;
let server = null;
let baselineServer = null;
let child = null;

function acquireLock() {
  mkdirSync(GATES_DIR, { recursive: true });
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, "utf8").trim());
    let live = false;
    if (pid > 0) {
      try {
        process.kill(pid, 0);
        live = true;
      } catch {
        live = false;
      }
    }
    if (live) {
      console.error(
        `gates: another run holds ${path.relative(DOX, LOCK)} (pid ${pid}).`,
      );
      process.exit(2);
    }
  }
  writeFileSync(LOCK, String(process.pid));
  locked = true;
}

function cleanup() {
  try {
    child?.kill("SIGTERM");
  } catch {}
  server?.close();
  baselineServer?.close();
  if (locked) rmSync(LOCK, { force: true });
  locked = false;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    cleanup();
    process.exit(130);
  });
}

function bail(code, message) {
  if (message) console.error(message);
  cleanup();
  process.exit(code);
}

// --- changed files, selection ---------------------------------------------------------------

const against =
  opts.against ??
  (git(["rev-parse", "--verify", "--quiet", "origin/main"])
    ? "origin/main"
    : "main");
const againstSha = git(["rev-parse", "--short", against]) ?? "?";

function changedFiles() {
  const base = git(["merge-base", "HEAD", against]);
  if (!base) bail(2, `gates: no merge base between HEAD and ${against}`);
  const tracked = git(["diff", "--name-only", base]) ?? "";
  const untracked = git(["ls-files", "--others", "--exclude-standard"]) ?? "";
  return [
    ...new Set(
      [...tracked.split("\n"), ...untracked.split("\n")].filter(Boolean),
    ),
  ].sort();
}

const requestedGates = GATES.filter(
  (g) => inTier(g, opts.tier) && (!opts.only || opts.only.includes(g.id)),
);

const early = !opts.all && !opts.pages;
let changed = [];
if (early) {
  changed = changedFiles();
  if (!changed.some(isRelevant)) {
    const line = "gates: PASS  nothing to check (no Dox page changed)";
    console.log(
      opts.json
        ? JSON.stringify({ status: "PASS", nothingToCheck: true })
        : line,
    );
    appendStepSummary(line);
    process.exit(0);
  }
}

// --- build, serve ----------------------------------------------------------------------------

if (opts.plan) {
  // A plan builds only when `dist` is missing, because the gates that list pages from `dist` need it.
  if (!existsSync(path.join(DIST, "gmt/index.html")) && !opts.noBuild)
    acquireLock();
} else acquireLock();

mkdirSync(GATES_DIR, { recursive: true });

/** Runs a command with its output in a log; resolves its exit code. */
function run(command, args, { cwd, env, log }) {
  return new Promise((resolve) => {
    const fd = openSync(log, "a");
    const p = spawn(command, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0", ...env },
      stdio: ["ignore", fd, fd],
    });
    child = p;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      p.kill("SIGTERM");
    }, GATE_TIMEOUT_MS);
    p.on("close", (code, signal) => {
      clearTimeout(timer);
      closeSync(fd);
      child = null;
      resolve(timedOut ? TIMED_OUT : (code ?? (signal ? 1 : 0)));
    });
    p.on("error", () => {
      clearTimeout(timer);
      closeSync(fd);
      child = null;
      resolve(2);
    });
  });
}

let buildRow = {
  id: "build",
  status: "SKIP",
  detail: opts.noBuild ? "--no-build" : "dist reused",
};
const needsBuild = !existsSync(path.join(DIST, "gmt/index.html"));

if (opts.noBuild && needsBuild) {
  bail(
    2,
    "gates: --no-build needs dist/gmt/index.html; run without --no-build to build it.",
  );
}
if (!opts.noBuild && (!opts.plan || needsBuild)) {
  const buildStart = performance.now();
  const log = path.join(GATES_DIR, "build.log");
  rmSync(log, { force: true });
  if (!existsSync(path.join(ROOT, "packages/gmt/dist"))) {
    const code = await run("pnpm", ["--filter", "@northguild/gmt", "build"], {
      cwd: ROOT,
      log,
    });
    if (code !== 0) {
      bail(
        2,
        `gates: the library build failed (${path.relative(DOX, log)})\n${logTail(log, 15).join("\n")}`,
      );
    }
  }
  const cache =
    process.env.DOX_VITE_CACHE_DIR ?? path.join(GATES_DIR, "vite-cache");
  const code = await run("pnpm", ["--filter", "@gmt/dox", "build"], {
    cwd: ROOT,
    env: { DOX_VITE_CACHE_DIR: cache },
    log,
  });
  if (code !== 0) {
    bail(
      2,
      `gates: the site build failed (${path.relative(DOX, log)})\n${logTail(log, 15).join("\n")}`,
    );
  }
  buildRow = {
    id: "build",
    status: "PASS",
    detail: "",
    durationMs: performance.now() - buildStart,
  };
}

// --- selection ------------------------------------------------------------------------------

const allPages = buildPages(ROOT);
const union = new Set();
for (const g of requestedGates) for (const p of listPages(g)) union.add(p);

let plan;
if (opts.pages) {
  for (const p of opts.pages) {
    if (!union.has(p)) bail(2, `gates: no selected gate lists the page "${p}"`);
  }
  plan = {
    pages: [...opts.pages].sort(),
    reasons: Object.fromEntries(opts.pages.map((p) => [p, ["--pages"]])),
    capped: null,
    sample: SAMPLE,
    gatesOnSample: [],
  };
} else {
  plan = selectPages({
    changed,
    pages: allPages,
    sample: SAMPLE,
    gateScripts: { ...scriptIndex(), ...inputIndex() },
    all: opts.all,
  });
}

const sampleSet = new Set(SAMPLE);
const sampleGates = new Set(plan.gatesOnSample);

/** Page groups for one gate: `{ browsers, pages }` per distinct page set. */
function groupsFor(gate) {
  const listed = listPages(gate);
  let wanted;
  if (opts.all) wanted = listed;
  else {
    const onSample = sampleGates.has("*") || sampleGates.has(gate.id);
    wanted = listed.filter(
      (p) => plan.pages.includes(p) || (onSample && sampleSet.has(p)),
    );
  }
  const dropped = opts.browsers.filter(
    (b) => gate.browsers.length > 0 && !gate.browsers.includes(b),
  );
  const browsers =
    gate.browsers.length === 0
      ? []
      : opts.browsers.filter((b) => gate.browsers.includes(b));
  const keep = (list) => {
    const sorted = [...list].sort();
    return opts.shard
      ? sorted.filter((_, idx) => idx % opts.shard.n === opts.shard.i - 1)
      : sorted;
  };
  if (gate.browsers.length > 0 && browsers.length === 0)
    return { groups: [], dropped, reason: "browser" };
  if (opts.all && gate.fullBrowsers) {
    const full = browsers.filter((b) => gate.fullBrowsers.includes(b));
    const rest = browsers.filter((b) => !gate.fullBrowsers.includes(b));
    const groups = [];
    if (full.length > 0) groups.push({ browsers: full, pages: keep(wanted) });
    if (rest.length > 0) {
      groups.push({
        browsers: rest,
        pages: keep(wanted.filter((p) => sampleSet.has(p))),
      });
    }
    return { groups: groups.filter((g) => g.pages.length > 0), dropped };
  }
  const pages = keep(wanted);
  return { groups: pages.length > 0 ? [{ browsers, pages }] : [], dropped };
}

const todo = requestedGates.map((gate) => ({ gate, ...groupsFor(gate) }));
const themesOf = (gate) => (gate.themes ? opts.themes : [null]);

function detailOf(entry) {
  const pagesAll = new Set(entry.groups.flatMap((g) => g.pages));
  const browsers = [...new Set(entry.groups.flatMap((g) => g.browsers))];
  const parts = [plural(pagesAll.size, "page")];
  if (browsers.length > 0) parts.push(browsers.join(","));
  if (entry.gate.themes) parts.push(opts.themes.join(","));
  let text = parts.join(" · ");
  if (entry.dropped.length > 0 && browsers.length > 0) {
    text += ` (no ${entry.dropped.join(",")})`;
  }
  return text;
}

const selectedPageCount = new Set(
  todo.flatMap((e) => e.groups.flatMap((g) => g.pages)),
).size;
const browsersUsed = [
  ...new Set(todo.flatMap((e) => e.groups.flatMap((g) => g.browsers))),
];

// --- --plan ---------------------------------------------------------------------------------

if (opts.plan) {
  const planned = todo.map((e) => ({
    gate: e.gate.id,
    tier: e.gate.tier,
    selected: e.groups.length > 0,
    detail: e.groups.length > 0 ? detailOf(e) : "not selected",
    groups: e.groups,
    needs: e.gate.needs,
  }));
  if (opts.json) {
    console.log(
      JSON.stringify(
        { against, againstSha, changed, plan, gates: planned },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `gates plan (against ${against} @ ${againstSha}): ${plural(changed.length, "changed file")}, ` +
        `${plural(plan.pages.length, "page")} selected` +
        (plan.capped
          ? `, capped from ${plan.capped.from} to ${plan.capped.to} (sample plus 6)`
          : ""),
    );
    for (const p of plan.pages) console.log(`  ${p}  ${plan.reasons[p][0]}`);
    if (plan.gatesOnSample.length > 0) {
      console.log(
        `  gate scripts changed, run on the sample: ${plan.gatesOnSample.join(", ")}`,
      );
    }
    console.log("gates:");
    for (const g of planned) {
      const note = g.needs && g.selected ? `  [needs ${g.needs}]` : "";
      console.log(
        `  ${g.gate.padEnd(22)} ${g.tier.padEnd(8)} ${g.detail}${note}`,
      );
    }
  }
  bail(0);
}

if (todo.every((e) => e.groups.length === 0)) {
  const nothing = "gates: PASS  nothing to check (no Dox page changed)";
  console.log(
    opts.json
      ? JSON.stringify({ status: "PASS", nothingToCheck: true })
      : nothing,
  );
  appendStepSummary(nothing);
  bail(0);
}

server = await serveStatic(DIST, 0);
const BASE_URL = `http://127.0.0.1:${server.address().port}/gmt`;

// --- running --------------------------------------------------------------------------------

/** What one invocation of a gate script wrote under `GATE_REPORT`. */
function readReport(file) {
  const findings = [];
  let measured = null;
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.kind === "finding") findings.push(entry);
        else if (entry.kind === "measured")
          measured = (measured ?? 0) + entry.n;
      } catch {}
    }
  }
  return { findings, measured };
}

/** The commands for one (group, theme) of a gate; the first non-zero exit ends the invocation. */
function stepsFor(gate, group, theme, pages) {
  const script = path.join(SCRIPTS, gate.script);
  const fixed = (gate.args ?? []).map((a) => a.replace("{gates}", GATES_DIR));
  const common = [
    ...(gate.base === false ? [] : ["--base", BASE_URL]),
    ...(gate.browserArg === false || group.browsers.length === 0
      ? []
      : ["--browsers", group.browsers.join(",")]),
    "--pages",
    pages.join(","),
    ...(theme ? ["--theme", theme] : []),
    ...fixed,
  ];
  if (gate.id === "html-diff") {
    const dir = path.join(GATES_DIR, "html-base");
    return [
      {
        cwd: opts.baseline,
        args: [script, "capture", dir, "--pages", pages.join(",")],
      },
      { cwd: DOX, args: [script, "compare", dir, "--pages", pages.join(",")] },
    ];
  }
  if (gate.id === "visual-diff") {
    return [
      { cwd: DOX, args: [script, "before", ...common], base: "baseline" },
      { cwd: DOX, args: [script, "after", ...common] },
      { cwd: DOX, args: [script, "diff", "--pages", pages.join(",")] },
    ];
  }
  return [{ cwd: DOX, args: [script, ...common] }];
}

async function invoke(gate, group, theme, pages, tag, attempt) {
  const log = path.join(GATES_DIR, `${tag}.log`);
  const report = path.join(GATES_DIR, `${tag}.ndjson`);
  rmSync(report, { force: true });
  if (attempt === 0) rmSync(log, { force: true });
  writeFileSync(log, `\n--- attempt ${attempt + 1} ---\n`, { flag: "a" });
  let code = 0;
  for (const step of stepsFor(gate, group, theme, pages)) {
    const args = [...step.args];
    if (step.base === "baseline") {
      baselineServer ??= await serveStatic(path.join(opts.baseline, "dist"), 0);
      args[args.indexOf("--base") + 1] =
        `http://127.0.0.1:${baselineServer.address().port}/gmt`;
    }
    code = await run(process.execPath, args, {
      cwd: step.cwd,
      env: { GATE_REPORT: report },
      log,
    });
    if (code !== 0) break;
  }
  const { findings, measured } = readReport(report);
  let status = "PASS";
  if (code === 2) status = "ERROR";
  else if (code !== 0 || findings.length > 0) status = "FAIL";
  else if (measured === null || measured === 0) status = "FAIL";
  const timedOut = code === TIMED_OUT;
  const empty =
    code === 0 &&
    findings.length === 0 &&
    (measured === null || measured === 0);
  return { status, code, findings, measured, empty, timedOut, log };
}

const rows = [buildRow];
let usageError = false;

for (const entry of todo) {
  const { gate } = entry;
  if (entry.groups.length === 0) {
    rows.push({
      id: gate.id,
      status: "SKIP",
      detail:
        entry.reason === "browser"
          ? `none of ${opts.browsers.join(",")} runs it`
          : `not selected (no ${gate.id} page changed)`,
    });
    continue;
  }
  if (gate.needs === "gpu" && process.env.CI) {
    rows.push({ id: gate.id, status: "SKIP", detail: "needs a GPU" });
    continue;
  }
  if (gate.needs === "baseline" && !opts.baseline) {
    rows.push({
      id: gate.id,
      status: "SKIP",
      detail: "needs --baseline (built.md Runbooks: gate baseline)",
    });
    continue;
  }

  const start = performance.now();
  let retriedOnce = false;
  let final = { status: "PASS", findings: [], empty: false };
  let lastLog = path.join(GATES_DIR, `${gate.id}.log`);
  let invocation = 0;
  for (const group of entry.groups) {
    for (const theme of themesOf(gate)) {
      invocation += 1;
      const tag = [
        gate.id,
        theme,
        entry.groups.length > 1 ? `g${invocation}` : null,
      ]
        .filter(Boolean)
        .join("-");
      let pages = group.pages;
      let result = await invoke(gate, group, theme, pages, tag, 0);
      for (
        let retry = 1;
        retry <= opts.retries && result.status === "FAIL" && !result.timedOut;
        retry++
      ) {
        const failing = [
          ...new Set(result.findings.map((f) => f.page).filter(Boolean)),
        ].filter((p) => pages.includes(p));
        if (failing.length > 0) pages = failing;
        const again = await invoke(gate, group, theme, pages, tag, retry);
        if (again.status === "PASS") {
          retriedOnce = true;
          result = { ...again, retried: true };
        } else result = again;
      }
      lastLog = result.log;
      if (result.status === "ERROR") usageError = true;
      if (result.status === "ERROR" || result.status === "FAIL") {
        final = {
          status: "FAIL",
          findings: [...(final.findings ?? []), ...result.findings],
          empty: final.empty || result.empty,
          timedOut: final.timedOut || result.timedOut,
          error: result.status === "ERROR" || final.error,
          log: result.log,
        };
      }
    }
  }
  const durationMs = performance.now() - start;
  const row = { id: gate.id, detail: detailOf(entry), durationMs };
  if (final.status === "FAIL") {
    row.status = "FAIL";
    row.findings = final.findings;
    row.moreIn = path.relative(DOX, final.log ?? lastLog);
    row.logTail = logTail(final.log ?? lastLog, 10);
    if (final.findings.length === 0) {
      row.detail = final.timedOut
        ? "timed out after 90m"
        : final.empty
          ? "measured nothing"
          : final.error
            ? "exited 2 (usage)"
            : row.detail;
    }
  } else if (retriedOnce) {
    row.status = "FLAKY";
    row.detail = "failed once, passed on retry";
  } else row.status = "PASS";
  rows.push(row);
}

// --- report ---------------------------------------------------------------------------------

const failed = rows.filter((r) => r.status === "FAIL").length;
const flaky = rows.filter((r) => r.status === "FLAKY").length;
const skipped = rows.filter((r) => r.status === "SKIP").length;
const status = failed > 0 ? "FAIL" : "PASS";
const headline =
  failed > 0
    ? `${failed} of ${rows.length} failed`
    : `${rows.length - skipped} ran${flaky > 0 ? `, ${flaky} flaky` : ""}, ${skipped} skipped`;
const context = [
  `against ${against} @ ${againstSha}`,
  plural(selectedPageCount, "page"),
  browsersUsed.join(",") || "no browser",
  todo.some((e) => e.gate.themes && e.groups.length > 0)
    ? opts.themes.join(",")
    : null,
]
  .filter(Boolean)
  .join(", ");

const summary = {
  status,
  headline,
  context,
  durationMs: elapsed(),
  rows,
  logsDir: `${GATES_DIR}/`,
  summaryPath: path.relative(DOX, path.join(GATES_DIR, "summary.json")),
};
writeFileSync(
  path.join(GATES_DIR, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
const screen = formatGatesScreen(summary);
console.log(opts.json ? JSON.stringify(summary, null, 2) : screen);
appendStepSummary(screen);

cleanup();
// FLAKY and SKIP pass. A gate that exited 2, or a failed build, is a usage-class error.
process.exit(usageError ? 2 : failed > 0 ? 1 : 0);
