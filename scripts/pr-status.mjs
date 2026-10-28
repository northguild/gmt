#!/usr/bin/env node
/**
 * One screen for a pull request: its checks, its unresolved review threads and a verdict.
 *
 * One `gh api graphql` call reads the PR, its last commit's checks, its review threads and the
 * viewer. Each failing check run (at most 3) then costs one `gh run view --job --log-failed`,
 * whose log is written whole to `.verdict/pr-<n>/<job>.log` and tailed on the screen. Reads only:
 * nothing is posted, commented, resolved, rerun or edited.
 *
 * Run as: node scripts/pr-status.mjs [<number> | <url> | <branch>] [--log-lines 30] [--json]
 *   no argument  the open PR whose head is the current branch
 *   --json       print the planned status as JSON instead of the screen (no log fetch)
 *
 * Exit: 0 PASS, 1 FAIL, 3 PEND (nothing failed, and a check still runs, no check has registered
 * yet, or more than 100 checks or threads went unread), 2 usage error, no PR found
 * or a `gh` error. The decision lives in `scripts/lib/pr-status-plan.mjs`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildQuery,
  checksToFetch,
  cleanLog,
  DEFAULT_LOG_LINES,
  exitCodeFor,
  formatStatus,
  jobSlug,
  planStatus,
} from "./lib/pr-status-plan.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const USAGE =
  "usage: node scripts/pr-status.mjs [<number> | <url> | <branch>] [--log-lines 30] [--json]";

/** @param {string} message @param {number} [code] */
function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

/** @param {string[]} args */
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return {
    ok: result.status === 0 && !result.error,
    stdout: result.stdout ?? "",
    stderr: result.error ? String(result.error.message) : (result.stderr ?? ""),
  };
}

/** `git@github.com:owner/repo.git` or `https://github.com/owner/repo(.git)` */
function parseRemote(url) {
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(
    url.trim(),
  );
  return match ? { owner: match[1], repo: match[2] } : null;
}

function parseArgs(argv) {
  let target = null;
  let logLines = DEFAULT_LOG_LINES;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") json = true;
    else if (arg === "--log-lines") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1)
        fail(`--log-lines needs a positive whole number\n${USAGE}`);
      logLines = value;
    } else if (arg.startsWith("--")) fail(`unknown option ${arg}\n${USAGE}`);
    else if (target === null) target = arg;
    else fail(`one pull request at a time\n${USAGE}`);
  }
  return { target, logLines, json };
}

const { target, logLines, json } = parseArgs(process.argv.slice(2));

const remote = run("git", ["remote", "get-url", "origin"]);
let repoRef = remote.ok ? parseRemote(remote.stdout) : null;

// What to look up: a number, or a branch.
let lookup;
const urlMatch = target
  ? /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(target)
  : null;
if (urlMatch) {
  repoRef = { owner: urlMatch[1], repo: urlMatch[2] };
  lookup = { by: "number", value: urlMatch[3] };
} else if (target && /^#?\d+$/.test(target)) {
  lookup = { by: "number", value: target.replace("#", "") };
} else if (target) {
  lookup = { by: "branch", value: target };
} else {
  const head = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  const branch = head.stdout.trim();
  if (!head.ok || branch === "" || branch === "HEAD") {
    fail(`no PR given and no current branch\n${USAGE}`);
  }
  lookup = { by: "branch", value: branch };
}
if (!repoRef)
  fail("could not read owner and repo from `git remote get-url origin`");

const graphqlArgs = [
  "api",
  "graphql",
  "-f",
  `query=${buildQuery(lookup.by)}`,
  "-f",
  `owner=${repoRef.owner}`,
  "-f",
  `repo=${repoRef.repo}`,
  lookup.by === "number" ? "-F" : "-f",
  `${lookup.by}=${lookup.value}`,
];
const response = run("gh", graphqlArgs);
if (!response.ok) {
  console.error(response.stderr.trim());
  if (/auth|login|token|credentials/i.test(response.stderr)) {
    console.error("hint: run `gh auth status`");
  }
  process.exit(2);
}

let status;
try {
  status = planStatus(JSON.parse(response.stdout).data);
} catch (error) {
  fail(`could not read the GraphQL response: ${error.message}`);
}
if (!status) {
  fail(
    lookup.by === "branch"
      ? `no open pull request with head branch ${lookup.value}`
      : `no pull request #${lookup.value}`,
  );
}

if (json) {
  console.log(JSON.stringify(status, null, 2));
  process.exit(exitCodeFor(status.verdict));
}

// One log fetch per failing check run, at most 3.
const logs = {};
const used = new Set();
for (const check of checksToFetch(status)) {
  const result = run("gh", [
    "run",
    "view",
    String(check.runId),
    "--job",
    String(check.jobId),
    "--log-failed",
  ]);
  const lines = result.ok ? cleanLog(result.stdout) : [];
  if (lines.length === 0) {
    logs[check.jobId] = null;
    continue;
  }
  let slug = jobSlug(check.name);
  if (used.has(slug)) slug = `${slug}-${check.jobId}`;
  used.add(slug);
  const relative = `.verdict/pr-${status.pr.number}/${slug}.log`;
  mkdirSync(dirname(resolve(root, relative)), { recursive: true });
  writeFileSync(resolve(root, relative), `${lines.join("\n")}\n`);
  logs[check.jobId] = { lines, path: relative };
}

console.log(formatStatus(status, { logs, logLines }));
process.exit(exitCodeFor(status.verdict));
