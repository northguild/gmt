import { compatGroups, groupLabel } from "../data/temporal-compat";
import { renderMdxComponents } from "./mdx-jsx";

/**
 * The Markdown twin of the `/upstream/` table (`.md`, `llms.txt`, retrieval chunks).
 *
 * It reads each group's `state` from the snapshot through `stateLine`, the same helper the HTML
 * row uses. These tests compare the rendered rows with the snapshot's rows, so they name no defect
 * and hard-code no count.
 */
const rows = renderMdxComponents("<UpstreamDefects />")
  .split("\n")
  .filter((line) => line.startsWith("| **"));

/** The middle cell: the state badge, the count and, on a guard row, the reason. */
const stateCell = (row: string): string => row.split(/(?<!\\)\|/)[2]!.trim();

describe("<UpstreamDefects /> as Markdown", () => {
  it("renders one row for every group in the snapshot", () => {
    expect(rows).toHaveLength(compatGroups.length);
    compatGroups.forEach((group, i) => {
      expect(rows[i], groupLabel(group)).toContain(`**${groupLabel(group)}**`);
    });
  });

  it("shows 'Kept on purpose' on exactly the guard rows, each with its reason", () => {
    const guards = compatGroups.filter((g) => g.state === "guard");
    const kept = rows.filter((row) => row.includes("Kept on purpose"));
    expect(kept).toHaveLength(guards.length);
    for (const group of guards) {
      const row = rows[compatGroups.indexOf(group)]!;
      expect(row, groupLabel(group)).toContain("Kept on purpose");
      expect(row, groupLabel(group)).toContain(
        group.guard!.reason.replaceAll("|", "\\|"),
      );
      expect(stateCell(row)).toBe(
        `Kept on purpose — ${group.probes} of ${group.probes} checks pass. ${group.guard!.reason.replaceAll("|", "\\|")}`,
      );
    }
  });

  it("shows '✓ Yes' on exactly the still-needed rows and 'No' on exactly the removable ones", () => {
    const count = (state: string) =>
      compatGroups.filter((g) => g.state === state).length;
    expect(rows.filter((r) => r.includes("✓ Yes"))).toHaveLength(
      count("still-needed"),
    );
    expect(rows.filter((r) => stateCell(r).startsWith("No"))).toHaveLength(
      count("removable"),
    );
  });

  it("follows the state, not the probe counts", () => {
    compatGroups.forEach((group, i) => {
      const cell = stateCell(rows[i]!);
      const expected = {
        "still-needed": "✓ Yes",
        removable: "No",
        guard: "Kept on purpose",
      }[group.state];
      expect(cell.startsWith(`${expected} — `), groupLabel(group)).toBe(true);
    });
  });

  it("keeps every row to four unescaped pipes", () => {
    for (const row of rows) {
      expect(row.replaceAll("\\|", "").split("|").length - 1, row).toBe(4);
    }
  });
});
