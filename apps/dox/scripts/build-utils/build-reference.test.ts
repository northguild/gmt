import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as BR from "../build-reference";
import type { FnDoc, TypeDoc, RegexDoc } from "../build-reference";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// In-memory TS program helpers
// ---------------------------------------------------------------------------

const gmtSrc = resolve(process.cwd(), "..", "..", "packages", "gmt", "src");

function compile(source: string) {
  const fileName = "subject.ts";
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const host = ts.createCompilerHost({});
  const origGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (f, lang, onError, shouldCreate) =>
    f === fileName
      ? sourceFile
      : origGetSourceFile(f, lang, onError, shouldCreate);
  const origFileExists = host.fileExists.bind(host);
  host.fileExists = (f) => f === fileName || origFileExists(f);
  const origReadFile = host.readFile.bind(host);
  host.readFile = (f) => (f === fileName ? source : origReadFile(f));
  const program = ts.createProgram(
    [fileName],
    {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      skipLibCheck: true,
      noEmit: true,
      strict: false,
    },
    host,
  );
  return { checker: program.getTypeChecker(), sourceFile };
}

function gmtPath(rel: string): string {
  return resolve(gmtSrc, rel);
}

// ---------------------------------------------------------------------------
// extractFunction
// ---------------------------------------------------------------------------

describe("extractFunction", () => {
  it("produces a complete FnDoc from a declared function", () => {
    const src = `
      /**
       * Add days to a plain date.
       * @param value - The date string.
       * @param days - Number of days.
       * @returns The new date string.
       * @example addDays("2024-01-01", 5) // "2024-01-06"
       */
      function addDays(value: string, days: number): string {
        return value;
      }
    `;
    const { checker, sourceFile } = compile(src);
    let result: FnDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === "addDays") {
        result = BR.extractFunction(
          checker,
          node,
          "plain",
          "calculate",
          gmtPath("plain/calculate.ts"),
          new Set(),
        );
      }
    });
    expect(result).toBeDefined();
    expect(result!.name).toBe("addDays");
    expect(result!.namespace).toBe("plain");
    expect(result!.module).toBe("calculate");
    expect(result!.kind).toBe("function");
    expect(result!.params).toEqual([
      { name: "value", type: "string", description: "- The date string." },
      { name: "days", type: "number", description: "- Number of days." },
    ]);
    expect(result!.returns).toBe("The new date string.");
    expect(result!.examples).toEqual([
      {
        call: 'addDays("2024-01-01", 5)',
        result: '"2024-01-06"',
        note: undefined,
      },
    ]);
    expect(result!.sourcePath).toBe("plain/calculate.ts");
    expect(result!.signature).toContain("addDays");
    expect(result!.signature).toContain("value: string");
    expect(result!.signature).toContain("days: number");
  });

  it("generates playgroundSpec and livePlaygroundTemplate", () => {
    const src = `
      /** Format a duration. */
      function formatDuration(value: string): string { return value; }
    `;
    const { checker, sourceFile } = compile(src);
    let result: FnDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name?.text === "formatDuration"
      ) {
        result = BR.extractFunction(
          checker,
          node,
          "duration",
          "format",
          gmtPath("duration/format.ts"),
          new Set(),
        );
      }
    });
    expect(result).toBeDefined();
    expect(result!.playgroundSpec).toBeDefined();
    expect(result!.playgroundSpec!.module).toBe("duration");
    expect(result!.playgroundSpec!.fn).toBe("formatDuration");
    expect(result!.livePlaygroundTemplate).toBeDefined();
    expect(result!.livePlaygroundTemplate!.template).toBe("formatDuration()");
  });
});

// ---------------------------------------------------------------------------
// extractArrowFn
// ---------------------------------------------------------------------------

describe("extractArrowFn", () => {
  it("produces a complete FnDoc from an arrow function", () => {
    const src = `
      const compareDates = (a: string, b: string): number => {
        return a < b ? -1 : a > b ? 1 : 0;
      };
    `;
    const { checker, sourceFile } = compile(src);
    let result: FnDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === "compareDates") {
            result = BR.extractArrowFn(
              checker,
              decl,
              "plain",
              "compare",
              gmtPath("plain/compare.ts"),
              new Set(),
            );
          }
        }
      }
    });
    expect(result).toBeDefined();
    expect(result!.name).toBe("compareDates");
    expect(result!.namespace).toBe("plain");
    expect(result!.module).toBe("compare");
    expect(result!.kind).toBe("function");
    expect(result!.signature).toContain("compareDates");
    expect(result!.signature).toContain("a: string");
    expect(result!.signature).toContain("b: string");
    expect(result!.sourcePath).toBe("plain/compare.ts");
  });
});

