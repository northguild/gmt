/**
 * No-throw fuzz harness (CORE-8 row A1): every public function, called with each argument
 * position replaced in turn by a garbage value, never throws and returns its declared type — and
 * returns the sentinel when a required argument is missing. See ./noThrow.ts.
 */
import {
  corpusFunctionNames,
  corpusNamespaces,
  exportedFunctionNames,
  type NoThrowCase,
  noThrowCases,
  noThrowFailures,
  signatureOf,
} from "./noThrow";

describe("no-throw harness coverage", () => {
  it("fuzzes every namespace that holds a function, each with at least one case", () => {
    const namespaces = corpusNamespaces();
    // The namespaces the harness once listed by hand stay covered, and the realm layers join them.
    expect(namespaces).toEqual(
      expect.arrayContaining([
        "calendar",
        "duration",
        "gnss",
        "instant",
        "intermodal",
        "interval",
        "plain",
        "precision",
        "span",
        "timescale",
        "transport",
        "unix",
        "utc",
        "zoned",
      ]),
    );
    for (const namespace of namespaces) {
      expect(noThrowCases(namespace).length, namespace).toBeGreaterThan(0);
    }
    // The first call builds the cases for every public function: about 2 seconds alone, and past
    // the default 5 when the whole suite shares the machine.
  }, 60_000);

  it("covers every exported function (each has a corpus @example baseline)", () => {
    const corpus = new Set(corpusFunctionNames());
    expect(exportedFunctionNames().filter((name) => !corpus.has(name))).toEqual(
      [],
    );
  });

  it.each`
    result       | returned          | failures
    ${() => 1}   | ${"the number 1"} | ${1}
    ${() => ""}  | ${"''"}           | ${0}
    ${() => "a"} | ${"'a'"}          | ${1}
  `(
    "reports a wrong type or a missing sentinel ($failures failure(s) for a string function returning $returned)",
    ({ result, failures }) => {
      const testCase: NoThrowCase = {
        name: "fake",
        fn: result,
        declared: { kinds: ["string"], nullable: false },
        readsClock: false,
        calls: [{ label: "arg0=null", args: [null], missingRequired: true }],
      };
      expect(noThrowFailures(testCase)).toHaveLength(failures);
    },
  );

  it("reports a throw", () => {
    const testCase: NoThrowCase = {
      name: "fake",
      fn: () => {
        throw new TypeError("boom");
      },
      declared: { kinds: ["boolean"], nullable: false },
      readsClock: false,
      calls: [{ label: "arg0=null", args: [null], missingRequired: false }],
    };
    expect(noThrowFailures(testCase)).toEqual([
      "arg0=null: threw TypeError: boom",
    ]);
  });
});

describe("signatureOf", () => {
  const overloaded = [
    "export function f(value: string): boolean;",
    "export function f(value: unknown): value is string;",
    "export function f(value: unknown): boolean {",
    "  return typeof value === 'string';",
    "}",
  ].join("\n");

  it("reads the first overload of an overloaded function, not the text that follows it", () => {
    const signature = signatureOf(overloaded, "f");
    expect(signature.declared).toEqual({ kinds: ["boolean"], nullable: false });
    expect(signature.types).toEqual(["string"]);
  });

  it("ORs nullability across every overload and keeps the parameters of the first", () => {
    const source = [
      'export function h(o?: { u?: "a" }): number;',
      "export function h(o?: unknown): number | null;",
      "export function h(o?: unknown): number | null {",
      "  return o === undefined ? 1 : null;",
      "}",
    ].join("\n");
    const signature = signatureOf(source, "h");
    expect(signature.declared).toEqual({ kinds: ["number"], nullable: true });
    expect(signature.types).toEqual(['{ u?: "a" }']);
    expect(signature.required).toEqual([false]);
  });

  it("ORs nullability when the first overload returns an object type", () => {
    const source = [
      'export function k(c: "A"): { z: string };',
      "export function k(c: unknown): { z: string } | null;",
      "export function k(c: unknown): { z: string } | null {",
      "  return c === 'A' ? { z: 'z' } : null;",
      "}",
    ].join("\n");
    expect(signatureOf(source, "k").declared).toEqual({
      kinds: ["object"],
      nullable: true,
    });
  });

  it("is nullable when only the first overload is nullable, whatever the order", () => {
    const source = [
      "export function p(a: unknown): number | null;",
      "export function p(a: string): number;",
      "export function p(a: unknown): number | null {",
      "  return typeof a === 'string' ? 1 : null;",
      "}",
    ].join("\n");
    expect(signatureOf(source, "p").declared).toEqual({
      kinds: ["number"],
      nullable: true,
    });
  });

  it("unions the kinds of the overloads, first overload first, without repeats", () => {
    const source = [
      "export function q(a: string): number;",
      "export function q(a: number): string | null;",
      "export function q(a: boolean): number;",
      "export function q(a: unknown): number | string | null {",
      "  return null;",
      "}",
    ].join("\n");
    expect(signatureOf(source, "q").declared).toEqual({
      kinds: ["number", "string"],
      nullable: true,
    });
  });

  it("does not read the implementation signature", () => {
    const source = [
      "export function m(a: string): string;",
      "export function m(a: unknown): string;",
      "export function m(a: unknown): unknown {",
      "  return a;",
      "}",
    ].join("\n");
    expect(signatureOf(source, "m").declared).toEqual({
      kinds: ["string"],
      nullable: false,
    });
  });

  it("reads an object return type whose members end in semicolons", () => {
    const source =
      "export function g(value: string): { a: string; b: number } {\n  return { a: value, b: 1 };\n}";
    expect(signatureOf(source, "g").declared).toEqual({
      kinds: ["object"],
      nullable: false,
    });
  });
});

describe.each(corpusNamespaces().map((namespace) => ({ namespace })))(
  "no-throw harness: $namespace",
  ({ namespace }) => {
    it.each(noThrowCases(namespace))(
      "$name never throws, returns its declared type, and returns the sentinel for a missing required argument",
      (testCase) => {
        expect(noThrowFailures(testCase)).toEqual([]);
      },
    );
  },
);
