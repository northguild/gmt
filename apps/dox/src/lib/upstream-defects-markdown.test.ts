import {
  compatGroups,
  groupLabel,
  groupWhatBreaks,
} from "../data/temporal-compat";
import { escapeMarkdownInline, renderMdxComponents } from "./mdx-jsx";

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

  it("shows '✓ Yes' on exactly the still-needed and out-of-scope rows and 'No' on exactly the removable ones", () => {
    const count = (state: string) =>
      compatGroups.filter((g) => g.state === state).length;
    expect(rows.filter((r) => r.includes("✓ Yes"))).toHaveLength(
      count("still-needed") + count("out-of-scope"),
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
        "out-of-scope": "✓ Yes, on Firefox",
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

describe("escapeMarkdownInline", () => {
  it.each`
    char    | name
    ${"*"}  | ${"asterisk"}
    ${"_"}  | ${"underscore"}
    ${"["}  | ${"opening bracket"}
    ${"]"}  | ${"closing bracket"}
    ${"`"}  | ${"backtick"}
    ${"<"}  | ${"less-than"}
    ${"\\"} | ${"backslash"}
    ${"|"}  | ${"pipe"}
    ${"&"}  | ${"ampersand"}
    ${"~"}  | ${"tilde"}
  `("puts a backslash before a $name", ({ char }) => {
    expect(escapeMarkdownInline(`a${char}b`)).toBe(`a\\${char}b`);
  });

  it("leaves plain prose, digits, parentheses, dots and # alone", () => {
    const text =
      "Polyfill 0.5.1 is older (tc39/proposal-temporal#3292), so it passes.";
    expect(escapeMarkdownInline(text)).toBe(text);
  });

  it("escapes a backslash once, so an escape it adds is not itself escaped again", () => {
    expect(escapeMarkdownInline("a\\*b")).toBe("a\\\\\\*b");
  });
});

describe("<UpstreamDefects /> free text as Markdown", () => {
  it("leaves every real guard reason unchanged apart from its pipes", () => {
    for (const g of compatGroups.filter((g) => g.guard)) {
      expect(escapeMarkdownInline(g.guard!.reason)).toBe(
        g.guard!.reason.replaceAll("|", "\\|"),
      );
    }
  });

  it("escapes Markdown in a guard reason", () => {
    const hostile = "a*b_c[d](e) `f` <g> h\\i | j";
    const guard = compatGroups.find((g) => g.guard)!;
    const saved = guard.guard!.reason;
    try {
      guard.guard!.reason = hostile;
      const row = renderMdxComponents("<UpstreamDefects />")
        .split("\n")
        .filter((line) => line.startsWith("| **"))[
        compatGroups.indexOf(guard)
      ]!;
      expect(stateCell(row)).toContain(escapeMarkdownInline(hostile));
      expect(row).not.toContain(hostile);
    } finally {
      guard.guard!.reason = saved;
    }
  });

  it("escapes every what-breaks cell the way the helper does", () => {
    compatGroups.forEach((group, i) => {
      expect(rows[i]).toContain(
        `**${escapeMarkdownInline(groupLabel(group))}** — ${escapeMarkdownInline(groupWhatBreaks(group))} |`,
      );
    });
  });
});
