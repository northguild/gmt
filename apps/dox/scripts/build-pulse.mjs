#!/usr/bin/env node
/**
 * Builds the data behind `/pulse/` and keeps the repo's list of checks honest.
 *
 *   node scripts/build-pulse.mjs           write src/generated/pulse.json, then read run history
 *   node scripts/build-pulse.mjs --check   report drift between the list and the repo (`pnpm pulse:check`)
 *   node scripts/build-pulse.mjs --sync    rewrite the table in context/canary/overview.md (`pnpm pulse:sync`)
 *
 * The one hand-written source is `scripts/lib/pulse.mjs`. This script reads each workflow with
 * `yaml` (its name, its schedules, its jobs) and joins them to the list, so no cadence or job name
 * is typed twice. The run history of every scheduled workflow is read from GitHub at build only,
 * best effort, the way `scripts/upstream.mjs refresh` reads the filings: ten seconds in all, a six
 * hour freshness window, no token or a 404 leaves the history empty, and the page says so. The
 * history goes to the gitignored `src/generated/pulse-runs.live.json`.
 *
 * Nothing runs on import: the functions below take their inputs, so the tests use fixtures and an
 * injected `gh`, clock and stamp. The stamp uses GMT when `packages/gmt` is built, and a build
 * without it reads no history.
 */
import { execFile } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseDocument } from "yaml";
import { formatJson } from "../../../scripts/lib/format-json.mjs";
import { tryLoadGmt } from "../../../scripts/lib/gmt.mjs";
import { PULSE_AREAS, PULSE_CHECKS } from "../../../scripts/lib/pulse.mjs";
import { WORKAROUNDS } from "../../../scripts/lib/workarounds.mjs";

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "../../..");
const GENERATED = join(HERE, "../src/generated");
export const PULSE_FILE = join(GENERATED, "pulse.json");
export const RUNS_FILE = join(GENERATED, "pulse-runs.live.json");

export const OVERVIEW_PATH = "context/canary/overview.md";
export const OVERVIEW_START = "<!-- pulse:start -->";
export const OVERVIEW_END = "<!-- pulse:end -->";

const RUNS_BUDGET_MS = 10_000;
const RUNS_TTL_MS = 6 * 60 * 60 * 1000;
const RUNS_CALL_MS = 4_000;
const RUNS_PER_WORKFLOW = 12;

/** The id a workaround group goes by: its defects joined, as the compat page labels it. */
export const groupId = (group) => group.defects.join(" + ");

/** Reads one workflow file: its name, every `schedule[].cron` and the id and name of every job. */
export function readWorkflow(root, rel) {
  const doc = parseDocument(readFileSync(join(root, rel), "utf8"));
  if (doc.errors.length > 0) {
    throw new Error(`${rel}: ${doc.errors[0].message}`);
  }
  const data = doc.toJS() ?? {};
  const on = data.on ?? {};
  const schedule = Array.isArray(on.schedule) ? on.schedule : [];
  return {
    name: typeof data.name === "string" ? data.name : rel,
    crons: schedule.map((s) => s.cron).filter((c) => typeof c === "string"),
    jobs: Object.entries(data.jobs ?? {}).map(([id, job]) => ({
      id,
      name: typeof job?.name === "string" ? job.name : id,
    })),
  };
}

/** Every workflow file under `.github/workflows` that has an `on.schedule`, relative to the root. */
export function scheduledWorkflows(root) {
  const dir = join(root, ".github/workflows");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => `.github/workflows/${f}`)
    .filter((rel) => readWorkflow(root, rel).crons.length > 0);
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "generated"]);

/** Files under `dir` (relative to `root`) whose name matches `test`, skipping dependency folders. */
function findFiles(root, dir, test) {
  const out = [];
  const walk = (rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(`${rel}/${entry.name}`);
      } else if (test(entry.name)) {
        out.push(`${rel}/${entry.name}`);
      }
    }
  };
  walk(dir);
  return out.sort();
}

