import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import * as BR from "../build-reference";
import {
  assignInlineAnchors,
  buildTypeUsage,
  headingAnchors,
  inlineTypesOf,
  pageAnchors,
  publicTypeIndex,
  typeReferences,
  type PublicFunctionDecl,
  type PublicTypeDecl,
  type TypeUsage,
} from "./type-usage";

// ---------------------------------------------------------------------------
// In-memory programs
// ---------------------------------------------------------------------------

/**
 * Compile in-memory files and treat every top-level function and type in them as public,
 * keyed `ns/mod/<name>`.
 */
function graphInput(files: Record<string, string>) {
  const names = Object.keys(files);
  const host = ts.createCompilerHost({});
  const origGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (f, lang, onError, shouldCreate) =>
    f in files
      ? ts.createSourceFile(f, files[f], ts.ScriptTarget.ESNext, true)
      : origGetSourceFile(f, lang, onError, shouldCreate);
  const origFileExists = host.fileExists.bind(host);
  host.fileExists = (f) => f in files || origFileExists(f);
  const origReadFile = host.readFile.bind(host);
  host.readFile = (f) => (f in files ? files[f] : origReadFile(f));
  const program = ts.createProgram(names, BR.REFERENCE_COMPILER_OPTIONS, host);

  const functions: PublicFunctionDecl[] = [];
  const types: PublicTypeDecl[] = [];
  for (const name of names) {
    for (const stmt of program.getSourceFile(name)!.statements) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        functions.push({ key: `ns/mod/${stmt.name.text}`, node: stmt });
      } else if (
        ts.isTypeAliasDeclaration(stmt) ||
        ts.isInterfaceDeclaration(stmt)
      ) {
        types.push({ name: stmt.name.text, node: stmt });
      } else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            functions.push({ key: `ns/mod/${decl.name.text}`, node: decl });
          }
        }
      }
    }
  }
  return { checker: program.getTypeChecker(), functions, types };
}

function usageOf(source: string | Record<string, string>): TypeUsage {
  const { checker, functions, types } = graphInput(
    typeof source === "string" ? { "subject.ts": source } : source,
  );
  return buildTypeUsage(checker, functions, types);
}

