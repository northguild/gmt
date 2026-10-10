import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as BR from "../build-reference";
import type { FnDoc, PropertyDoc, TypeDoc, RegexDoc } from "../build-reference";
import { findGaps } from "./doc-gate";
import { renderOptionsTable } from "./render-table";
import {
  assignInlineAnchors,
  buildTypeUsage,
  headingAnchors,
  publicTypeIndex,
  type PublicFunctionDecl,
  type PublicTypeDecl,
  type TypeUsage,
} from "./type-usage";
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
  // The generator's own options, so a test sees the types the reference pages see.
  const program = ts.createProgram(
    [fileName],
    BR.REFERENCE_COMPILER_OPTIONS,
    host,
  );
  return { checker: program.getTypeChecker(), sourceFile, program };
}

/**
 * The extraction context the generator builds, with every top-level type of the test source
 * treated as public: lib detection from the program, and type links from the declarations.
 */
function contextFor(
  program: ts.Program,
  sourceFile: ts.SourceFile,
): BR.ExtractContext {
  const types = sourceFile.statements.flatMap((stmt) =>
    ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)
      ? [{ name: stmt.name.text, node: stmt }]
      : [],
  );
  return { program, publicTypes: publicTypeIndex(types) };
}

/** Extract one declared function with every type in the source public. */
function extractFn(src: string, name: string): FnDoc {
  const { checker, sourceFile, program } = compile(src);
  let result: FnDoc | undefined;
  sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      result = BR.extractFunction(
        checker,
        node,
        "plain",
        "calculate",
        gmtPath("plain/calculate/subject.ts"),
        contextFor(program, sourceFile),
      );
    }
  });
  expect(result).toBeDefined();
  return result!;
}

/** Extract one declared alias or interface. */
function extractTypeDoc(src: string, name: string): TypeDoc {
  const { checker, sourceFile, program } = compile(src);
  const ctx = contextFor(program, sourceFile);
  let result: TypeDoc | undefined;
  sourceFile.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
      result = BR.extractType(
        checker,
        node,
        "types",
        "t",
        gmtPath("t.ts"),
        ctx,
      );
    }
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      result = BR.extractInterface(
        checker,
        node,
        "types",
        "t",
        gmtPath("t.ts"),
        ctx,
      );
    }
  });
  expect(result).toBeDefined();
  return result!;
}

