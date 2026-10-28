import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { distDirOrSkip } from "../dist-dir";
import {
  GATES,
  inTier,
  inputIndex,
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

  it("nests the tiers: pr < nightly < local", () => {
    const at = (tier: string) =>
      GATES.filter((g) => inTier(g, tier)).map((g) => g.id);
    expect(at("pr")).toEqual([
      "contrast-measure",
      "grow-measure",
      "readout-still",
      "data-credits-check",
      "canada-layout-check",
      "a11y-axe",
      "a11y-tab-walk",
      "a11y-media",
    ]);
    expect(at("nightly")).toEqual([
      ...at("pr"),
      "canada-clock-still",
      "canada-stored-still",
      "table-fit",
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

// `a11y-tab-walk` lists a subset of the built pages and `table-fit` lists the built pages that hold
// a table, so without `dist` each exits 2 before it reads a flag: its list fails, and its
// unknown-page case passes for the wrong reason.
const LISTS_FROM_DIST = new Set(["a11y-tab-walk", "table-fit"]);

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
  },
);