// ---------------------------------------------------------------------------
// extractType
// ---------------------------------------------------------------------------

describe("extractType", () => {
  it("produces a TypeDoc from a type alias", () => {
    const src = `
      /** A duration unit enum. */
      type DurationUnit = "years" | "months" | "days";
    `;
    const { checker, sourceFile } = compile(src);
    let result: TypeDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (
        ts.isTypeAliasDeclaration(node) &&
        node.name.text === "DurationUnit"
      ) {
        result = BR.extractType(
          checker,
          node,
          "types",
          "types",
          gmtPath("types/duration.ts"),
        );
      }
    });
    expect(result).toBeDefined();
    expect(result!.name).toBe("DurationUnit");
    expect(result!.namespace).toBe("types");
    expect(result!.module).toBe("types");
    expect(result!.kind).toBe("type");
    expect(result!.description).toBe("The DurationUnit type.");
    expect(result!.isColocated).toBe(false);
    expect(result!.sourcePath).toBe("types/duration.ts");
  });

  it("marks colocated types as isColocated=true", () => {
    const src = `
      /** Local helper type. */
      type Local = string;
    `;
    const { checker, sourceFile } = compile(src);
    let result: TypeDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isTypeAliasDeclaration(node) && node.name.text === "Local") {
        result = BR.extractType(
          checker,
          node,
          "plain",
          "format",
          gmtPath("plain/format.ts"),
        );
      }
    });
    expect(result).toBeDefined();
    expect(result!.isColocated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractInterface
// ---------------------------------------------------------------------------

describe("extractInterface", () => {
  it("produces a TypeDoc with members from an interface", () => {
    const src = `
      /** Date options. */
      interface DateOptions {
        relativeTo?: string;
        roundingIncrement?: number;
      }
    `;
    const { checker, sourceFile } = compile(src);
    let result: TypeDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === "DateOptions") {
        result = BR.extractInterface(
          checker,
          node,
          "types",
          "types",
          gmtPath("types/options.ts"),
        );
      }
    });
    expect(result).toBeDefined();
    expect(result!.name).toBe("DateOptions");
    expect(result!.description).toBe("The DateOptions type.");
    expect(result!.members).toEqual([
      { name: "relativeTo?", type: "string", description: "" },
      { name: "roundingIncrement?", type: "number", description: "" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// extractRegex
// ---------------------------------------------------------------------------

describe("extractRegex", () => {
  it("extracts a regex doc from the regex namespace", () => {
    const src = `
      // Matches a 4-digit year.
      const yearRegex = /^\\d{4}$/;
    `;
    const { checker, sourceFile } = compile(src);
    let result: RegexDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === "yearRegex") {
            result = BR.extractRegex(
              checker,
              decl,
              "regex",
              "regex",
              gmtPath("regex/dates.ts"),
            );
          }
        }
      }
    });
    expect(result).toBeDefined();
    expect(result!.name).toBe("yearRegex");
    expect(result!.namespace).toBe("regex");
    expect(result!.module).toBe("regex");
    expect(result!.pattern).toBe("/^\\d{4}$/");
    expect(result!.description).toBe("Matches a 4-digit year.");
    expect(result!.examples.length).toBeGreaterThan(0);
  });

  it("returns undefined for non-regex namespace", () => {
    const src = `const foo = /^bar$/;`;
    const { checker, sourceFile } = compile(src);
    let result: RegexDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === "foo") {
            result = BR.extractRegex(
              checker,
              decl,
              "plain",
              "validate",
              gmtPath("plain/validate.ts"),
            );
          }
        }
      }
    });
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateRegexExamples
// ---------------------------------------------------------------------------

