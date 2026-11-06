import {
  compatGroups,
  engineLabel,
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

/** The middle cell: the state badge, and the count. */
const stateCell = (row: string): string => row.split(/(?<!\\)\|/)[2]!.trim();

describe("<UpstreamDefects /> as Markdown", () => {
  it("renders one row for every group in the snapshot", () => {
    expect(rows).toHaveLength(compatGroups.length);
    compatGroups.forEach((group, i) => {
      expect(rows[i], groupLabel(group)).toContain(`**${groupLabel(group)}**`);
    });
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
        "out-of-scope": `✓ Yes, on ${(group.engines ?? []).map(engineLabel).join(" and ")}`,
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
      "Polyfill 1.0.8 is newer (tc39/proposal-temporal#3292), so it passes.";
    expect(escapeMarkdownInline(text)).toBe(text);
  });

  it("escapes a backslash once, so an escape it adds is not itself escaped again", () => {
    expect(escapeMarkdownInline("a\\*b")).toBe("a\\\\\\*b");
  });
});

describe("<UpstreamDefects /> free text as Markdown", () => {
  it("escapes every what-breaks cell the way the helper does", () => {
    compatGroups.forEach((group, i) => {
      expect(rows[i]).toContain(
        `**${escapeMarkdownInline(groupLabel(group))}** — ${escapeMarkdownInline(groupWhatBreaks(group))} |`,
      );
    });
  });
});
