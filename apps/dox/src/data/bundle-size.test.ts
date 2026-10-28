import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import report from "../generated/bundle-size.json";

const budgets = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "..",
      "scripts",
      "bundle-size.budgets.json",
    ),
    "utf8",
  ),
) as { entries: Record<string, { minified: number }> };

type Row = { minified: number; gzipped: number; budget: number | null };
const entries = report.entries as Record<string, Row>;

describe("the bundle-size figures", () => {
  it("name the budgeted entries and the floor, and no others", () => {
    expect(Object.keys(entries).sort()).toEqual(
      [...Object.keys(budgets.entries), report.floor].sort(),
    );
  });

  it("carry the budget the repository's file states", () => {
    for (const [name, row] of Object.entries(entries)) {
      expect(row.budget, name).toBe(budgets.entries[name]?.minified ?? null);
    }
  });

  it("keep every budgeted entry within its budget", () => {
    for (const [name, row] of Object.entries(entries)) {
      if (row.budget === null) continue;
      expect(row.minified, name).toBeLessThanOrEqual(row.budget);
    }
  });

  it("measure the floor as the smallest entry", () => {
    const floor = entries[report.floor].minified;
    for (const [name, row] of Object.entries(entries)) {
      expect(row.minified, name).toBeGreaterThanOrEqual(floor);
    }
  });
});
