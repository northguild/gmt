import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { GATES, inTier } from "./registry.mjs";

type Leg = {
  leg: string;
  slug: string;
  select: string;
  "step-limit": number;
  deadline: number;
};
type Workflow = {
  jobs: Record<
    string,
    {
      "timeout-minutes"?: number;
      strategy?: { matrix?: { include?: Leg[] } };
      steps?: { name?: string; run?: string; env?: Record<string, string> }[];
    }
  >;
};

const read = (file: string) =>
  parseYaml(
    readFileSync(
      new URL(`../../../../.github/workflows/${file}`, import.meta.url),
      "utf8",
    ),
  ) as Workflow;
const workflow = read("ci.yml");
const weekly = read("dox-gates-weekly.yml");
const legs = workflow.jobs["dox-gates"]?.strategy?.matrix?.include ?? [];
const prGates = GATES.filter((g) => inTier(g, "pr")).map((g) => g.id);

/** The gates one leg's `select` runs, as the runner reads `--only` and `--skip`. */
function gatesOf(select: string): string[] {
  const [flag, list = ""] = select.trim().split(/\s+/);
  const names = list.split(",").filter(Boolean);
  if (flag === "--only") return names;
  if (flag === "--skip") return prGates.filter((id) => !names.includes(id));
  throw new Error(`leg select "${select}" is neither --only nor --skip`);
}

describe("the Dox gates legs in ci.yml", () => {
  it("has legs with distinct slugs", () => {
    expect(legs.length).toBeGreaterThan(0);
    expect(new Set(legs.map((l) => l.slug)).size).toBe(legs.length);
  });

  it("runs every pr-tier gate in exactly one leg", () => {
    const runs = new Map<string, string[]>(prGates.map((id) => [id, []]));
    for (const leg of legs) {
      for (const id of gatesOf(leg.select)) {
        if (!runs.has(id)) {
          throw new Error(`leg "${leg.slug}" names "${id}", not a pr gate`);
        }
        runs.get(id)!.push(leg.slug);
      }
    }
    for (const [id, where] of runs) expect(where, id).toHaveLength(1);
  });

  it("stops each leg's runner before its gate step's limit", () => {
    const step = workflow.jobs["dox-gates"]?.steps?.find((s) =>
      s.run?.includes("--deadline ${{ matrix.deadline }}"),
    );
    expect(step).toBeDefined();
    for (const leg of legs) {
      expect(leg.deadline, leg.slug).toBeLessThan(leg["step-limit"]);
    }
  });
});

describe("the weekly sweep legs", () => {
  // Measured minutes per engine (tier-6-ops, "The weekly gate sweep") divided by these counts leave
  // about 20 minutes of headroom under the 80-minute deadline.
  it("run 8 Chromium, 5 Firefox and 5 WebKit legs", () => {
    const matrix = (weekly.jobs.sweep?.strategy?.matrix?.include ??
      []) as unknown as { browser: string }[];
    const count = (browser: string) =>
      matrix.filter((m) => m.browser === browser).length;
    expect([count("chromium"), count("firefox"), count("webkit")]).toEqual([
      8, 5, 5,
    ]);
    expect(matrix).toHaveLength(18);
  });

  it("stop their runner at least 5 minutes inside the job's timeout", () => {
    const sweep = weekly.jobs.sweep;
    const run = sweep?.steps?.find((s) => s.run?.includes("gates --all"))?.run;
    const deadline = Number(/--deadline (\d+)/.exec(run ?? "")?.[1]);
    expect(deadline).toBeGreaterThan(0);
    expect(deadline).toBeLessThanOrEqual((sweep?.["timeout-minutes"] ?? 0) - 5);
  });

  // The report names every leg so one that crashed without uploading is still filed, and each
  // browser's shards must cover its pages exactly once.
  it("are named in the report's LEGS list, each browser's shards running 1 to n", () => {
    const matrix = (weekly.jobs.sweep?.strategy?.matrix?.include ??
      []) as unknown as { leg: string; browser: string; shard: string }[];
    const listed = weekly.jobs.report?.steps
      ?.find((s) => s.env?.LEGS)
      ?.env?.LEGS.split(",");
    expect(listed).toEqual(matrix.map((m) => m.leg));
    for (const browser of new Set(matrix.map((m) => m.browser))) {
      const shards = matrix
        .filter((m) => m.browser === browser)
        .map((m) => m.shard);
      const n = shards.length;
      expect(shards, browser).toEqual(
        Array.from({ length: n }, (_, i) => `${i + 1}/${n}`),
      );
      for (const m of matrix.filter((l) => l.browser === browser))
        expect(m.leg).toBe(`${browser}-${m.shard.split("/")[0]}`);
    }
  });
});
