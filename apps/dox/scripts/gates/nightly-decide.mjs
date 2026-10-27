#!/usr/bin/env node
/**
 * The skip rule of the nightly gate sweep (`.github/workflows/dox-gates-nightly.yml`, job
 * `decide`): run the sweep, or say nothing under `apps/dox/` or `pnpm-lock.yaml` changed since the
 * last finished run. `shouldRun` is pure and tested (`nightly-decide.test.ts`); the CLI reads its
 * input from the environment the workflow step sets and writes `run=true|false` to
 * `$GITHUB_OUTPUT` and the reason to `$GITHUB_STEP_SUMMARY`.
 *
 *   EVENT_NAME      github.event_name
 *   SCHEDULE        github.event.schedule (the cron that fired; empty otherwise)
 *   FORCE           "true" for a dispatch with `force`
 *   FORCE_FINDING   "true" for a dispatch with `force_finding`
 *   LAST_SHA        commit of the newest finished run, empty when there is none or it is not in
 *                   the history
 *   CHANGED         the files `git diff --name-only $LAST_SHA HEAD -- apps/dox/ pnpm-lock.yaml`
 *                   printed, one per line
 *   LAST_ERROR      why the earlier runs could not be listed (empty when they could)
 *
 * Fails open: anything it cannot decide runs the sweep. Node built-ins only, no `Date`.
 */
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** The Sunday cron: the weekly run, which always sweeps. */
export const WEEKLY_CRON = "41 4 * * 0";

/**
 * @param {{ event: string, schedule?: string, force?: boolean, forceFinding?: boolean,
 *   lastSha: string | null, changed: string[] | null, lastError?: string }} input
 *   `lastSha` null: no earlier finished run, or its commit is not in the history.
 *   `changed` null: the diff could not be taken.
 * @returns {{ run: boolean, reason: string }}
 */
export function shouldRun({
  event,
  schedule = "",
  force = false,
  forceFinding = false,
  lastSha,
  changed,
  lastError = "",
}) {
  if (event === "schedule" && schedule === WEEKLY_CRON) {
    return { run: true, reason: "weekly run: always sweeps" };
  }
  if (event === "workflow_dispatch" && (force || forceFinding)) {
    return { run: true, reason: "dispatched with force" };
  }
  if (lastError) {
    return {
      run: true,
      reason: `could not list earlier runs (${lastError}); sweeping`,
    };
  }
  if (!lastSha) {
    return {
      run: true,
      reason: "no earlier finished run, or its commit is not in the history",
    };
  }
  if (changed === null) {
    return { run: true, reason: `could not diff against ${lastSha}; sweeping` };
  }
  if (changed.length > 0) {
    return {
      run: true,
      reason: `${changed.length} file${changed.length === 1 ? "" : "s"} under apps/dox/ or pnpm-lock.yaml changed since ${lastSha}`,
    };
  }
  return {
    run: false,
    reason: `Skipped: nothing under apps/dox/ or pnpm-lock.yaml changed since ${lastSha}`,
  };
}

/** @param {Record<string, string | undefined>} env */
export function inputFromEnv(env) {
  const lines = (env.CHANGED ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    event: env.EVENT_NAME ?? "",
    schedule: env.SCHEDULE ?? "",
    force: env.FORCE === "true",
    forceFinding: env.FORCE_FINDING === "true",
    lastSha: (env.LAST_SHA ?? "").trim() || null,
    changed: lines,
    lastError: (env.LAST_ERROR ?? "").trim(),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { run, reason } = shouldRun(inputFromEnv(process.env));
  console.log(`run=${run} (${reason})`);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `${run ? "Sweeping" : ""}${run ? ": " : ""}${reason}\n`,
    );
  }
}
