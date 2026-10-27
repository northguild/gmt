/**
 * Slice 7 of #396: the pure half of `scripts/pr-status.mjs`. The GraphQL `data` and the viewer's
 * login go in; the checks, the threads and the verdict come out, and `formatStatus` turns that
 * into the one screen. Nothing here reads a file, the network, the process or the clock; the tests
 * (`apps/dox/scripts/pr-status/*.test.ts`) run it offline against captured responses.
 *
 * `createdAt` is only ever compared as an ISO string, never parsed.
 */

import { failureLines, parseLog, stripAnsi } from "./verdict-parse.mjs";

/** How many checks and threads one query returns; a full page is flagged `(first 100 shown)`. */
export const PAGE_SIZE = 100;
/** How many failing jobs get a log fetch. */
export const MAX_LOG_FETCHES = 3;
/** Default number of log lines kept on screen. */
export const DEFAULT_LOG_LINES = 30;
/** Characters of a thread's first comment shown on screen. */
const QUOTE_WIDTH = 100;

const FAILING_CONCLUSIONS = new Set([
  "FAILURE",
  "TIMED_OUT",
  "CANCELLED",
  "STARTUP_FAILURE",
]);
const PASSING_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

const PR_FIELDS = `
  number title url state isDraft reviewDecision mergeStateStatus headRefOid
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup {
          contexts(first: ${PAGE_SIZE}) {
            nodes {
              __typename
              ... on CheckRun {
                name status conclusion detailsUrl databaseId
                checkSuite { workflowRun { databaseId } }
              }
              ... on StatusContext { context state targetUrl }
            }
          }
        }
      }
    }
  }
  reviewThreads(first: ${PAGE_SIZE}) {
    nodes {
      isResolved isOutdated path line originalLine
      comments(first: 50) { nodes { author { login } body createdAt url } }
    }
  }
  latestReviews(first: 20) { nodes { author { login } state } }
`;

/**
 * The one query the script sends. Read-only. A number resolves through `pullRequest`, a branch
 * through `pullRequests(headRefName:, states: OPEN, first: 1)`.
 * @param {"number" | "branch"} by
 */
export function buildQuery(by) {
  if (by === "branch") {
    return `query($owner: String!, $repo: String!, $branch: String!) {
  viewer { login }
  repository(owner: $owner, name: $repo) {
    pullRequests(headRefName: $branch, states: OPEN, first: 1) {
      nodes {${PR_FIELDS}}
    }
  }
}`;
  }
  return `query($owner: String!, $repo: String!, $number: Int!) {
  viewer { login }
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {${PR_FIELDS}}
  }
}`;
}

/**
 * The pull request in either response shape, or `null` when a branch has no open one.
 * @param {any} data the `data` member of the GraphQL response
 */
export function extractPullRequest(data) {
  const repository = data?.repository;
  if (repository?.pullRequest) return repository.pullRequest;
  return repository?.pullRequests?.nodes?.[0] ?? null;
}

/**
 * @typedef {object} PlannedCheck
 * @property {"check" | "status"} kind a check run, or a commit status context
 * @property {string} name
 * @property {"PASS" | "FAIL" | "PEND"} state
 * @property {string | null} url
 * @property {string | null} [conclusion] check runs only
 * @property {number | null} [jobId] check runs only
 * @property {number | null} [runId] check runs only
 * @property {boolean} [fetchLog] check runs only: a failing conclusion worth a log fetch
 *
 * @typedef {object} PlannedThread
 * @property {string | null} path
 * @property {number | null} line
 * @property {boolean} isOutdated
 * @property {number} commentCount
 * @property {string | null} firstAuthor
 * @property {string} quote
 * @property {string | null} url
 * @property {boolean} answered
 *
 * @typedef {"PASS" | "FAIL" | "PEND"} Verdict
 *
 * @typedef {object} PrStatus
 * @property {{ number: number, title: string, url: string, state: string, isDraft: boolean, reviewDecision: string | null, mergeStateStatus: string | null, headRefOid: string }} pr
 * @property {string | null} viewer
 * @property {{ status: Verdict, failed: number, pending: number, passed: number, total: number, truncated: boolean, items: PlannedCheck[] }} checks
 * @property {{ unresolved: number, waiting: number, truncated: boolean, items: PlannedThread[] }} threads
 * @property {Verdict} verdict
 */

/** @param {{ status?: string, conclusion?: string | null }} run */
function checkRunState(run) {
  if (run.status !== "COMPLETED" || !run.conclusion) return "PEND";
  if (PASSING_CONCLUSIONS.has(run.conclusion)) return "PASS";
  // ACTION_REQUIRED and STALE are not in the spec's failing list, but they are not a pass either.
  return "FAIL";
}

/** @param {string} state a StatusContext state */
function statusContextState(state) {
  if (state === "SUCCESS") return "PASS";
  if (state === "FAILURE" || state === "ERROR") return "FAIL";
  return "PEND";
}