/** A row as the tests compare it: the fields a reader sees, without the source position. */
function shown(rows: PropertyDoc[]) {
  return rows.map(({ name, optional, type, description, defaultValue }) => ({
    name,
    optional,
    type,
    description,
    defaultValue,
  }));
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

describe("extractFunction nullable types", () => {
  function extract(src: string, name: string): FnDoc {
    const { checker, sourceFile } = compile(src);
    let result: FnDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
        result = BR.extractFunction(
          checker,
          node,
          "plain",
          "calculate",
          gmtPath("plain/calculate/diffDate.ts"),
        );
      }
    });
    expect(result).toBeDefined();
    return result!;
  }

  it.each`
    source                                                                                                                                                                                                                                                                                                                                                                                                                                           | name          | signature
    ${"function diffDays(a: string, b: string): number | null { return null; }"}                                                                                                                                                                                                                                                                                                                                                                     | ${"diffDays"} | ${"diffDays(a: string, b: string): number | null"}
    ${"function maybe(a: string | undefined): string { return ''; }"}                                                                                                                                                                                                                                                                                                                                                                                | ${"maybe"}    | ${"maybe(a: string | undefined): string"}
    ${"interface O { unit?: string }\nfunction opt(a: string, options?: O): string { return a; }"}                                                                                                                                                                                                                                                                                                                                                   | ${"opt"}      | ${"opt(a: string, options?: O): string"}
    ${"function inl(options?: { unit?: string; zone?: string | undefined }): number | null { return null; }"}                                                                                                                                                                                                                                                                                                                                        | ${"inl"}      | ${"inl(options?: { unit?: string; zone?: string | undefined; }): number | null"}
    ${"function wide(a: string): 'lit00_abcdefgh' | 'lit01_abcdefgh' | 'lit02_abcdefgh' | 'lit03_abcdefgh' | 'lit04_abcdefgh' | 'lit05_abcdefgh' | 'lit06_abcdefgh' | 'lit07_abcdefgh' | 'lit08_abcdefgh' | 'lit09_abcdefgh' | 'lit10_abcdefgh' | 'lit11_abcdefgh' | 'lit12_abcdefgh' | 'lit13_abcdefgh' | 'lit14_abcdefgh' | 'lit15_abcdefgh' | 'lit16_abcdefgh' | 'lit17_abcdefgh' | 'lit18_abcdefgh' | 'lit19_abcdefgh' | null { return null; }"} | ${"wide"}     | ${'wide(a: string): "lit00_abcdefgh" | "lit01_abcdefgh" | "lit02_abcdefgh" | "lit03_abcdefgh" | "lit04_abcdefgh" | "lit05_abcdefgh" | "lit06_abcdefgh" | "lit07_abcdefgh" | "lit08_abcdefgh" | "lit09_abcdefgh" | "lit10_abcdefgh" | "lit11_abcdefgh" | "lit12_abcdefgh" | "lit13_abcdefgh" | "lit14_abcdefgh" | "lit15_abcdefgh" | "lit16_abcdefgh" | "lit17_abcdefgh" | "lit18_abcdefgh" | "lit19_abcdefgh" | null'}
  `(
    "renders $name as written in source: $signature",
    ({ source, name, signature }) => {
      expect(extract(source, name).signature).toBe(signature);
    },
  );

  it.each`
    source                                                                               | name      | param  | type
    ${"/** @param a - x */\nfunction nul(a: string | null): string { return ''; }"}      | ${"nul"}  | ${"a"} | ${"string | null"}
    ${"/** @param a - x */\nfunction und(a: string | undefined): string { return ''; }"} | ${"und"}  | ${"a"} | ${"string | undefined"}
    ${"/** @param a - x */\nfunction optp(a?: string): string { return ''; }"}           | ${"optp"} | ${"a"} | ${"string"}
  `(
    "types param $param of $name as written: $type",
    ({ source, name, param, type }) => {
      const doc = extract(source, name);
      expect(doc.params.find((p) => p.name === param)?.type).toBe(type);
    },
  );

  it("keeps the options of an optional options parameter, without an implicit undefined", () => {
    const doc = extractFn(
      "interface O { unit?: string; zone: string | null }\n/** @param options - opts */\nfunction withOpts(a: string, options?: O): string { return a; }",
      "withOpts",
    );
    expect(doc.options).toHaveLength(1);
    expect(doc.options[0].param).toBe("options");
    expect(shown(doc.options[0].rows)).toEqual([
      {
        name: "unit",
        optional: true,
        type: "string",
        description: "",
        defaultValue: undefined,
      },
      {
        name: "zone",
        optional: false,
        type: "string | null",
        description: "",
        defaultValue: undefined,
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// The prose of a function's JSDoc
// ---------------------------------------------------------------------------

describe("function JSDoc prose", () => {
  const body = "function f(a: string): string { return a; }";

  it("joins a summary wrapped over several lines, and starts the bullets at the first `- `", () => {
    const doc = extractFn(
      `/**
 * Return true if \`a\` and \`b\` form a valid range — both parseable as
 * ISO strings and \`a <= b\`.
 *
 * - Both inputs must be ISO strings, as
 *   \`isValid\` accepts.
 * - Invalid input returns \`false\`.
 */
${body}`,
      "f",
    );
    expect(doc.description).toBe(
      "Return true if `a` and `b` form a valid range — both parseable as ISO strings and `a <= b`.",
    );
    expect(doc.behavior).toEqual([
      "Both inputs must be ISO strings, as `isValid` accepts.",
      "Invalid input returns `false`.",
    ]);
  });

  it("ends the summary at a bullet that follows it with no blank line", () => {
    const doc = extractFn(
      `/**
 * Add a day.
 * - Returns "" on invalid input.
 */
${body}`,
      "f",
    );
    expect(doc.description).toBe("Add a day.");
    expect(doc.behavior).toEqual(['Returns "" on invalid input.']);
  });

  it("keeps a second paragraph as an item of its own", () => {
    const doc = extractFn(
      `/**
 * Add a day.
 *
 * The convention is always
 * explicit.
 *
 * - Returns "" on invalid input.
 */
${body}`,
      "f",
    );
    expect(doc.description).toBe("Add a day.");
    expect(doc.behavior).toEqual([
      "The convention is always explicit.",
      'Returns "" on invalid input.',
    ]);
  });

  it("keeps the rows of a table on lines of their own, inside the item they belong to", () => {
    const doc = extractFn(
      `/**
 * Roll a date.
 *
 * - One call replaces
 *   several:
 *
 * | Before | After |
 * | --- | --- |
 * | \`a <= b\` | \`f(a)\` |
 *
 * - Returns "" on invalid input.
 */
${body}`,
      "f",
    );
    expect(doc.behavior).toEqual([
      "One call replaces several:\n| Before | After |\n| --- | --- |\n| `a <= b` | `f(a)` |",
      'Returns "" on invalid input.',
    ]);
  });

  it("does not read a table directly under the summary as part of it", () => {
    const doc = extractFn(
      `/**
 * Roll a date.
 * | Before | After |
 * | --- | --- |
 * | x | y |
 */
${body}`,
      "f",
    );
    expect(doc.description).toBe("Roll a date.");
    expect(doc.behavior).toEqual([
      "| Before | After |\n| --- | --- |\n| x | y |",
    ]);
  });

  it("puts back the braces TypeScript reads as a JSDoc type on @returns and after a @param name", () => {
    const doc = extractFn(
      `/**
 * Read the quarter.
 * @param a the date
 * @param options { inclusive?: boolean = true } how to compare
 * @returns { year, quarter }, or null on invalid input
 */
function f(a: string, options?: { inclusive?: boolean }): { year: number; quarter: number } | null { return null; }`,
      "f",
    );
    expect(doc.returns).toBe("{ year, quarter }, or null on invalid input");
    expect(doc.params).toEqual([
      { name: "a", type: "string", description: "the date" },
    ]);
    expect(doc.options[0].lead).toBe(
      "{ inclusive?: boolean = true } how to compare",
    );
  });

  it("keeps a @param whose whole text is a brace expression", () => {
    const doc = extractFn(
      `/**
 * @param a the date
 * @param calendar { pattern, yearEndsOn }
 * @returns the period
 */
function f(a: string, calendar: string): string { return a; }`,
      "f",
    );
    expect(doc.params.map((p) => [p.name, p.description])).toEqual([
      ["a", "the date"],
      ["calendar", "{ pattern, yearEndsOn }"],
    ]);
  });

  it("leaves a real JSDoc type before the name out of the description", () => {
    const doc = extractFn(
      `/**
 * @param {string} a the date
 * @returns the date
 */
${body}`,
      "f",
    );
    expect(doc.params).toEqual([
      { name: "a", type: "string", description: "the date" },
    ]);
    expect(doc.returns).toBe("the date");
  });
});

// ---------------------------------------------------------------------------
// Options: which parameters expand, and what a row holds
// ---------------------------------------------------------------------------

describe("options blocks", () => {
  const PROPERTY = `
      /** How to resolve an out-of-range day. */
      overflow?: "constrain" | "reject";
      /**
       * The zone to read the wall clock in.
       * @defaultValue \`"UTC"\`
       */
      timeZone?: string;
      /** The unit to count in. */
      unit: string;`;

  // The four forms a public options parameter is declared in.
  it.each`
    form | source
    ${"inline literal"} | ${`function f(a: string, options?: {${PROPERTY}
}): string { return a; }`}
    ${"public interface"} | ${`interface O {${PROPERTY}
}
function f(a: string, options?: O): string { return a; }`}
    ${"public alias"} | ${`type O = {${PROPERTY}
};
function f(a: string, options?: O): string { return a; }`}
    ${"intersection"} | ${`interface Base {${PROPERTY}
}
function f(a: string, options?: Base & {}): string { return a; }`}
  `("an $form produces the same rows", ({ source }) => {
    const doc = extractFn(source, "f");
    expect(doc.options).toHaveLength(1);
    expect(shown(doc.options[0].rows)).toEqual([
      {
        name: "overflow",
        optional: true,
        type: '"constrain" | "reject"',
        description: "How to resolve an out-of-range day.",
        defaultValue: undefined,
      },
      {
        name: "timeZone",
        optional: true,
        type: "string",
        description: "The zone to read the wall clock in.",
        defaultValue: '`"UTC"`',
      },
      {
        name: "unit",
        optional: false,
        type: "string",
        description: "The unit to count in.",
        defaultValue: undefined,
      },
    ]);
  });

  it("carries a property's JSDoc and @defaultValue to the table, and marks a required option", () => {
    const doc = extractFn(
      `function f(a: string, options?: {${PROPERTY}
}): string { return a; }`,
      "f",
    );
    const table = renderOptionsTable(doc.options[0].rows, {
      typeUrl: () => undefined,
    });
    expect(table).toContain(
      '| `timeZone?` | `string` | `"UTC"` | The zone to read the wall clock in. |',
    );
    expect(table).toContain(
      "| `unit` | `string` | Required | The unit to count in. |",
    );
  });

  it("reads no default from the function's prose", () => {
    const doc = extractFn(
      "/** @param options optional: `unit` (default: `day`) */\nfunction f(a: string, options?: { unit?: string }): string { return a; }",
      "f",
    );
    expect(doc.options[0].rows[0].defaultValue).toBeUndefined();
    expect(doc.options[0].lead).toBe("optional: `unit` (default: `day`)");
  });

  it("prints a union alias as its literals and names the alias for a link", () => {
    const doc = extractFn(
      'type Overflow = "constrain" | "reject";\nfunction f(a: string, options?: { overflow?: Overflow; mode: Overflow }): string { return a; }',
      "f",
    );
    expect(
      doc.options[0].rows.map((r) => [r.name, r.type, r.typeRefs]),
    ).toEqual([
      ["overflow", '"constrain" | "reject"', ["Overflow"]],
      ["mode", '"constrain" | "reject"', ["Overflow"]],
    ]);
  });

  it("expands an inline literal under any name, and a named type only under an options name", () => {
    const doc = extractFn(
      `
      interface Calendar { weekend: number[] }
      interface Opts { strict?: boolean }
      /**
       * @param calendar the calendar
       * @param range the range
       * @param options how to compare
       * @param units the units
       */
      function f(
        calendar: Calendar | undefined,
        range: { start: string; end: string },
        options: Opts,
        units?: Partial<Opts>,
      ): string { return ""; }
    `,
      "f",
    );
    expect(doc.options.map((b) => [b.param, b.rule, b.typeName])).toEqual([
      ["range", 1, undefined],
      ["options", 2, "Opts"],
    ]);
    expect(doc.options.map((b) => b.lead)).toEqual([
      "the range",
      "how to compare",
    ]);
    expect(doc.params.map((p) => p.name)).toEqual(["calendar", "units"]);
  });

  // Rule 2 reads the declared name, and nothing else: not whether the parameter is optional,
  // and not what the @param tag calls it.
  it.each`
    declared                     | expands
    ${"options: Opts"}           | ${true}
    ${"options?: Opts"}          | ${true}
    ${"optionsArg?: Opts"}       | ${true}
    ${"formatOptions: Opts"}     | ${true}
    ${"props: Opts"}             | ${true}
    ${"calendar?: Opts"}         | ${false}
    ${"calendar: Opts"}          | ${false}
    ${"settings?: Opts"}         | ${false}
    ${"propsBag: Opts"}          | ${false}
    ${"options?: Opts[]"}        | ${false}
    ${"options?: Partial<Opts>"} | ${false}
  `(
    "a named object type declared `$declared` expands: $expands",
    ({ declared, expands }) => {
      const doc = extractFn(
        `interface Opts { strict?: boolean }
/** @param options how to compare */
function f(a: string, ${declared}): string { return a; }`,
        "f",
      );
      expect(doc.options.map((b) => b.rule)).toEqual(expands ? [2] : []);
    },
  );

  it("expands a parameter declared as a generic public type", () => {
    const doc = extractFn(
      "interface Rounding<U extends string> { smallestUnit?: U }\nfunction f(a: string, options?: Rounding<'day' | 'hour'>): string { return a; }",
      "f",
    );
    expect(doc.options.map((b) => [b.param, b.rule, b.typeName])).toEqual([
      ["options", 2, "Rounding"],
    ]);
    expect(doc.options[0].rows.map((r) => [r.name, r.type])).toEqual([
      ["smallestUnit", '"day" | "hour"'],
    ]);
  });

  it("pairs a leftover @param with the leftover parameter, so `options` finds `optionsArg`", () => {
    const doc = extractFn(
      "/**\n * @param value the date\n * @param options how to round\n */\nfunction f(value: string, optionsArg?: { unit?: string }): string { return value; }",
      "f",
    );
    expect(doc.params.map((p) => p.name)).toEqual(["value"]);
    expect(doc.options[0].param).toBe("optionsArg");
    expect(doc.options[0].lead).toBe("how to round");
    expect(doc.declaredParams).toEqual(["value", "optionsArg"]);
    expect(doc.documentedParams.map((p) => p.name)).toEqual([
      "value",
      "options",
    ]);
  });

  it("does not read a JSDoc comment written on the same line as the brace before it", () => {
    // TypeScript attaches a comment to a member only when it starts on a line of its own, so
    // an editor shows nothing for this one either. The row stays empty and the gate reports it.
    const doc = extractFn(
      "function f(a: string, options?: { /** The unit. */ unit?: string }): string { return a; }",
      "f",
    );
    expect(doc.options[0].rows[0].description).toBe("");
  });

  it("leaves @param tags alone when they cannot be paired with the parameters", () => {
    const doc = extractFn(
      "/**\n * @param value1 first\n * @param value2 second\n */\nfunction f(props: { value1: string; value2: string }): boolean { return true; }",
      "f",
    );
    expect(doc.params.map((p) => p.name)).toEqual(["value1", "value2"]);
    expect(doc.options[0].param).toBe("props");
    expect(doc.options[0].lead).toBe("");
  });

  it("treats each named member of a rest tuple as a parameter", () => {
    const doc = extractFn(
      "/**\n * @param stepDays the step\n * @param options how to walk\n */\nfunction f(...input: [stepDays?: number, options?: { limit?: number }]): string { return ''; }",
      "f",
    );
    expect(doc.declaredParams).toEqual(["stepDays", "options"]);
    expect(doc.options.map((b) => b.param)).toEqual(["options"]);
    expect(doc.options[0].rows.map((r) => r.name)).toEqual(["limit"]);
    expect(doc.params.map((p) => p.name)).toEqual(["stepDays"]);
  });

  it("marks properties a TypeScript lib file declares, and not one a GMT interface redeclares", () => {
    const doc = extractFn(
      "interface O extends Intl.DateTimeFormatOptions {\n  /** The zone. */\n  timeZone?: string;\n}\nfunction f(a: string, options?: O): string { return a; }",
      "f",
    );
    const rows = doc.options[0].rows;
    const timeZone = rows.find((r) => r.name === "timeZone")!;
    expect(timeZone.fromLib).toBe(false);
    expect(timeZone.description).toBe("The zone.");
    const lib = rows.filter((r) => r.fromLib);
    expect(lib.length).toBeGreaterThan(5);
    expect(new Set(lib.map((r) => r.libType))).toEqual(
      new Set(["Intl.DateTimeFormatOptions"]),
    );
    expect(lib.map((r) => r.name)).not.toContain("timeZone");
  });
});

// ---------------------------------------------------------------------------
// What extraction hands the documentation gate
// ---------------------------------------------------------------------------

describe("inline object literals", () => {
  const SRC = `
    /**
     * @param value the date
     * @param props what to compare
     * @returns the parts
     */
    function f(
      value: string,
      props: {
        /** The settings. @defaultValue None. */
        options?: {
          /** Whether equal counts. @defaultValue \`false\` */
          allowEqual?: boolean;
        };
      },
    ): { type: string; value: string }[] | null { return null; }

    /** One quarter. */
    function g(): { year: number; quarter: number } { return { year: 1, quarter: 1 }; }`;

  it("extracts the members of a nested literal, and prints the parent as object", () => {
    const [options] = extractFn(SRC, "f").options[0].rows;
    expect(options.type).toBe("object");
    expect(shown(options.children!)).toEqual([
      {
        name: "allowEqual",
        optional: true,
        type: "boolean",
        description: "Whether equal counts.",
        defaultValue: "`false`",
      },
    ]);
    expect(options.children![0].source?.line).toBeGreaterThan(0);
  });

  it("extracts the members of a returned literal, through an array and null", () => {
    const f = extractFn(SRC, "f");
    expect(f.returnMembers.map((r) => r.name)).toEqual(["type", "value"]);
    expect(f.returnsItems).toBe(true);
    const g = extractFn(SRC, "g");
    expect(g.returnMembers.map((r) => r.name)).toEqual(["year", "quarter"]);
    expect(g.returnsItems).toBe(false);
  });

  it("renders the nested rows in the Options table, with dotted names", () => {
    const page = placed(SRC).fnPage("f");
    expect(section(page, "Options").join("\n")).toContain(
      "| `options.allowEqual?` | `boolean` | `false` | Whether equal counts. |",
    );
  });

  it("renders a Members table under Returns for a returned literal", () => {
    const page = placed(SRC).fnPage("g");
    const returns = section(page, "Returns");
    expect(returns[0]).toBe("**Members**");
    expect(returns.join("\n")).toContain("| `year` | `number` | — |");
    expect(placed(SRC).fnPage("f")).toContain("**Members of each item**");
  });

  it("gates a nested option, and requires a description on each returned member", () => {
    expect(gapsFor(SRC, "g")).toEqual([
      "return-description g.returns.quarter",
      "return-description g.returns.year",
    ]);
    expect(gapsFor(SRC, "f")).toEqual([
      "return-description f.returns[].type",
      "return-description f.returns[].value",
    ]);
  });

  /** As the describe below, for any source. */
  function gapsFor(src: string, name: string): string[] {
    const doc = extractFn(src, name);
    return findGaps({
      functions: [
        {
          name: doc.name,
          namespace: doc.namespace,
          file: `packages/gmt/src/${doc.sourcePath}`,
          line: doc.line,
          declaredParams: doc.declaredParams,
          documentedParams: doc.documentedParams,
          options: doc.options,
          returnMembers: doc.returnMembers,
          returnsItems: doc.returnsItems,
        },
      ],
      types: [],
    }).map((g) => `${g.rule} ${g.subject}`);
  }
});

describe("extraction for the documentation gate", () => {
  /** The gate's findings for one in-memory function, as `rule subject` strings. */
  function gapsFor(src: string, name: string): string[] {
    const doc = extractFn(src, name);
    return findGaps({
      functions: [
        {
          name: doc.name,
          namespace: doc.namespace,
          file: `packages/gmt/src/${doc.sourcePath}`,
          line: doc.line,
          declaredParams: doc.declaredParams,
          documentedParams: doc.documentedParams,
          options: doc.options,
          returnMembers: doc.returnMembers,
          returnsItems: doc.returnsItems,
        },
      ],
      types: [],
    }).map((g) => `${g.rule} ${g.subject}`);
  }

  const documented = (body: string) => `
      /**
       * @param value the date
       * @param options how to add
       */
      function f(value: string, options?: {
${body}
      }): string { return value; }`;

  it("finds nothing on a documented option with a @defaultValue", () => {
    expect(
      gapsFor(
        documented(`
        /**
         * How an out-of-range day is resolved.
         * @defaultValue \`"constrain"\`
         */
        overflow?: string;`),
        "f",
      ),
    ).toEqual([]);
  });

  it("finds a missing description and a missing default", () => {
    expect(gapsFor(documented("        overflow?: string;"), "f")).toEqual([
      "default-value f.options.overflow",
      "option-description f.options.overflow",
    ]);
  });

  it("finds @default, and does not also ask for the @defaultValue it stands in for", () => {
    expect(
      gapsFor(
        documented(`
        /**
         * How an out-of-range day is resolved.
         * @default "constrain"
         */
        overflow?: string;`),
        "f",
      ),
    ).toEqual(["default-tag f.options.overflow"]);
  });

  it("finds a list in a property description", () => {
    expect(
      gapsFor(
        documented(`
        /**
         * How an out-of-range day is resolved:
         * - constrain clamps
         * - reject fails
         * @defaultValue \`"constrain"\`
         */
        overflow?: string;`),
        "f",
      ),
    ).toEqual(["list-in-description f.options.overflow"]);
  });

  it("finds a @param that names no parameter, and a dotted one", () => {
    const src = `
      /**
       * @param value the date
       * @param options how to add
       * @param options.unit the unit
       * @param extra nothing declares this
       */
      function f(valueInput: string, options?: {
        /**
         * The unit.
         * @defaultValue \`"day"\`
         */
        unit?: string;
      }): string { return valueInput; }`;
    expect(gapsFor(src, "f")).toEqual([
      "param-name f(@param value)",
      "param-name f(@param options.unit)",
      "param-name f(@param extra)",
    ]);
    // Each tag is reported on its own line.
    expect(extractFn(src, "f").documentedParams).toEqual([
      { name: "value", line: 3 },
      { name: "options", line: 4 },
      { name: "options.unit", line: 5 },
      { name: "extra", line: 6 },
    ]);
  });

  it("reads the @param tags of an arrow function from its statement", () => {
    const { checker, sourceFile } = compile(
      "/**\n * @param a the first\n * @param c nothing declares this\n */\nconst f = (a: string, b: string): string => a + b;",
    );
    let doc: FnDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isVariableStatement(node)) {
        doc = BR.extractArrowFn(
          checker,
          node.declarationList.declarations[0],
          "plain",
          "compare",
          gmtPath("plain/compare.ts"),
        );
      }
    });
    expect(doc!.declaredParams).toEqual(["a", "b"]);
    expect(doc!.documentedParams.map((p) => p.name)).toEqual(["a", "c"]);
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
    expect(result!.description).toBe("A duration unit enum.");
    expect(result!.members).toEqual([]);
    expect(result!.sourcePath).toBe("types/duration.ts");
  });

  it("joins a multi-line JSDoc summary onto one line, up to the first blank line or bullet", () => {
    const alias = extractTypeDoc(
      `
      /**
       * How an out-of-range day is resolved,
       * wrapped over two lines.
       *
       * A second paragraph that is not the summary.
       */
      type Overflow = "constrain" | "reject";
    `,
      "Overflow",
    );
    expect(alias.description).toBe(
      "How an out-of-range day is resolved, wrapped over two lines.",
    );

    const iface = extractTypeDoc(
      `
      /**
       * The span between two events,
       * as a duration and a day count.
       * - A detail that is not part of the summary.
       */
      interface Dwell { duration: string }
    `,
      "Dwell",
    );
    expect(iface.description).toBe(
      "The span between two events, as a duration and a day count.",
    );
  });

  it("falls back to the // comment above a type that has no JSDoc", () => {
    const doc = extractTypeDoc(
      "// used in add() and subtract()\ntype Overflow = string;",
      "Overflow",
    );
    expect(doc.description).toBe("used in add() and subtract()");
  });

  it("leaves the description empty when the type has no comment at all", () => {
    expect(extractTypeDoc("type Bare = string;", "Bare").description).toBe("");
    expect(
      extractTypeDoc("interface Bare { a: string }", "Bare").description,
    ).toBe("");
  });

  it("gives an object-literal alias and an intersection alias their members", () => {
    const literal = extractTypeDoc(
      "type Interval = {\n  /** The first instant. */\n  start: string;\n  end?: string;\n};",
      "Interval",
    );
    expect(shown(literal.members)).toEqual([
      {
        name: "start",
        optional: false,
        type: "string",
        description: "The first instant.",
        defaultValue: undefined,
      },
      {
        name: "end",
        optional: true,
        type: "string",
        description: "",
        defaultValue: undefined,
      },
    ]);

    const intersection = extractTypeDoc(
      "interface A { a: string }\ntype Both = A & { b?: number };",
      "Both",
    );
    expect(intersection.members.map((m) => m.name)).toEqual(["a", "b"]);
  });

  it("gives a union alias no members", () => {
    expect(
      extractTypeDoc("type Either = { a: string } | { b: string };", "Either")
        .members,
    ).toEqual([]);
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
    expect(result!.description).toBe("Date options.");
    expect(shown(result!.members)).toEqual([
      {
        name: "relativeTo",
        optional: true,
        type: "string",
        description: "",
        defaultValue: undefined,
      },
      {
        name: "roundingIncrement",
        optional: true,
        type: "number",
        description: "",
        defaultValue: undefined,
      },
    ]);
    // Each row records where it is declared, for the documentation gate.
    expect(result!.members.map((m) => m.source?.line)).toEqual([4, 5]);
  });

  it("includes the members an interface inherits", () => {
    const doc = extractTypeDoc(
      "interface Base { timeZone?: string }\ninterface Child extends Base { unit: string }",
      "Child",
    );
    expect(doc.members.map((m) => m.name).sort()).toEqual(["timeZone", "unit"]);
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

  it("reads the description and examples from JSDoc, not a // comment inside it", () => {
    const src = `
      /**
       * RegExp matching a 4-digit year, wrapped
       * over two lines.
       *
       * - A detail that is not part of the summary.
       *
       * @example year.test("2021") // true
       * @example year.test("21")   // false (two digits)
       */
      export const year: RegExp = /^\\d{4}$/;
    `;
    const { checker, sourceFile } = compile(src);
    let result: RegexDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === "year") {
            result = BR.extractRegex(
              checker,
              decl,
              "regex",
              "year",
              gmtPath("regex/year.ts"),
            );
          }
        }
      }
    });
    expect(result).toBeDefined();
    expect(result!.description).toBe(
      "RegExp matching a 4-digit year, wrapped over two lines.",
    );
    expect(result!.examples).toEqual([
      { call: 'year.test("2021")', result: "true", note: undefined },
      {
        call: 'year.test("21")',
        result: "false (two digits)",
        note: undefined,
      },
    ]);
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
// buildChoiceSeeds
// ---------------------------------------------------------------------------

describe("buildChoiceSeeds", () => {
  const spec = (optional = false) => ({
    module: "intermodal/edi",
    fn: "parseStamp",
    returnType: "string" as const,
    params: [
      { name: "value", type: "string" as const, value: "202406151430" },
      {
        name: "format",
        type: "enum" as const,
        value: "203",
        options: ["203", "204"],
        ...(optional ? { optional: true } : {}),
      },
    ],
  });
  const fieldsFor = (call: string, optional = false) =>
    BR.buildPlaygroundFields(spec(optional), call)!.fields;

  const fieldsFor3 = (sp: ReturnType<typeof spec>, call: string) =>
    BR.buildPlaygroundFields(sp, call)!.fields;

  it("stores the other fields' values for each choice's example", () => {
    const examples = [
      { call: 'parseStamp("202406151430", "203")', result: '"2024-06-15"' },
      { call: 'parseStamp("20240615143000", "204")', result: '"2024-06-15"' },
    ];
    expect(
      BR.buildChoiceSeeds(spec(), examples, fieldsFor(examples[0].call)),
    ).toEqual({
      format: {
        "203": { value: { seed: "202406151430" } },
        "204": { value: { seed: "20240615143000" } },
      },
    });
  });

  it("leaves out a choice that has no example", () => {
    const examples = [
      { call: 'parseStamp("202406151430", "203")', result: '"a"' },
      { call: 'parseStamp("202406151431", "203")', result: '"b"' },
    ];
    // One choice only: nothing varies by choice, so nothing is emitted.
    expect(
      BR.buildChoiceSeeds(spec(), examples, fieldsFor(examples[0].call)),
    ).toBeUndefined();
  });

  it("gives a three-choice enum entries only for the choices with examples", () => {
    const base = spec();
    const three = {
      ...base,
      params: [
        base.params[0],
        { ...base.params[1], options: ["203", "204", "102"] },
      ],
    };
    const examples = [
      { call: 'parseStamp("202406151430", "203")', result: '"a"' },
      { call: 'parseStamp("20240615143000", "204")', result: '"b"' },
    ];
    const seeds = BR.buildChoiceSeeds(
      three,
      examples,
      fieldsFor3(three, examples[0].call),
    )!;
    expect(Object.keys(seeds.format)).toEqual(["203", "204"]);
  });

  it("skips an example whose documented result is a sentinel", () => {
    const examples = [
      { call: 'parseStamp("202406151430", "203")', result: '"a"' },
      { call: 'parseStamp("not a stamp", "204")', result: '""' },
    ];
    expect(
      BR.buildChoiceSeeds(spec(), examples, fieldsFor(examples[0].call)),
    ).toBeUndefined();
    for (const bad of ["null", "false", "[]", "// null", '"" (invalid)']) {
      const withBad = [examples[0], { ...examples[1], result: bad }];
      expect(
        BR.buildChoiceSeeds(spec(), withBad, fieldsFor(examples[0].call)),
      ).toBeUndefined();
    }
  });

  it("falls through to the next example for the same choice, first one winning", () => {
    const examples = [
      { call: 'parseStamp("202406151430", "203")', result: '"a"' },
      { call: 'parseStamp("bad", "204")', result: "null" },
      { call: 'parseStamp("20240615143000", "204")', result: '"b"' },
      { call: 'parseStamp("20240615143001", "204")', result: '"c"' },
    ];
    expect(
      BR.buildChoiceSeeds(spec(), examples, fieldsFor(examples[0].call))!
        .format["204"],
    ).toEqual({ value: { seed: "20240615143000" } });
  });

  it("ignores an example the form cannot hold", () => {
    const examples = [
      { call: 'parseStamp("202406151430", "203")', result: '"a"' },
      { call: 'parseStamp(someVar, "204")', result: '"b"' },
    ];
    expect(
      BR.buildChoiceSeeds(spec(), examples, fieldsFor(examples[0].call)),
    ).toBeUndefined();
  });

  it("handles an optional enum: the blank option gets no entry", () => {
    const optSpec = spec(true);
    const examples = [
      { call: 'parseStamp("202406151430")', result: '"a"' },
      { call: 'parseStamp("202406151430", "203")', result: '"b"' },
      { call: 'parseStamp("20240615143000", "204")', result: '"c"' },
    ];
    const seeds = BR.buildChoiceSeeds(
      optSpec,
      examples,
      fieldsFor(examples[0].call, true),
    )!;
    expect(Object.keys(seeds.format)).toEqual(["203", "204"]);
    expect(seeds.format["204"].value.seed).toBe("20240615143000");
  });

  it("returns undefined for a function with no enum field", () => {
    const plain = {
      module: "plain/x",
      fn: "f",
      returnType: "string" as const,
      params: [{ name: "v", type: "string" as const, value: "a" }],
    };
    const fields = BR.buildPlaygroundFields(plain, 'f("a")')!.fields;
    expect(
      BR.buildChoiceSeeds(plain, [{ call: 'f("a")', result: '"x"' }], fields),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildPlaygroundFields
// ---------------------------------------------------------------------------

describe("buildPlaygroundFields", () => {
  it("maps bigint params from their `n`-suffixed example literals", () => {
    // Regression: `NUMERIC_ARG` rejected `1710072000123456789n`, which made
    // fieldForParam return null and dropped the whole precision namespace's
    // playgrounds. Seeds carry the digits alone; formatArg re-adds the `n`.
    const res = BR.buildPlaygroundFields(
      {
        module: "precision/calculate",
        fn: "truncateNanoseconds",
        returnType: "bigint",
        params: [
          { name: "nanoseconds", type: "bigint", value: "1710072000123456789" },
          {
            name: "unit",
            type: "enum",
            value: "us",
            options: ["ms", "us", "ns"],
          },
        ],
      },
      'truncateNanoseconds(1710072000123456789n, "us")',
    );
    expect(res).toEqual({
      fields: [
        {
          name: "nanoseconds",
          kind: "bigint",
          seed: "1710072000123456789",
        },
        { name: "unit", kind: "enum", seed: "us", choices: ["ms", "us", "ns"] },
      ],
    });
  });

  it("accepts a negative bigint literal and a bare integer for a bigint param", () => {
    const spec = {
      module: "precision/convert",
      fn: "fromNanoseconds",
      returnType: "string" as const,
      params: [{ name: "nanoseconds", type: "bigint" as const, value: "0" }],
    };
    expect(
      BR.buildPlaygroundFields(spec, "fromNanoseconds(-1000000000n)"),
    ).toEqual({
      fields: [{ name: "nanoseconds", kind: "bigint", seed: "-1000000000" }],
    });
    expect(BR.buildPlaygroundFields(spec, "fromNanoseconds(0)")).toEqual({
      fields: [{ name: "nanoseconds", kind: "bigint", seed: "0" }],
    });
  });

  it("maps clean positional params to fields", () => {
    const res = BR.buildPlaygroundFields(
      {
        module: "duration",
        fn: "durationAs",
        returnType: "number",
        params: [
          { name: "value", type: "string", value: "P1DT2H30M" },
          {
            name: "unit",
            type: "enum",
            value: "hours",
            options: ["hours", "minutes"],
          },
        ],
        options: [{ name: "relativeTo", type: "string", value: "" }],
      },
      'durationAs("P1DT2H30M", "hours")',
    );
    expect(res).toEqual({
      fields: [
        { name: "value", kind: "string", seed: "P1DT2H30M" },
        {
          name: "unit",
          kind: "enum",
          seed: "hours",
          choices: ["hours", "minutes"],
        },
      ],
    });
  });

  it("promotes a bare-number example arg to a number field", () => {
    const res = BR.buildPlaygroundFields(
      {
        module: "unix",
        fn: "parseYearFromUnix",
        returnType: "number",
        params: [{ name: "value", type: "string", value: "1700000000000" }],
      },
      "parseYearFromUnix(1700000000000)",
    );
    expect(res?.fields[0]).toEqual({
      name: "value",
      kind: "number",
      seed: "1700000000000",
    });
  });

  it("carries a trailing options object through as optionsSuffix", () => {
    const res = BR.buildPlaygroundFields(
      {
        module: "duration",
        fn: "normalizeDuration",
        returnType: "string",
        params: [{ name: "value", type: "string", value: "PT90M" }],
        options: [{ name: "largestUnit", type: "enum", value: "" }],
      },
      'normalizeDuration("PT90M", { largestUnit: "hour" })',
    );
    expect(res?.optionsSuffix).toBe('{ largestUnit: "hour" }');
  });

  it("builds units controls from a { unit: n } example arg", () => {
    const res = BR.buildPlaygroundFields(
      {
        module: "plain",
        fn: "addDate",
        returnType: "string",
        params: [
          { name: "value", type: "string", value: "2024-03-10" },
          {
            name: "duration",
            type: "units",
            value: "5",
            unitValue: "days",
            options: ["days", "months"],
          },
        ],
      },
      'addDate("2024-03-10", { days: 5 })',
    );
    expect(res?.fields[1]).toMatchObject({
      kind: "units",
      seed: "5",
      unitSeed: "days",
    });
  });

  it("builds a string list field from an array param", () => {
    const res = BR.buildPlaygroundFields(
      {
        module: "plain",
        fn: "maxDate",
        returnType: "string",
        params: [
          { name: "dates", type: "array", value: "", arrayType: "string" },
        ],
      },
      'maxDate(["2024-03-10", "2024-03-15", "2024-03-12"])',
    );
    expect(res?.fields[0]).toMatchObject({
      name: "dates",
      kind: "list",
      element: "string",
      items: ["2024-03-10", "2024-03-15", "2024-03-12"],
    });
  });

  it("builds an intervals field from a { start, end }[] param", () => {
    const res = BR.buildPlaygroundFields(
      {
        module: "plain",
        fn: "mergeIntervalsDate",
        returnType: "array",
        params: [
          {
            name: "intervals",
            type: "array",
            value: "",
            arrayType: "string",
            intervalShape: true,
          },
        ],
      },
      'mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-05", end: "2024-01-15" }])',
    );
    expect(res?.fields[0]).toMatchObject({
      name: "intervals",
      kind: "intervals",
      pairs: [
        ["2024-01-01", "2024-01-10"],
        ["2024-01-05", "2024-01-15"],
      ],
    });
  });

  it("allows the example to omit an optional trailing param", () => {
    const res = BR.buildPlaygroundFields(
      {
        module: "plain",
        fn: "getWeekNumber",
        returnType: "number",
        params: [
          { name: "dateStr", type: "string", value: "2024-01-01" },
          {
            name: "weekStartsOn",
            type: "enum",
            value: "",
            options: ["monday", "sunday"],
            optional: true,
          },
        ],
      },
      'getWeekNumber("2024-01-01")',
    );
    expect(res?.fields).toEqual([
      { name: "dateStr", kind: "string", seed: "2024-01-01" },
      {
        name: "weekStartsOn",
        kind: "enum",
        seed: "",
        choices: ["monday", "sunday"],
        optional: true,
      },
    ]);
  });

  it("still bails on a required missing param or a non-literal arg", () => {
    const missingRequired = BR.buildPlaygroundFields(
      {
        module: "duration",
        fn: "formatDuration",
        returnType: "string",
        params: [
          { name: "value", type: "string", value: "P1D" },
          { name: "locale", type: "string", value: "" },
        ],
      },
      'formatDuration("P1D")',
    );
    expect(missingRequired).toBeUndefined();

    const callExprArg = BR.buildPlaygroundFields(
      {
        module: "plain",
        fn: "foo",
        returnType: "string",
        params: [{ name: "value", type: "string", value: "" }],
      },
      "foo(new Date())", // date-ban: source text in a fixture, asserting the playground builder rejects a call expression it cannot parse
    );
    expect(callExprArg).toBeUndefined();
  });

  it("rebuilds a destructured object-arg call from its keys", () => {
    const res = BR.buildPlaygroundFields(
      {
        module: "plain",
        fn: "isValidDateRange",
        returnType: "boolean",
        params: [
          { name: "value1", type: "string", value: "" },
          { name: "value2", type: "string", value: "" },
          { name: "options", type: "string", value: "" },
        ],
      },
      'isValidDateRange({ value1: "2024-02-28", value2: "2024-02-29" })',
    );
    expect(res?.objectArg).toBe(true);
    expect(res?.fields).toEqual([
      { name: "value1", kind: "string", seed: "2024-02-28" },
      { name: "value2", kind: "string", seed: "2024-02-29" },
    ]);
  });

  it("returns an empty field list for a no-arg function", () => {
    const res = BR.buildPlaygroundFields(
      { module: "unix", fn: "getUnixNow", returnType: "number", params: [] },
      "getUnixNow()",
    );
    expect(res).toEqual({ fields: [] });
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
        );
      }
    });
    expect(doc).toBeDefined();
    expect(doc!.livePlaygroundTemplate).toBeDefined();
    expect(doc!.livePlaygroundTemplate!.allowEmptyArray).toBe(true);
  });

  /** Extract one declared function the way the generator does. */
  function templateFor(src: string, name: string) {
    const { checker, sourceFile } = compile(src);
    let doc: FnDoc | undefined;
    sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
        doc = BR.extractFunction(
          checker,
          node,
          "zoned",
          "interval",
          gmtPath("zoned/interval.ts"),
        );
      }
    });
    return doc?.livePlaygroundTemplate;
  }

  it("classifies an object | null result as object, with no empty flag by default", () => {
    const t = templateFor(
      `
      interface Dwell { duration: string; calendarDays: number }
      /** Dwell.
       * @example dwellTime("2024-06-15T23:00:00Z", "2024-06-16T01:00:00Z", "UTC") // { duration: "PT2H", calendarDays: 1 }
       */
      function dwellTime(entry: string, exit: string, zone?: string): Dwell | null { return null; }
    `,
      "dwellTime",
    );
    expect(t?.returnType).toBe("object");
    expect(t?.nullIsEmpty).toBeUndefined();
  });

  it("sets nullIsEmpty for a function on the allowlist", () => {
    const t = templateFor(
      `
      /** Intersect.
       * @example intervalIntersectionZoned("a", "b", "c", "d") // null (touching)
       */
      function intervalIntersectionZoned(a: string, b: string, c: string, d: string): { start: string; end: string } | null { return null; }
    `,
      "intervalIntersectionZoned",
    );
    expect(t?.returnType).toBe("object");
    expect(t?.nullIsEmpty).toBe(true);
  });

  it("refuses an allowlisted name whose return is not an object", () => {
    expect(() =>
      templateFor(
        `
        /** Wrong shape.
         * @example intervalIntersectionZoned("a", "b", "c", "d") // ""
         */
        function intervalIntersectionZoned(a: string, b: string, c: string, d: string): string { return ""; }
      `,
        "intervalIntersectionZoned",
      ),
    ).toThrow(/NULL_IS_EMPTY/);
  });
});

// ---------------------------------------------------------------------------
// Placement: which page documents a type
// ---------------------------------------------------------------------------

/**
 * Every function and type of an in-memory source, extracted and placed as the generator
 * places them: all public, keyed `plain/calculate/<name>`, anchors set from each page's
 * headings.
 */
function placed(src: string) {
  const { checker, sourceFile, program } = compile(src);
  const ctx = contextFor(program, sourceFile);
  const file = gmtPath("plain/calculate/subject.ts");
  const functions: PublicFunctionDecl[] = [];
  const types: PublicTypeDecl[] = [];
  const fnDocs = new Map<string, FnDoc>();
  const typeDocs = new Map<string, TypeDoc>();
  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const key = `plain/calculate/${stmt.name.text}`;
      functions.push({ key, node: stmt });
      fnDocs.set(
        key,
        BR.extractFunction(checker, stmt, "plain", "calculate", file, ctx)!,
      );
    } else if (ts.isTypeAliasDeclaration(stmt)) {
      types.push({ name: stmt.name.text, node: stmt });
      typeDocs.set(
        stmt.name.text,
        BR.extractType(checker, stmt, "plain", "calculate", file, ctx),
      );
    } else if (ts.isInterfaceDeclaration(stmt)) {
      types.push({ name: stmt.name.text, node: stmt });
      typeDocs.set(
        stmt.name.text,
        BR.extractInterface(checker, stmt, "plain", "calculate", file, ctx),
      );
    }
  }
  const usage: TypeUsage = buildTypeUsage(checker, functions, types);
  for (const [key, doc] of fnDocs) doc.relatedTypes = usage.reach.get(key)!;
  assignInlineAnchors(usage, (key) => BR.fnHeadings(fnDocs.get(key)!, usage));
  const page: BR.PageContext = { usage, typeDocs };
  return {
    usage,
    fnDocs,
    typeDocs,
    fnPage: (name: string) =>
      BR.renderFn(fnDocs.get(`plain/calculate/${name}`)!, page),
    typePage: (name: string) => BR.renderType(typeDocs.get(name)!, page),
  };
}