describe("buildTypeUsage", () => {
  it("finds a union alias used only through a parameter annotation", () => {
    // The printed signature reads `"constrain" | "reject"`; only the node names the alias.
    const usage = usageOf(`
      export type Overflow = "constrain" | "reject";
      export function add(value: string, options?: { overflow?: Overflow }): string { return value; }
    `);
    expect(usage.direct.get("ns/mod/add")).toEqual(["Overflow"]);
    expect(usage.types.get("Overflow")!.usedBy).toEqual(["ns/mod/add"]);
    expect(usage.types.get("Overflow")!.input).toBe(true);
  });

  it("counts a type reached only through another type for the functions that reach the outer one", () => {
    const usage = usageOf(`
      export interface TierBand { from: number }
      export interface Charges { bands: TierBand[] }
      export interface Unrelated { a: string }
      export function charges(a: string): Charges | null { return null; }
      export function other(a: Unrelated): string { return ""; }
    `);
    expect(usage.direct.get("ns/mod/charges")).toEqual(["Charges"]);
    expect(usage.reach.get("ns/mod/charges")).toEqual(["Charges", "TierBand"]);
    expect(usage.types.get("TierBand")!.usedBy).toEqual(["ns/mod/charges"]);
  });

  it("orders reach depth-first: a type's own members before the next type the function names", () => {
    const usage = usageOf(`
      export interface Inner { a: string }
      export interface First { inner: Inner }
      export interface Second { b: string }
      export interface Result { c: string }
      export function f(a: First, b: Second): Result { return { c: "" }; }
    `);
    expect(usage.reach.get("ns/mod/f")).toEqual([
      "First",
      "Inner",
      "Second",
      "Result",
    ]);
  });

  it("follows an interface's extends clause and survives a cycle", () => {
    const usage = usageOf(`
      export interface Base { next?: Node }
      export interface Node extends Base { value: string }
      export function walk(node: Node): string { return node.value; }
    `);
    expect(usage.reach.get("ns/mod/walk")).toEqual(["Node", "Base"]);
  });

  it("finds the type of a named member of a rest tuple", () => {
    const usage = usageOf(`
      export interface StepOptions { limit?: number }
      export function step(...input: [stepDays?: number, options?: StepOptions]): string { return ""; }
    `);
    expect(usage.direct.get("ns/mod/step")).toEqual(["StepOptions"]);
    expect(usage.types.get("StepOptions")!.input).toBe(true);
  });

  it("reads an arrow function's annotations, on the function or on the variable", () => {
    const usage = usageOf(`
      export interface A { a: string }
      export interface B { b: string }
      export const onFunction = (a: A): string => a.a;
      export const onVariable: (b: B) => string = (b) => b.b;
    `);
    expect(usage.direct.get("ns/mod/onFunction")).toEqual(["A"]);
    expect(usage.direct.get("ns/mod/onVariable")).toEqual(["B"]);
  });

  it("marks a type reached only from a return annotation as not an input", () => {
    const usage = usageOf(`
      export interface Shared { a: string }
      export interface Out { shared: Shared }
      export interface In { a: string }
      export function f(a: In): Out | null { return null; }
    `);
    expect(usage.types.get("In")!.input).toBe(true);
    expect(usage.types.get("Out")!.input).toBe(false);
    expect(usage.types.get("Shared")!.input).toBe(false);
  });

  it("marks a type an input when any function takes it, though another only returns it", () => {
    const usage = usageOf(`
      export interface Interval { start: string }
      export function make(a: string): Interval | null { return null; }
      export function take(a: Interval): string { return a.start; }
    `);
    expect(usage.types.get("Interval")!.input).toBe(true);
  });

  it("gives a type two functions reach a page, and a type one function reaches a place on that function's page", () => {
    const usage = usageOf(`
      export interface Shared { a: string }
      export interface Dwell { duration: string }
      export interface DwellTime { n: number }
      export function one(a: Shared): Dwell | null { return null; }
      export function two(a: Shared, b: DwellTime): string { return ""; }
    `);
    expect(usage.types.get("Shared")!.placement).toEqual({ kind: "page" });
    expect(usage.types.get("Dwell")!.placement).toEqual({
      kind: "inline",
      owner: "ns/mod/one",
      anchor: "dwell",
    });
    expect(usage.types.get("DwellTime")!.placement).toEqual({
      kind: "inline",
      owner: "ns/mod/two",
      anchor: "dwelltime",
    });
    expect(usage.orphans).toEqual([]);
  });

  it("returns a type no function reaches as an orphan, without throwing", () => {
    const usage = usageOf(`
      export type DurationUnit = "years" | "days";
      export interface Used { a: string }
      export function f(a: Used): string { return a.a; }
    `);
    expect(usage.orphans).toEqual(["DurationUnit"]);
    expect(usage.types.get("DurationUnit")!.usedBy).toEqual([]);
  });

  it("treats a merged interface as one type", () => {
    const usage = usageOf(`
      export interface A { a: string }
      export interface B { b: string }
      export interface Merged { a: A }
      export interface Merged { b: B }
      export function f(m: Merged): string { return ""; }
    `);
    expect(usage.reach.get("ns/mod/f")).toEqual(["Merged", "A", "B"]);
  });

  it("ignores types that are not public: Temporal, lib and type parameters", () => {
    const usage = usageOf(`
      export type Box<T> = { value: T };
      export function f(a: Box<string>, b: Intl.DateTimeFormatOptions, c: Array<RegExp>): string { return ""; }
    `);
    expect(usage.direct.get("ns/mod/f")).toEqual(["Box"]);
  });

  it("throws on two public types with one name", () => {
    expect(() =>
      usageOf({
        "a.ts": `export type Unit = "a"; export function f(u: Unit): string { return u; }`,
        "b.ts": `export type Unit = "b"; export function g(u: Unit): string { return u; }`,
      }),
    ).toThrow(/public type names must be unique.*Unit/);
  });

  it("throws on two public types whose names differ only by case", () => {
    expect(() =>
      usageOf(`
        export interface DwellTime { a: string }
        export interface Dwelltime { b: string }
        export function f(a: DwellTime, b: Dwelltime): string { return ""; }
      `),
    ).toThrow(/public type names must be unique.*DwellTime \/ Dwelltime/);
  });

  it("throws on a public function with no return annotation, naming each one", () => {
    expect(() =>
      usageOf(`
        export function first(a: string) { return a; }
        export const second = (a: string) => a;
        export function fine(a: string): string { return a; }
      `),
    ).toThrow(
      /must annotate their return type: ns\/mod\/first, ns\/mod\/second\./,
    );
  });

  it("throws on a generic public function", () => {
    expect(() =>
      usageOf(`export function f<T>(a: T): T { return a; }`),
    ).toThrow(/must not be overloaded or generic: ns\/mod\/f\./);
  });

  it("throws on an overloaded public function", () => {
    expect(() =>
      usageOf(`
        export function f(a: string): string;
        export function f(a: number): number;
        export function f(a: string | number): string | number { return a; }
      `),
    ).toThrow(/must not be overloaded or generic: ns\/mod\/f\./);
  });
});

