#!/usr/bin/env node
/**
 * Run the repo's checks and print one short screen instead of thousands of lines.
 *
 * Each step runs exactly as `pnpm run validate` or CI runs it. Its output goes to a log under
 * `.verdict/`; this script parses the log and prints a PASS or FAIL row per step, and for a failed
 * step the first failures (test, file and line, message) plus the log path.
 *
 * Run as:
 *   node scripts/verdict.mjs validate [--full] [--base <ref>]
 *                                      # the checks `pnpm run validate` runs, one step each
 *   node scripts/verdict.mjs run <filter> <script> [-- args] # pnpm --filter <filter> run <script> [args]
 *   node scripts/verdict.mjs all <script>                    # pnpm -r --if-present run <script>
 *
 * Exit: 0 every step passed, 1 a step failed, 2 usage error or another run holds the lock,
 * 130 interrupted.
 */

import { spawn } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { plan as affectedPlan } from "./affected.mjs";
import { assertRulesValid, CHECKS } from "./lib/affected.mjs";
import { formatDuration, formatScreen } from "./lib/verdict-format.mjs";
import {
  countPassedTests,
  emptyRunProblem,
  failureLines,
  formatCount,
  parseLog,
} from "./lib/verdict-parse.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const USAGE = `usage:
  node scripts/verdict.mjs validate [--full] [--base <ref>]
  node scripts/verdict.mjs run <filter> <script> [-- args]
  node scripts/verdict.mjs all <script>`;

/**
 * The checks `pnpm run validate` runs, from the rules in `scripts/lib/affected.mjs`: each local
 * check that reads a file changed against `base` (origin/main), or every one with `full`.
 * @param {{ full?: boolean, base?: string }} opts
 */
export function validateChecks(opts) {
  assertRulesValid();
  const p = affectedPlan(opts);
  const local = CHECKS.filter((check) => check.local !== false);
  return {
    header: p.header,
    run: local.filter((check) => p.checks.includes(check.id)),
    skipped: local
      .filter((check) => !p.checks.includes(check.id))
      .map((check) => check.id),
  };
}

/** `--full` and `--base <ref>` after `validate`, or null for anything else. */
function validateOptions(args) {
  const opts = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--full") opts.full = true;
    else if (args[i] === "--base" && args[i + 1]) opts.base = args[++i];
    else return null;
  }
  return opts;
}

function quote(arg) {
  return /^[\w@%+=:,./-]+$/.test(arg)
    ? arg
    : `'${arg.replaceAll("'", "'\\''")}'`;
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * `{ title, dir, steps, skipped }` for the arguments, or `{ error }`. `checksFor` is
 * `validateChecks`, which reads git; the tests pass their own.
 * @param {string[]} args
 * @param {typeof validateChecks} [checksFor]
 * @returns {{ title?: string, dir?: string, steps?: Array<{ command: string, label: string, script?: string }>, skipped?: string[], error?: string }}
 */
export function plan(args, checksFor = validateChecks) {
  const [mode, ...rest] = args;
  if (mode === "validate") {
    const opts = validateOptions(rest);
    if (!opts) return { error: USAGE };
    const checks = checksFor(opts);
    return {
      title: opts.full
        ? "verdict validate --full"
        : `verdict validate for ${checks.header}`,
      dir: "validate",
      steps: checks.run.map((check) => ({
        command: check.run,
        label: check.id,
      })),
      skipped: checks.skipped,
    };
  }
  if (mode === "run" && rest.length >= 2) {
    const [filter, script, ...extra] = rest;
    const passed = extra[0] === "--" ? extra.slice(1) : extra;
    const command = [
      "pnpm",
      "--filter",
      quote(filter),
      "run",
      quote(script),
      ...passed.map(quote),
    ].join(" ");
    return {
      title: `verdict run ${rest.join(" ")}`,
      dir: slug(`${filter}-${script}`),
      steps: [{ command, label: script, script }],
    };
  }
  if (mode === "all" && rest.length === 1) {
    return {
      title: `verdict all ${rest[0]}`,
      dir: slug(`all-${rest[0]}`),
      steps: [
        {
          command: `pnpm -r --if-present run ${quote(rest[0])}`,
          label: rest[0],
          script: rest[0],
        },
      ],
    };
  }
  return { error: USAGE };
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** Claims `.verdict/lock`; returns the other run's pid when it is still alive. */
function takeLock(lockFile) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(lockFile, String(process.pid), { flag: "wx" });
      return null;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const pid = Number.parseInt(readFileSync(lockFile, "utf-8"), 10);
      if (Number.isInteger(pid) && pid !== process.pid && alive(pid))
        return pid;
      rmSync(lockFile, { force: true });
    }
  }
  return null;
}

/** Runs one command through `sh -c`, output to `logFile`; resolves with its exit code. */
function runStep(command, logFile, env, onChild) {
  return new Promise((done) => {
    const fd = openSync(logFile, "w");
    const child = spawn("sh", ["-c", command], {
      cwd: root,
      env,
      stdio: ["ignore", fd, fd],
      detached: true,
    });
    onChild(child);
    child.on("error", () => {
      closeSync(fd);
      done(127);
    });
    child.on("close", (code, signal) => {
      closeSync(fd);
      onChild(null);
      done(code ?? (signal ? 128 : 1));
    });
  });
}

/** The line under a validate screen that names the checks the change did not need. */
export function skippedLine(skipped) {
  if (!skipped?.length) return null;
  return `skipped: ${skipped.join(", ")} (nothing they read changed; --full runs every check)`;
}

function main(args) {
  let run;
  try {
    run = plan(args);
  } catch (error) {
    console.error(`verdict: ${error.message}`);
    return Promise.resolve(2);
  }
  if (run.error) {
    console.error(run.error);
    return Promise.resolve(2);
  }
  const skipped = skippedLine(run.skipped);

  const verdictDir = join(root, ".verdict");
  mkdirSync(verdictDir, { recursive: true });
  const lockFile = join(verdictDir, "lock");
  const other = takeLock(lockFile);
  if (other !== null) {
    console.error(`verdict: another run (pid ${other}) is using this checkout`);
    return Promise.resolve(2);
  }

  const logDir = join(verdictDir, run.dir);
  rmSync(logDir, { recursive: true, force: true });
  mkdirSync(logDir, { recursive: true });

  const env = {
    DOX_VITE_CACHE_DIR: join(verdictDir, "vite-cache"),
    ...process.env,
    NO_COLOR: "1",
    FORCE_COLOR: "0",
  };

  let current = null;
  let interrupted = false;
  const onSigint = () => {
    interrupted = true;
    if (current?.pid) {
      try {
        process.kill(-current.pid, "SIGTERM");
      } catch {
        // The step ended between the signal and the kill.
      }
    }
  };
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigint);

  return (async () => {
    const started = performance.now();
    const total = run.steps.length;
    const rows = [];
    let failedAt = -1;
    try {
      for (const [i, step] of run.steps.entries()) {
        const number = String(i + 1).padStart(2, "0");
        const logFile = join(
          logDir,
          `${number}-${slug(step.label) || "step"}.log`,
        );
        const t0 = performance.now();
        const code = await runStep(step.command, logFile, env, (child) => {
          current = child;
        });
        const duration = formatDuration(performance.now() - t0);
        if (interrupted) return 130;
        const text = readFileSync(logFile, "utf-8");
        const empty =
          code === 0 && step.script ? emptyRunProblem(text, step.script) : null;
        if (code === 0 && !empty) {
          const passed = countPassedTests(text);
          rows.push({
            status: "PASS",
            index: i + 1,
            label: step.label,
            detail: passed > 0 ? `${formatCount(passed)} tests` : "",
            duration,
          });
        } else {
          failedAt = i;
          const relLog = relative(root, logFile);
          rows.push({
            status: "FAIL",
            index: i + 1,
            label: step.label,
            duration,
            details: empty
              ? [empty]
              : failureLines(parseLog(text), { logPath: relLog }),
            logFile,
          });
          break;
        }
      }
    } finally {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigint);
      rmSync(lockFile, { force: true });
    }

    const elapsed = formatDuration(performance.now() - started);
    if (failedAt === -1) {
      console.log(
        formatScreen({
          title: run.title,
          status: `PASS  ${total} of ${total}  ${elapsed}`,
          rows,
          logPath: logDir,
        }),
      );
      if (skipped) console.log(skipped);
      return 0;
    }
    for (const [i, step] of run.steps.entries()) {
      if (i > failedAt)
        rows.push({
          status: "----",
          index: i + 1,
          label: step.label,
          detail: "not run",
        });
    }
    const failed = rows[failedAt];
    console.log(
      formatScreen({
        title: run.title,
        status: `FAIL at step ${failedAt + 1} of ${total} (${run.steps[failedAt].command})  ${elapsed}`,
        rows,
        logPath: failed.logFile,
      }),
    );
    return 1;
  })();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(2);
    },
  );
}
