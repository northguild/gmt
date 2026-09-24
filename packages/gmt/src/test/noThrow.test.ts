/**
 * No-throw fuzz harness (CORE-8 row A1): every public function, called with each argument
 * position replaced in turn by a garbage value, never throws and returns its declared type — and
 * returns the sentinel when a required argument is missing. See ./noThrow.ts.
 */
import { describe, expect, it } from "vitest";
import {
  corpusFunctionNames,
  corpusNamespaces,
  exportedFunctionNames,
  type NoThrowCase,
  noThrowCases,
  noThrowFailures,
} from "./noThrow";

describe("no-throw harness coverage", () => {
  it("fuzzes every namespace that holds a function, each with at least one case", () => {
    const namespaces = corpusNamespaces();
    // The namespaces the harness once listed by hand stay covered, and the realm layers join them.
    expect(namespaces).toEqual(
      expect.arrayContaining([
        "calendar",
        "duration",
        "instant",
        "intermodal",
        "interval",
        "plain",
        "precision",
        "span",
        "transport",
        "unix",
        "utc",
        "zoned",
      ]),
    );
    for (const namespace of namespaces) {
      expect(noThrowCases(namespace).length, namespace).toBeGreaterThan(0);
    }
  });

  it("covers every exported function (each has a corpus @example baseline)", () => {
    const corpus = new Set(corpusFunctionNames());
    expect(exportedFunctionNames().filter((name) => !corpus.has(name))).toEqual(
      [],
    );
  });

  it.each`
    result       | failures
    ${() => 1}   | ${1}
    ${() => ""}  | ${0}
    ${() => "a"} | ${1}
  `(
    "reports a wrong type or a missing sentinel ($failures failure(s) for a string function)",
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