describe("typeReferences", () => {
  it("lists each public type a node names once, in source order", () => {
    const { checker, types } = graphInput({
      "subject.ts": `
        export interface A { a: string }
        export interface B { b: string }
        export type Both = { first: B; second: A; again: B[] };
      `,
    });
    const both = types.find((t) => t.name === "Both")!;
    expect(typeReferences(checker, both.node, publicTypeIndex(types))).toEqual([
      "B",
      "A",
    ]);
  });
});

describe("inline anchors", () => {
  const SOURCE = `
    export interface Options { a: string }
    export interface Dwell { b: string }
    export interface Shared { c: string }
    export function one(o: Options, s: Shared): Dwell | null { return null; }
    export function two(s: Shared): string { return ""; }
  `;

  it("slugs the headings of a page in order, suffixing one that repeats an earlier one", () => {
    expect(
      headingAnchors(["Signature", "Options", "Types", "Options", "DwellTime"]),
    ).toEqual(["signature", "options", "types", "options-1", "dwelltime"]);
  });

  it("lists a function's inline types in reach order, without the shared ones", () => {
    const usage = usageOf(SOURCE);
    expect(usage.reach.get("ns/mod/one")).toEqual([
      "Options",
      "Shared",
      "Dwell",
    ]);
    expect(inlineTypesOf(usage, "ns/mod/one")).toEqual(["Options", "Dwell"]);
    expect(inlineTypesOf(usage, "ns/mod/two")).toEqual([]);
    expect(inlineTypesOf(usage, "ns/mod/missing")).toEqual([]);
  });

  it("takes each anchor from every heading of the page, not from the type names alone", () => {
    const usage = usageOf(SOURCE);
    // On a page with no other heading, the type's own slug.
    expect(usage.types.get("Options")!.placement).toMatchObject({
      anchor: "options",
    });
    assignInlineAnchors(usage, (_key, inline) => ({
      headings: ["Signature", "Options", "Types", ...inline],
      at: 3,
    }));
    expect(usage.types.get("Options")!.placement).toEqual({
      kind: "inline",
      owner: "ns/mod/one",
      anchor: "options-1",
    });
    expect(usage.types.get("Dwell")!.placement).toMatchObject({
      anchor: "dwell",
    });
    expect(usage.types.get("Shared")!.placement).toEqual({ kind: "page" });
  });

  it("slugs a hand-set anchor after every heading, so it never takes a heading's id", () => {
    expect(
      pageAnchors(["Signature", "Options", "Returns"], ["Returns"]),
    ).toEqual({
      headings: ["signature", "options", "returns"],
      extras: ["returns-1"],
    });
    expect(pageAnchors(["A", "A"])).toEqual({
      headings: ["a", "a-1"],
      extras: [],
    });
  });

  it("anchors a type its page documents in an Options block without a heading for it", () => {
    const usage = usageOf(SOURCE);
    assignInlineAnchors(usage, () => ({
      // `Options` is held by the Options block; only `Dwell` is headed.
      headings: ["Signature", "Options", "Types", "Dwell", "Source"],
      at: 3,
      inOptions: ["Options"],
    }));
    expect(usage.types.get("Options")!.placement).toMatchObject({
      anchor: "options-1",
    });
    expect(usage.types.get("Dwell")!.placement).toMatchObject({
      anchor: "dwell",
    });
  });

  it("throws when a page does not head its inline types where it says it does", () => {
    const usage = usageOf(SOURCE);
    expect(() =>
      assignInlineAnchors(usage, () => ({
        headings: ["Types", "Options"],
        at: 1,
      })),
    ).toThrow(/ns\/mod\/one: heading 2 is undefined, not Dwell/);
    // Pointing at the section instead of the type's own heading is caught too.
    expect(() =>
      assignInlineAnchors(usage, () => ({
        headings: ["Options", "Types", "Options", "Dwell"],
        at: 0,
      })),
    ).toThrow(/ns\/mod\/one: heading 1 is "Types", not Dwell/);
  });
});

