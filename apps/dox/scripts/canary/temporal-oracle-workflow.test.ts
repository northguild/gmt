import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";

import {
  NATIVE_LEGS,
  SWAP_LEGS,
} from "../../../../scripts/lib/canary-issues.mjs";
import {
  LEG_BROWSER,
  LEG_HOST,
} from "../../../../scripts/lib/native-suite-compat.mjs";

// The workflow and the scripts list the same legs, and the report job reads every leg's artifact.

type Row = { leg: string; browser?: string; os: string };
type Step = { name?: string; run?: string };
type Job = {
  strategy: { matrix: { include?: Row[]; leg?: string[] } };
  steps: Step[];
};

const text = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../.github/workflows/temporal-oracle.yml",
  ),
  "utf8",
);
const jobs = (parse(text) as { jobs: Record<string, Job> }).jobs;
const rows = jobs["native-suite"].strategy.matrix.include ?? [];
const hostOf = LEG_HOST as Record<string, string>;
const browserOf = LEG_BROWSER as Record<string, string>;

function step(job: string, name: string): string {
  const found = jobs[job].steps.find((s) => s.name === name);
  if (!found?.run) throw new Error(`no step "${name}" in ${job}`);
  return found.run;
}

/** The first `awk -F'\t' -v run="${RUN_ID}' '...'` program of a script. */
function firstAwkProgram(run: string): string {
  const start = run.indexOf(`awk -F'\\t' -v run="\${RUN_ID}" '`);
  if (start < 0) throw new Error("no awk program");
  const open = run.indexOf("'", run.indexOf("-v run=", start) + 1) + 1;
  return run.slice(open, run.indexOf("'", open));
}

describe("native-suite matrix", () => {
  it("lists the legs of NATIVE_LEGS, in order", () => {
    expect(rows.map((r) => r.leg)).toEqual(NATIVE_LEGS);
  });

  it.each(NATIVE_LEGS.map((leg: string) => ({ leg })))(
    "row '$leg' installs the browser LEG_BROWSER names",
    ({ leg }) => {
      const row = rows.find((r) => r.leg === leg);
      expect(row?.browser).toBe(browserOf[leg]);
    },
  );

  it.each(NATIVE_LEGS.map((leg: string) => ({ leg })))(
    "row '$leg' runs on the host LEG_HOST requires",
    ({ leg }) => {
      const row = rows.find((r) => r.leg === leg);
      expect(row?.os).toBe(
        hostOf[leg] === "darwin" ? "macos-latest" : "ubuntu-latest",
      );
    },
  );
});

describe("polyfill-swap matrix", () => {
  it("keeps the four SWAP_LEGS", () => {
    expect(jobs["polyfill-swap"].strategy.matrix.leg).toEqual(SWAP_LEGS);
  });
});

describe("report job artifact parse", () => {
  const t = "2026-01-05T06:20:00Z";
  const input = [
    `Native Temporal suite (webkit-macos)\t${t}`,
    `Native Temporal suite (webkit)\t${t}`,
    `Temporal polyfill swap (webkit)\t${t}`,
    `Native Temporal oracle\t${t}`,
    "",
  ].join("\n");

  it("maps each job name to its artifact name", () => {
    const program = firstAwkProgram(step("report", "Download verdicts"));
    const out = spawnSync("awk", ["-F", "\t", "-v", "run=123", program], {
      input,
      encoding: "utf8",
    });
    expect(out.stdout.trim().split("\n")).toEqual([
      `native-suite-webkit-macos-123 ${t}`,
      `native-suite-webkit-123 ${t}`,
      `temporal-polyfill-swap-webkit-123 ${t}`,
      `temporal-oracle-123 ${t}`,
    ]);
  });
});

describe("native-suite resource trace", () => {
  const run = step("native-suite", "Native suite");

  it("uses no GNU-only df option", () => {
    expect(run).not.toContain("--output");
  });

  it("calls free only behind command -v free", () => {
    const calls = run.split("\n").filter((l) => /\bfree -m\b/.test(l));
    expect(calls).toHaveLength(1);
    expect(run).toContain("command -v free");
    expect(run.indexOf("command -v free")).toBeLessThan(run.indexOf("free -m"));
  });
});
