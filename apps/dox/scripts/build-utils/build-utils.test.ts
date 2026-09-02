import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  buildPlaygroundSpec,
  classifyReturnType,
  classifyReturnTypeFromString,
  classifyType,
  classifyTypeFromString,
  CURATED_CALENDARS,
  CURATED_LOCALES,
  CURATED_NUMBERING_SYSTEMS,
  CURATED_TIMEZONES,
  defaultValue,
  optionPropertyType,
  optionValueFromCall,
  parseArrayArg,
  parseUnitsArg,
  playgroundModule,
  resolveRestParam,
  seedForOption,
  seedForParam,
  type ClassifiedType,
  type ExampleLike,
  type ParamTypeResolver,
} from "./build-utils";
import {
  splitTopLevel as sharedSplitTopLevel,
  parseCallArgs as sharedParseCallArgs,
  argToValue as sharedArgToValue,
} from "../../src/lib/playground-parsers";

// ---------------------------------------------------------------------------
// In-memory TS program helpers (for checker-backed classification tests)
// ---------------------------------------------------------------------------

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
      skipLibCheck: true,
      noEmit: true,
      strict: false,
    },
    host,
  );
  return { checker: program.getTypeChecker(), sourceFile };
}

function paramTypes(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  fnName: string,
): ts.Type[] {
  let result: ts.Type[] = [];
  sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === fnName) {
      const sig = checker.getSignatureFromDeclaration(node);
      if (sig) {
        result = sig
          .getParameters()
          .map((sp) => checker.getTypeOfSymbolAtLocation(sp, node));
      }
    }
  });
  return result;
}

// ---------------------------------------------------------------------------
// playgroundModule
// ---------------------------------------------------------------------------

describe("playgroundModule", () => {
  it("collapses duration to its top-level barrel", () => {
    expect(playgroundModule("duration", "calculate")).toBe("duration");
  });
  it("maps every other namespace 1:1 to <ns>/<mod>", () => {
    expect(playgroundModule("plain", "calculate")).toBe("plain/calculate");
    expect(playgroundModule("zoned", "map")).toBe("zoned/map");
    expect(playgroundModule("unix", "parse")).toBe("unix/parse");
    expect(playgroundModule("utc", "convert")).toBe("utc/convert");
  });
});

// ---------------------------------------------------------------------------
// classifyTypeFromString
// ---------------------------------------------------------------------------

describe("classifyTypeFromString", () => {
  it("treats a string-literal union as an enum", () => {
    expect(
      classifyTypeFromString(`"compatible" | "earlier" | "later" | "reject"`),
    ).toEqual({
      type: "enum",
      options: ["compatible", "earlier", "later", "reject"],
    });
  });
  it("treats a single string literal as a plain string (not a union)", () => {
    expect(classifyTypeFromString(`"monday"`)).toEqual({ type: "string" });
  });
  it("classifies number / bigint", () => {
    expect(classifyTypeFromString("number")).toEqual({ type: "number" });
    expect(classifyTypeFromString("Number")).toEqual({ type: "number" });
    expect(classifyTypeFromString("bigint")).toEqual({ type: "number" });
  });
  it("classifies boolean", () => {
    expect(classifyTypeFromString("boolean")).toEqual({ type: "boolean" });
  });
  it("falls back to string for objects / unknowns", () => {
    expect(classifyTypeFromString("{ a: number }")).toEqual({ type: "string" });
    expect(classifyTypeFromString("DateTimeUnit")).toEqual({ type: "string" });
  });
});

// ---------------------------------------------------------------------------
// resolveRestParam
// ---------------------------------------------------------------------------

