import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildQuery,
  checksToFetch,
  cleanLog,
  exitCodeFor,
  extractPullRequest,
  formatStatus,
  jobSlug,
  planStatus,
  viewFailure,
} from "../../../../scripts/lib/pr-status-plan.mjs";

/**
 * Slice 7 of #396: the pure planner behind `scripts/pr-status.mjs`. The fixtures are real responses
 * to the query `buildQuery` returns (northguild/gmt); `unanswered-edited-399.json` has one field
 * edited and says so in its `_fixture` header. Synthetic edits made in a test are named as such.
 */

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const load = (name: string) =>
  JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")).data;

/** A response whose last commit has these extra contexts appended (synthetic edit). */
function withContexts(name: string, extra: object[]) {
  const data = load(name);
  const contexts =
    data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup
      .contexts;
  contexts.nodes.push(...extra);
  return data;
}

const run = (over: object) => ({
  __typename: "CheckRun",
  name: "job",
  status: "COMPLETED",
  conclusion: "SUCCESS",
  detailsUrl: "https://example.test/job",
  databaseId: 11,
  checkSuite: { workflowRun: { databaseId: 22 } },
  ...over,
});

describe("buildQuery", () => {
  it("only reads, and asks for the fields the spec lists", () => {
    for (const by of ["number", "branch"] as const) {
      const query = buildQuery(by);
      expect(query).not.toMatch(/mutation/i);
      expect(query).toContain("viewer { login }");
      expect(query).toContain("statusCheckRollup");
      expect(query).toContain("reviewThreads(first: 100)");
      // Truncation is read, not guessed, and a thread's last comment is asked for by name.
      expect(query.match(/pageInfo \{ hasNextPage \}/g)).toHaveLength(2);
      expect(query).toContain("latest: comments(last: 1)");
      expect(query).toContain("latestReviews(first: 20)");
    }
    expect(buildQuery("branch")).toContain(
      "pullRequests(headRefName: $branch, states: OPEN, first: 1)",
    );
  });
});

