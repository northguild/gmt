#!/usr/bin/env node
/**
 * CORE-81: files the canary issues. A thin shell around the pure decision in
 * `scripts/lib/canary-issues.mjs`: it reads the verdict files a canary wrote, applies the dry-run
 * force flags, asks the planner what to do and runs that through the GitHub CLI.
 *
 *   node scripts/canary-report.mjs <temporal-oracle|leap-seconds>
 *        [--force-removable=<id>] [--force-mismatch] [--force-leap-difference] [--print]
 *
 * Exit 0 when it reported (or had nothing to report), 1 when a `gh` call failed, 2 on a usage
 * error (nothing is filed), on `--force-removable` naming an id the check did not list (nothing is
 * filed), or on a force flag whose source did not run. A dry run never alters real behaviour, and a
 * canary that could not run is a finding: so that force is dropped, said so on stderr and in the
 * summary, and the real findings are filed as usual before the exit 2. `--print` writes the
 * summary and the planned actions to stdout and calls no `gh`.
 *
 * Node built-ins only and no `Date`: the workflows run it with no install and no build. `gh`
 * authenticates from `GH_TOKEN`. The job summary goes to `$GITHUB_STEP_SUMMARY`, or to stdout when
 * that is unset.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { couldNotRunVerdict, VERDICT_FILES } from "./lib/canary-verdict.mjs";
import {
  CANARY_LABEL,
  DRY_RUN_LABEL,
  WORKFLOW_SOURCES,
  applyForce,
  planIssueActions,
} from "./lib/canary-issues.mjs";
import { summaryMarkdown } from "./lib/canary-summary.mjs";

// fileURLToPath, not `.pathname`: see scripts/test-markers.mjs.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const USAGE =
  "Usage: node scripts/canary-report.mjs <temporal-oracle|leap-seconds> " +
  "[--force-removable=<id>] [--force-mismatch] [--force-leap-difference] [--print]";

/** Flags each workflow accepts besides `--print`. */
const FORCE_FLAGS = {
  "temporal-oracle": ["--force-removable=", "--force-mismatch"],
  "leap-seconds": ["--force-leap-difference"],
};

/** What `gh label create` gets for each label the canaries use. Existing labels are never edited. */
const LABEL_SPECS = {
  [CANARY_LABEL]: {
    description: "Opened by a weekly canary workflow",
    color: "0e8a16",
  },
  [DRY_RUN_LABEL]: {
    description:
      "Opened by a forced dry run of a canary workflow; close once checked",
    color: "c5def5",
  },
  // GitHub's default `bug` label, created only if a repository has none.
  bug: { description: "Something isn't working", color: "d73a4a" },
};

/**
 * @typedef {import("./lib/canary-issues.mjs").Force} Force
 * @typedef {import("./lib/canary-issues.mjs").Action} Action
 * @typedef {(args: string[], input?: string) => string} Gh  runs `gh` with args, returns stdout
 * @typedef {{ action: Action, ok: boolean, issue?: number, error?: string }} ActionResult
 */

/**
 * @param {string[]} argv  the arguments after `node scripts/canary-report.mjs`
 * @returns {{ ok: true, workflow: "temporal-oracle" | "leap-seconds", force: Force, print: boolean }
 *   | { ok: false, error: string }}
 */
export function parseArgs(argv) {
  const args = argv.filter((a) => a !== "--");
  const fail = (/** @type {string} */ detail) => ({
    ok: /** @type {const} */ (false),
    error: `canary-report: ${detail}\n${USAGE}`,
  });
  const [workflow, ...flags] = args;
  if (workflow !== "temporal-oracle" && workflow !== "leap-seconds") {
    return fail(
      workflow === undefined
        ? "no workflow given"
        : `unknown workflow: ${workflow}`,
    );
  }
  /** @type {Force} */
  const force = {};
  let print = false;
  for (const flag of flags) {
    if (flag === "--print") {
      print = true;
    } else if (
      !FORCE_FLAGS[workflow].some((f) =>
        f.endsWith("=") ? flag.startsWith(f) : flag === f,
      )
    ) {
      return fail(`unknown flag for ${workflow}: ${flag}`);
    } else if (flag.startsWith("--force-removable=")) {
      // An empty value is no force: a scheduled run passes nothing, a dispatch an empty input.
      const id = flag.slice("--force-removable=".length);
      if (id !== "") force.removable = id;
    } else if (flag === "--force-mismatch") {
      force.mismatch = true;
    } else {
      force.leapDifference = true;
    }
  }
  return { ok: true, workflow, force, print };
}