/** The lines of one `## Section` of a page, without the heading. */
function section(mdx: string, heading: string): string[] {
  const lines = mdx.split("\n");
  const start = lines.indexOf(`## ${heading}`);
  expect(start, `page has ## ${heading}`).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).filter((l) => l !== "");
}

describe("placement", () => {
  const SOURCE = `
    /** How to resolve an out-of-range day. */
    type Overflow = "constrain" | "reject";
    /** A span between two instants. */
    interface Interval {
      /** Where it starts. */
      start: string;
    }
    /** What \`charge\` takes. */
    interface ChargeOptions {
      /** How to resolve an out-of-range day. */
      overflow?: Overflow;
    }
    /** One band of a tiered tariff. */
    interface TierBand {
      /** Days in the band. */
      days: number;
    }
    /** What \`charge\` returns. */
    interface Charges {
      /** The bands. */
      bands: TierBand[];
      /** How the count was rounded. */
      rounding: Rounding;
    }
    /** How a count is rounded. */
    type Rounding = "up" | "down";
    /** A callback. */
    type Visit = (day: string) => void;

    /**
     * Charge a stay.
     * @param span the stay
     * @param options how to charge
     * @param visit called per day
     * @returns the charges
     * @example charge({ start: "a" }, {}) // null
     */
    function charge(span: Interval, options: ChargeOptions, visit?: Visit): Charges | null { return null; }
    /**
     * Shift a span.
     * @param span the span
     * @param options how to shift
     * @returns the span
     */
    function shift(span: Interval, options?: { overflow?: Overflow }): Interval { return span; }
  `;

  it("gives a type two functions reach a page under /reference/types, with its import line and its users sorted", () => {
    const mdx = placed(SOURCE).typePage("Interval");
    expect(mdx).toContain('slug: "reference/types/Interval"');
    expect(mdx).toContain('import type { Interval } from "@northguild/gmt";');
    expect(section(mdx, "Members")).toContain(
      "| `start` | `string` | Where it starts. |",
    );
    expect(section(mdx, "Used by")).toEqual([
      "- [`charge`](/reference/plain/calculate/charge)",
      "- [`shift`](/reference/plain/calculate/shift)",
    ]);
  });

  it("shows the import line of a shared type that has no members", () => {
    const mdx = placed(SOURCE).typePage("Overflow");
    expect(mdx).toContain('import type { Overflow } from "@northguild/gmt";');
    expect(mdx).not.toContain("## Members");
  });

  it("documents a single-use type on its function's page, parameters first, then returns, depth-first", () => {
    const { fnPage, usage } = placed(SOURCE);
    const mdx = fnPage("charge");
    const types = section(mdx, "Types");
    // ChargeOptions is the type of the expanded `options` parameter: its Options block
    // documents it, so it is not repeated here.
    expect(types.filter((l) => l.startsWith("### "))).toEqual([
      "### Visit",
      "### Charges",
      "### TierBand",
      "### Rounding",
    ]);
    expect(usage.types.get("TierBand")!.placement).toEqual({
      kind: "inline",
      owner: "plain/calculate/charge",
      anchor: "tierband",
    });
    // Each inline type: its description, its import line, then what it is.
    expect(types).toContain("One band of a tiered tariff.");
    expect(types).toContain('import type { TierBand } from "@northguild/gmt";');
    expect(types).toContain("| `days` | `number` | Days in the band. |");
    // A member typed as another inline type links to its heading on this page.
    expect(types).toContain(
      '| `rounding` | `"up"` \\| `"down"` ([`Rounding`](#rounding)) | How the count was rounded. |',
    );
  });

  it("shows a literal union's values on one line, and any other alias as its definition", () => {
    const types = section(placed(SOURCE).fnPage("charge"), "Types");
    const after = (heading: string) => {
      const rest = types.slice(types.indexOf(heading) + 1);
      const end = rest.findIndex((l) => l.startsWith("### "));
      return end < 0 ? rest : rest.slice(0, end);
    };
    expect(after("### Rounding").slice(-3)).toEqual([
      "```ts",
      '"up" | "down"',
      "```",
    ]);
    expect(after("### Visit").slice(-3)).toEqual([
      "```ts",
      "type Visit = (day: string) => void;",
      "```",
    ]);
  });

  it("documents a single-use options type in its Options block, once: anchor, description, import line, table", () => {
    const source = `
      interface Shared { strict?: boolean }
      /** How \`a\` compares. */
      interface Own {
        /** Whether to be strict. */
        strict?: boolean;
      }
      /** @param options how to compare */
      function a(x: string, options: Own): string { return x; }
      function b(x: string, options?: Shared): string { return x; }
      function c(x: string, options?: Shared): string { return x; }
    `;
    const { fnPage, usage } = placed(source);
    const mdx = fnPage("a");
    expect(section(mdx, "Options")).toEqual([
      "**options**",
      "how to compare",
      '<a id="own"></a>',
      "How `a` compares.",
      "```ts",
      'import type { Own } from "@northguild/gmt";',
      "```",
      '<div class="gmt-ref-table" data-kind="options">',
      "| Option | Type | Default | Description |",
      "| --- | --- | --- | --- |",
      "| `strict?` | `boolean` | — | Whether to be strict. |",
      "</div>",
    ]);
    expect(usage.types.get("Own")!.placement).toEqual({
      kind: "inline",
      owner: "plain/calculate/a",
      anchor: "own",
    });
    // Not printed a second time, and with nothing else inline there is no Types section.
    expect(mdx).not.toContain("### Own");
    expect(mdx).not.toContain("## Types");
    expect(mdx.match(/\| `strict\?` \|/g)).toHaveLength(1);
    expect(BR.mdxIds(mdx).filter((id) => id === "own")).toHaveLength(1);

    // A shared options type has a page: the block links to it.
    expect(section(fnPage("b"), "Options")).toContain(
      "Type: [`Shared`](/reference/types/Shared).",
    );
    // An inline literal names no type, so the block has neither.
    const literal = placed(SOURCE).fnPage("shift");
    expect(literal).not.toContain("Type: [");
    expect(literal).not.toContain("<a id=");
  });

  it("keeps the types nested in an options type under Types", () => {
    const { fnPage, fnDocs, usage } = placed(`
      interface Band { days: number }
      interface Own { bands?: Band[] }
      function a(x: string, options: Own): string { return x; }
    `);
    const mdx = fnPage("a");
    expect(BR.optionTypesOf(fnDocs.get("plain/calculate/a")!, usage)).toEqual([
      "Own",
    ]);
    expect(section(mdx, "Types").filter((l) => l.startsWith("### "))).toEqual([
      "### Band",
    ]);
    // The row links to the nested type's heading on this page.
    expect(section(mdx, "Options")).toContain(
      "| `bands?` | `Band[]` ([`Band`](#band)) | — | — |",
    );
  });

  it("lists only shared types under Related types, and omits the section when there are none", () => {
    const { fnPage } = placed(SOURCE);
    expect(
      section(fnPage("charge"), "Related types").filter((l) =>
        l.startsWith("- "),
      ),
    ).toEqual([
      "- [`Interval`](/reference/types/Interval)",
      "- [`Overflow`](/reference/types/Overflow)",
    ]);
    const lone = placed(`
      interface Own { a: string }
      function f(x: Own): string { return x.a; }
    `).fnPage("f");
    expect(lone).not.toContain("## Related types");
    expect(lone).toContain("### Own");
  });

  it("emits exactly the headings fnHeadings lists, so each inline anchor is the one the page gets", () => {
    const { fnDocs, usage, fnPage } = placed(SOURCE);
    for (const [key, doc] of fnDocs) {
      expect(BR.mdxHeadings(fnPage(doc.name)), key).toEqual(
        BR.fnHeadings(doc, usage).headings,
      );
    }
    expect(BR.fnHeadings(fnDocs.get("plain/calculate/charge")!, usage)).toEqual(
      {
        headings: [
          "Signature",
          "Parameters",
          "Options",
          "Returns",
          "Types",
          "Visit",
          "Charges",
          "TierBand",
          "Rounding",
          "Related types",
          "Examples",
          "Source",
        ],
        at: 5,
        inOptions: ["ChargeOptions"],
      },
    );
  });

  it("gives an inline type named like a section the suffix the page gives its heading", () => {
    const { usage, fnPage } = placed(`
      interface Options { strict?: boolean }
      interface Returns { ok: boolean }
      /**
       * @param options how
       * @returns the result
       */
      function f(a: string, options?: Options): Returns | null { return null; }
    `);
    expect(usage.types.get("Options")!.placement).toMatchObject({
      anchor: "options-1",
    });
    expect(usage.types.get("Returns")!.placement).toMatchObject({
      anchor: "returns-1",
    });
    const mdx = fnPage("f");
    // `Options` is documented by the Options block: its anchor is set by hand there, and
    // must not be the id the `## Options` heading already has.
    expect(mdx).toContain('<a id="options-1"></a>');
    const headings = BR.mdxHeadings(mdx);
    expect(headings.filter((h) => h === "Options")).toHaveLength(1);
    // `Returns` keeps a heading under Types, after the `## Returns` section.
    expect(headingAnchors(headings)[headings.lastIndexOf("Returns")]).toBe(
      "returns-1",
    );
    const ids = BR.mdxIds(mdx);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never gives a hand-set anchor the id of a heading that comes after it", () => {
    // `Returns` is the options type here: its anchor is set in the Options block, above the
    // `## Returns` heading, which keeps the plain `returns` the page gives it.
    const { usage, fnPage } = placed(`
      interface Returns { strict?: boolean }
      /**
       * @param options how
       * @returns the result
       */
      function f(a: string, options?: Returns): string { return a; }
    `);
    expect(usage.types.get("Returns")!.placement).toMatchObject({
      anchor: "returns-1",
    });
    const mdx = fnPage("f");
    expect(mdx).toContain('<a id="returns-1"></a>');
    const ids = BR.mdxIds(mdx);
    expect(ids).toContain("returns");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("mdxIds lists heading ids and hand-set anchors, and skips a code fence", () => {
    expect(
      BR.mdxIds(
        '## A\n\n<a id="own"></a>\n\n```ts\n<a id="no"></a>\n```\n\n### B',
      ),
    ).toEqual(["a", "b", "own"]);
  });

  it("refuses two exports that share one reference key, naming both and their files", () => {
    const { checker, sourceFile, program } = compile(`
      export type dwell = { days: number };
      export function dwell(a: string): string { return a; }
    `);
    const file = gmtPath("transport/calculate/dwell.ts");
    const extracted = BR.extractFromFile(
      checker,
      file,
      sourceFile,
      new Set<ts.Node>(sourceFile.statements),
      contextFor(program, sourceFile),
    );
    expect(extracted).toHaveLength(2);
    expect(() => BR.dedupeDocs(extracted)).toThrow(
      /type dwell \(packages\/gmt\/src\/transport\/calculate\/dwell\.ts\) and function dwell \(packages\/gmt\/src\/transport\/calculate\/dwell\.ts\)/,
    );
  });

  it("keeps one doc for an interface declared twice, which is one type", () => {
    const { checker, sourceFile, program } = compile(`
      export interface Opts { a?: string }
      export interface Opts { b?: string }
      export function f(o: Opts): string { return ""; }
    `);
    const extracted = BR.extractFromFile(
      checker,
      gmtPath("plain/calculate/f.ts"),
      sourceFile,
      new Set<ts.Node>(sourceFile.statements),
      contextFor(program, sourceFile),
    );
    expect(extracted.map((e) => e.doc.name)).toEqual(["Opts", "Opts", "f"]);
    const docs = BR.dedupeDocs(extracted);
    expect(docs.map((d) => d.name)).toEqual(["Opts", "f"]);
    // Either declaration yields the merged members.
    const opts = docs[0] as TypeDoc;
    expect(opts.members.map((m) => m.name)).toEqual(["a", "b"]);
  });

  it("refuses two types with one key that are not one declaration", () => {
    const a = compile("export type T = { a: string };");
    const b = compile("export type T = { b: string };");
    const file = gmtPath("plain/calculate/t.ts");
    const extracted = [a, b].flatMap(({ checker, sourceFile }) =>
      BR.extractFromFile(
        checker,
        file,
        sourceFile,
        new Set<ts.Node>(sourceFile.statements),
      ),
    );
    expect(() => BR.dedupeDocs(extracted)).toThrow(/type T .* and type T /);
  });

  it("mdxHeadings reads headings and skips a `#` line inside a code fence", () => {
    expect(
      BR.mdxHeadings(
        "## A\n\n```ts\n# not a heading\n```\n\n### B  \ntext # no",
      ),
    ).toEqual(["A", "B"]);
  });

  it("refuses a public type no public function reaches, naming it and its file", () => {
    const { usage, typeDocs } = placed(`
      type Unused = "a" | "b";
      type AlsoUnused = { a: string };
      type Used = "x";
      function f(a: Used): string { return a; }
    `);
    expect(() => BR.refuseOrphans(usage, [...typeDocs.values()])).toThrow(
      /AlsoUnused \(packages\/gmt\/src\/plain\/calculate\/subject\.ts\), Unused \(packages\/gmt\/src\/plain\/calculate\/subject\.ts\)/,
    );
  });

  it("accepts a source with no orphan", () => {
    const { usage, typeDocs } = placed(SOURCE);
    expect(() => BR.refuseOrphans(usage, [...typeDocs.values()])).not.toThrow();
  });

  it("refuses two routes that differ only by case", () => {
    expect(() =>
      BR.refuseCaseClash([
        "/reference/types/Interval",
        "/reference/types/interval",
      ]),
    ).toThrow(/\/reference\/types\/Interval and \/reference\/types\/interval/);
    expect(() =>
      BR.refuseCaseClash(["/reference/types/Interval", "/reference/types"]),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Unreleased badges in the generated sidebar
// ---------------------------------------------------------------------------

describe("buildSidebar", () => {
  const badge = 'badge: { text: "Unreleased", variant: "caution" }';

  it("badges unreleased items, and a group only when all of it is unreleased", () => {
    const out = BR.buildSidebar(
      new Map([
        [
          "transport/calculate",
          [
            {
              name: "dwellTime",
              slug: "reference/transport/calculate/dwellTime",
              unreleased: true,
            },
            {
              name: "transitTime",
              slug: "reference/transport/calculate/transitTime",
              unreleased: true,
            },
          ],
        ],
        [
          "calendar/calculate",
          [
            {
              name: "floorToZone",
              slug: "reference/calendar/calculate/floorToZone",
            },
            {
              name: "newThing",
              slug: "reference/calendar/calculate/newThing",
              unreleased: true,
            },
          ],
        ],
      ]),
    );
    expect(out).toContain(
      `{ slug: "reference/transport/calculate/dwellTime", ${badge} }`,
    );
    expect(out).toContain(
      `{ slug: "reference/calendar/calculate/floorToZone" }`,
    );
    expect(out).toContain(
      `{ slug: "reference/calendar/calculate/newThing", ${badge} }`,
    );
    // transport and its module group are all new; calendar is mixed.
    expect(out).toMatch(/label: "transport",\n\s+badge:/);
    expect(out).toMatch(/label: "calculate",\n\s+badge:/);
    expect(out).not.toMatch(/label: "calendar",\n\s+badge:/);
  });

  it("lists the shared types as one flat group, alphabetical, sorted among the namespaces", () => {
    const out = BR.buildSidebar(
      new Map([
        ["unix/format", [{ name: "a", slug: "reference/unix/format/a" }]],
        ["plain/format", [{ name: "b", slug: "reference/plain/format/b" }]],
      ]),
      [
        { name: "Overflow", slug: "reference/types/Overflow" },
        {
          name: "Interval",
          slug: "reference/types/Interval",
          unreleased: true,
        },
      ],
    );
    const labels = [...out.matchAll(/^ {4}label: "(\w+)"/gm)].map((m) => m[1]);
    expect(labels).toEqual(["plain", "types", "unix"]);
    // Overview comes first in the group, before the first type.
    const typesOverview = out.indexOf(
      '{ label: "Overview", slug: "reference/types" }',
    );
    expect(typesOverview).toBeGreaterThan(out.indexOf('label: "types"'));
    const interval = out.indexOf(
      `{ slug: "reference/types/Interval", ${badge} }`,
    );
    const overflow = out.indexOf('{ slug: "reference/types/Overflow" }');
    expect(interval).toBeGreaterThan(typesOverview);
    expect(overflow).toBeGreaterThan(interval);
    // Flat: no module group inside it.
    const group = out.slice(
      out.indexOf('label: "types"'),
      out.indexOf('label: "unix"'),
    );
    expect(group.match(/collapsed:/g)).toHaveLength(1);
    expect(out).not.toMatch(/label: "types",\n\s+badge:/);
  });

  it("opens the list and each namespace group with an Overview link, and gives a module group none", () => {
    const out = BR.buildSidebar(
      new Map([
        [
          "plain/format",
          [
            { name: "a", slug: "reference/plain/format/a" },
            { name: "b", slug: "reference/plain/format/b" },
          ],
        ],
        ["plain/parse", [{ name: "c", slug: "reference/plain/parse/c" }]],
      ]),
    );
    const items = out
      .slice(out.indexOf("export const referenceSidebar"))
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{ ") || l.startsWith("label:"));
    expect(items).toEqual([
      '{ label: "Overview", slug: "reference" },',
      'label: "plain",',
      '{ label: "Overview", slug: "reference/plain" },',
      'label: "format",',
      '{ slug: "reference/plain/format/a" },',
      '{ slug: "reference/plain/format/b" },',
      '{ slug: "reference/plain/parse/c" },',
    ]);
  });

  it("does not count the Overview link when deciding a group is all unreleased", () => {
    const out = BR.buildSidebar(
      new Map([
        [
          "plain/format",
          [{ name: "a", slug: "reference/plain/format/a", unreleased: true }],
        ],
      ]),
      [{ name: "T", slug: "reference/types/T", unreleased: true }],
    );
    expect(out).toMatch(/label: "plain",\n\s+badge:/);
    expect(out).toMatch(/label: "types",\n\s+badge:/);
    expect(out).not.toMatch(/label: "Overview", slug: "[^"]+", badge/);
  });

  it("emits no types group when there is no shared type", () => {
    const out = BR.buildSidebar(
      new Map([
        ["plain/format", [{ name: "b", slug: "reference/plain/format/b" }]],
      ]),
    );
    expect(out).not.toContain('label: "types"');
  });

  it("emits no badge when nothing is unreleased", () => {
    const out = BR.buildSidebar(
      new Map([
        [
          "calendar/calculate",
          [
            { name: "a", slug: "reference/calendar/calculate/a" },
            { name: "b", slug: "reference/calendar/calculate/b" },
          ],
        ],
      ]),
    );
    expect(out).not.toContain("badge");
  });
});

// ---------------------------------------------------------------------------
// Industry namespaces: the sidebar group and the page tag
// ---------------------------------------------------------------------------

describe("buildSidebar with industries", () => {
  const sym = (ns: string, mod: string, name: string, unreleased = false) => ({
    key: `${ns}/${mod}`,
    entry: {
      name,
      slug: `reference/${ns}/${mod}/${name}`,
      ...(unreleased ? { unreleased } : {}),
    },
  });
  const symbols = (
    rows: Array<ReturnType<typeof sym>>,
  ): Map<string, Array<(typeof rows)[number]["entry"]>> => {
    const map = new Map<string, Array<(typeof rows)[number]["entry"]>>();
    for (const { key, entry } of rows) {
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  };
  const rows = [
    sym("zoned", "format", "a"),
    sym("plain", "format", "b"),
    sym("transport", "calculate", "dwellTime"),
    sym("transport", "calculate", "transitTime"),
    sym("intermodal", "parse", "p"),
    sym("regex", "date", "year"),
  ];
  /** Labels at each nesting depth, in file order. */
  const labelsAt = (out: string, indent: number) =>
    [...out.matchAll(new RegExp(`^ {${indent}}label: "([^"]+)"`, "gm"))].map(
      (m) => m[1],
    );

  const DIVIDER =
    '  { label: "By industry", link: "#by-industry", attrs: { "data-gmt-divider": "true" } },';

  it("puts the industries after a divider, as siblings of the general groups, with no `By industry` group", () => {
    const out = BR.buildSidebar(
      symbols(rows),
      [{ name: "T", slug: "reference/types/T" }],
      ["intermodal", "transport"],
    );
    // Every namespace group is at the same level; the industries come last, in order.
    expect(labelsAt(out, 4)).toEqual([
      "plain",
      "regex",
      "types",
      "zoned",
      "intermodal",
      "transport",
    ]);
    // The divider is one entry, once, between the last general group and the first industry.
    expect(out.split(DIVIDER)).toHaveLength(2);
    expect(out.indexOf(DIVIDER)).toBeGreaterThan(out.indexOf('label: "zoned"'));
    expect(out.indexOf(DIVIDER)).toBeLessThan(
      out.indexOf('label: "intermodal"'),
    );
    // It is not a group: nothing to open.
    expect(out).not.toMatch(/label: "By industry",\n/);
  });

  it("does not change a single general group when industries are added", () => {
    const general = rows.filter(
      ({ key }) => !/^(transport|intermodal)\//.test(key),
    );
    const without = BR.buildSidebar(symbols(general));
    const withIndustries = BR.buildSidebar(
      symbols(rows),
      [],
      ["intermodal", "transport"],
    );
    // Everything before the divider is the general sidebar, text for text.
    const body = (out: string, end: number) =>
      out.slice(out.indexOf("export const"), end);
    expect(body(withIndustries, withIndustries.indexOf(DIVIDER))).toBe(
      body(without, without.lastIndexOf("];")),
    );
  });

  it("marks each industry's Overview link so the stylesheet can draw its icon, and no other link", () => {
    const out = BR.buildSidebar(symbols(rows), [], ["intermodal", "transport"]);
    expect(out).toContain(
      '{ label: "Overview", slug: "reference/intermodal", attrs: { "data-gmt-industry": "intermodal" } }',
    );
    expect(out).toContain(
      '{ label: "Overview", slug: "reference/transport", attrs: { "data-gmt-industry": "transport" } }',
    );
    expect(out.match(/data-gmt-industry/g)).toHaveLength(2);
    expect(out).toContain('{ label: "Overview", slug: "reference/plain" }');
  });

  it("keeps an industry group's inner structure: Overview, multi-symbol module groups, then hoisted items", () => {
    const out = BR.buildSidebar(symbols(rows), [], ["intermodal", "transport"]);
    const group = out.slice(out.indexOf('label: "transport"'));
    expect(
      group
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("{ ") || l.startsWith("label:"))
        .slice(0, 5),
    ).toEqual([
      'label: "transport",',
      '{ label: "Overview", slug: "reference/transport", attrs: { "data-gmt-industry": "transport" } },',
      'label: "calculate",',
      '{ slug: "reference/transport/calculate/dwellTime" },',
      '{ slug: "reference/transport/calculate/transitTime" },',
    ]);
  });

  it("puts a third industry in the group with no change to the generator", () => {
    const out = BR.buildSidebar(
      symbols([...rows, sym("maritime", "calculate", "laytime")]),
      [],
      ["intermodal", "transport", "maritime"],
    );
    expect(labelsAt(out, 4)).toEqual([
      "plain",
      "regex",
      "zoned",
      "intermodal",
      "transport",
      "maritime",
    ]);
    expect(out.split(DIVIDER)).toHaveLength(2);
    expect(out).toContain('"data-gmt-industry": "maritime"');
  });

  it("emits no divider when no industry has a page", () => {
    const out = BR.buildSidebar(symbols(rows.slice(0, 2)), [], ["transport"]);
    expect(out).not.toContain("By industry");
  });

  it("badges an industry group by the same rule as any namespace group", () => {
    const out = BR.buildSidebar(
      symbols([
        sym("transport", "calculate", "a", true),
        sym("intermodal", "parse", "b"),
      ]),
      [],
      ["intermodal", "transport"],
    );
    expect(out).toMatch(/label: "transport",\n\s+badge:/);
    expect(out).not.toMatch(/label: "intermodal",\n\s+badge:/);
    expect(out).not.toMatch(/label: "By industry",\n/);
  });
});

describe("industry tag on a page", () => {
  const SOURCE = `
    /** What \`charge\` takes. */
    interface ChargeOptions {
      /** The rate. */
      rate: number;
    }
    /**
     * Charge it.
     * @param options - The terms.
     * @returns The charge.
     * @example charge({ rate: 1 }) // 1
     */
    function charge(options: ChargeOptions): number { return 0; }
  `;

  it("writes `industries: [id]` into a function page's frontmatter, after the slug", () => {
    const mdx = BR.withIndustry(placed(SOURCE).fnPage("charge"), "intermodal");
    expect(mdx.split("\n").slice(0, 6)).toEqual([
      "---",
      'title: "charge"',
      expect.stringMatching(/^description: /),
      'slug: "reference/plain/calculate/charge"',
      "industries: [intermodal]",
      "---",
    ]);
    // Nothing else on the page moves.
    expect(mdx.replace("industries: [intermodal]\n", "")).toBe(
      placed(SOURCE).fnPage("charge"),
    );
  });

  it("tags a shared type's page the same way", () => {
    const page = placed(SOURCE).typePage("ChargeOptions");
    const tagged = BR.withIndustry(page, "transport");
    expect(tagged).toMatch(/^---\n[\s\S]*?\nindustries: \[transport\]\n---\n/);
  });

  it("leaves a general page byte for byte as it was", () => {
    const page = placed(SOURCE).fnPage("charge");
    expect(BR.withIndustry(page, undefined)).toBe(page);
    expect(page).not.toContain("industries:");
  });

  it("tags a type only when every function that reaches it is in one industry namespace", () => {
    const layers = ["intermodal", "transport"];
    expect(
      BR.typeIndustry(["transport/calculate/a", "transport/compare/b"], layers),
    ).toBe("transport");
    expect(
      BR.typeIndustry(["transport/calculate/a", "plain/calculate/b"], layers),
    ).toBeUndefined();
    expect(
      BR.typeIndustry(["transport/calculate/a", "intermodal/parse/b"], layers),
    ).toBeUndefined();
    expect(BR.typeIndustry(["plain/calculate/a"], layers)).toBeUndefined();
    expect(BR.typeIndustry([], layers)).toBeUndefined();
  });
});
