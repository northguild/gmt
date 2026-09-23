/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  compatGroups,
  groupLabel,
  groupSummary,
  groupsMissingDescription,
  groupsStillNeeded,
  probeTotals,
} from "./temporal-compat";

/**
 * The canary snapshot the `/upstream/` page reads.
 *
 * `pnpm compat:snapshot` writes it from the same probes `pnpm compat` runs, and
 * `temporal-compat.mjs snapshot --check` (wired into `validate`) fails when the committed copy has
 * drifted. These tests cover the shape the page depends on, and that every group the canary knows
 * about is present — a group silently missing would understate how much GMT still works around.
 */
describe("temporal compat snapshot", () => {
  it("has a row for every workaround group in the canary script", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "../../../../scripts/temporal-compat.mjs"),
      "utf8",
    );
    const declared = [...script.matchAll(/^\s*defects: \[([^\]]+)\],$/gm)].map(
      (m) =>
        m[1]
          .split(",")
          .map((id) => id.trim().replace(/^["']|["']$/g, ""))
          .join(" + "),
    );

    expect(declared.length).toBeGreaterThan(0);
    expect(compatGroups.map(groupLabel).sort()).toEqual(declared.sort());
  });

  it("counts probes that cannot exceed their group's total", () => {
    for (const group of compatGroups) {
      const label = groupLabel(group);
      expect(group.probes, label).toBeGreaterThan(0);
      expect(group.failing, label).toBeGreaterThanOrEqual(0);
      expect(group.failing, label).toBeLessThanOrEqual(group.probes);
    }
  });

  it("derives its totals from the rows", () => {
    expect(probeTotals.probes).toBe(
      compatGroups.reduce((n, g) => n + g.probes, 0),
    );
    expect(probeTotals.failing).toBe(
      compatGroups.reduce((n, g) => n + g.failing, 0),
    );
    expect(groupsStillNeeded).toBe(
      compatGroups.filter((g) => g.failing > 0).length,
    );
    expect(groupsStillNeeded).toBeLessThanOrEqual(compatGroups.length);
  });

  it("has a plain-language line for every group", () => {
    // The fallback is the canary's own wording, which names files and defect numbers because it is
    // written for whoever removes a workaround. A group without its own line would ship that to
    // readers without anyone noticing.
    expect(groupsMissingDescription).toEqual([]);
  });

  it("gives every group a label and a readable summary", () => {
    for (const group of compatGroups) {
      expect(groupLabel(group)).toMatch(/^[A-Za-z0-9.]+( \+ [A-Za-z0-9.]+)*$/);
      // The title reads "D1 — what goes wrong"; the summary is the half a reader needs.
      expect(groupSummary(group).length).toBeGreaterThan(10);
      expect(groupSummary(group)).not.toContain("—");
      expect(group.trigger.length).toBeGreaterThan(10);
    }
  });
});