describe("resolveRestParam", () => {
  it("returns null for non-rest types", () => {
    expect(resolveRestParam("string")).toBeNull();
    expect(resolveRestParam("{ relativeTo?: string }")).toBeNull();
  });
  it("resolves a single optional scalar rest tuple", () => {
    expect(resolveRestParam("[stepDays?: number]")).toEqual([
      { name: "stepDays", inner: "number", optional: true },
    ]);
  });
  it("resolves a required single-element tuple", () => {
    expect(resolveRestParam("[rest: string]")).toEqual([
      { name: "rest", inner: "string", optional: false },
    ]);
  });
  it("splits a multi-element rest tuple into one element each", () => {
    expect(resolveRestParam("[a: string, b?: number]")).toEqual([
      { name: "a", inner: "string", optional: false },
      { name: "b", inner: "number", optional: true },
    ]);
  });
});

// ---------------------------------------------------------------------------
// defaultValue
// ---------------------------------------------------------------------------

describe("defaultValue", () => {
  it("uses 0 / false / empty string", () => {
    expect(defaultValue("number")).toBe("0");
    expect(defaultValue("boolean")).toBe("false");
    expect(defaultValue("string")).toBe("");
    expect(defaultValue("enum")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// splitTopLevel (shared module)
// ---------------------------------------------------------------------------

describe("splitTopLevel (shared)", () => {
  it("splits on top-level commas", () => {
    expect(sharedSplitTopLevel(`a, b, c`)).toEqual(["a", "b", "c"]);
  });
  it("ignores commas inside brackets", () => {
    expect(sharedSplitTopLevel(`a, (b, c), d`)).toEqual(["a", "(b, c)", "d"]);
  });
  it("ignores commas inside string literals (incl. brackets)", () => {
    expect(sharedSplitTopLevel(`"a,b", "x[y,z]", c`)).toEqual([
      `"a,b"`,
      `"x[y,z]"`,
      "c",
    ]);
  });
  it("trims and drops empties", () => {
    expect(sharedSplitTopLevel(`  a ,, b `)).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// parseCallArgs (shared module)
// ---------------------------------------------------------------------------

describe("parseCallArgs (shared)", () => {
  it("extracts positional args from a call", () => {
    expect(sharedParseCallArgs(`durationAs("P1DT2H30M", "hours")`)).toEqual([
      `"P1DT2H30M"`,
      `"hours"`,
    ]);
  });
  it("handles bracketed content inside string literals (e.g. [UTC])", () => {
    const call = `mapZonedDatesInRange("2024-02-28T12:00:00+00:00[UTC]", "2024-03-02T12:00:00+00:00[UTC]", 2)`;
    expect(sharedParseCallArgs(call)).toEqual([
      `"2024-02-28T12:00:00+00:00[UTC]"`,
      `"2024-03-02T12:00:00+00:00[UTC]"`,
      "2",
    ]);
  });
  it("returns [] when no parentheses", () => {
    expect(sharedParseCallArgs(`not a call`)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// argToValue (shared module)
// ---------------------------------------------------------------------------

describe("argToValue (shared)", () => {
  it("strips surrounding quotes", () => {
    expect(sharedArgToValue(`"hours"`)).toBe("hours");
    expect(sharedArgToValue(`'2024-02-01'`)).toBe("2024-02-01");
  });
  it("leaves numbers, booleans, and object literals untouched", () => {
    expect(sharedArgToValue("2")).toBe("2");
    expect(sharedArgToValue("true")).toBe("true");
    expect(sharedArgToValue(`{ days: 7 }`)).toBe(`{ days: 7 }`);
  });
});

// ---------------------------------------------------------------------------
// optionValueFromCall
// ---------------------------------------------------------------------------

describe("optionValueFromCall", () => {
  it("pulls a property value from a trailing options object", () => {
    const call = `durationAs("P1M", "days", { relativeTo: "2024-02-01" })`;
    expect(optionValueFromCall(call, "relativeTo")).toBe(`"2024-02-01"`);
  });
  it("returns undefined when the options object is absent", () => {
    expect(
      optionValueFromCall(`durationAs("P1M", "days")`, "relativeTo"),
    ).toBeUndefined();
  });
  it("matches the last (options) object when several are present", () => {
    const call = `f("a", { x: 1 }, { relativeTo: "z" })`;
    expect(optionValueFromCall(call, "relativeTo")).toBe(`"z"`);
  });
});

// ---------------------------------------------------------------------------
// seedForParam
// ---------------------------------------------------------------------------

describe("seedForParam", () => {
  const ex = (call: string): ExampleLike => ({ call, result: "" });

  it("uses the first example that supplies the argument index", () => {
    const examples = [ex(`f("a", "b")`), ex(`f("a", "b", 2)`)];
    expect(seedForParam(examples, 2, { type: "number" })).toBe("2");
  });
  it("falls back to a default when no example supplies the arg", () => {
    expect(seedForParam([ex(`f("a")`)], 1, { type: "number" })).toBe("0");
    expect(seedForParam([ex(`f("a")`)], 1, { type: "boolean" })).toBe("false");
    expect(seedForParam([ex(`f("a")`)], 1, { type: "string" })).toBe("");
  });
  it("validates enum seeds against the option list", () => {
    const info: ClassifiedType = {
      type: "enum",
      options: ["hours", "days"],
    };
    // "years" is not a valid option -> fall back to first
    expect(seedForParam([ex(`f("years")`)], 0, info)).toBe("hours");
    // "days" is valid -> keep it
    expect(seedForParam([ex(`f("days")`)], 0, info)).toBe("days");
  });
});

// ---------------------------------------------------------------------------
// seedForOption
// ---------------------------------------------------------------------------

describe("seedForOption", () => {
  const ex = (call: string): ExampleLike => ({ call, result: "" });

  it("seeds from the example's options object", () => {
    const examples = [ex(`f("a", { relativeTo: "2024-02-01" })`)];
    expect(seedForOption(examples, "relativeTo", { type: "string" })).toBe(
      "2024-02-01",
    );
  });
  it("falls back to default when no example supplies the option", () => {
    expect(
      seedForOption([ex(`f("a")`)], "relativeTo", { type: "boolean" }),
    ).toBe("false");
  });
  it("defaults enum options to empty (unset) when no example supplies them", () => {
    const info: ClassifiedType = {
      type: "enum",
      options: ["long", "short", "narrow"],
    };
    expect(seedForOption([ex(`f("a")`)], "weekday", info)).toBe("");
  });
  it("preserves explicit enum values from examples", () => {
    const info: ClassifiedType = {
      type: "enum",
      options: ["long", "short", "narrow"],
    };
    expect(
      seedForOption([ex(`f("a", { weekday: "short" })`)], "weekday", info),
    ).toBe("short");
  });
  it("defaults roundingIncrement to 1 instead of 0", () => {
    expect(seedForOption([], "roundingIncrement", { type: "number" })).toBe(
      "1",
    );
  });
  it("preserves explicit roundingIncrement from examples", () => {
    expect(
      seedForOption(
        [ex(`normalizeDuration("PT90M", { roundingIncrement: 30 })`)],
        "roundingIncrement",
        { type: "number" },
      ),
    ).toBe("30");
  });
});

// ---------------------------------------------------------------------------
// classifyReturnTypeFromString
// ---------------------------------------------------------------------------

describe("classifyReturnTypeFromString", () => {
  it("detects arrays, then boolean, then number, else string", () => {
    expect(classifyReturnTypeFromString("string[]")).toBe("array");
    expect(classifyReturnTypeFromString("boolean")).toBe("boolean");
    expect(classifyReturnTypeFromString("number | null")).toBe("number");
    expect(classifyReturnTypeFromString("string | null")).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// classifyType (checker-backed)
// ---------------------------------------------------------------------------

describe("classifyType", () => {
  const src = `
    function f(
      s: string,
      n: number,
      b: boolean,
      u: "x" | "y" | "z",
      obj: { a: number },
    ): void {}
  `;
  const { checker, sourceFile } = compile(src);
  const types = paramTypes(checker, sourceFile, "f");

  it("classifies primitives", () => {
    expect(classifyType(checker, types[0])).toEqual({ type: "string" });
    expect(classifyType(checker, types[1])).toEqual({ type: "number" });
    expect(classifyType(checker, types[2])).toEqual({ type: "boolean" });
  });
  it("classifies a string-literal union as an enum", () => {
    expect(classifyType(checker, types[3])).toEqual({
      type: "enum",
      options: ["x", "y", "z"],
    });
  });
  it("falls back to string for objects", () => {
    expect(classifyType(checker, types[4])).toEqual({ type: "string" });
  });
  it("falls back to string for undefined", () => {
    expect(classifyType(checker, undefined)).toEqual({ type: "string" });
  });
});

// ---------------------------------------------------------------------------
// classifyReturnType (checker-backed)
// ---------------------------------------------------------------------------

describe("classifyReturnType", () => {
  const src = `
    function s(): string { return ""; }
    function n(): number { return 0; }
    function b(): boolean { return false; }
    function a(): string[] { return []; }
  `;
  const { checker, sourceFile } = compile(src);
  it("maps signatures to return kinds", () => {
    expect(classifyReturnType(checker, sigOf(checker, sourceFile, "s"))).toBe(
      "string",
    );
    expect(classifyReturnType(checker, sigOf(checker, sourceFile, "n"))).toBe(
      "number",
    );
    expect(classifyReturnType(checker, sigOf(checker, sourceFile, "b"))).toBe(
      "boolean",
    );
    expect(classifyReturnType(checker, sigOf(checker, sourceFile, "a"))).toBe(
      "array",
    );
    expect(classifyReturnType(checker, undefined)).toBe("string");
  });
});

function sigOf(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  fnName: string,
): ts.Signature | undefined {
  let sig: ts.Signature | undefined;
  sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === fnName) {
      sig = checker.getSignatureFromDeclaration(node);
    }
  });
  return sig;
}

// ---------------------------------------------------------------------------
// optionPropertyType (checker-backed)
// ---------------------------------------------------------------------------

describe("optionPropertyType", () => {
  const src = `
    function f(a: string, options?: { include?: boolean; unit?: "x" | "y" }): void {}
  `;
  const { checker, sourceFile } = compile(src);
  const sig = sigOf(checker, sourceFile, "f");
  it("resolves an option property type by name", () => {
    const t = optionPropertyType(checker, sig, sourceFile, "include");
    expect(classifyType(checker, t)).toEqual({ type: "boolean" });
    const u = optionPropertyType(checker, sig, sourceFile, "unit");
    expect(classifyType(checker, u)).toEqual({
      type: "enum",
      options: ["x", "y"],
    });
  });
  it("returns undefined for unknown options / missing sig", () => {
    expect(
      optionPropertyType(checker, sig, sourceFile, "nope"),
    ).toBeUndefined();
    expect(
      optionPropertyType(checker, undefined, sourceFile, "include"),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildPlaygroundSpec (with injected mocks — fully testable)
// ---------------------------------------------------------------------------

describe("buildPlaygroundSpec", () => {
  it("resolves a rest-tuple scalar to a number param (mapZonedDatesInRange)", () => {
    const spec = buildPlaygroundSpec(
      {
        namespace: "zoned",
        module: "map",
        name: "mapZonedDatesInRange",
        params: [
          { name: "startZonedDateTime", type: "string" },
          { name: "endZonedDateTime", type: "string" },
          { name: "stepDaysInput", type: "[stepDays?: number]" },
        ],
        options: [],
        examples: [
          { call: `mapZonedDatesInRange("a[UTC]", "b[UTC]")`, result: `[]` },
          {
            call: `mapZonedDatesInRange("a[UTC]", "b[UTC]", 2)`,
            result: `["2024-02-28"]`,
          },
        ],
      },
      {
        classifyParamType: (() => {
          const map: Record<string, ClassifiedType> = {
            startZonedDateTime: { type: "string" },
            endZonedDateTime: { type: "string" },
          };
          return ((name: string) =>
            map[name] ?? { type: "string" }) as ParamTypeResolver;
        })(),
        optionPropertyType: () => undefined,
        classifyType: () => ({ type: "string" }),
        returnType: "array",
      },
    );

    expect(spec.module).toBe("zoned/map");
    expect(spec.fn).toBe("mapZonedDatesInRange");
    expect(spec.params).toEqual([
      { name: "startZonedDateTime", type: "string", value: "a[UTC]" },
      { name: "endZonedDateTime", type: "string", value: "b[UTC]" },
      { name: "stepDays", type: "number", value: "2", optional: true },
    ]);
    expect(spec.options).toBeUndefined();
    expect(spec.returnType).toBe("array");
    expect(spec.allowEmptyArray).toBe(true);
  });

  it("derives enum params + an options object (durationAs)", () => {
    const spec = buildPlaygroundSpec(
      {
        namespace: "duration",
        module: "calculate",
        name: "durationAs",
        params: [
          { name: "value", type: "string" },
          { name: "unit", type: "DateTimeDurationUnit" },
        ],
        options: [{ name: "relativeTo?" }],
        examples: [
          { call: `durationAs("P1DT2H30M", "hours")`, result: `26.5` },
          {
            call: `durationAs("P1M", "days", { relativeTo: "2024-02-01" })`,
            result: `29`,
          },
        ],
      },
      {
        classifyParamType: (() => {
          const map: Record<string, ClassifiedType> = {
            value: { type: "string" },
            unit: { type: "enum", options: ["years", "days", "hours"] },
          };
          return ((name: string) =>
            map[name] ?? { type: "string" }) as ParamTypeResolver;
        })(),
        optionPropertyType: () => undefined,
        classifyType: () => ({ type: "string" }),
        returnType: "number",
      },
    );

    expect(spec.module).toBe("duration");
    expect(spec.params).toEqual([
      { name: "value", type: "string", value: "P1DT2H30M" },
      {
        name: "unit",
        type: "enum",
        value: "hours",
        options: ["years", "days", "hours"],
      },
    ]);
    expect(spec.options).toEqual([
      { name: "relativeTo", type: "string", value: "2024-02-01" },
    ]);
    expect(spec.returnType).toBe("number");
    expect(spec.allowEmptyArray).toBeUndefined();
  });

  it("renders boolean options from a boolean option type (isBetweenDate)", () => {
    const spec = buildPlaygroundSpec(
      {
        namespace: "plain",
        module: "compare",
        name: "isBetweenDate",
        params: [
          { name: "date", type: "string" },
          { name: "start", type: "string" },
          { name: "end", type: "string" },
        ],
        options: [{ name: "inclusiveStart?" }, { name: "inclusiveEnd?" }],
        examples: [
          {
            call: `isBetweenDate("2024-02-29", "2024-02-01", "2024-02-28")`,
            result: `false`,
          },
        ],
      },
      {
        classifyParamType: (() => {
          const map: Record<string, ClassifiedType> = {
            date: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
          };
          return ((name: string) =>
            map[name] ?? { type: "string" }) as ParamTypeResolver;
        })(),
        optionPropertyType: () => undefined,
        classifyType: () => ({ type: "boolean" }),
        returnType: "boolean",
      },
    );

    expect(spec.options).toEqual([
      { name: "inclusiveStart", type: "boolean", value: "false" },
      { name: "inclusiveEnd", type: "boolean", value: "false" },
    ]);
    expect(spec.returnType).toBe("boolean");
  });

  it("omits options when none are present", () => {
    const spec = buildPlaygroundSpec(
      {
        namespace: "plain",
        module: "get",
        name: "getToday",
        params: [],
        options: [],
        examples: [],
      },
      {
        classifyParamType: (() =>
          (() => ({ type: "string" })) as ParamTypeResolver)(),
        optionPropertyType: () => undefined,
        classifyType: () => ({ type: "string" }),
        returnType: "string",
      },
    );
    expect(spec.params).toEqual([]);
    expect(spec.options).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// classifyTypeFromString — mixed unions / arrays
// ---------------------------------------------------------------------------

describe("classifyTypeFromString (mixed unions / arrays)", () => {
  it("classifies a mixed number+string union as enum", () => {
    expect(classifyTypeFromString(`0 | 1 | 2 | "auto"`)).toEqual({
      type: "enum",
      options: ["0", "1", "2", "auto"],
    });
  });
  it("classifies number[] as array", () => {
    expect(classifyTypeFromString("number[]")).toEqual({
      type: "array",
      arrayType: "number",
    });
  });
  it("classifies string[] as array", () => {
    expect(classifyTypeFromString("string[]")).toEqual({
      type: "array",
      arrayType: "string",
    });
  });
});

// ---------------------------------------------------------------------------
// classifyType (checker-backed) — mixed unions, objects, arrays
// ---------------------------------------------------------------------------

describe("classifyType (checker-backed — complex types)", () => {
  const src = `
    type FractionalDigit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "auto";
    type DateTimeDurationUnit = "years" | "months" | "weeks" | "days" | "hours" | "minutes" | "seconds" | "milliseconds" | "microseconds" | "nanoseconds";
    type UnitsMap = Record<DateTimeDurationUnit, number>;
    function f(
      mixed: FractionalDigit,
      units: UnitsMap,
      nums: number[],
      tz: string,
    ): void {}
  `;
  const { checker, sourceFile } = compile(src);
  const types = paramTypes(checker, sourceFile, "f");

  it("classifies mixed number+string union as enum", () => {
    expect(classifyType(checker, types[0])).toEqual({
      type: "enum",
      options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "auto"],
    });
  });
  it("classifies Record<UnitEnum, number> as units", () => {
    expect(classifyType(checker, types[1])).toEqual({
      type: "units",
      options: [
        "years",
        "months",
        "weeks",
        "days",
        "hours",
        "minutes",
        "seconds",
        "milliseconds",
        "microseconds",
        "nanoseconds",
      ],
    });
  });
  it("classifies number[] as array", () => {
    expect(classifyType(checker, types[2])).toEqual({
      type: "array",
      arrayType: "number",
    });
  });
  it("falls back to string for plain string params", () => {
    expect(classifyType(checker, types[3])).toEqual({ type: "string" });
  });
  it("classifies Temporal field objects as units", () => {
    const src = `
      type PlainDateLike = { year: number; month: number; day: number; era?: string; eraYear?: number };
      function setLike(v: string, fields: PlainDateLike): void {}
    `;
    const { checker: c2, sourceFile: sf2 } = compile(src);
    const types2 = paramTypes(c2, sf2, "setLike");
    expect(classifyType(c2, types2[1])).toEqual({
      type: "units",
      options: ["year", "month", "day", "eraYear"],
    });
  });
  it("classifies timeZone params as enum with curated list", () => {
    const tzType = classifyType(checker, types[3], "timeZone");
    expect(tzType).toEqual({
      type: "enum",
      options: [...CURATED_TIMEZONES],
    });
  });
  it("classifies union of string-literal union + array as enum (diffDate/diffDateTime pattern)", () => {
    const src = `
      type DateDurationUnit = "years" | "months" | "weeks" | "days";
      type DateTimeDurationUnit = "years" | "months" | "weeks" | "days" | "hours" | "minutes" | "seconds";
      function f(
        dateUnit: DateDurationUnit | DateDurationUnit[],
        dateTimeUnit: DateTimeDurationUnit | DateTimeDurationUnit[],
      ): void {}
    `;
    const { checker, sourceFile } = compile(src);
    const types = paramTypes(checker, sourceFile, "f");

    expect(classifyType(checker, types[0])).toEqual({
      type: "enum",
      options: ["years", "months", "weeks", "days"],
    });
    expect(classifyType(checker, types[1])).toEqual({
      type: "enum",
      options: [
        "years",
        "months",
        "weeks",
        "days",
        "hours",
        "minutes",
        "seconds",
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// parseUnitsArg
// ---------------------------------------------------------------------------

describe("parseUnitsArg", () => {
  it("parses { unit: amount }", () => {
    expect(parseUnitsArg("{ days: 1 }")).toEqual({ unit: "days", amount: "1" });
    expect(parseUnitsArg("{ hours: 2.5 }")).toEqual({
      unit: "hours",
      amount: "2.5",
    });
    expect(parseUnitsArg("{ years: -1 }")).toEqual({
      unit: "years",
      amount: "-1",
    });
  });
  it("falls back to empty unit + '1' on failure", () => {
    expect(parseUnitsArg("foo")).toEqual({ unit: "", amount: "1" });
    expect(parseUnitsArg("")).toEqual({ unit: "", amount: "1" });
  });
});

// ---------------------------------------------------------------------------
// parseArrayArg
// ---------------------------------------------------------------------------

describe("parseArrayArg", () => {
  it("parses [1, 2, 3] into string numbers", () => {
    expect(parseArrayArg("[1, 2, 3]")).toEqual(["1", "2", "3"]);
  });
  it("handles whitespace and empty array", () => {
    expect(parseArrayArg("[  ]")).toEqual([]);
    expect(parseArrayArg("[1706659200000, 1704067200000]")).toEqual([
      "1706659200000",
      "1704067200000",
    ]);
  });
  it("preserves non-numeric values", () => {
    expect(parseArrayArg("[a, b]")).toEqual(["a", "b"]);
  });
  it("strips quotes from string-literal array elements", () => {
    expect(parseArrayArg('["2024-03-01", "2024-03-20", "2024-03-18"]')).toEqual(
      ["2024-03-01", "2024-03-20", "2024-03-18"],
    );
  });
});

// ---------------------------------------------------------------------------
// seedForParam — units and array
// ---------------------------------------------------------------------------

describe("seedForParam (units / array)", () => {
  const ex = (call: string): ExampleLike => ({ call, result: "" });

  it("seeds units from { unit: amount } example args", () => {
    const info: ClassifiedType = {
      type: "units",
      options: ["years", "months", "weeks", "days", "hours"],
    };
    expect(
      seedForParam([ex('addZoned("2024-01-01", { days: 1 })')], 1, info),
    ).toBe("1");
  });
  it("falls back to '1' for units with no examples", () => {
    expect(seedForParam([], 0, { type: "units", options: ["days"] })).toBe("1");
  });

  it("seeds array from [1, 2, 3] example args", () => {
    const info: ClassifiedType = {
      type: "array",
      arrayType: "number",
    };
    expect(
      seedForParam(
        [ex('maxUnix("2024-01-01", "2024-12-31", [1, 2, 3])')],
        2,
        info,
      ),
    ).toBe("1,2,3");
  });
  it("falls back to '0,0,0' for array with no examples", () => {
    expect(seedForParam([], 0, { type: "array", arrayType: "number" })).toBe(
      "0,0,0",
    );
  });
});

// ---------------------------------------------------------------------------
// buildPlaygroundSpec — units and array fields
// ---------------------------------------------------------------------------

describe("buildPlaygroundSpec (units / array)", () => {
  it("sets unitValue for units params", () => {
    const spec = buildPlaygroundSpec(
      {
        namespace: "zoned",
        module: "add",
        name: "addZoned",
        params: [
          { name: "value", type: "string" },
          { name: "units", type: "Record<DateTimeDurationUnit, number>" },
        ],
        options: [],
        examples: [
          {
            call: `addZoned("2024-01-01", { days: 1 })`,
            result: `"2024-01-02"`,
          },
        ],
      },
      {
        classifyParamType: (() => {
          const map: Record<string, ClassifiedType> = {
            value: { type: "string" },
            units: {
              type: "units",
              options: ["years", "months", "weeks", "days"],
            },
          };
          return ((name: string) =>
            map[name] ?? { type: "string" }) as ParamTypeResolver;
        })(),
        optionPropertyType: () => undefined,
        classifyType: () => ({ type: "string" }),
        returnType: "string",
      },
    );
    expect(spec.params[1].type).toBe("units");
    expect(spec.params[1].options).toEqual([
      "years",
      "months",
      "weeks",
      "days",
    ]);
    expect(spec.params[1].unitValue).toBe("days");
    expect(spec.params[1].value).toBe("1");
  });

  it("sets arrayType for array params", () => {
    const spec = buildPlaygroundSpec(
      {
        namespace: "unix",
        module: "range",
        name: "maxUnix",
        params: [
          { name: "start", type: "string" },
          { name: "end", type: "string" },
          { name: "unixValues", type: "number[]" },
        ],
        options: [],
        examples: [
          {
            call: `maxUnix("2024-01-01", "2024-12-31", [1706659200000, 1704067200000])`,
            result: `"2024-05-20"`,
          },
        ],
      },
      {
        classifyParamType: (() => {
          const map: Record<string, ClassifiedType> = {
            start: { type: "string" },
            end: { type: "string" },
            unixValues: { type: "array", arrayType: "number" },
          };
          return ((name: string) =>
            map[name] ?? { type: "string" }) as ParamTypeResolver;
        })(),
        optionPropertyType: () => undefined,
        classifyType: () => ({ type: "string" }),
        returnType: "string",
      },
    );
    expect(spec.params[2].type).toBe("array");
    expect(spec.params[2].arrayType).toBe("number");
    expect(spec.params[2].value).toBe("1706659200000,1704067200000");
  });
});

// ---------------------------------------------------------------------------
// classifyTypeFromString — timezone enum
// ---------------------------------------------------------------------------

describe("classifyTypeFromString (timezone)", () => {
  it("does not auto-detect timezone (param-name-aware)", () => {
    expect(classifyTypeFromString("string")).toEqual({ type: "string" });
  });
});

// ---------------------------------------------------------------------------
// classifyType (checker-backed) — pure number-literal unions
// ---------------------------------------------------------------------------

describe("classifyType (checker-backed — pure number unions)", () => {
  it("classifies `1 | 2 | 3` as number (fractionalSecondDigits)", () => {
    const src = `
      function f(digits: 1 | 2 | 3): void {}
    `;
    const { checker, sourceFile } = compile(src);
    const types = paramTypes(checker, sourceFile, "f");
    expect(classifyType(checker, types[0])).toEqual({ type: "number" });
  });

  it("classifies `0 | 1 | 2 | 3` as number", () => {
    const src = `
      function f(digits: 0 | 1 | 2 | 3): void {}
    `;
    const { checker, sourceFile } = compile(src);
    const types = paramTypes(checker, sourceFile, "f");
    expect(classifyType(checker, types[0])).toEqual({ type: "number" });
  });
});

// ---------------------------------------------------------------------------
// classifyType (checker-backed) — calendar and numberingSystem
// ---------------------------------------------------------------------------

describe("classifyType (checker-backed — calendar/numberingSystem)", () => {
  it("classifies calendar param as enum with curated calendars", () => {
    const src = `
      function f(calendar: string): void {}
    `;
    const { checker, sourceFile } = compile(src);
    const types = paramTypes(checker, sourceFile, "f");
    expect(classifyType(checker, types[0], "calendar")).toEqual({
      type: "enum",
      options: [...CURATED_CALENDARS],
    });
  });

  it("classifies numberingSystem param as enum with curated numbering systems", () => {
    const src = `
      function f(numberingSystem: string): void {}
    `;
    const { checker, sourceFile } = compile(src);
    const types = paramTypes(checker, sourceFile, "f");
    expect(classifyType(checker, types[0], "numberingSystem")).toEqual({
      type: "enum",
      options: [...CURATED_NUMBERING_SYSTEMS],
    });
  });

  it("classifies a locale param as enum with the curated locale matrix", () => {
    const src = `
      function f(locale: string): void {}
    `;
    const { checker, sourceFile } = compile(src);
    const types = paramTypes(checker, sourceFile, "f");
    expect(classifyType(checker, types[0], "locale")).toEqual({
      type: "enum",
      options: [...CURATED_LOCALES],
    });
  });

  it("does not classify unrelated string params as calendar/locale", () => {
    const src = `
      function f(pattern: string): void {}
    `;
    const { checker, sourceFile } = compile(src);
    const types = paramTypes(checker, sourceFile, "f");
    expect(classifyType(checker, types[0], "pattern")).toEqual({
      type: "string",
    });
  });
});