/** @param {any} node one entry of `contexts.nodes` */
function planCheck(node) {
  if (node.__typename === "StatusContext") {
    return {
      kind: "status",
      name: node.context,
      state: statusContextState(node.state),
      url: node.targetUrl ?? null,
    };
  }
  return {
    kind: "check",
    name: node.name,
    state: checkRunState(node),
    conclusion: node.conclusion ?? null,
    url: node.detailsUrl ?? null,
    jobId: node.databaseId ?? null,
    runId: node.checkSuite?.workflowRun?.databaseId ?? null,
    // The spec's list of conclusions whose log is worth fetching.
    fetchLog:
      node.status === "COMPLETED" && FAILING_CONCLUSIONS.has(node.conclusion),
  };
}

/** @param {any} thread */
function planThread(thread, viewer) {
  const comments = [...(thread.comments?.nodes ?? [])].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
  const first = comments[0];
  const last = comments.at(-1);
  return {
    path: thread.path ?? null,
    line: thread.line ?? thread.originalLine ?? null,
    isOutdated: Boolean(thread.isOutdated),
    commentCount: comments.length,
    firstAuthor: first?.author?.login ?? null,
    quote: (first?.body ?? "").split("\n")[0].trim().slice(0, QUOTE_WIDTH),
    url: first?.url ?? null,
    answered: viewer !== null && last?.author?.login === viewer,
  };
}

/**
 * @param {any} data the `data` member of the GraphQL response
 * @returns {PrStatus | null} null when there is no pull request
 */
export function planStatus(data) {
  const pr = extractPullRequest(data);
  if (!pr) return null;
  const viewer = data?.viewer?.login ?? null;

  const contexts =
    pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts?.nodes ?? [];
  const checks = contexts.map(planCheck);
  const unresolved = (pr.reviewThreads?.nodes ?? [])
    .filter((thread) => !thread.isResolved)
    .map((thread) => planThread(thread, viewer));

  const failed = checks.filter((c) => c.state === "FAIL").length;
  const pending = checks.filter((c) => c.state === "PEND").length;
  const waiting = unresolved.filter((t) => !t.answered).length;
  const checksStatus = failed > 0 ? "FAIL" : pending > 0 ? "PEND" : "PASS";
  const verdict =
    failed > 0 || waiting > 0 ? "FAIL" : pending > 0 ? "PEND" : "PASS";

  return {
    pr: {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      isDraft: Boolean(pr.isDraft),
      reviewDecision: pr.reviewDecision ?? null,
      mergeStateStatus: pr.mergeStateStatus ?? null,
      headRefOid: pr.headRefOid ?? "",
    },
    viewer,
    checks: {
      status: checksStatus,
      failed,
      pending,
      passed: checks.length - failed - pending,
      total: checks.length,
      truncated: contexts.length >= PAGE_SIZE,
      items: checks,
    },
    threads: {
      unresolved: unresolved.length,
      waiting,
      truncated: (pr.reviewThreads?.nodes?.length ?? 0) >= PAGE_SIZE,
      items: unresolved,
    },
    verdict,
  };
}

/** The exit code a verdict implies: PASS 0, FAIL 1, PEND 3. */
export function exitCodeFor(verdict) {
  return verdict === "PASS" ? 0 : verdict === "FAIL" ? 1 : 3;
}

/**
 * The failing check runs worth a log fetch, at most `MAX_LOG_FETCHES`, in the order they appear.
 * @param {PrStatus} status
 */
export function checksToFetch(status) {
  return status.checks.items
    .filter((c) => c.kind === "check" && c.fetchLog && c.runId && c.jobId)
    .slice(0, MAX_LOG_FETCHES);
}

/**
 * A line without colour codes. `gh run view` can print the escape byte as the two characters `^[`,
 * so those are turned back first; `stripAnsi` (from `verdict-parse.mjs`) then removes the codes.
 * @param {string} line
 */
function plain(line) {
  return stripAnsi(line.replaceAll("^[[", "\u001b["));
}

/**
 * `gh run view --log-failed` lines look like `<job>\t<step>\t<timestamp> <text>`. Drop the prefix
 * and any colour codes, and the trailing blank lines.
 * @param {string} raw
 * @returns {string[]}
 */
export function cleanLog(raw) {
  const lines = raw
    .split("\n")
    .map((line) =>
      plain(line.replace(/\r$/, "")).replace(/^[^\t]*\t[^\t]*\t\S+ ?/, ""),
    );
  while (lines.length > 0 && lines.at(-1)?.trim() === "") lines.pop();
  return lines;
}

/** A job name as a file name: `Dox gates (changed pages, Chromium)` becomes `dox-gates-changed-pages-chromium`. */
export function jobSlug(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug === "" ? "job" : slug;
}

const SCREEN_INDENT = "        ";

/**
 * What to show of a failed job's log. `gh run view --job --log-failed` often cannot map steps, so
 * it returns the whole job and its last lines are cleanup. When the log has a `##[error]` line, the
 * view is anchored there: the step before the first one (from the previous `##[group]Run ` line) is
 * run through `parseLog`, and a recognised tool's failure lines are shown; otherwise the
 * `logLines` lines ending at that `##[error]` line. With no `##[error]`, the last `logLines` lines.
 * @param {string[]} rawLines
 * @param {{ logLines?: number, logPath?: string }} [options]
 * @returns {{ lines: string[], anchored: boolean, parsed: boolean }}
 */