/**
 * Creates each label in `needed` that the repository lacks. No `--force`: an existing label,
 * `bug` included, is never edited.
 * @param {Gh} gh
 * @param {string[]} needed
 */
export function ensureLabels(gh, needed) {
  const existing = new Set(
    JSON.parse(gh(["label", "list", "--json", "name", "--limit", "1000"])).map(
      (/** @type {{ name: string }} */ label) => label.name,
    ),
  );
  for (const name of needed) {
    if (existing.has(name)) continue;
    const spec =
      /** @type {Record<string, { description: string, color: string }>} */ (
        LABEL_SPECS
      )[name];
    const args = ["label", "create", name];
    if (spec)
      args.push("--description", spec.description, "--color", spec.color);
    gh(args);
  }
}

/**
 * @param {Gh} gh
 * @returns {{ number: number, body: string, labels: { name: string }[] }[]}
 */
export function listOpenCanaryIssues(gh) {
  return JSON.parse(
    gh([
      "issue",
      "list",
      "--label",
      CANARY_LABEL,
      "--state",
      "open",
      "--limit",
      "1000",
      "--json",
      "number,body,labels",
    ]),
  );
}

/**
 * Runs every action in order. A failed call is recorded and the next action still runs; an action
 * already run stays done, and the next weekly run comments on it.
 * @param {Gh} gh
 * @param {Action[]} actions
 * @returns {ActionResult[]}
 */
export function runActions(gh, actions) {
  return actions.map((action) => {
    try {
      if (action.kind === "comment") {
        gh(
          ["issue", "comment", String(action.issue), "--body-file", "-"],
          action.body,
        );
        return { action, ok: true, issue: action.issue };
      }
      const output = gh(
        [
          "issue",
          "create",
          "--title",
          action.title,
          ...action.labels.flatMap((label) => ["--label", label]),
          "--body-file",
          "-",
        ],
        action.body,
      );
      // `gh issue create` prints the new issue's URL; the number is its last path segment.
      const number = /\/(\d+)\s*$/.exec(output)?.[1];
      if (number === undefined) {
        return {
          action,
          ok: false,
          error: `could not read the new issue number from gh's output: ${output.trim()}`,
        };
      }
      return { action, ok: true, issue: Number(number) };
    } catch (error) {
      return { action, ok: false, error: messageOf(error) };
    }
  });
}

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The real `gh`: no shell, body on stdin, stderr kept as the error message. `maxBuffer` is 64 MiB
 * because Node's 1 MiB default would fail `gh issue list --limit 1000` (bodies included) once the
 * open issues are large enough, and that failure would stop any issue being filed.
 * @type {Gh}
 */