describe("check states", () => {
  it.each([
    [{ conclusion: "SUCCESS" }, "PASS"],
    [{ conclusion: "NEUTRAL" }, "PASS"],
    [{ conclusion: "SKIPPED" }, "PASS"],
    [{ conclusion: "FAILURE" }, "FAIL"],
    [{ conclusion: "TIMED_OUT" }, "FAIL"],
    [{ conclusion: "CANCELLED" }, "FAIL"],
    [{ conclusion: "STARTUP_FAILURE" }, "FAIL"],
    [{ status: "QUEUED", conclusion: null }, "PEND"],
    [{ status: "IN_PROGRESS", conclusion: null }, "PEND"],
    [{ status: "WAITING", conclusion: null }, "PEND"],
    [{ status: "PENDING", conclusion: null }, "PEND"],
    [{ status: "COMPLETED", conclusion: null }, "PEND"],
  ])("maps %j to %s", (over, expected) => {
    const data = withContexts("green-395", [run(over)]);
    const status = planStatus(data)!;
    expect(status.checks.items.at(-1)!.state).toBe(expected);
  });

  it("maps the failing check runs of a real response, with run and job ids", () => {
    const status = planStatus(load("failed-closed-350"))!;
    expect(status.checks).toMatchObject({
      status: "FAIL",
      failed: 2,
      pending: 0,
      passed: 37,
      total: 39,
      truncated: false,
    });
    expect(status.checks.items.filter((c: any) => c.state === "FAIL")).toEqual([
      expect.objectContaining({
        name: "Story consistency",
        runId: 39930358774,
        jobId: 120336870371,
        fetchLog: true,
      }),
      expect.objectContaining({
        name: "Tests (Node 24)",
        runId: 39930358774,
        jobId: 120337937039,
      }),
    ]);
  });

  it("counts a failing StatusContext, which has no log, with its target URL", () => {
    const data = withContexts("green-395", [
      {
        __typename: "StatusContext",
        context: "ci/legacy",
        state: "FAILURE",
        targetUrl: "https://example.test/legacy",
      },
      {
        __typename: "StatusContext",
        context: "ci/error",
        state: "ERROR",
        targetUrl: null,
      },
      {
        __typename: "StatusContext",
        context: "ci/wait",
        state: "PENDING",
        targetUrl: null,
      },
      {
        __typename: "StatusContext",
        context: "ci/ok",
        state: "SUCCESS",
        targetUrl: null,
      },
    ]);
    const status = planStatus(data)!;
    expect(status.checks).toMatchObject({ failed: 2, pending: 1, passed: 40 });
    expect(status.checks.items.at(-4)).toEqual({
      kind: "status",
      name: "ci/legacy",
      state: "FAIL",
      url: "https://example.test/legacy",
    });
    expect(status.verdict).toBe("FAIL");
    expect(checksToFetch(status)).toEqual([]);
  });

  it("fetches at most three logs, and only for the conclusions the spec names", () => {
    const data = withContexts("green-395", [
      run({ name: "a", conclusion: "FAILURE", databaseId: 1 }),
      run({ name: "b", conclusion: "TIMED_OUT", databaseId: 2 }),
      run({ name: "c", conclusion: "CANCELLED", databaseId: 3 }),
      run({ name: "d", conclusion: "STARTUP_FAILURE", databaseId: 4 }),
      run({ name: "e", conclusion: "ACTION_REQUIRED", databaseId: 5 }),
    ]);
    const status = planStatus(data)!;
    expect(status.checks.failed).toBe(5);
    expect(checksToFetch(status).map((c: any) => c.name)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("flags checks past the page, and never passes on the 100 it read", () => {
    // Synthetic edit: 100 passing checks and a next page.
    const many = Array.from({ length: 100 }, (_, i) => run({ databaseId: i }));
    const data = load("green-395");
    const contexts =
      data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup
        .contexts;
    contexts.nodes = many;
    expect(planStatus(data)!.checks).toMatchObject({
      truncated: false,
      status: "PASS",
    });
    contexts.pageInfo = { hasNextPage: true };
    const status = planStatus(data)!;
    expect(status.checks).toMatchObject({ truncated: true, status: "PEND" });
    expect(status.verdict).toBe("PEND");
  });

  it("reads a commit with no rollup as no checks yet, which is pending", () => {
    // Right after a push, before CI registers a check run.
    const data = load("green-395");
    data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup =
      null;
    const status = planStatus(data)!;
    expect(status.checks).toMatchObject({ total: 0, status: "PEND" });
    expect(status.verdict).toBe("PEND");
    expect(formatStatus(status).split("\n")[2]).toBe("checks: PEND  none yet");
  });
});

describe("threads", () => {
  it("skips resolved threads and counts unresolved ones answered by the viewer as done", () => {
    const status = planStatus(load("pending-answered-399"))!;
    expect(status.viewer).toBe("baldurpan");
    expect(status.threads).toMatchObject({
      unresolved: 8,
      waiting: 0,
      truncated: false,
    });
    expect(status.threads.items.every((t: any) => t.answered)).toBe(true);
  });

  it("shows an outdated thread, flagged, and falls back to originalLine", () => {
    const status = planStatus(load("pending-answered-399"))!;
    const outdated = status.threads.items.filter((t: any) => t.isOutdated);
    expect(outdated).toHaveLength(6);
    expect(status.threads.items[0]).toMatchObject({
      path: "context/domination/issues/FIN-96.md",
      line: 53,
      isOutdated: true,
    });
  });

  it("leaves a thread whose last comment is not the viewer's waiting, with first line and URL", () => {
    const status = planStatus(load("unanswered-edited-399"))!;
    expect(status.threads).toMatchObject({ unresolved: 8, waiting: 1 });
    expect(status.threads.items.find((t: any) => !t.answered)).toEqual({
      path: "context/domination/issues/IOT-101.md",
      line: 82,
      isOutdated: false,
      commentCount: 1,
      firstAuthor: "craig-o-curtis",
      quote: "Why not keep the old name?",
      url: expect.stringContaining("/pull/399#discussion_r"),
      answered: false,
    });
  });

  it("orders comments by createdAt as an ISO string, not by array order", () => {
    const data = load("unanswered-edited-399");
    const thread = data.repository.pullRequest.reviewThreads.nodes.find(
      (t: any) => !t.isResolved && t.path.endsWith("IOT-101.md"),
    );
    // Synthetic edit: a later reply by the viewer arrives first in the array.
    thread.comments.nodes.unshift({
      author: { login: "baldurpan" },
      body: "Fixed.",
      createdAt: "2999-01-01T00:00:00Z",
      url: "u",
    });
    const item = planStatus(data)!.threads.items.find((t: any) =>
      t.path.endsWith("IOT-101.md"),
    );
    expect(item!.answered).toBe(true);
    expect(item!.firstAuthor).toBe("craig-o-curtis");
  });

  it("judges a long thread by its latest comment and counts all of them", () => {
    // Synthetic edit in the live query's shape: the first comment, the last in `latest`, and a
    // total past what one page of comments would hold.
    const data = load("unanswered-edited-399");
    const thread = data.repository.pullRequest.reviewThreads.nodes.find(
      (t: any) => !t.isResolved && t.path.endsWith("IOT-101.md"),
    );
    thread.comments.totalCount = 75;
    thread.latest = {
      nodes: [
        {
          author: { login: "baldurpan" },
          body: "Fixed.",
          createdAt: "2999-01-01T00:00:00Z",
          url: "u",
        },
      ],
    };
    const item = planStatus(data)!.threads.items.find((t: any) =>
      t.path.endsWith("IOT-101.md"),
    );
    expect(item).toMatchObject({
      answered: true,
      commentCount: 75,
      firstAuthor: "craig-o-curtis",
    });
  });

  it("never passes with threads past the page", () => {
    // Synthetic edit: every check passed and no thread waits, but a next page of threads is unread.
    const data = load("green-395");
    data.repository.pullRequest.reviewThreads.pageInfo = { hasNextPage: true };
    const status = planStatus(data)!;
    expect(status.threads.truncated).toBe(true);
    expect(status.verdict).toBe("PEND");
  });

  it("quotes only the first line of the first comment, cut at 100 characters", () => {
    const data = load("unanswered-edited-399");
    const thread = data.repository.pullRequest.reviewThreads.nodes.find(
      (t: any) => !t.isResolved && t.path.endsWith("IOT-101.md"),
    );
    thread.comments.nodes[0].body = `${"x".repeat(150)}\nsecond`;
    const item = planStatus(data)!.threads.items.find((t: any) =>
      t.path.endsWith("IOT-101.md"),
    );
    expect(item!.quote).toBe("x".repeat(100));
  });
});

describe("verdict", () => {
  it("is PASS with every check passed and nothing waiting", () => {
    const status = planStatus(load("green-395"))!;
    expect(status.verdict).toBe("PASS");
    expect(exitCodeFor(status.verdict)).toBe(0);
  });

  it("is PEND with a check running and nothing failed or waiting", () => {
    const status = planStatus(load("pending-answered-399"))!;
    expect(status.verdict).toBe("PEND");
    expect(exitCodeFor(status.verdict)).toBe(3);
  });

  it("is FAIL for a failed check", () => {
    const status = planStatus(load("failed-closed-350"))!;
    expect(status.verdict).toBe("FAIL");
    expect(exitCodeFor(status.verdict)).toBe(1);
  });

  it("is FAIL for an unanswered thread even while checks are pending", () => {
    expect(planStatus(load("unanswered-edited-399"))!.verdict).toBe("FAIL");
  });

  it("is FAIL when a failed check sits beside a pending one", () => {
    const data = withContexts("failed-closed-350", [
      run({ status: "IN_PROGRESS", conclusion: null }),
    ]);
    const status = planStatus(data)!;
    expect(status.checks).toMatchObject({
      status: "FAIL",
      failed: 2,
      pending: 1,
    });
    expect(status.verdict).toBe("FAIL");
  });
});

describe("branch lookup", () => {
  it("finds the pull request in the pullRequests(headRefName:) shape", () => {
    const data = load("branch-399");
    expect(data.repository.pullRequest).toBeUndefined();
    expect(extractPullRequest(data)).toBe(
      data.repository.pullRequests.nodes[0],
    );
    const status = planStatus(data)!;
    expect(status.pr).toMatchObject({
      number: 399,
      state: "OPEN",
      isDraft: false,
    });
    expect(status.viewer).toBe("baldurpan");
  });

  it("finds the pull request in the pullRequest(number:) shape", () => {
    expect(planStatus(load("green-395"))!.pr).toMatchObject({
      number: 395,
      state: "MERGED",
    });
  });

  it("returns null when the branch has no open pull request", () => {
    expect(planStatus(load("branch-none"))).toBeNull();
    expect(planStatus({ repository: { pullRequest: null } })).toBeNull();
  });
});

describe("log helpers", () => {
  it("strips the job, step and timestamp prefix and trailing blank lines", () => {
    const raw = [
      "Tests\tRun tests\t2026-10-25T10:00:00.0000000Z FAIL src/a.test.ts",
      "Tests\tRun tests\t2026-10-25T10:00:01.0000000Z \u001b[31mexpected 1\u001b[0m",
      "Tests\tRun tests\t2026-10-25T10:00:02.0000000Z",
      "",
    ].join("\n");
    expect(cleanLog(raw)).toEqual(["FAIL src/a.test.ts", "expected 1"]);
  });

  it("slugs a job name into a file name", () => {
    expect(jobSlug("Dox gates (changed pages, Chromium)")).toBe(
      "dox-gates-changed-pages-chromium",
    );
    expect(jobSlug("???")).toBe("job");
  });
});

describe("viewFailure", () => {
  const fixture = JSON.parse(
    readFileSync(join(FIXTURES, "log-tests-node-24-350.json"), "utf8"),
  );
  const lines: string[] = fixture.lines;
  const group = (name: string) => `##[group]Run ${name}`;

  it("ends the tail at the first ##[error] line, not at the cleanup after it", () => {
    const view = viewFailure(lines, { logLines: 30, logPath: "x.log" });
    expect(view.lines).toHaveLength(30);
    expect(view.lines.at(-1)).toBe(
      "##[error]Process completed with exit code 1.",
    );
    expect(view.lines.join("\n")).toContain("[ELIFECYCLE] Test failed");
    expect(view.lines.join("\n")).not.toContain("mkdir -p artifact");
    expect(view.anchored).toBe(true);
  });

  it("strips ANSI escape sequences", () => {
    expect(lines.join("\n")).toContain("^[[");
    const view = viewFailure(lines, { logLines: 30, logPath: "x.log" });
    expect(view.lines.join("\n")).not.toContain("\u001b");
    expect(view.lines.join("\n")).toContain("Tests  12655 passed (12655)");
  });

  it("strips real escape bytes too", () => {
    const view = viewFailure(["\u001b[31mred\u001b[39m"], {
      logLines: 5,
      logPath: "x.log",
    });
    expect(view.lines).toEqual(["red"]);
  });

  it("anchors at the first of several ##[error] lines", () => {
    const view = viewFailure(
      ["a", "##[error]first", "b", "##[error]second", "c"],
      { logLines: 2, logPath: "x.log" },
    );
    expect(view.lines).toEqual(["a", "##[error]first"]);
  });

  it("keeps the last lines when the log has no ##[error] line", () => {
    const view = viewFailure(["a", "b", "c", "d"], {
      logLines: 2,
      logPath: "x.log",
    });
    expect(view.lines).toEqual(["c", "d"]);
    expect(view.anchored).toBe(false);
  });

  it("shows the parsed failures when the step before the error is a recognised tool", () => {
    const vitest = readFileSync(
      join(dirname(FIXTURES), "..", "verdict", "fixtures", "vitest-fail.log"),
      "utf8",
    ).split("\n");
    const view = viewFailure(
      [
        "noise",
        group("pnpm test"),
        ...vitest,
        "##[error]Process completed with exit code 1.",
        "cleanup",
      ],
      { logLines: 30, logPath: "x.log" },
    );
    expect(view.parsed).toBe(true);
    expect(view.lines[0]).toContain("scratch-fail.test.ts");
    expect(view.lines.join("\n")).not.toContain("noise");
    expect(view.lines.join("\n")).not.toContain("cleanup");
  });

  it("falls back to the anchored tail when the tool is not recognised", () => {
    const view = viewFailure(lines, { logLines: 5, logPath: "x.log" });
    expect(view.parsed).toBe(false);
    expect(view.lines).toHaveLength(5);
  });
});
