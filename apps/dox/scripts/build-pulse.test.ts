import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  buildPulse,
  checkDrift,
  OVERVIEW_END,
  OVERVIEW_PATH,
  OVERVIEW_START,
  overviewTable,
  readWorkflow,
  refreshRuns,
  syncedOverview,
} from "./build-pulse.mjs";

type Check = Parameters<typeof overviewTable>[0] extends infer T
  ? T extends readonly (infer C)[]
    ? C
    : never
  : never;

const WORKFLOW = `name: Fixture weekly

# Pulse check: fixture

on:
  workflow_dispatch:
  schedule:
    - cron: "17 6 * * 1"

jobs:
  canary:
    name: The canary
    runs-on: ubuntu-latest
`;

const CHECK = {
  id: "fixture",
  name: "Fixture",
  area: "temporal",
  source: ".github/workflows/fixture.yml",
  job: "canary",
  watches: "A thing.",
  finds: "Opens an issue.",
  life: { kind: "workarounds", groups: "all" },
  story: "CORE-1",
} as unknown as Check;

const GROUPS = [{ defects: ["D1"] }, { defects: ["D2", "D3"] }];

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

/** A repo-shaped folder with one scheduled workflow and the overview table in sync. */
function fixtureRoot(
  files: Record<string, string> = {},
  checks: readonly Check[] = [CHECK],
): string {
  const root = mkdtempSync(join(tmpdir(), "pulse-"));
  dirs.push(root);
  const all: Record<string, string> = {
    ".github/workflows/fixture.yml": WORKFLOW,
    [OVERVIEW_PATH]: `# Overview\n\n${OVERVIEW_START}\n${OVERVIEW_END}\n`,
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  const overview = join(root, OVERVIEW_PATH);
  const synced = syncedOverview(readFileSync(overview, "utf8"), checks);
  if (synced !== null) writeFileSync(overview, synced);
  return root;
}

describe("pulse: the real list matches the repo", () => {
  it("reports no drift", () => {
    expect(checkDrift()).toEqual([]);
  });

  it("joins every check to a card, with the cron and jobs the workflow file says", () => {
    const data = buildPulse();
    const ids = data.cards.flatMap((c: { checkIds: string[] }) => c.checkIds);
    expect(ids.sort()).toEqual(
      data.checks.map((c: { id: string }) => c.id).sort(),
    );
    const oracle = data.cards.find(
      (c: { file: string }) => c.file === "temporal-oracle.yml",
    );
    expect(oracle?.crons).toHaveLength(1);
    expect(oracle?.jobs.map((j: { id: string }) => j.id)).toContain("oracle");
  });
});

describe("pulse: the drift check", () => {
  it("passes on a fixture where list, workflow, tag and groups agree", () => {
    const root = fixtureRoot();
    expect(
      checkDrift({ root, checks: [CHECK], workarounds: GROUPS as never }),
    ).toEqual([]);
  });

  it("fails when a scheduled workflow has no entry", () => {
    const root = fixtureRoot({
      ".github/workflows/other.yml": WORKFLOW.replace("fixture", "other"),
    });
    const problems = checkDrift({
      root,
      checks: [CHECK],
      workarounds: GROUPS as never,
    });
    expect(problems.join("\n")).toMatch(/other\.yml runs on a schedule/);
  });

  it("fails when an entry is deleted from the list", () => {
    const root = fixtureRoot();
    const problems = checkDrift({
      root,
      checks: [],
      workarounds: GROUPS as never,
    });
    expect(problems.join("\n")).toMatch(/fixture\.yml runs on a schedule/);
  });

  it("fails when the source loses its Pulse check line", () => {
    const root = fixtureRoot({
      ".github/workflows/fixture.yml": WORKFLOW.replace(
        "# Pulse check: fixture\n",
        "",
      ),
    });
    const problems = checkDrift({
      root,
      checks: [CHECK],
      workarounds: GROUPS as never,
    });
    expect(problems.join("\n")).toMatch(/no "Pulse check: fixture" line/);
  });

  it("fails when a workaround group is claimed by no check", () => {
    const root = fixtureRoot();
    const partial = {
      ...CHECK,
      life: { kind: "workarounds", groups: ["D1"] },
    } as Check;
    const problems = checkDrift({
      root,
      checks: [partial],
      workarounds: GROUPS as never,
    });
    expect(problems.join("\n")).toMatch(
      /group D2 \+ D3 is claimed by no check/,
    );
  });

  it("fails when a check claims a group that does not exist", () => {
    const root = fixtureRoot();
    const wrong = {
      ...CHECK,
      life: { kind: "workarounds", groups: ["D9"] },
    } as Check;
    const problems = checkDrift({
      root,
      checks: [wrong],
      workarounds: GROUPS as never,
    });
    expect(problems.join("\n")).toMatch(/claims workaround group D9/);
  });

  it("fails when a job named by an entry is not in the workflow", () => {
    const root = fixtureRoot();
    const wrong = { ...CHECK, job: "missing" } as Check;
    const problems = checkDrift({
      root,
      checks: [wrong],
      workarounds: GROUPS as never,
    });
    expect(problems.join("\n")).toMatch(/has no job missing/);
  });

  it("fails on retirement prose left in a source file", () => {
    const root = fixtureRoot({
      ".github/workflows/fixture.yml": WORKFLOW.replace(
        "# Pulse check: fixture\n",
        "# Pulse check: fixture\n# Retire this workflow when it is done.\n",
      ),
    });
    const problems = checkDrift({
      root,
      checks: [CHECK],
      workarounds: GROUPS as never,
    });
    expect(problems.join("\n")).toMatch(/describes when it retires/);
  });

  it("fails on a canary script and a canary test no entry names", () => {
    const root = fixtureRoot({
      "scripts/canary/extra.mjs": "// a canary\n",
      "apps/dox/src/lib/extra-canary.test.ts": "// a canary\n",
    });
    const text = checkDrift({
      root,
      checks: [CHECK],
      workarounds: GROUPS as never,
    }).join("\n");
    expect(text).toMatch(/scripts\/canary\/extra\.mjs is a canary script/);
    expect(text).toMatch(/extra-canary\.test\.ts is a canary test/);
  });

  it("fails when the overview table is stale", () => {
    const root = fixtureRoot();
    writeFileSync(
      join(root, OVERVIEW_PATH),
      `# Overview\n\n${OVERVIEW_START}\nold\n${OVERVIEW_END}\n`,
    );
    const problems = checkDrift({
      root,
      checks: [CHECK],
      workarounds: GROUPS as never,
    });
    expect(problems.join("\n")).toMatch(/out of date: run pnpm pulse:sync/);
  });
});

describe("pulse: the workflow reader", () => {
  it("reads the name, the schedules and the jobs", () => {
    const root = fixtureRoot();
    expect(readWorkflow(root, ".github/workflows/fixture.yml")).toEqual({
      name: "Fixture weekly",
      crons: ["17 6 * * 1"],
      jobs: [{ id: "canary", name: "The canary" }],
    });
  });
});

describe("pulse: the overview table", () => {
  it("writes one row per check between the markers and is stable", () => {
    const once = syncedOverview(`a\n${OVERVIEW_START}\n${OVERVIEW_END}\nb\n`, [
      CHECK,
    ]);
    expect(once).toContain("| Fixture | `fixture.yml` job `canary` |");
    expect(syncedOverview(once as string, [CHECK])).toBe(once);
  });

  it("returns null when the markers are missing", () => {
    expect(syncedOverview("no markers", [CHECK])).toBeNull();
  });
});

describe("pulse: run history", () => {
  const RUN = {
    conclusion: "success",
    startedAt: "2026-11-09T06:20:00Z",
    url: "u",
  };

  /** Reads the history into a fixture folder with everything injected: no network, no clock. */
  async function read(
    options: Partial<Parameters<typeof refreshRuns>[0]> = {},
  ): Promise<{ result: string; file: string; logs: string[] }> {
    const root = fixtureRoot();
    const file = join(root, "runs.json");
    const logs: string[] = [];
    const result = await refreshRuns({
      root,
      checks: [CHECK],
      file,
      env: {},
      stamp: async () => "2026-11-14T10:00:00Z",
      ageOf: () => Infinity,
      clock: () => 0,
      log: (line: string) => logs.push(line),
      gh: async () => [RUN],
      ...options,
    });
    return { result, file, logs };
  }

  it("writes the runs of each scheduled workflow with the time they were read", async () => {
    const { result, file } = await read();
    expect(result).toBe("read");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      runsRead: "2026-11-14T10:00:00Z",
      workflows: { "fixture.yml": [RUN] },
    });
  });

  it("leaves a workflow's runs null when the call fails", async () => {
    const { file } = await read({
      gh: async () => {
        throw new Error("HTTP 404");
      },
    });
    expect(
      JSON.parse(readFileSync(file, "utf8")).workflows["fixture.yml"],
    ).toBeNull();
  });

  it("skips while the file is under six hours old, unless forced", async () => {
    expect((await read({ ageOf: () => 1000 })).result).toBe("fresh");
    expect(
      (await read({ ageOf: () => 1000, env: { PULSE_REFRESH: "force" } }))
        .result,
    ).toBe("read");
    expect(
      (await read({ ageOf: () => 1000, env: { CI: "true" } })).result,
    ).toBe("read");
  });

  it("reads nothing, and says so, when the library is not built", async () => {
    const { result, logs } = await read({ stamp: async () => null });
    expect(result).toBe("skipped");
    expect(logs.join()).toMatch(/not built/);
  });

  it("gives up with a warning when the budget is spent", async () => {
    let now = 0;
    const { result, logs } = await read({
      clock: () => {
        const t = now;
        now += 20_000;
        return t;
      },
    });
    expect(result).toBe("failed");
    expect(logs.join()).toMatch(/budget/);
  });
});
