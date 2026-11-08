import { describe, expect, it } from "vitest";

import { planMeta, storyIdOf } from "../../../../scripts/lib/pr-meta-plan.mjs";

/** The pure planner behind `scripts/pr-meta.mjs`. Branches and paths are from merged northguild/gmt PRs. */

const TRACKERS = {
  "context/dox/tracker.md": "| DOX-G6 | Done | #448 |\n",
  "context/domination/tracker.md":
    "| SPA-46 | Done | #227 |\n| CORE-105 | Done | #437 |\n",
};

const facts = (over: Partial<Parameters<typeof planMeta>[0]>) => ({
  branch: "x",
  subjects: [],
  paths: [],
  closingIssues: [],
  trackers: TRACKERS,
  milestones: ["Dox", "Domination", "Ultimation"],
  viewer: "craig-o-curtis",
  author: null,
  collaborators: ["baldurpan", "craig-o-curtis"],
  ...over,
});

describe("storyIdOf", () => {
  it.each([
    ["448-dox-g6-research-and-improve-how-search-engines", "DOX-G6"],
    ["feature/227-spa-46-tai64-text-labels", "SPA-46"],
    ["core-109-hero-sun-one-camera", "CORE-109"],
    ["437-core-105-split-zonedwallclockdiffere", "CORE-105"],
    ["447-featdox-unify-entrance-of-gmt-docs-w", null],
    ["chore/add-worktree-config", null],
    ["release/2026-11-03", null],
  ])("%s → %s", (branch, id) => {
    expect(storyIdOf(branch)).toBe(id);
  });
});

describe("planMeta labels", () => {
  it("reads commit types and paths, as #476 (feat, library, Intent skills, docs) was labelled", () => {
    const plan = planMeta(
      facts({
        branch: "feature/227-spa-46-tai64-text-labels",
        subjects: [
          "feat(domination): TAI64N text labels, toTai64n and fromTai64n (SPA-46)",
        ],
        paths: [
          "packages/gmt/src/timescale/convert/toTai64n.ts",
          "packages/gmt/skills/gmt-timescale/SKILL.md",
          "context/domination/tracker.md",
          "apps/dox/src/content/docs/guides/tai64.mdx",
        ],
      }),
    );
    expect(plan.labels).toEqual([
      "documentation",
      "enhancement",
      "gmt",
      "skills",
    ]);
  });

  it("labels workflows pipes, tooling gmt monorepo and agent files ai skills, as #439 was", () => {
    const plan = planMeta(
      facts({
        branch: "chore/add-release-skill",
        subjects: ["chore: add the release skill"],
        paths: [
          ".agents/skills/release/SKILL.md",
          "AGENTS.md",
          ".github/workflows/release.yml",
          "scripts/changelog.mjs",
        ],
      }),
    );
    expect(plan.labels).toEqual(["ai skills", "gmt monorepo", "pipes"]);
  });

  it("counts Dox build scripts as tooling, not documentation", () => {
    const plan = planMeta(
      facts({
        paths: [
          "apps/dox/scripts/pr-meta/plan.test.ts",
          "apps/dox/src/pages/index.astro",
        ],
      }),
    );
    expect(plan.labels).toEqual(["documentation", "gmt monorepo"]);
    expect(
      planMeta(facts({ paths: ["apps/dox/scripts/build-guides.mjs"] })).labels,
    ).toEqual(["gmt monorepo"]);
  });

  it("gives a fix bug, and a breaking feat! enhancement", () => {
    expect(
      planMeta(facts({ subjects: ["fix(dox): one option per unit"] })).labels,
    ).toEqual(["bug"]);
    expect(
      planMeta(facts({ subjects: ["feat(gmt)!: split the type"] })).labels,
    ).toEqual(["enhancement"]);
  });

  it("gives a release branch only `release`, whatever it touches", () => {
    const plan = planMeta(
      facts({
        branch: "release/2026-11-03",
        subjects: ["release: v1.21.0"],
        paths: ["packages/gmt/CHANGELOG.md"],
      }),
    );
    expect(plan.labels).toEqual(["release"]);
  });
});

describe("planMeta milestone", () => {
  it("takes the closed issue's milestone first", () => {
    const plan = planMeta(
      facts({
        branch: "448-dox-g6-x",
        closingIssues: [
          { number: 456, milestone: null },
          { number: 448, milestone: "Dox" },
        ],
      }),
    );
    expect([plan.milestone, plan.milestoneFrom]).toEqual(["Dox", "#448"]);
  });

  it("falls back to the tracker that holds the story's row", () => {
    const plan = planMeta(
      facts({
        branch: "437-core-105-split",
        closingIssues: [{ number: 437, milestone: null }],
      }),
    );
    expect([plan.milestone, plan.milestoneFrom]).toEqual([
      "Domination",
      "context/domination/tracker.md",
    ]);
  });

  it("is none for a branch with no story and no milestoned issue", () => {
    expect(
      planMeta(facts({ branch: "chore/add-worktree-config" })).milestone,
    ).toBeNull();
  });

  it("leaves off a milestone that is not open", () => {
    const plan = planMeta(
      facts({
        closingIssues: [{ number: 1, milestone: "Dox" }],
        milestones: ["Domination"],
      }),
    );
    expect(plan.milestone).toBeNull();
    expect(plan.milestoneFrom).toContain("not an open milestone");
  });
});

describe("planMeta reviewer", () => {
  it("asks the other collaborator: baldurpan for the viewer's new PR", () => {
    expect(planMeta(facts({})).reviewers).toEqual(["baldurpan"]);
  });

  it("follows the PR's author, not the viewer, once the PR exists", () => {
    expect(planMeta(facts({ author: "baldurpan" })).reviewers).toEqual([
      "craig-o-curtis",
    ]);
  });
});
