import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import plugin from "./dox-test-rules.mjs";
import { LEGACY_TEST_FILES } from "./legacy-test-files.mjs";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");

type Node = Record<string, unknown>;
type Visitors = Record<string, (node: Node) => void>;

/** Runs one rule over hand-built nodes and returns the reported messages. */
function run(rule: string, visits: [string, Node][]): string[] {
  const reports: string[] = [];
  const visitors = (
    plugin.rules as Record<
      string,
      { create(ctx: { report(r: { message: string }): void }): Visitors }
    >
  )[rule].create({ report: (r) => reports.push(r.message) });
  for (const [type, node] of visits) visitors[type]?.(node);
  return reports;
}

const id = (name: string): Node => ({ type: "Identifier", name });
const str = (value: string): Node => ({ type: "Literal", value });
const member = (object: Node, property: string): Node => ({
  type: "MemberExpression",
  object,
  property: id(property),
});
const call = (callee: Node, ...args: Node[]): [string, Node] => [
  "CallExpression",
  { type: "CallExpression", callee, arguments: args },
];

describe("dox-test/no-dispatch-event", () => {
  const rule = "no-dispatch-event";
  it("reports dispatchEvent, fireEvent and new Event", () => {
    expect(run(rule, [call(member(id("el"), "dispatchEvent"))])).toHaveLength(
      1,
    );
    expect(run(rule, [call(id("fireEvent"))])).toHaveLength(1);
    expect(
      run(rule, [["MemberExpression", member(id("fireEvent"), "click")]]),
    ).toHaveLength(1);
    for (const ctor of [
      "Event",
      "KeyboardEvent",
      "MouseEvent",
      "PointerEvent",
      "InputEvent",
      "FocusEvent",
      "WheelEvent",
      "TouchEvent",
      "ClipboardEvent",
      "DragEvent",
      "CompositionEvent",
      "UIEvent",
      "CustomEvent",
    ]) {
      expect(
        run(rule, [
          ["NewExpression", { type: "NewExpression", callee: id(ctor) }],
        ]),
      ).toHaveLength(1);
    }
  });
  it("ignores other calls and constructors", () => {
    expect(run(rule, [call(member(id("el"), "click"))])).toEqual([]);
    expect(
      run(rule, [
        ["NewExpression", { type: "NewExpression", callee: id("Map") }],
      ]),
    ).toEqual([]);
  });
});

describe("dox-test/no-class-query", () => {
  const rule = "no-class-query";
  it("reports classList and className", () => {
    for (const prop of ["classList", "className"]) {
      expect(
        run(rule, [["MemberExpression", member(id("el"), prop)]]),
      ).toHaveLength(1);
    }
  });
  it("reports class and data selectors only", () => {
    const q = (sel: string) =>
      run(rule, [call(member(id("el"), "querySelector"), str(sel))]);
    expect(q(".card")).toHaveLength(1);
    expect(q("[data-role=x]")).toHaveLength(1);
    expect(q("button")).toEqual([]);
    expect(
      run(rule, [call(member(id("el"), "closest"), str("li.row"))]),
    ).toHaveLength(1);
  });
  it("does not read a dot inside an attribute value or quotes as a class", () => {
    const q = (sel: string) =>
      run(rule, [call(member(id("el"), "querySelector"), str(sel))]);
    expect(q("a[href$='.pdf']")).toEqual([]);
    expect(q("[aria-label='v1.2']")).toEqual([]);
    expect(q('[title="a.b"]')).toEqual([]);
    expect(q("a[href$='.pdf'].file")).toHaveLength(1);
    expect(q("[aria-label='v1.2'] .card")).toHaveLength(1);
  });
});