describe("generateRegexExamples", () => {
  it("generates true and false candidates for digit-count patterns", () => {
    const examples = BR.generateRegexExamples("^\\d{4}$", "yearRegex");
    expect(examples.length).toBeGreaterThanOrEqual(2);
    expect(examples.some((e) => e.result === "true")).toBe(true);
    expect(examples.some((e) => e.result === "false")).toBe(true);
  });

  it("returns empty array for invalid regex", () => {
    expect(BR.generateRegexExamples("[invalid", "badRegex")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// synthesizeTemplate
// ---------------------------------------------------------------------------

describe("synthesizeTemplate", () => {
  it("synthesizes a call string from a PlaygroundSpec", () => {
    const template = BR.synthesizeTemplate({
      module: "plain",
      fn: "addDays",
      returnType: "string",
      params: [
        { name: "value", type: "string", value: "2024-01-01" },
        { name: "days", type: "number", value: "5" },
      ],
    });
    expect(template).toBe('addDays("2024-01-01", 5)');
  });

  it("handles options objects", () => {
    const template = BR.synthesizeTemplate({
      module: "duration",
      fn: "durationAs",
      returnType: "number",
      params: [
        { name: "value", type: "string", value: "P1M" },
        { name: "unit", type: "enum", value: "days" },
      ],
      options: [{ name: "relativeTo", type: "string", value: "2024-02-01" }],
    });
    expect(template).toBe(
      'durationAs("P1M", "days", { relativeTo: "2024-02-01" })',
    );
  });

  it("handles array params", () => {
    const template = BR.synthesizeTemplate({
      module: "unix",
      fn: "maxUnix",
      returnType: "string",
      params: [
        { name: "start", type: "string", value: "2024-01-01" },
        {
          name: "unixValues",
          type: "array",
          value: "1706659200000,1704067200000",
        },
      ],
    });
    expect(template).toBe(
      'maxUnix("2024-01-01", ["1706659200000", "1704067200000"])',
    );
  });

  it("handles units params", () => {
    const template = BR.synthesizeTemplate({
      module: "zoned",
      fn: "addZoned",
      returnType: "string",
      params: [
        { name: "value", type: "string", value: "2024-01-01" },
        { name: "units", type: "units", value: "1", unitValue: "days" },
      ],
    });
    expect(template).toBe('addZoned("2024-01-01", { days: 1 })');
  });

  it("handles boolean params", () => {
    const template = BR.synthesizeTemplate({
      module: "plain",
      fn: "isBetweenDate",
      returnType: "boolean",
      params: [
        { name: "date", type: "string", value: "2024-02-29" },
        { name: "start", type: "string", value: "2024-02-01" },
        { name: "end", type: "string", value: "2024-02-28" },
      ],
      options: [{ name: "inclusiveStart", type: "boolean", value: "false" }],
    });
    expect(template).toBe(
      'isBetweenDate("2024-02-29", "2024-02-01", "2024-02-28", { inclusiveStart: false })',
    );
  });
});

// ---------------------------------------------------------------------------
// buildLivePlaygroundTemplate integration
// ---------------------------------------------------------------------------

describe("buildLivePlaygroundTemplate integration", () => {
  it("uses the first example call as template when examples exist", () => {
    const src = `
      /** Add days.
       * @example addDays("2024-01-01", 5) // "2024-01-06"
       */
      function addDays(value: string, days: number): string { return value; }
    `;
    const { checker, sourceFile } = compile(src);
    let doc: FnDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === "addDays") {
        doc = BR.extractFunction(
          checker,
          node,
          "plain",
          "calculate",
          gmtPath("plain/calculate.ts"),
          new Set(),
        );
      }
    });
    expect(doc).toBeDefined();
    expect(doc!.livePlaygroundTemplate).toBeDefined();
    expect(doc!.livePlaygroundTemplate!.template).toBe(
      'addDays("2024-01-01", 5)',
    );
    expect(doc!.livePlaygroundTemplate!.returnType).toBe("string");
  });

  it("falls back to synthesized template when no examples exist", () => {
    const src = `
      /** Format duration.
       * @param value - The duration string.
       * @param unit - The unit.
       */
      function formatDuration(value: string, unit: "days" | "hours"): string { return value; }
    `;
    const { checker, sourceFile } = compile(src);
    let doc: FnDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name?.text === "formatDuration"
      ) {
        doc = BR.extractFunction(
          checker,
          node,
          "duration",
          "format",
          gmtPath("duration/format.ts"),
          new Set(),
        );
      }
    });
    expect(doc).toBeDefined();
    expect(doc!.livePlaygroundTemplate).toBeDefined();
    expect(doc!.livePlaygroundTemplate!.template).toBe(
      'formatDuration("", "")',
    );
  });

  it("sets allowEmptyArray when examples contain empty array result", () => {
    const src = `
      /** Get dates in range.
       * @example mapZonedDatesInRange("a[UTC]", "b[UTC]") // []
       */
      function mapZonedDatesInRange(start: string, end: string): string[] { return []; }
    `;
    const { checker, sourceFile } = compile(src);
    let doc: FnDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name?.text === "mapZonedDatesInRange"
      ) {
        doc = BR.extractFunction(
          checker,
          node,
          "zoned",
          "map",
          gmtPath("zoned/map.ts"),
          new Set(),
        );
      }
    });
    expect(doc).toBeDefined();
    expect(doc!.livePlaygroundTemplate).toBeDefined();
    expect(doc!.livePlaygroundTemplate!.allowEmptyArray).toBe(true);
  });
});
