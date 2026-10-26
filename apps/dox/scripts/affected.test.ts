import { describe, expect, it } from "vitest";
import {
  affected,
  ALL_CHECKS,
  assertRulesValid,
  CHECKS,
  RULES,
  uncovered,
} from "../../../scripts/lib/affected.mjs";

/** Every check but the named ones, in `CHECKS` order. */
const allBut = (...skip: string[]) =>
  ALL_CHECKS.filter((id: string) => !skip.includes(id));

describe("affected: which checks a change runs", () => {
  it.each([
    {
      name: "notes in context/ run nothing",
      changes: ["context/dox/built.md", "context/skills.md"],
      checks: [],
    },
    {
      name: "a changeset and an agent persona run nothing",
      changes: [".changeset/quiet-owls-sing.md", ".agents/finalizer.md"],
      checks: [],
    },
    {
      name: "a workflow other than ci.yml runs nothing",
      changes: [".github/workflows/canary.yml"],
      checks: [],
    },
    {
      name: "a tracker runs deps check",
      changes: ["context/domination/tracker.md"],
      checks: ["deps"],
    },
    {
      name: "CONTRIBUTING.md runs the Dox tests and the build they need",
      changes: ["CONTRIBUTING.md"],
      checks: ["build:gmt", "test:dox"],
    },
    {
      name: "an edited README runs stats, the API surface and the Dox tests",
      changes: [{ path: "README.md", status: "M" }],
      checks: ["build:gmt", "dox-pages", "stats", "api-surface", "test:dox"],
    },
    {
      name: "an edited Dox guide skips the listing checks",
      changes: [
        { path: "apps/dox/src/content/docs/guides/zones.mdx", status: "M" },
      ],
      checks: [
        "build:gmt",
        "dox-pages",
        "build:dox",
        "api-surface",
        "dox-dist",
        "typecheck:dox",
        "test:dox",
      ],
    },
    {
      name: "an added Dox guide also runs markers and stats",
      changes: [
        { path: "apps/dox/src/content/docs/guides/zones.mdx", status: "A" },
      ],
      checks: [
        "markers",
        "build:gmt",
        "dox-pages",
        "build:dox",
        "stats",
        "api-surface",
        "dox-dist",
        "typecheck:dox",
        "test:dox",
      ],
    },
    {
      name: "a bare path counts as added",
      changes: ["apps/dox/src/content/docs/guides/zones.mdx"],
      checks: [
        "markers",
        "build:gmt",
        "dox-pages",
        "build:dox",
        "stats",
        "api-surface",
        "dox-dist",
        "typecheck:dox",
        "test:dox",
      ],
    },
    {
      name: "an edited library test skips the Dox build",
      changes: [{ path: "packages/gmt/src/zone/zone.test.ts", status: "M" }],
      checks: [
        "markers",
        "build:gmt-oxlint",
        "build:gmt",
        "stats",
        "lint:gmt",
        "typecheck:gmt",
        "test:dox",
        "test:gmt",
      ],
    },
    {
      name: "library source runs all but deps, the Dox lint and the plugin's own checks",
      changes: [{ path: "packages/gmt/src/zone/zone.ts", status: "M" }],
      checks: allBut(
        "deps",
        "lint:dox",
        "typecheck:gmt-oxlint",
        "test:gmt-oxlint",
      ),
    },
    {
      name: "a repo script runs its own check and the Dox tests",
      changes: [{ path: "scripts/deps.mjs", status: "M" }],
      checks: ["deps", "build:gmt", "test:dox"],
    },
    {
      name: "a mixed change runs the union of its paths",
      changes: [
        "context/skills.md",
        { path: "context/domination/tracker.md", status: "M" },
        { path: "CONTRIBUTING.md", status: "M" },
        { path: "scripts/test-markers.mjs", status: "M" },
      ],
      checks: ["deps", "markers", "build:gmt", "test:dox"],
    },
    {
      name: "the DST guide's source runs the checks of the Dox page it becomes",
      changes: [{ path: "docs/dst-disambiguation.md", status: "M" }],
      checks: [
        "build:gmt",
        "dox-pages",
        "build:dox",
        "api-surface",
        "dox-dist",
        "typecheck:dox",
        "test:dox",
      ],
    },
    {
      name: "a Windows path matches like a POSIX one",
      changes: ["context\\domination\\tracker.md"],
      checks: ["deps"],
    },
  ])("$name", ({ changes, checks }) => {
    const result = affected(changes);
    expect(result.checks).toEqual(checks);
    expect(result.full).toBe(false);
  });

  it.each([
    { name: "the lockfile", path: "pnpm-lock.yaml" },
    { name: "the root package.json", path: "package.json" },
    {
      name: "a package's package.json",
      path: "packages/gmt-oxlint/package.json",
    },
    { name: "the CI workflow", path: ".github/workflows/ci.yml" },
    { name: "the rules themselves", path: "scripts/lib/affected.mjs" },
    { name: "the Node version", path: ".node-version" },
  ])("$name runs every check", ({ path }) => {
    const result = affected([{ path, status: "M" }]);
    expect(result.checks).toEqual(ALL_CHECKS);
    expect(result.full).toBe(true);
  });

  it("a path no rule names runs every check and says why", () => {
    const result = affected([{ path: "tools/new-thing.sh", status: "A" }]);
    expect(result.full).toBe(true);
    expect(result.reasons.get("test:gmt")).toEqual([
      "tools/new-thing.sh (no rule)",
    ]);
  });

  it("a notes change mixed with a toolchain change runs every check", () => {
    const result = affected([
      "context/skills.md",
      { path: "pnpm-lock.yaml", status: "M" },
    ]);
    expect(result.full).toBe(true);
  });

  it("names the check that brought in a build", () => {
    const result = affected([{ path: "CONTRIBUTING.md", status: "M" }]);
    expect(result.reasons.get("build:gmt")).toEqual(["needed by test:dox"]);
    expect(result.reasons.get("test:dox")).toEqual(["CONTRIBUTING.md"]);
  });

  it("brings in a build that a build needs", () => {
    const result = affected([{ path: "docs/guide.md", status: "M" }]);
    expect(result.reasons.get("build:gmt")).toContain("needed by build:dox");
  });

  it("marks a deleted file's extra checks as deleted", () => {
    const result = affected([
      { path: "apps/dox/src/content/docs/guides/old.mdx", status: "D" },
    ]);
    expect(result.reasons.get("stats")).toEqual([
      "apps/dox/src/content/docs/guides/old.mdx (deleted)",
    ]);
  });
});

