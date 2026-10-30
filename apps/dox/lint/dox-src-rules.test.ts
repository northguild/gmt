import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import plugin from "./dox-src-rules.mjs";
import { LEGACY_SRC_FILES } from "./legacy-src-files.mjs";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");

type Node = Record<string, unknown>;
type Visitors = Record<string, (node: Node) => void>;

/** Runs one rule over hand-built nodes for a file and returns the reported messages. */
function run(
  rule: string,
  visits: [string, Node][],
  filename = "/app/src/lib/x.ts",
): string[] {
  const reports: string[] = [];
  const visitors = (
    plugin.rules as Record<
      string,
      {
        create(ctx: {
          filename: string;
          report(r: { message: string }): void;
        }): Visitors;
      }
    >
  )[rule].create({ filename, report: (r) => reports.push(r.message) });
  for (const [type, node] of visits) visitors[type]?.(node);
  return reports;
}

const str = (value: string): [string, Node] => [
  "Literal",
  { type: "Literal", value },
];
const id = (name: string): Node => ({ type: "Identifier", name });
const num = (value: number): Node => ({ type: "Literal", value });

describe("dox-src/no-hand-markup", () => {
  const rule = "no-hand-markup";
  it("reports each hand-written widget construct", () => {
    for (const text of [
      "<section>",
      '<div role="slider">',
      "<output>",
      '<input type="range">',
      '<input type="checkbox">',
      '<input type="radio">',
      '<p class="gmt-x">',
    ]) {
      expect(run(rule, [str(text)])).toHaveLength(1);
    }
  });
  it("reads template literals", () => {
    const node: Node = {
      type: "TemplateLiteral",
      quasis: [{ value: { cooked: "<output>" } }],
    };
    expect(run(rule, [["TemplateLiteral", node]])).toHaveLength(1);
  });
  it("ignores other strings, widgets and test files", () => {
    expect(run(rule, [str("<div>")])).toEqual([]);
    expect(run(rule, [str("<section>")], "/app/src/widgets/x/x.tsx")).toEqual(
      [],
    );
    expect(run(rule, [str("<section>")], "/app/src/lib/x.test.ts")).toEqual([]);
  });
});

describe("dox-src/no-nth-selector", () => {
  const rule = "no-nth-selector";
  it("reports :nth- in a string", () => {
    expect(run(rule, [str("li:nth-child(2)")])).toHaveLength(1);
  });
  it("ignores other selectors", () => {
    expect(run(rule, [str("li.first")])).toEqual([]);
  });
});

describe("dox-src/no-module-counter", () => {
  const rule = "no-module-counter";
  const decl = (name: string, init: Node | null, parent = "Program"): Node => ({
    type: "VariableDeclaration",
    kind: "let",
    parent: { type: parent },
    declarations: [{ id: id(name), init }],
  });
  const exit: [string, Node] = ["Program:exit", {}];
  it("reports a top-level let that is assigned a number", () => {
    expect(
      run(
        rule,
        [["VariableDeclaration", decl("n", num(0))], exit],
        "/app/src/lib/a-mount.ts",
      ),
    ).toHaveLength(1);
    expect(
      run(
        rule,
        [
          ["VariableDeclaration", decl("n", null)],
          ["UpdateExpression", { argument: id("n") }],
          exit,
        ],
        "/app/src/lib/a-mount.ts",
      ),
    ).toHaveLength(1);
  });
  it("ignores non-numeric lets, nested lets and other files", () => {
    const mount = "/app/src/lib/a-mount.ts";
    expect(
      run(rule, [["VariableDeclaration", decl("n", null)], exit], mount),
    ).toEqual([]);
    expect(
      run(
        rule,
        [["VariableDeclaration", decl("n", num(0), "BlockStatement")], exit],
        mount,
      ),
    ).toEqual([]);
    expect(
      run(rule, [["VariableDeclaration", decl("n", num(0))], exit]),
    ).toEqual([]);
  });
});

describe("dox-src/no-define-at-top", () => {
  const rule = "no-define-at-top";
  const define: [string, Node] = [
    "CallExpression",
    {
      callee: {
        type: "MemberExpression",
        object: id("customElements"),
        property: id("define"),
      },
    },
  ];
  it("reports a define at module level", () => {
    expect(run(rule, [define])).toHaveLength(1);
  });
  it("allows a define inside a function", () => {
    expect(
      run(rule, [
        ["FunctionDeclaration", {}],
        define,
        ["FunctionDeclaration:exit", {}],
      ]),
    ).toEqual([]);
  });
});

describe("legacy src list", () => {
  it("names real files, with no globs, in order", () => {
    for (const file of LEGACY_SRC_FILES) {
      expect(file).not.toMatch(/[*?{}]/);
      expect(existsSync(join(APP, file)), file).toBe(true);
    }
    expect([...LEGACY_SRC_FILES]).toEqual([...LEGACY_SRC_FILES].toSorted());
  });
});