export function viewFailure(
  rawLines,
  { logLines = DEFAULT_LOG_LINES, logPath } = {},
) {
  const lines = rawLines.map(plain);
  const errorAt = lines.findIndex((line) => line.startsWith("##[error]"));
  if (errorAt === -1) {
    return { lines: lines.slice(-logLines), anchored: false, parsed: false };
  }
  let groupAt = errorAt - 1;
  while (groupAt >= 0 && !lines[groupAt].startsWith("##[group]Run ")) groupAt--;
  const parsed = parseLog(lines.slice(groupAt + 1, errorAt).join("\n"));
  if (parsed.failures.length > 0) {
    return {
      lines: failureLines(parsed, { max: 5, logPath }),
      anchored: true,
      parsed: true,
    };
  }
  return {
    lines: lines.slice(Math.max(0, errorAt + 1 - logLines), errorAt + 1),
    anchored: true,
    parsed: false,
  };
}

/**
 * The screen. `logs` maps a job id to `{ lines, path }` (a fetched log) or `null` (not available);
 * a failing check run with no entry was not fetched (over the cap).
 * @param {PrStatus} status
 * @param {{ logs?: Record<string, { lines: string[], path: string } | null>, logLines?: number }} [options]
 * @returns {string} no trailing newline
 */
export function formatStatus(
  status,
  { logs = {}, logLines = DEFAULT_LOG_LINES } = {},
) {
  const { pr, checks, threads } = status;
  const out = [
    `PR #${pr.number} ${pr.title} (${pr.state.toLowerCase()}${pr.isDraft ? ", draft" : ""})  head ${pr.headRefOid.slice(0, 7)}`,
    `review: ${pr.reviewDecision ?? "none"} · merge state: ${pr.mergeStateStatus ?? "unknown"}`,
  ];

  const counts = [
    checks.failed > 0 ? `${checks.failed} failed` : "",
    checks.pending > 0 ? `${checks.pending} pending` : "",
    checks.passed > 0 ? `${checks.passed} passed` : "",
  ].filter(Boolean);
  out.push(
    `checks: ${checks.status}  ${counts.length > 0 ? counts.join(", ") : "none"}${checks.truncated ? "  (first 100 shown)" : ""}`,
  );
  for (const check of checks.items) {
    if (check.state === "PASS") continue;
    const ids =
      check.kind === "check" && check.runId
        ? `  run ${check.runId} · job ${check.jobId}`
        : "";
    out.push(`  ${check.state}  ${check.name}${ids}`.trimEnd());
    if (check.state !== "FAIL") continue;
    if (check.kind === "status") {
      if (check.url) out.push(`${SCREEN_INDENT}${check.url}`);
      continue;
    }
    const key = String(check.jobId);
    if (!check.fetchLog) {
      if (check.url) out.push(`${SCREEN_INDENT}${check.url}`);
    } else if (!(key in logs)) {
      out.push(
        `${SCREEN_INDENT}log not fetched (first ${MAX_LOG_FETCHES} failing jobs only)`,
      );
      if (check.url) out.push(`${SCREEN_INDENT}${check.url}`);
    } else if (logs[key] === null) {
      out.push(`${SCREEN_INDENT}log not available`);
      if (check.url) out.push(`${SCREEN_INDENT}${check.url}`);
    } else {
      const { lines, path } = logs[key];
      const view = viewFailure(lines, { logLines, logPath: path });
      for (const line of view.lines)
        out.push(`${SCREEN_INDENT}${line}`.trimEnd());
      const what = view.parsed
        ? "failures before the first ##[error]"
        : view.anchored
          ? `${view.lines.length} lines ending at the first ##[error]`
          : view.lines.length < lines.length
            ? `last ${logLines} lines`
            : null;
      out.push(
        `${SCREEN_INDENT}… (${what === null ? "" : `${what}; `}full log ${path})`,
      );
    }
  }

  out.push(
    `threads: ${threads.unresolved} unresolved, ${threads.waiting} waiting on you${threads.truncated ? "  (first 100 shown)" : ""}`,
  );
  for (const thread of threads.items) {
    const where = `${thread.path ?? "(no file)"}${thread.line ? `:${thread.line}` : ""}`;
    if (thread.answered) {
      out.push(
        `  DONE  ${where}  (last comment yours${thread.isOutdated ? ", outdated" : ""})`,
      );
      continue;
    }
    const comments = `${thread.commentCount} comment${thread.commentCount === 1 ? "" : "s"}${thread.isOutdated ? ", outdated" : ""}`;
    out.push(
      `  WAIT  ${where}  ${thread.firstAuthor ?? "unknown"} (${comments})`,
    );
    if (thread.quote) out.push(`${SCREEN_INDENT}"${thread.quote}"`);
    if (thread.url) out.push(`${SCREEN_INDENT}${thread.url}`);
  }

  out.push(`verdict: ${status.verdict}`);
  return out.join("\n");
}