describe("dox-test/no-data-role", () => {
  const rule = "no-data-role";
  it("reports strings and templates", () => {
    expect(run(rule, [["Literal", str("[data-role=a]")]])).toHaveLength(1);
    expect(run(rule, [["Literal", str("data-testid")]])).toHaveLength(1);
    expect(
      run(rule, [
        [
          "TemplateLiteral",
          {
            type: "TemplateLiteral",
            quasis: [{ value: { cooked: "[data-role=" } }],
          },
        ],
      ]),
    ).toHaveLength(1);
    expect(run(rule, [["Literal", str("role")]])).toEqual([]);
  });
});

describe("dox-test/no-house-class", () => {
  const rule = "no-house-class";
  it("reports gmt- followed by a letter", () => {
    expect(run(rule, [["Literal", str("gmt-widget")]])).toHaveLength(1);
    expect(run(rule, [["Literal", str("gmt-1")]])).toEqual([]);
    expect(run(rule, [["Literal", str("@northguild/gmt")]])).toEqual([]);
  });
  it("skips module specifiers", () => {
    const source = str("../data/gmt-stats");
    expect(
      run(rule, [
        ["ImportDeclaration", { type: "ImportDeclaration", source }],
        ["Literal", source],
      ]),
    ).toEqual([]);
    const mocked = str("~/lib/gmt-modules");
    expect(
      run(rule, [call(member(id("vi"), "mock"), mocked), ["Literal", mocked]]),
    ).toEqual([]);
    expect(run(rule, [["Literal", str("../data/gmt-stats")]])).toHaveLength(1);
  });
});

describe("dox-test/no-markup-read", () => {
  const rule = "no-markup-read";
  it("reports innerHTML, outerHTML and toContainHTML", () => {
    expect(
      run(rule, [["MemberExpression", member(id("el"), "innerHTML")]]),
    ).toHaveLength(1);
    expect(
      run(rule, [["MemberExpression", member(id("el"), "outerHTML")]]),
    ).toHaveLength(1);
    expect(
      run(rule, [call(member(call(id("expect"))[1], "toContainHTML"))]),
    ).toHaveLength(1);
    expect(
      run(rule, [["MemberExpression", member(id("el"), "value")]]),
    ).toEqual([]);
  });
});

describe("dox-test/no-implementation-assert", () => {
  const rule = "no-implementation-assert";
  const matcher = (name: string, ...args: Node[]) =>
    call(member(call(id("expect"))[1], name), ...args);
  it("reports class, style and data-* assertions", () => {
    for (const name of ["toHaveClass", "toHaveStyle"]) {
      expect(run(rule, [matcher(name)])).toHaveLength(1);
    }
    expect(run(rule, [call(id("getComputedStyle"))])).toHaveLength(1);
    expect(
      run(rule, [["MemberExpression", member(id("el"), "style")]]),
    ).toHaveLength(1);
    for (const attr of ["class", "style", "id", "data-state"]) {
      expect(run(rule, [matcher("toHaveAttribute", str(attr))])).toHaveLength(
        1,
      );
    }
  });
  it("allows the attributes a reader or assistive technology perceives", () => {
    for (const attr of ["aria-pressed", "disabled", "href", "hidden"]) {
      expect(run(rule, [matcher("toHaveAttribute", str(attr))])).toEqual([]);
    }
    expect(
      run(rule, [
        ["MemberExpression", { ...member(id("el"), "style"), computed: true }],
      ]),
    ).toEqual([]);
  });
});

describe("legacy test file list", () => {
  it("holds paths, never globs", () => {
    const globs = LEGACY_TEST_FILES.filter((f) => /[*?{}[\]!]/.test(f));
    expect(globs).toEqual([]);
  });
  it("names only test files that exist, so a deleted file leaves the list", () => {
    const missing = LEGACY_TEST_FILES.filter((f) => !existsSync(join(APP, f)));
    expect(missing).toEqual([]);
  });
  it("is sorted and free of duplicates", () => {
    expect(LEGACY_TEST_FILES).toEqual(
      [...new Set(LEGACY_TEST_FILES)].toSorted(),
    );
  });
});
