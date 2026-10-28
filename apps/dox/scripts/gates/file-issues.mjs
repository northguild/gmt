#!/usr/bin/env node
/**
 * Files the nightly gate sweep's findings as `bug` issues. A thin shell around the pure decision
 * in `./issue-plan.mjs`, shaped like `scripts/canary-report.mjs`: it reads the `summary.json` each
 * sweep leg wrote, asks the planner what to do against the open `dox-gate` issues and runs that
 * through the GitHub CLI.
 *
 *   node apps/dox/scripts/gates/file-issues.mjs [--print] [--dry-run-finding]
 *        [--legs <leg,...>] <summary.json ...>
 *
 * A summary's leg is the name of the folder it sits in (`artifacts/chromium-1/summary.json` is
 * `chromium-1`). `--legs` names every leg the sweep ran: one with no readable summary is filed as
 * could-not-run, which is how a crashed leg that uploaded nothing is still seen. `--print` plans
 * against the live open-issue list and prints the actions instead of running them (one line per
 * action, then a count); with `$GITHUB_STEP_SUMMARY` set it also appends the plan there.
 * `--dry-run-finding` adds one synthetic `[dry run]` finding under the `dox-gate-dry-run` label.
 *
 * Exit 0 when the actions were carried out (findings do not change it; the sweep legs already
 * fail), 1 when a `gh` call failed, 2 for usage (including a summary path with no leg or no
 * readable file, and any run without `--print` outside GitHub Actions: it only plans locally). Node built-ins only and no `Date`. `gh`
 * authenticates from `GH_TOKEN`.
 */
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { realGh } from "../../../../scripts/canary-report.mjs";
import {
  BUG_LABEL,
  DRY_RUN_LABEL,
  GATE_LABEL,
  ISSUE_TYPE,
  flakyRows,
  planIssueActions,
} from "./issue-plan.mjs";

const USAGE =
  "Usage: node apps/dox/scripts/gates/file-issues.mjs [--print] [--dry-run-finding] [--legs <leg,...>] <summary.json ...>";

/** What `gh label create` gets for each label; an existing label is never edited. */
export const LABEL_SPECS = {
  [GATE_LABEL]: {
    description: "Opened by the nightly Dox gate sweep",
    color: "b60205",
  },
  [DRY_RUN_LABEL]: {
    description:
      "Opened by a forced dry run of the nightly Dox gate sweep; close once checked",
    color: "c5def5",
  },
  [BUG_LABEL]: { description: "Something isn't working", color: "d73a4a" },
};

/**
 * @typedef {(args: string[], input?: string) => string} Gh  runs `gh` with args, returns stdout
 */

/** @param {string[]} argv */
export function parseArgs(argv) {
  const files = [];
  let print = false;
  let dryRun = false;
  /** @type {string[] | null} */
  let legs = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    if (a === "--print") print = true;
    else if (a === "--dry-run-finding") dryRun = true;
    else if (a === "--legs") {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) {
        return {
          ok: false,
          error: `file-issues: --legs needs a value\n${USAGE}`,
        };
      }
      legs = v.split(",").filter(Boolean);
    } else if (a.startsWith("--")) {
      return { ok: false, error: `file-issues: unknown flag ${a}\n${USAGE}` };
    } else files.push(a);
  }
  if (files.length === 0 && !legs) {
    return {
      ok: false,
      error: `file-issues: no summary files given\n${USAGE}`,
    };
  }
  return { ok: true, files, print, dryRun, legs };
}

/**
 * Creates each label in `needed` that the repository lacks.
 * @param {Gh} gh
 * @param {string[]} needed
 */
