import plugin from "@northguild/gmt-oxlint";
import { describe, expect, it } from "vitest";
import { LINT_RULES, byRule, findingsOf, lintCode } from "./agent-lint";

describe("lintCode", () => {
  it("reports each rule the plugin raises, at its line, in line order", () => {
    const code = [
      "const zone = 'Europe/Helsinki';",
      "const at = new Date('2027-03-28T03:30:00');", // date-ban: lint fixture
      "const wait = at.getTime() - Date.now();", // date-ban: lint fixture
    ].join("\n");
    expect(lintCode([{ id: "answer", code }]).get("answer")).toEqual([
      { rule: "no-new-date", line: 2 },
      { rule: "no-date-now", line: 3 },
    ]);
  });

  it("flags Date.now beside Temporal, and leaves code with no Date clean", () => {
    const found = lintCode([
      {
        id: "temporal",
        code: "const at = Temporal.Now.instant();\nconst ms = Date.now();", // date-ban: lint fixture
      },
      { id: "string", code: 'const utc = "2027-03-28T00:30:00.000Z";' },
    ]);
    expect(found.get("temporal")).toEqual([{ rule: "no-date-now", line: 2 }]);
    expect(found.get("string")).toEqual([]);
  });

  it("flags importing a Date library", () => {
    expect(
      lintCode([{ id: "moment", code: 'import moment from "moment";' }]).get(
        "moment",
      ),
    ).toEqual([{ rule: "no-date-library-imports", line: 1 }]);
  });
});

describe("findingsOf", () => {
  it("keeps only the plugin's rules", () => {
    const report = {
      diagnostics: [
        {
          code: "eslint(no-unused-vars)",
          filename: "a.js",
          labels: [{ span: { line: 1 } }],
        },
        {
          code: `${plugin.meta.name}(no-date-utc)`,
          filename: "a.js",
          labels: [{ span: { line: 4 } }],
        },
      ],
    };
    expect(findingsOf(report, ["a.js", "b.js"])).toEqual(
      new Map([
        ["a.js", [{ rule: "no-date-utc", line: 4 }]],
        ["b.js", []],
      ]),
    );
  });
});

describe("LINT_RULES", () => {
  it("names each recommended rule without the plugin prefix, with its description", () => {
    expect(LINT_RULES).toContainEqual({
      rule: "no-date-now",
      description: "Disallow Date.now().",
    });
    expect(LINT_RULES.every(({ rule }) => rule.startsWith("no-"))).toBe(true);
  });
});

describe("byRule", () => {
  it("groups the lines under each rule, in first-seen order", () => {
    expect(
      byRule([
        { rule: "no-new-date", line: 2 },
        { rule: "no-date-utc", line: 5 },
        { rule: "no-new-date", line: 9 },
      ]),
    ).toEqual([
      { rule: "no-new-date", lines: [2, 9] },
      { rule: "no-date-utc", lines: [5] },
    ]);
  });
});
