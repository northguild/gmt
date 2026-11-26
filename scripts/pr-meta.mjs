#!/usr/bin/env node
/**
 * The labels, milestone and reviewer a pull request should carry, and (with `--apply`) setting
 * them on its open PR.
 *
 * - Labels: from the commit types since `origin/main` and the paths the branch changes,
 *   committed or not.
 * - Milestone: the milestone of the issue the PR closes (or the branch's leading issue number),
 *   else the tracker that holds the branch's story id.
 * - Reviewer: every collaborator who is not the PR's author.
 *
 * The rules live in `scripts/lib/pr-meta-plan.mjs`. `--apply` only adds: it never removes a label,
 * never replaces a milestone a person set, and never un-requests a reviewer.
 *
 * Run as: node scripts/pr-meta.mjs [<number> | <branch>] [--apply] [--json]
 *   no argument  the open PR whose head is the current branch (or, with none open, the plan for
 *                the PR the current branch would open)
 *
 * Exit: 0 done, 2 usage error, `gh` or `git` error, or `--apply` with no open PR.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { planMeta, TRACKER_MILESTONES } from "./lib/pr-meta-plan.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const USAGE =
  "usage: node scripts/pr-meta.mjs [<number> | <branch>] [--apply] [--json]";

/** @param {string} message */
function fail(message) {
  console.error(message);
  process.exit(2);
}

/**
 * `gh`'s own "does not exist" answers. Any other failure (a bad token, no network, a rate limit)
 * stops the script with `gh`'s message, so it never reads as "no open PR" or "no milestone".
 */
const NO_PR =
  /no pull requests found for branch|Could not resolve to a PullRequest/;
const NO_ISSUE = /Could not resolve to an issue or pull request/;

/**
 * Runs a command and returns its trimmed stdout. A failure whose stderr matches `notFound`
 * returns null; any other failure stops the script.
 * @param {string} cmd @param {string[]} args @param {{ notFound?: RegExp }} [options]
 */
function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    if (options.notFound?.test(result.stderr)) return null;
    fail(`${cmd} ${args.join(" ")} failed:\n${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

/** @param {string | null} text */
const lines = (text) => (text ? text.split("\n").filter(Boolean) : []);

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const asJson = argv.includes("--json");
const rest = argv.filter((arg) => !arg.startsWith("--"));
if (
  rest.length > 1 ||
  argv.some(
    (arg) => arg.startsWith("--") && arg !== "--apply" && arg !== "--json",
  )
) {
  fail(USAGE);
}

const pr = JSON.parse(
  run(
    "gh",
    [
      "pr",
      "view",
      ...rest,
      "--json",
      "number,state,headRefName,author,closingIssuesReferences,labels,milestone,reviewRequests,latestReviews",
    ],
    { notFound: NO_PR },
  ) ?? "null",
);
if (rest.length && pr?.state !== "OPEN") fail(`No open PR for ${rest[0]}.`);
const open = pr?.state === "OPEN" ? pr : null;
const branch = open?.headRefName ?? run("git", ["branch", "--show-current"]);
if (!branch) fail("No branch: check one out or name the PR.");

run("git", ["fetch", "--quiet", "origin", "main"]);
const head =
  open && branch !== run("git", ["branch", "--show-current"])
    ? `origin/${branch}`
    : "HEAD";
if (head !== "HEAD") run("git", ["fetch", "--quiet", "origin", branch]);
const base = run("git", ["merge-base", head, "origin/main"]);
const subjects = lines(
  run("git", ["log", "--no-merges", "--format=%s", `${base}..${head}`]),
);
const paths = [
  ...new Set([
    ...lines(
      run("git", [
        "diff",
        "--name-only",
        base,
        ...(head === "HEAD" ? [] : [head]),
      ]),
    ),
    ...(head === "HEAD"
      ? lines(run("git", ["ls-files", "--others", "--exclude-standard"]))
      : []),
  ]),
];

const issueNumbers = open?.closingIssuesReferences?.length
  ? open.closingIssuesReferences.map(
      (/** @type {{ number: number }} */ issue) => issue.number,
    )
  : [/^(?:[\w-]+\/)?(\d+)-/.exec(branch)?.[1]].filter(Boolean).map(Number);
const closingIssues = issueNumbers.map((number) => {
  const issue = JSON.parse(
    run("gh", ["issue", "view", String(number), "--json", "milestone"], {
      notFound: NO_ISSUE,
    }) ?? "{}",
  );
  return { number, milestone: issue.milestone?.title ?? null };
});

const trackers = Object.fromEntries(
  Object.keys(TRACKER_MILESTONES)
    .filter((path) => existsSync(join(root, path)))
    .map((path) => [path, readFileSync(join(root, path), "utf8")]),
);

const plan = planMeta({
  branch,
  subjects,
  paths,
  closingIssues,
  trackers,
  milestones: lines(
    run("gh", ["api", "repos/{owner}/{repo}/milestones", "--jq", ".[].title"]),
  ),
  viewer: run("gh", ["api", "user", "--jq", ".login"]) ?? "",
  author: open?.author?.login ?? null,
  collaborators: lines(
    run("gh", [
      "api",
      "repos/{owner}/{repo}/collaborators",
      "--jq",
      ".[].login",
    ]),
  ),
});

if (asJson && !apply) {
  console.log(
    JSON.stringify({ pr: open?.number ?? null, branch, ...plan }, null, 2),
  );
  process.exit(0);
}

console.log(
  `${open ? `PR #${open.number}` : "No open PR"} · ${branch}${plan.storyId ? ` · ${plan.storyId}` : ""}`,
);
console.log(`  labels     ${plan.labels.join(", ") || "(none)"}`);
console.log(
  `  milestone  ${plan.milestone ?? "(none)"}   from ${plan.milestoneFrom}`,
);
console.log(`  reviewer   ${plan.reviewers.join(", ") || "(none)"}`);

if (!apply) process.exit(0);
if (!open)
  fail("--apply needs an open PR. Open it first, then run this again.");

const hasLabels = new Set(
  open.labels.map((/** @type {{ name: string }} */ label) => label.name),
);
const addLabels = plan.labels.filter((label) => !hasLabels.has(label));
/* Someone already asked, or who already reviewed, is not asked again. */
const requested = new Set([
  ...open.reviewRequests.map(
    (/** @type {{ login?: string, name?: string }} */ r) => r.login ?? r.name,
  ),
  ...open.latestReviews.map(
    (/** @type {{ author: { login: string } }} */ r) => r.author.login,
  ),
]);
const addReviewers = plan.reviewers.filter((login) => !requested.has(login));
const current = open.milestone?.title ?? null;
const setMilestone = plan.milestone && !current ? plan.milestone : null;

const args = ["pr", "edit", String(open.number)];
if (addLabels.length) args.push("--add-label", addLabels.join(","));
if (setMilestone) args.push("--milestone", setMilestone);
if (addReviewers.length) args.push("--add-reviewer", addReviewers.join(","));
if (args.length > 3) run("gh", args);

console.log(
  `Applied: ${addLabels.length ? `labels ${addLabels.join(", ")}` : "no new labels"}; ` +
    `${setMilestone ? `milestone ${setMilestone}` : current ? `milestone kept (${current})` : "no milestone"}; ` +
    `${addReviewers.length ? `reviewer ${addReviewers.join(", ")}` : "reviewer already asked"}.`,
);
if (current && plan.milestone && current !== plan.milestone) {
  console.log(
    `  Note: the PR's milestone is ${current}; the plan says ${plan.milestone}. Left as it is.`,
  );
}
