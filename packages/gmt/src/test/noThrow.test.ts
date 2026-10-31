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
