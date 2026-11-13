import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { GATES, inTier } from "./registry.mjs";

type Leg = { leg: string; slug: string; select: string };

const workflow = parseYaml(
  readFileSync(
    new URL("../../../../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  ),
) as {
  jobs: Record<string, { strategy?: { matrix?: { include?: Leg[] } } }>;
};
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
});