describe("affected: the rules and checks are well formed", () => {
  it("every rule and every need names a check that exists", () => {
    expect(() => assertRulesValid()).not.toThrow();
  });

  it("no check id appears twice", () => {
    expect(new Set(ALL_CHECKS).size).toBe(CHECKS.length);
  });

  it("every rule's listed checks add something its checks do not", () => {
    for (const rule of RULES) {
      if (!rule.listed) continue;
      expect(
        rule.listed.some((id: string) => !rule.checks.includes(id)),
        String(rule.test),
      ).toBe(true);
    }
  });
});

describe("uncovered: reads the rules miss", () => {
  const guide = "apps/dox/src/content/docs/guides/zones.mdx";
  const tracked = [
    "README.md",
    guide,
    "apps/dox/src/content/docs/guides/dst.mdx",
  ];

  it("a read the file's rule names is covered", () => {
    expect(uncovered(new Map([["stats", ["R README.md"]]]), tracked)).toEqual(
      [],
    );
  });

  it("a read the file's rule does not name is a miss", () => {
    expect(
      uncovered(new Map([["lint:gmt", ["R README.md"]]]), tracked),
    ).toEqual([{ check: "lint:gmt", path: "README.md", via: "reads" }]);
  });

  it("a folder listing is covered by the rule's listed checks", () => {
    const traces = new Map([
      ["stats", ["D apps/dox/src/content/docs/guides/"]],
    ]);
    expect(uncovered(traces, tracked)).toEqual([]);
  });

  it("a folder listing misses each file whose rule names neither list", () => {
    const traces = new Map([
      ["lint:dox", ["D apps/dox/src/content/docs/guides"]],
    ]);
    const via = "lists apps/dox/src/content/docs/guides";
    expect(uncovered(traces, tracked)).toEqual([
      { check: "lint:dox", path: guide, via },
      {
        check: "lint:dox",
        path: "apps/dox/src/content/docs/guides/dst.mdx",
        via,
      },
    ]);
  });

  it("a stat is covered by the rule's listed checks", () => {
    const traces = new Map([["markers", [`S ${guide}`]]]);
    expect(uncovered(traces, tracked)).toEqual([]);
  });

  it("a stat the file's rule names in neither list is a miss", () => {
    const traces = new Map([["lint:dox", [`S ${guide}`]]]);
    expect(uncovered(traces, tracked)).toEqual([
      { check: "lint:dox", path: guide, via: "stats" },
    ]);
  });

  it("reads of untracked files and of files with no rule are ignored", () => {
    const traces = new Map([
      ["lint:gmt", ["R apps/dox/dist/index.html", "R tools/new-thing.sh"]],
    ]);
    expect(uncovered(traces, [...tracked, "tools/new-thing.sh"])).toEqual([]);
  });

  it("the same read twice is reported once", () => {
    const traces = new Map([["lint:gmt", ["R README.md", "R README.md"]]]);
    expect(uncovered(traces, tracked)).toHaveLength(1);
  });
});
