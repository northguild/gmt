#!/usr/bin/env node
/**
 * Run the repo's checks and print one short screen instead of thousands of lines.
 *
 * Each step runs exactly as `pnpm run validate` or CI runs it. Its output goes to a log under
 * `.verdict/`; this script parses the log and prints a PASS or FAIL row per step, and for a failed
 * step the first failures (test, file and line, message) plus the log path.
 *
 * Run as:
 *   node scripts/verdict.mjs validate                        # the root validate chain
 *   node scripts/verdict.mjs run <filter> <script> [-- args] # pnpm --filter <filter> run <script> [args]
 *   node scripts/verdict.mjs all <script>                    # pnpm -r --if-present run <script>
 *
 * Exit: 0 every step passed, 1 a step failed, 2 usage error or another run holds the lock,
 * 130 interrupted.
 */

import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  node scripts/verdict.mjs validate
  node scripts/verdict.mjs run <filter> <script> [-- args]
  node scripts/verdict.mjs all <script>`;

/** The step label for a command: see the table in the slice spec. */
export function stepLabel(command) {
  const node = /^node scripts\/([\w-]+)\.mjs\s*(.*)$/.exec(command);
  if (node) return `${node[1]} ${node[2]}`.trim();
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] !== "pnpm") return command.trim();
  const rest = tokens.slice(1);
  while (rest.length > 0 && rest[0].startsWith("-")) {
    rest.shift();
    if (rest[0] && !rest[0].startsWith("-") && tokens[1] === "--filter")
      rest.shift();
  }
  if (rest[0] === "run") rest.shift();
  return rest[0] ?? command.trim();
}

/** `scripts.validate` split on ` && `, each step with its command and label. */
export function stepsFromChain(chain) {
  return chain
    .split(" && ")
    .map((command) => command.trim())
    .filter(Boolean)
    .map((command) => ({ command, label: stepLabel(command) }));
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
 * `{ title, dir, steps }` for the arguments, or `{ error }`.
 * @param {string[]} args
 * @param {{ scripts?: Record<string, string> } | null} pkg
 * @returns {{ title?: string, dir?: string, steps?: Array<{ command: string, label: string, script?: string }>, error?: string }}
 */
export function plan(args, pkg) {
  const [mode, ...rest] = args;
  if (mode === "validate" && rest.length === 0) {
    const chain = pkg?.scripts?.validate;
    if (!chain)
      return { error: "verdict: package.json has no scripts.validate" };
    return {
      title: "verdict validate",
      dir: "validate",
      steps: stepsFromChain(chain),
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

function main(args) {
  const pkgPath = join(root, "package.json");
  const pkg = existsSync(pkgPath)
    ? JSON.parse(readFileSync(pkgPath, "utf-8"))
    : null;
  const run = plan(args, pkg);
  if (run.error) {
    console.error(run.error);
    return Promise.resolve(2);
  }

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