export function realGh(args, input) {
  try {
    return execFileSync("gh", args, {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = /** @type {any} */ (error)?.stderr?.toString().trim();
    throw new Error(stderr || messageOf(error));
  }
}

/**
 * The verdict file of each source the workflow reads: a missing file is `null`, an unreadable one
 * a could-not-run verdict.
 * @param {string} root
 * @param {"temporal-oracle" | "leap-seconds"} workflow
 */
function readVerdicts(root, workflow) {
  /** @type {Record<string, any>} */
  const verdicts = {};
  for (const source of WORKFLOW_SOURCES[workflow]) {
    const unreadable = (/** @type {string} */ why) =>
      couldNotRunVerdict(source, `unreadable verdict: ${why}`);
    let text;
    try {
      text = readFileSync(
        join(
          root,
          /** @type {Record<string, string>} */ (VERDICT_FILES)[source],
        ),
        "utf8",
      );
    } catch (error) {
      verdicts[source] =
        /** @type {any} */ (error)?.code === "ENOENT"
          ? null
          : unreadable(messageOf(error));
      continue;
    }
    try {
      const parsed = JSON.parse(text);
      verdicts[source] =
        parsed !== null &&
        typeof parsed === "object" &&
        typeof parsed.status === "string"
          ? parsed
          : unreadable("not a verdict object");
    } catch (error) {
      verdicts[source] = unreadable(messageOf(error));
    }
  }
  return verdicts;
}

/**
 * Runs the reporter; returns the exit code.
 * @param {string[]} argv
 * @param {{ root: string, env: Record<string, string | undefined>, gh: Gh,
 *           stdout: (text: string) => void, stderr: (text: string) => void }} io
 * @returns {number}
 */
export function main(argv, { root, env, gh, stdout, stderr }) {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    stderr(`${parsed.error}\n`);
    return 2;
  }
  const { workflow, force, print } = parsed;
  const verdicts = readVerdicts(root, workflow);

  /** @param {string} text */
  const emitSummary = (text) => {
    if (!print && env.GITHUB_STEP_SUMMARY) {
      appendFileSync(env.GITHUB_STEP_SUMMARY, text);
    } else {
      stdout(text);
    }
  };

  /** @type {Record<string, any>} */
  let forced;
  /** @type {{ flag: string, reason: string }[]} */
  let skipped;
  try {
    ({ verdicts: forced, skipped } = applyForce(verdicts, force));
  } catch (error) {
    stderr(`canary-report: ${messageOf(error)}\n`);
    emitSummary(
      summaryMarkdown(workflow, verdicts, force, null, messageOf(error)),
    );
    return 2;
  }
  for (const { flag, reason } of skipped) {
    stderr(`canary-report: ${flag} not applied: ${reason}\n`);
  }
  // A force with nothing to force against is still a usage problem to see, so it exits 2 once the
  // real findings are filed.
  const skippedCode = skipped.length > 0 ? 2 : 0;

  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = env;
  const runUrl =
    GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
      ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
      : "(local run)";
  const context = { workflow, runUrl };

  if (print) {
    emitSummary(
      summaryMarkdown(workflow, verdicts, force, null, undefined, skipped),
    );
    stdout(
      `${JSON.stringify(planIssueActions(forced, [], context), null, 2)}\n`,
    );
    return skippedCode;
  }

  /** @type {ActionResult[] | null} */
  let results = null;
  /** @type {string | undefined} */
  let notFiledReason;
  let code = skippedCode;
  try {
    // With no open issues every finding plans as `open`, so this names every label that could be
    // needed; with no finding at all, no `gh` call is made.
    const labels = new Set([CANARY_LABEL]);
    const planned = planIssueActions(forced, [], context);
    for (const action of planned) {
      if (action.kind === "open") action.labels.forEach((l) => labels.add(l));
    }
    if (planned.length === 0) {
      results = [];
    } else {
      ensureLabels(gh, [...labels]);
      const actions = planIssueActions(
        forced,
        listOpenCanaryIssues(gh),
        context,
      );
      results = runActions(gh, actions);
      for (const { action, ok, error } of results) {
        if (ok) continue;
        code = 1;
        stderr(
          `canary-report: failed to ${
            action.kind === "open"
              ? `open "${action.title}"`
              : `comment on #${action.issue}`
          }: ${error}\n`,
        );
      }
    }
  } catch (error) {
    // Labels or the issue list failed: nothing was filed.
    code = 1;
    notFiledReason = `gh failed: ${messageOf(error)}`;
    stderr(`canary-report: ${notFiledReason}\n`);
  } finally {
    emitSummary(
      summaryMarkdown(
        workflow,
        verdicts,
        force,
        results,
        notFiledReason,
        skipped,
      ),
    );
  }
  return code;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main(process.argv.slice(2), {
    root: ROOT,
    env: process.env,
    gh: realGh,
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
