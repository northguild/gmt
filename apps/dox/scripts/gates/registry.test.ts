import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { distDirOrSkip } from "../dist-dir";
import {
  GATES,
  inputIndex,
  inTier,
  SAMPLE,
  scriptIndex,
  TIERS,
} from "./registry.mjs";

const SCRIPTS = path.resolve(import.meta.dirname, "..");
const DOX = path.resolve(SCRIPTS, "..");

describe("the gate registry", () => {
  it("has unique ids, a known tier, and a script that exists", () => {
    const ids = GATES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const gate of GATES) {
      expect(TIERS).toContain(gate.tier);
      expect(existsSync(path.join(SCRIPTS, gate.script)), gate.script).toBe(
        true,
      );
      expect([null, "gpu", "baseline"]).toContain(gate.needs);
    }
  });

  it("nests the tiers: pr < weekly < local", () => {
    const at = (tier: string) =>
      GATES.filter((g) => inTier(g, tier)).map((g) => g.id);
    expect(at("pr")).toEqual([
      "contrast-measure",
      "grow-measure",
      "readout-still",
      "data-credits-check",
      "esc-cascade",
      "hero-phone",
      "sound-check",
      "rail-stored-still",
      "canada-layout-check",
      "frame-check",
      "slides-check",
      "a11y-axe",
      "a11y-tab-walk",
      "a11y-media",
    ]);
    expect(at("weekly")).toEqual([
      ...at("pr"),
      "canada-clock-still",
      "canada-stored-still",
      "table-fit",
      "plate-fit",
      "sky-orbits-fresh",
    ]);
    expect(at("local")).toHaveLength(GATES.length);
  });

  it("maps every script file to its gate", () => {
    expect(scriptIndex()["visual-snapshot.mjs"]).toBe("visual-diff");
    expect(Object.keys(scriptIndex())).toHaveLength(GATES.length);
    // Every data file a gate reads names a gate that exists.
    for (const gate of Object.values(inputIndex())) {
      expect(GATES.map((g) => g.id)).toContain(gate);
    }
  });

  it("lists sample pages that exist in a built dist", () => {
    const dist = distDirOrSkip();
    if (!dist) return;
    for (const page of SAMPLE) {
      expect(existsSync(path.join(dist, "gmt", page, "index.html")), page).toBe(
        true,
      );
    }
  });
});

// `a11y-tab-walk` lists a subset of the built pages, `table-fit` lists the built pages that hold a
// table and `plate-fit` lists the built tool pages, so
// without `dist` each exits 2 before it reads a flag: its list fails, and its unknown-page case
// passes for the wrong reason.
const LISTS_FROM_DIST = new Set(["a11y-tab-walk", "table-fit", "plate-fit"]);

// Each gate answers the page contract without a browser: a JSON list of site paths, and an unknown
// page is a usage error (exit 2), so a typo never passes as an empty run.
describe.each(GATES.filter((g) => g.pages !== "dist"))(
  "the page contract of $id",
  (gate) => {
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [path.join(SCRIPTS, gate.script), ...args], {
        cwd: DOX,
        encoding: "utf8",
        env: { ...process.env, GATE_REPORT: "" },
      });
    const unbuilt = () => LISTS_FROM_DIST.has(gate.id) && !distDirOrSkip();

    it("answers --list-pages with a non-empty array of site paths", () => {
      if (unbuilt()) return;
      const r = run("--list-pages");
      expect(r.status).toBe(0);
      const pages: string[] = JSON.parse(r.stdout);
      expect(pages.length).toBeGreaterThan(0);
      for (const p of pages) expect(p).toMatch(/^\/(?:[^/]+\/)*$/);
      expect(new Set(pages).size).toBe(pages.length);
    });

    it("rejects an unknown --pages path with exit 2", () => {
      if (unbuilt()) return;
      const r = run("--pages", "/no/such/page/");
      expect(r.status).toBe(2);
    });

    // A costed gate's shards are dealt by these minutes, and a page with no cost stops the runner,
    // so every listed page carries one; any other gate refuses the flag rather than answer `{}`.
    it(`answers --list-page-costs ${gate.costs ? "with a positive cost for every page" : "with exit 2"}`, () => {
      if (unbuilt()) return;
      const r = run("--list-page-costs");
      if (!gate.costs) {
        expect(r.status).toBe(2);
        return;
      }
      expect(r.status).toBe(0);
      const costs: Record<string, number> = JSON.parse(r.stdout);
      const pages: string[] = JSON.parse(run("--list-pages").stdout);
      expect(Object.keys(costs).sort()).toEqual([...pages].sort());
      for (const [page, minutes] of Object.entries(costs))
        expect(minutes, page).toBeGreaterThan(0);
    });
  },
);

describe("the tier name", () => {
  it("refuses the retired nightly tier with a usage error", () => {
    const r = spawnSync(
      process.execPath,
      [path.join(SCRIPTS, "gates.mjs"), "--plan", "--tier", "nightly"],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("--tier is one of pr, weekly, local");
  });
});
