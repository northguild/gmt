import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatStatus,
  planStatus,
} from "../../../../scripts/lib/pr-status-plan.mjs";

/**
 * Slice 7 of #396: the screen, line for line. Fixtures are real responses (see `plan.test.ts`);
 * the mixed screen at the end is a synthetic edit of one, named as such.
 */

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const load = (name: string) =>
  JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")).data;
const screen = (name: string, options?: Parameters<typeof formatStatus>[1]) =>
  formatStatus(planStatus(load(name))!, options).split("\n");

describe("formatStatus", () => {
  it("prints a green merged PR on four lines and a verdict", () => {
    expect(screen("green-395")).toEqual([
      "PR #395 test(gmt): give every test a title of its own (#391) (merged)  head 97aa9d3",
      "review: APPROVED · merge state: UNKNOWN",
      "checks: PASS  39 passed",
      "threads: 0 unresolved, 0 waiting on you",
      "verdict: PASS",
    ]);
  });

  it("prints failed jobs with a log tail, a missing log with its URL, and a closed PR's state", () => {
    const lines = screen("failed-closed-350", {
      logLines: 2,
      logs: {
        "120336870371": {
          lines: ["step one", "step two", "step three"],
          path: ".verdict/pr-350/story-consistency.log",
        },
        "120337937039": null,
      },
    });
    expect(lines).toEqual([
      "PR #350 feat(dox): the Morocco 2026 clock-change checker (CORE-89) (closed, draft)  head 5ff63bc",
      "review: REVIEW_REQUIRED · merge state: BLOCKED",
      "checks: FAIL  2 failed, 37 passed",
      "  FAIL  Story consistency  run 39930358774 · job 120336870371",
      "        step two",
      "        step three",
      "        … (last 2 lines; full log .verdict/pr-350/story-consistency.log)",
      "  FAIL  Tests (Node 24)  run 39930358774 · job 120337937039",
      "        log not available",
      "        https://github.com/northguild/gmt/actions/runs/39930358774/job/120337937039",
      "threads: 0 unresolved, 0 waiting on you",
      "verdict: FAIL",
    ]);
  });

  it("prints pending checks and threads the viewer answered", () => {
    expect(screen("pending-answered-399")).toEqual([
      "PR #399 chore(domination): narrow the Space stories and add the industry timestamp format stories (open)  head 1bbd3de",
      "review: none · merge state: BLOCKED",
      "checks: PEND  2 pending",
      "  PEND  Determine affected packages  run 40317423053 · job 121553411882",
      "  PEND  No machine trailers  run 40317423053 · job 121553412406",
      "threads: 8 unresolved, 0 waiting on you",
      "  DONE  context/domination/issues/FIN-96.md:53  (last comment yours, outdated)",
      "  DONE  context/domination/issues/IOT-101.md:82  (last comment yours)",
      "  DONE  context/domination/issues/HLTH-94.md:65  (last comment yours)",
      "  DONE  context/domination/issues/HLTH-93.md:37  (last comment yours, outdated)",
      "  DONE  context/domination/issues/AV-97.md:13  (last comment yours, outdated)",
      "  DONE  context/domination/issues/HLTH-93.md:19  (last comment yours, outdated)",
      "  DONE  context/domination/issues/RAI-100.md:75  (last comment yours, outdated)",
      "  DONE  context/domination/issues/HLTH-94.md:37  (last comment yours, outdated)",
      "verdict: PEND",
    ]);
  });

  it("prints a waiting thread with its author, first line and URL", () => {
    const lines = screen("unanswered-edited-399");
    expect(lines.slice(5, 10)).toEqual([
      "threads: 8 unresolved, 1 waiting on you",
      "  DONE  context/domination/issues/FIN-96.md:53  (last comment yours, outdated)",
      "  WAIT  context/domination/issues/IOT-101.md:82  craig-o-curtis (1 comment)",
      '        "Why not keep the old name?"',
      "        https://github.com/northguild/gmt/pull/399#discussion_r4376663364",
    ]);
    expect(lines.at(-1)).toBe("verdict: FAIL");
  });

  it("tails a failing job up to its first error, not its cleanup", () => {
    const fixture = JSON.parse(
      readFileSync(join(FIXTURES, "log-tests-node-24-350.json"), "utf8"),
    );
    const lines = screen("failed-closed-350", {
      logLines: 3,
      logs: {
        "120336870371": null,
        "120337937039": {
          lines: fixture.lines,
          path: ".verdict/pr-350/tests-node-24.log",
        },
      },
    });
    const at = lines.findIndex((l) => l.includes("job 120337937039"));
    expect(lines.slice(at, at + 5)).toEqual([
      "  FAIL  Tests (Node 24)  run 39930358774 · job 120337937039",
      '          × "pnpm recursive run" failed in /home/runner/work/gmt/gmt/apps/dox',
      "",
      "        ##[error]Process completed with exit code 1.",
      "        … (3 lines ending at the first ##[error]; full log .verdict/pr-350/tests-node-24.log)",
    ]);
  });

  it("prints a failing status context, a job over the log cap and a full page of checks", () => {
    // Synthetic edit of the green fixture: one status context, one failed job, 100 contexts and a
    // next page.
    const data = load("green-395");
    const contexts =
      data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup
        .contexts;
    contexts.pageInfo = { hasNextPage: true };
    const nodes = contexts.nodes;
    const passing = nodes[0];
    nodes.length = 0;
    for (let i = 0; i < 98; i++) nodes.push(passing);
    nodes.push(
      {
        __typename: "StatusContext",
        context: "ci/legacy",
        state: "FAILURE",
        targetUrl: "https://example.test/legacy",
      },
      {
        __typename: "CheckRun",
        name: "Tests (node 24)",
        status: "COMPLETED",
        conclusion: "FAILURE",
        detailsUrl: "https://example.test/job",
        databaseId: 7,
        checkSuite: { workflowRun: { databaseId: 8 } },
      },
    );
    expect(formatStatus(planStatus(data)!).split("\n")).toEqual([
      "PR #395 test(gmt): give every test a title of its own (#391) (merged)  head 97aa9d3",
      "review: APPROVED · merge state: UNKNOWN",
      "checks: FAIL  2 failed, 98 passed  (first 100 shown)",
      "  FAIL  ci/legacy",
      "        https://example.test/legacy",
      "  FAIL  Tests (node 24)  run 8 · job 7",
      "        log not fetched (first 3 failing jobs only)",
      "        https://example.test/job",
      "threads: 0 unresolved, 0 waiting on you",
      "verdict: FAIL",
    ]);
  });
});