/** The workflow-or-test sources the list names, in list order, each once, with the checks it holds. */
export function sourcesOf(checks) {
  const map = new Map();
  for (const check of checks) {
    if (!map.has(check.source)) map.set(check.source, []);
    map.get(check.source).push(check);
  }
  return map;
}

/** What `pulse.json` holds: the list joined with what the workflow files say. */
export function buildPulse({ root = REPO_ROOT, checks = PULSE_CHECKS } = {}) {
  const cards = [];
  for (const [source, held] of sourcesOf(checks)) {
    const isWorkflow = source.startsWith(".github/workflows/");
    const workflow = isWorkflow ? readWorkflow(root, source) : null;
    cards.push({
      source,
      file: source.split("/").at(-1),
      kind: isWorkflow ? "workflow" : "test",
      name: workflow?.name ?? held[0].name,
      crons: workflow?.crons ?? [],
      jobs: workflow?.jobs ?? [],
      checkIds: held.map((c) => c.id),
    });
  }
  return {
    areas: PULSE_AREAS,
    checks: checks.map((c) => ({ ...c })),
    cards,
    workaroundGroups: WORKAROUNDS.map(groupId),
  };
}

/** Whether a source file carries `Pulse check: <id>` in a comment. */
const carriesTag = (text, id) =>
  new RegExp(`^\\s*(?:#|//|\\*)\\s*Pulse check:\\s*${id}\\s*$`, "m").test(text);