export function ensureLabels(gh, needed) {
  const existing = new Set(
    JSON.parse(gh(["label", "list", "--json", "name", "--limit", "1000"])).map(
      (/** @type {{ name: string }} */ l) => l.name.toLowerCase(),
    ),
  );
  for (const name of needed) {
    if (existing.has(name.toLowerCase())) continue;
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

/** @param {Gh} gh */
export function listOpenGateIssues(gh) {
  return JSON.parse(
    gh([
      "issue",
      "list",
      "--label",
      GATE_LABEL,
      "--state",
      "open",
      "--limit",
      "1000",
      "--json",
      "number,body,labels",
    ]),
  );
}

const messageOf = (error) =>
  error instanceof Error ? error.message : String(error);

/**
 * Runs every action in order. A failed call is recorded and the next action still runs.
 * @param {Gh} gh
 * @param {import("./issue-plan.mjs").Action[]} actions
 */
export function runActions(gh, actions) {
  return actions.map((action) => {
    try {
      if (action.kind === "comment") {
        gh(
          ["issue", "comment", String(action.issue), "--body-file", "-"],
          action.body,
        );
        return { action, ok: true };
      }
      gh(
        [
          "issue",
          "create",
          "--title",
          action.title,
          "--type",
          ISSUE_TYPE,
          ...action.labels.flatMap((l) => ["--label", l]),
          "--body-file",
          "-",
        ],
        action.body,
      );
      return { action, ok: true };
    } catch (error) {
      return { action, ok: false, error: messageOf(error) };
    }
  });
}

/** The leg a summary file belongs to: its folder's name. */
export function legOf(file) {
  return path
    .basename(path.dirname(path.resolve(file)))
    .replace(/^dox-gates-/, "");
}

/**
 * Reads the summaries. A file whose leg cannot be derived (no folder name) is a usage error. An
 * unreadable file is a usage error too, unless `--legs` is given: then the crashed legs are the
 * `--legs` entries with no readable summary, and an unreadable path (the literal `artifacts/*` of
 * a glob that matched nothing, say) is ignored. A leg name is never empty.
 * @param {string[]} files
 * @param {string[] | null} legs
 * @returns {{ ok: true, legs: import("./issue-plan.mjs").LegSummary[] } | { ok: false, error: string }}
 */
export function readLegs(files, legs) {
  /** @type {Map<string, any>} */
  const byLeg = new Map((legs ?? []).map((leg) => [leg, null]));
  for (const file of files) {
    const leg = legOf(file);
    if (leg === "" || leg === ".") {
      return {
        ok: false,
        error: `file-issues: cannot tell which leg ${file} belongs to (expected <leg>/summary.json)\n${USAGE}`,
      };
    }
    let summary = null;
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      if (parsed && Array.isArray(parsed.rows)) summary = parsed;
    } catch {}
    if (summary === null) {
      if (legs) continue;
      return {
        ok: false,
        error: `file-issues: cannot read a summary from ${file}\n${USAGE}`,
      };
    }
    byLeg.set(leg, summary);
  }
  return {
    ok: true,
    legs: [...byLeg].map(([leg, summary]) => ({ leg, summary })),
  };
}

const actionLine = (a) =>
  a.kind === "open"
    ? `open  ${a.key}  ${a.title}`
    : `comment #${a.issue}  ${a.key}`;

/**
 * @param {string[]} argv
 * @param {{ env: Record<string, string | undefined>, gh: Gh,
 *   stdout: (text: string) => void, stderr: (text: string) => void }} io
 * @returns {number}
 */
export function main(argv, { env, gh, stdout, stderr }) {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    stderr(`${parsed.error}\n`);
    return 2;
  }
  const { files, print, dryRun, legs } = parsed;
  if (!print && env.GITHUB_ACTIONS !== "true") {
    stderr(
      "file-issues: run with --print locally; issues are filed by the nightly workflow\n",
    );
    return 2;
  }
  const read = readLegs(files, legs);
  if (!read.ok) {
    stderr(`${read.error}\n`);
    return 2;
  }
  const legSummaries = read.legs;
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SHA } =
    env;
  const runUrl =
    GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
      ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
      : "(local run)";
  const context = { runUrl, sha: GITHUB_SHA ?? "(local)", dryRun };

  const flaky = flakyRows(legSummaries);
  const flakyText =
    flaky.length > 0
      ? `\nFlaky (failed, passed on retry; not filed):\n${flaky.map((f) => `- ${f.gate} on ${f.leg}: ${f.detail}`).join("\n")}\n`
      : "";
  /** @param {string} text */
  const summarise = (text) => {
    if (env.GITHUB_STEP_SUMMARY) {
      try {
        appendFileSync(env.GITHUB_STEP_SUMMARY, `${text}\n`);
      } catch {}
    }
  };

  let code = 0;
  let lines = [];
  try {
    const actions = planIssueActions(
      legSummaries,
      listOpenGateIssues(gh),
      context,
    );
    if (print) {
      lines = actions.map(actionLine);
    } else if (actions.length > 0) {
      ensureLabels(gh, [
        ...new Set(actions.flatMap((a) => (a.kind === "open" ? a.labels : []))),
      ]);
      const results = runActions(gh, actions);
      lines = results.map(({ action, ok, error }) =>
        ok ? actionLine(action) : `FAILED ${actionLine(action)}: ${error}`,
      );
      if (results.some((r) => !r.ok)) code = 1;
    }
    const count = `${actions.length} action${actions.length === 1 ? "" : "s"}${print ? " planned (not run)" : ""}`;
    stdout(`${[...lines, count].join("\n")}\n`);
    summarise(
      `### Dox gate issues\n\n\`\`\`text\n${[...lines, count].join("\n")}\n\`\`\`${flakyText}`,
    );
  } catch (error) {
    stderr(`file-issues: gh failed: ${messageOf(error)}\n`);
    summarise(
      `### Dox gate issues\n\nNothing filed: gh failed: ${messageOf(error)}${flakyText}`,
    );
    code = 1;
  }
  return code;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main(process.argv.slice(2), {
    env: process.env,
    gh: realGh,
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
