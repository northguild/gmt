/**
 * The runner's two process seams, split out of `gates.mjs` so a test can drive them:
 *
 * - `runCommand` runs a command with its output in a log and stops it at a time limit: SIGTERM,
 *   then SIGKILL after `KILL_GRACE_MS` for a child that does not exit. `onLimit` runs first, so the
 *   caller can note how much of its report file exists at that moment.
 * - `readReport` reads what a gate script wrote under `GATE_REPORT`. `upTo` drops every byte past an
 *   offset: at a deadline a gate may run on for a moment and record pages it never checked.
 * - `retryFits` says whether a retry may start, and `afterRetry` what its result becomes.
 */
import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync } from "node:fs";

/** Exit code `runCommand` reports for a child it stopped at the time limit. */
export const TIMED_OUT = 124;

/** How long a child has to exit after SIGTERM before it is killed. */
export const KILL_GRACE_MS = 10_000;

/**
 * Resolves the child's exit code, or `TIMED_OUT` when it was stopped after `limitMs`.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, log: string, limitMs: number,
 *           onSpawn?: (child: import("node:child_process").ChildProcess | null) => void,
 *           onLimit?: () => void }} options
 * @returns {Promise<number>}
 */
export function runCommand(
  command,
  args,
  { cwd, env, log, limitMs, onSpawn, onLimit },
) {
  return new Promise((resolve) => {
    const fd = openSync(log, "a");
    const p = spawn(command, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0", ...env },
      stdio: ["ignore", fd, fd],
    });
    onSpawn?.(p);
    let timedOut = false;
    let killTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      onLimit?.();
      p.kill("SIGTERM");
      killTimer = setTimeout(() => p.kill("SIGKILL"), KILL_GRACE_MS);
    }, limitMs);
    const finish = (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      closeSync(fd);
      onSpawn?.(null);
      resolve(code);
    };
    p.on("close", (code, signal) =>
      finish(timedOut ? TIMED_OUT : (code ?? (signal ? 1 : 0))),
    );
    p.on("error", () => finish(2));
  });
}

/**
 * What one invocation of a gate script wrote to its report file: the findings and the number of
 * pages measured. With `upTo`, only the first `upTo` bytes count; a line the cut splits is dropped.
 *
 * @param {string} file
 * @param {{ upTo?: number }} [options]
 */
export function readReport(file, { upTo } = {}) {
  const findings = [];
  let measured = null;
  if (existsSync(file)) {
    const bytes = readFileSync(file);
    const text = (
      upTo === undefined ? bytes : bytes.subarray(0, upTo)
    ).toString("utf8");
    for (const line of text.split("\n")) {
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

/**
 * A retry may start only with more time left than the first attempt took: one the deadline would
 * cut short replaces nothing and costs the minutes the next gate needs.
 *
 * @param {number} timeLeftMs Infinity without a deadline.
 * @param {number} firstAttemptMs
 */
export const retryFits = (timeLeftMs, firstAttemptMs) =>
  timeLeftMs > firstAttemptMs;

/**
 * What a gate's result becomes after one retry. A retry the deadline cut short never replaces the
 * first attempt: its status and findings stand, with the out-of-time note. A pass is flaky; any
 * other failure is the retry's own result.
 *
 * @template {{ status: string, outOfTime?: boolean }} R
 * @param {R} first
 * @param {R} again
 * @returns {{ result: R & { timedOut?: boolean, outOfTime?: boolean, retried?: boolean }, flaky: boolean, stop: boolean }}
 */
export function afterRetry(first, again) {
  if (again.outOfTime)
    return {
      result: { ...first, timedOut: true, outOfTime: true },
      flaky: false,
      stop: true,
    };
  if (again.status === "PASS")
    return { result: { ...again, retried: true }, flaky: true, stop: false };
  return { result: again, flaky: false, stop: false };
}