// ---------------------------------------------------------------------------
// Real source
// ---------------------------------------------------------------------------

describe("usage graph of the gmt source", () => {
  let usage: TypeUsage;
  let docs: BR.ReferenceExtraction["docs"];

  beforeAll(() => {
    // Also proves no structural throw fires on real source: no duplicate type name, no
    // unannotated return, no generic or overloaded public function.
    ({ usage, docs } = BR.extractReference());
  });

  it("finds the union aliases a printed signature inlines", () => {
    expect(usage.types.get("Overflow")!.usedBy.length).toBeGreaterThan(0);
    expect(usage.types.get("Disambiguation")!.usedBy.length).toBeGreaterThan(0);
  });

  it("knows every documented type and every documented function", () => {
    const typeNames = docs.filter((d) => d.kind === "type").map((d) => d.name);
    expect([...usage.types.keys()].sort()).toEqual([...typeNames].sort());
    const functionKeys = docs
      .filter((d) => d.kind === "function")
      .map((d) => `${d.namespace}/${d.module}/${d.name}`);
    expect([...usage.reach.keys()].sort()).toEqual([...functionKeys].sort());
  });

  it("places each type by how many functions reach it", () => {
    for (const node of usage.types.values()) {
      const reachedBy = [...usage.reach]
        .filter(([, types]) => types.includes(node.name))
        .map(([key]) => key);
      expect(node.usedBy, node.name).toEqual(reachedBy);
      if (reachedBy.length === 1) {
        expect(node.placement, node.name).toMatchObject({
          kind: "inline",
          owner: reachedBy[0],
        });
      } else {
        expect(node.placement, node.name).toEqual({ kind: "page" });
      }
      expect(usage.orphans.includes(node.name), node.name).toBe(
        reachedBy.length === 0,
      );
    }
  });

  it("starts every function's reach with the types it names directly", () => {
    for (const [key, direct] of usage.direct) {
      const reach = usage.reach.get(key)!;
      for (const name of direct) expect(reach, key).toContain(name);
    }
  });

  it("orders a page's inline types depth-first: TierBand directly after FreeTimeCharges", () => {
    const inline = inlineTypesOf(usage, "intermodal/calculate/chargeableDays");
    const charges = inline.indexOf("FreeTimeCharges");
    expect(charges).toBeGreaterThanOrEqual(0);
    expect(inline[charges + 1]).toBe("TierBand");
    // Parameter types come before the return type.
    expect(inline.indexOf("FreeTimeChargeOptions")).toBeLessThan(charges);
  });

  it("anchors each inline type at its heading, or after every heading when an Options block holds it", () => {
    const fns = new Map<string, BR.FnDoc>(
      docs.flatMap((d) =>
        d.kind === "function"
          ? [[`${d.namespace}/${d.module}/${d.name}`, d] as const]
          : [],
      ),
    );
    let checked = 0;
    for (const node of usage.types.values()) {
      if (node.placement.kind !== "inline") continue;
      const {
        headings,
        at,
        inOptions = [],
      } = BR.fnHeadings(fns.get(node.placement.owner)!, usage);
      const anchors = pageAnchors(headings, inOptions);
      const held = inOptions.indexOf(node.name);
      expect(node.placement.anchor, node.name).toBe(
        held >= 0
          ? anchors.extras[held]
          : anchors.headings[headings.indexOf(node.name, at)],
      );
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("has no orphan: every public type is reached by a public function", () => {
    expect(() => BR.refuseOrphans(usage, docs)).not.toThrow();
  });

  it("gives each inline type an anchor no other type on its owner's page has", () => {
    const anchors = new Map<string, string>();
    for (const node of usage.types.values()) {
      if (node.placement.kind !== "inline") continue;
      const at = `${node.placement.owner}#${node.placement.anchor}`;
      expect(anchors.get(at), `${node.name} at ${at}`).toBeUndefined();
      anchors.set(at, node.name);
    }
  });
});