/** A comment line that talks about retiring something: the list says it, not the source file. */
const RETIRE_PROSE =
  /^\s*(?:#|\/\/|\*)(?!\s*Pulse check:).*\bretire(?:s|d|ment)?\b/im;

/** The plain-words cell for a check's life. */
export function lifeText(life) {
  switch (life.kind) {
    case "permanent":
      return `Stays. ${life.why}`;
    case "workarounds":
      return life.groups === "all"
        ? "When the last workaround is gone."
        : `When workarounds ${life.groups.join(", ")} are gone.`;
    case "condition":
      return `When ${life.until}.`;
  }
}

const cell = (text) => text.replaceAll("|", "\\|").replaceAll("\n", " ");

const storyCell = (story) =>
  /^CORE-\d+$/.test(story)
    ? `[${story}](../domination/issues/${story}.md)`
    : `${story}: [../dox/built.md](../dox/built.md)`;

/** The generated canary table, rows in list order. */
export function overviewTable(checks = PULSE_CHECKS) {
  const rows = checks.map((c) => {
    const where = `\`${c.source.split("/").at(-1)}\`${c.job ? ` job \`${c.job}\`` : ""}`;
    return `| ${[
      cell(c.name),
      where,
      cell(c.watches),
      cell(c.finds),
      cell(lifeText(c.life)),
      c.story === "Dox epic" ? "Dox epic" : storyCell(c.story),
    ].join(" | ")} |`;
  });
  return [
    "| Canary | Where | Checks | Finds | Retires | Story |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

/** The overview text with the generated block replaced; `null` when the markers are missing. */
export function syncedOverview(text, checks = PULSE_CHECKS) {
  const start = text.indexOf(OVERVIEW_START);
  const end = text.indexOf(OVERVIEW_END);
  if (start === -1 || end === -1 || end < start) return null;
  return `${text.slice(0, start + OVERVIEW_START.length)}\n\n${overviewTable(checks)}\n\n${text.slice(end)}`;
}

/** Every way the list and the repo disagree, one sentence each. Empty means they agree. */
export function checkDrift({
  root = REPO_ROOT,
  checks = PULSE_CHECKS,
  workarounds = WORKAROUNDS,
} = {}) {
  const problems = [];
  const ids = new Set();
  for (const c of checks) {
    if (ids.has(c.id)) problems.push(`Two checks share the id ${c.id}.`);
    ids.add(c.id);
  }

  const scheduled = scheduledWorkflows(root);
  const sources = new Set(checks.map((c) => c.source));
  for (const wf of scheduled) {
    if (!sources.has(wf)) {
      problems.push(
        `${wf} runs on a schedule but no check in scripts/lib/pulse.mjs names it.`,
      );
    }
  }

  const canaryScripts = findFiles(root, "scripts/canary", (n) =>
    n.endsWith(".mjs"),
  );
  const canaryTests = ["apps", "packages", "scripts"].flatMap((dir) =>
    findFiles(root, dir, (n) => n.endsWith("-canary.test.ts")),
  );
  const namedScripts = new Set(checks.flatMap((c) => c.scripts ?? []));
  for (const s of canaryScripts) {
    if (!namedScripts.has(s)) {
      problems.push(
        `${s} is a canary script but no check lists it under scripts.`,
      );
    }
  }
  for (const t of canaryTests) {
    if (!sources.has(t)) {
      problems.push(
        `${t} is a canary test but no check names it as its source.`,
      );
    }
  }

  const groupIds = new Set(workarounds.map(groupId));
  const claimed = new Set();
  for (const c of checks) {
    const abs = join(root, c.source);
    if (!existsSync(abs)) {
      problems.push(`Check ${c.id}: ${c.source} does not exist.`);
      continue;
    }
    const text = readFileSync(abs, "utf8");
    if (c.source.startsWith(".github/workflows/")) {
      const wf = readWorkflow(root, c.source);
      if (wf.crons.length === 0) {
        problems.push(`Check ${c.id}: ${c.source} has no schedule.`);
      }
      if (c.job && !wf.jobs.some((j) => j.id === c.job)) {
        problems.push(`Check ${c.id}: ${c.source} has no job ${c.job}.`);
      }
    }
    for (const s of c.scripts ?? []) {
      if (!existsSync(join(root, s))) {
        problems.push(`Check ${c.id}: ${s} does not exist.`);
      }
    }
    if (!carriesTag(text, c.id)) {
      problems.push(`${c.source} has no "Pulse check: ${c.id}" line.`);
    }
    if (RETIRE_PROSE.test(text)) {
      problems.push(
        `${c.source} describes when it retires; that belongs in the check's life in scripts/lib/pulse.mjs.`,
      );
    }
    if (c.life.kind === "workarounds") {
      const claims = c.life.groups === "all" ? [...groupIds] : c.life.groups;
      for (const g of claims) {
        if (!groupIds.has(g)) {
          problems.push(
            `Check ${c.id} claims workaround group ${g}, which does not exist.`,
          );
        }
        claimed.add(g);
      }
    }
  }
  for (const g of groupIds) {
    if (!claimed.has(g)) {
      problems.push(`Workaround group ${g} is claimed by no check's life.`);
    }
  }

  const overviewPath = join(root, OVERVIEW_PATH);
  if (existsSync(overviewPath)) {
    const text = readFileSync(overviewPath, "utf8");
    const next = syncedOverview(text, checks);
    if (next === null) {
      problems.push(
        `${OVERVIEW_PATH} has no ${OVERVIEW_START} and ${OVERVIEW_END} markers.`,
      );
    } else if (next !== text) {
      problems.push(
        `The table in ${OVERVIEW_PATH} is out of date: run pnpm pulse:sync.`,
      );
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Run history

/** What a workflow run is called on the page: only the fields it prints. */
const RUN_JQ = `[.workflow_runs[] | select(.conclusion != null) | {startedAt: .run_started_at, conclusion: .conclusion, url: .html_url}]`;

/** The default way to ask GitHub: the `gh` CLI, with a time limit. */
export async function ghApi(path, timeoutMs) {
  const { stdout } = await execFileAsync("gh", ["api", path, "--jq", RUN_JQ], {
    timeout: Math.max(1, Math.floor(timeoutMs)),
    maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

/**
 * Age in ms of the live file by its modified time; `Infinity` when there is none, or when
 * `packages/gmt` is not built (the refresh then reads no history anyway). A test may answer
 * synchronously.
 *
 * @param {string} file
 * @returns {number | Promise<number>}
 */
function liveFileAge(file) {
  if (!existsSync(file)) return Infinity;
  return tryLoadGmt().then((gmt) =>
    gmt === null
      ? Infinity
      : gmt.getUnixNow({ epochUnit: "milliseconds" }) - statSync(file).mtimeMs,
  );
}

/**
 * Reads the recent scheduled runs of every scheduled workflow and writes the live file. Returns
 * what happened as a word for the log; never throws. Every input that touches the world is
 * injectable.
 */
export async function refreshRuns({
  root = REPO_ROOT,
  checks = PULSE_CHECKS,
  file = RUNS_FILE,
  env = process.env,
  gh = ghApi,
  stamp = async () => {
    const gmt = await tryLoadGmt();
    return gmt === null ? null : gmt.getUtcNow();
  },
  ageOf = liveFileAge,
  clock = () => performance.now(),
  log = (line) => console.warn(line),
} = {}) {
  if (env.CI === undefined && env.PULSE_REFRESH !== "force") {
    if ((await ageOf(file)) < RUNS_TTL_MS) {
      log(
        `pulse: ${file} is under 6 h old, skipping (PULSE_REFRESH=force to refresh now)`,
      );
      return "fresh";
    }
  }
  try {
    const read = await stamp();
    if (read === null) {
      log("pulse: packages/gmt is not built, so no run history was read");
      return "skipped";
    }
    const sources = [...sourcesOf(checks).keys()].filter((s) =>
      scheduledWorkflows(root).includes(s),
    );
    const deadline = clock() + RUNS_BUDGET_MS;
    const workflows = {};
    for (const source of sources) {
      const left = deadline - clock();
      if (left <= 0) throw new Error("the 10 s budget ran out");
      const name = source.split("/").at(-1);
      try {
        workflows[name] = await gh(
          `repos/{owner}/{repo}/actions/workflows/${name}/runs?event=schedule&per_page=${RUNS_PER_WORKFLOW}`,
          Math.min(left, RUNS_CALL_MS),
        );
      } catch {
        // A 404 (the workflow is not on main yet) or a failed call leaves this one without history.
        workflows[name] = null;
      }
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, formatJson({ runsRead: read, workflows }));
    return "read";
  } catch (error) {
    log(
      `pulse: run history not read: ${error instanceof Error ? error.message : String(error)}`,
    );
    return "failed";
  }
}

// ---------------------------------------------------------------------------------------------

async function main(argv) {
  const mode = argv.includes("--check")
    ? "check"
    : argv.includes("--sync")
      ? "sync"
      : "build";
  if (mode === "sync") {
    const path = join(REPO_ROOT, OVERVIEW_PATH);
    const text = readFileSync(path, "utf8");
    const next = syncedOverview(text);
    if (next === null) {
      console.error(
        `${OVERVIEW_PATH} has no ${OVERVIEW_START} and ${OVERVIEW_END} markers.`,
      );
      process.exit(1);
    }
    if (next !== text) writeFileSync(path, next);
    console.log(
      next === text
        ? "pulse: overview already current"
        : "pulse: overview table rewritten",
    );
    return;
  }
  const problems = checkDrift();
  if (problems.length > 0) {
    console.error(
      `pulse: the list of checks and the repo disagree:\n- ${problems.join("\n- ")}`,
    );
    process.exit(1);
  }
  if (mode === "check") {
    console.log(`pulse: ${PULSE_CHECKS.length} checks match the repo`);
    return;
  }
  mkdirSync(GENERATED, { recursive: true });
  writeFileSync(PULSE_FILE, formatJson(buildPulse()));
  await refreshRuns();
}

if (
  process.argv[1] &&
  relative(process.argv[1], fileURLToPath(import.meta.url)) === ""
) {
  await main(process.argv.slice(2));
}
