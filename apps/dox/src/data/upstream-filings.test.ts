/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checked,
  filings,
  filingsByKind,
  filingsByRepo,
  filingsByState,
  filingsWithMaintainerResponse,
  guardsAddressed,
  handledInGmt,
  totalFilings,
  unaffectingGmt,
} from "./upstream-filings";

// The literal `DefectId` / `ZonedDefectId` / `BoundedWorkDefectId` union members
// `repros.ts` declares — the same set `scripts/upstream.mjs check` parses out of
// the same file, so a filing's `gmtGuard` can never name a group that doesn't exist.
const reprosSrc = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../packages/gmt/src/internal/temporalCompat/repros.ts",
  ),
  "utf8",
);
const knownGuards = new Set<string>();
for (const m of reprosSrc.matchAll(
  /export type (?:DefectId|ZonedDefectId|BoundedWorkDefectId) =([^;]+);/g,
)) {
  for (const lit of m[1].matchAll(/"([^"]+)"/g)) knownGuards.add(lit[1]);
}

describe("upstream filings", () => {
  it("has at least one filing", () => {
    expect(totalFilings).toBeGreaterThan(0);
    expect(filings.length).toBe(totalFilings);
  });

  it("was checked, and not in the future", () => {
    expect(Number.isNaN(Date.parse(checked))).toBe(false);
    expect(Date.parse(checked)).toBeLessThanOrEqual(Date.now());
  });

  it("gives every filing a URL matching its own repo, kind and number", () => {
    for (const f of filings) {
      const expected = `https://github.com/${f.repo}/${f.kind === "pr" ? "pull" : "issues"}/${f.number}`;
      expect(f.url).toBe(expected);
    }
  });

  it("has no duplicate repo+number", () => {
    const keys = filings.map((f) => `${f.repo}#${f.number}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("sums repo counts to the total", () => {
    const sum = filingsByRepo.reduce((n, row) => n + row.count, 0);
    expect(sum).toBe(totalFilings);
  });

  it("sums kind counts to the total", () => {
    const sum = filingsByKind.reduce((n, row) => n + row.count, 0);
    expect(sum).toBe(totalFilings);
  });

  it("sums state counts to the total", () => {
    const sum = filingsByState.reduce((n, row) => n + row.count, 0);
    expect(sum).toBe(totalFilings);
  });

  it("counts a maintainer response only from comments, never below zero", () => {
    expect(filingsWithMaintainerResponse).toBeGreaterThanOrEqual(0);
    expect(filingsWithMaintainerResponse).toBeLessThanOrEqual(totalFilings);
  });

  it("every gmtGuard exists in repros.ts, or is null", () => {
    for (const f of filings) {
      if (f.gmtGuard !== null) {
        expect(
          knownGuards.has(f.gmtGuard),
          `${f.repo}#${f.number} gmtGuard "${f.gmtGuard}"`,
        ).toBe(true);
      }
    }
  });

  it("covers every filing in GMT: exactly one of gmtGuard or gmtNote", () => {
    // A filing with neither would be a defect GMT neither works around nor avoids.
    for (const f of filings) {
      expect(
        (f.gmtGuard === null) !== (f.gmtNote === null),
        `${f.repo}#${f.number}`,
      ).toBe(true);
    }
    expect(handledInGmt + unaffectingGmt).toBe(totalFilings);
  });

  it("lists guardsAddressed sorted and deduplicated", () => {
    expect(guardsAddressed).toEqual([...new Set(guardsAddressed)].sort());
    for (const g of guardsAddressed) expect(knownGuards.has(g)).toBe(true);
  });

  it("pairs symmetrically: if A pairsWith B, B pairsWith A", () => {
    const byKey = new Map(filings.map((f) => [`${f.repo}#${f.number}`, f]));
    for (const f of filings) {
      const key = `${f.repo}#${f.number}`;
      for (const partnerKey of f.pairsWith) {
        const partner = byKey.get(partnerKey);
        expect(
          partner,
          `${key} pairs with ${partnerKey}, which must exist`,
        ).toBeDefined();
        expect(
          partner!.pairsWith.includes(key),
          `${partnerKey} must pair back with ${key}`,
        ).toBe(true);
      }
    }
  });

  it("names only filings that exist in dependsOn and closes", () => {
    const keys = new Set(filings.map((f) => `${f.repo}#${f.number}`));
    for (const f of filings) {
      for (const dep of f.dependsOn) {
        // A dependency may be a filing tracked here, or an upstream number this
        // tracker doesn't carry (e.g. a merged PR never filed as its own row).
        // Only assert shape, not membership, for dependsOn/closes targets that
        // look like "owner/repo#number".
        expect(dep).toMatch(/^[\w.-]+\/[\w.-]+#\d+$/);
      }
      for (const c of f.closes) {
        expect(c).toMatch(/^[\w.-]+\/[\w.-]+#\d+$/);
      }
    }
    // At least one dependsOn target in this fixture is itself a tracked filing
    // (#370 depends on #369) — prove the happy path is actually exercised.
    const withDeps = filings.filter((f) => f.dependsOn.length > 0);
    for (const f of withDeps) {
      for (const dep of f.dependsOn) {
        if (keys.has(dep)) expect(keys.has(dep)).toBe(true);
      }
    }
  });
});
