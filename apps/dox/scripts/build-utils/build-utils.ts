/**
 * Pure, unit-tested helpers for generating playground specs.
 *
 * These functions intentionally avoid depending on `build-reference.ts` so they
 * can be tested in isolation. The only TS-compiler coupling lives behind small
 * injectable callbacks (`classifyType`, `classifyParamType`, `optionPropertyType`,
 * `classifyReturnType`) so `buildPlaygroundSpec` can be exercised with mocks.
 *
 * See `.kilo/plans/1788099109759-auto-generate-playground-specs.md`.
 */

import ts from "typescript";
import {
  argToValue,
  parseCallArgs,
  splitTopLevel,
} from "../../src/lib/playground-parsers";

export type ReturnTypeKind = "string" | "number" | "boolean" | "array";

export type ParamType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "units"
  | "array";

export interface ParamSpec {
  name: string;
  label?: string;
  type: ParamType;
  value: string;
  options?: string[];
  unitValue?: string;
  arrayType?: "number" | "string";
}

export interface ClassifiedType {
  type: ParamType;
  options?: string[];
  arrayType?: "number" | "string";
}

export interface PlaygroundSpec {
  module: string;
  fn: string;
  params: ParamSpec[];
  options?: ParamSpec[];
  returnType: "string" | "number" | "boolean" | "array";
  allowEmptyArray?: boolean;
}

/** Map a resolved TS type to a `ParamType`. Injected so tests can mock it. */
export type TypeClassifier = (
  type: ts.Type | undefined,
  paramName?: string,
) => ClassifiedType;

/** Resolve a single option property's TS type by name. Injected. */
export type OptionTypeResolver = (optName: string) => ts.Type | undefined;

/** Resolve a single positional param's classified type by name. Injected. */
export type ParamTypeResolver = (paramName: string) => ClassifiedType;

export interface ExampleLike {
  call: string;
  result: string;
  note?: string;
}

export interface PlaygroundSpecInput {
  namespace: string;
  module: string;
  name: string;
  params: Array<{ name: string; type: string }>;
  options: Array<{ name: string }>;
  examples: ExampleLike[];
}

export interface PlaygroundSpecDeps {
  classifyParamType: ParamTypeResolver;
  optionPropertyType: OptionTypeResolver;
  classifyType: TypeClassifier;
  returnType: ReturnTypeKind;
}

// ---------------------------------------------------------------------------
// Module resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the GMT_MODULES key a function's playground should import from.
 *
 * The `duration` barrel is a single top-level module that re-exports every
 * sub-module, so all duration functions resolve to the one key. Every other
 * namespace maps 1:1 to its GMT_MODULES key (`<ns>/<mod>`).
 */
export function playgroundModule(namespace: string, mod: string): string {
  if (namespace === "duration") return "duration";
  return `${namespace}/${mod}`;
}

// ---------------------------------------------------------------------------
// Type classification
// ---------------------------------------------------------------------------

export const CURATED_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
] as const;

export const CURATED_CALENDARS = [
  "gregorian",
  "hebrew",
  "islamic-civil",
  "islamic-tabular",
  "islamic-umalqura",
  "japanese",
  "buddhist",
  "taiwan",
  "persian",
  "indian",
  "ethiopic",
  "ethiopic-amete-alem",
  "coptic",
] as const;

export const CURATED_NUMBERING_SYSTEMS = [
  "latn",
  "arab",
  "arabext",
  "beng",
  "deva",
  "mymr",
  "thai",
  "hans",
  "hant",
  "jpan",
  "kore",
] as const;

export const ALL_DT_UNITS = [
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
] as const;

export const DATE_UNITS = ["years", "months", "weeks", "days"] as const;
export const TIME_UNITS = [
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
  "microseconds",
  "nanoseconds",
] as const;

const TEMPORAL_NUMBER_FIELDS = [
  "year",
  "month",
  "day",
  "eraYear",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
] as const;

const TEMPORAL_STRING_FIELDS = [
  "monthCode",
  "era",
  "calendar",
  "timeZone",
  "offset",
] as const;

function setEquals<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

/** Recursively extract string-literal values from a type (flattens nested unions and arrays). */
function extractStringLiteralValues(type: ts.Type, depth = 0): string[] {
  if (depth > 10) return [];
  if (type.flags & ts.TypeFlags.StringLiteral) {
    return [(type as ts.StringLiteralType).value];
  }
  if (type.flags & ts.TypeFlags.Union) {
    return (type as ts.UnionType).types.flatMap((t) =>
      extractStringLiteralValues(t, depth + 1),
    );
  }
  const numberIndex = type.getNumberIndexType();
  if (numberIndex) {
    return extractStringLiteralValues(numberIndex, depth + 1);
  }
  return [];
}

/**
 * Classify a TS type into a `ParamType`, resolving string-literal unions into
 * enums with their option lists.
 */
export function classifyType(
  _checker: ts.TypeChecker,
  type: ts.Type | undefined,
  _paramName?: string,
): ClassifiedType {
  if (!type) return { type: "string" };

  if (type.flags & ts.TypeFlags.Union) {
    const members = (type as ts.UnionType).types;

    // Mixed union: string-literal + number-literal → enum
    const stringLits = members.filter(
      (m) => m.flags & ts.TypeFlags.StringLiteral,
    );
    const numberLits = members.filter((m) => m.flags & ts.TypeFlags.NumberLike);
    if (stringLits.length > 0 && numberLits.length > 0) {
      const allLiterals: string[] = [];
      for (const m of members) {
        if (m.flags & ts.TypeFlags.StringLiteral) {
          allLiterals.push((m as ts.StringLiteralType).value);
        } else if (m.flags & ts.TypeFlags.NumberLike) {
          allLiterals.push(_checker.typeToString(m));
        }
      }
      return { type: "enum", options: allLiterals };
    }

    // Union containing string-literal union + array of that union
    // e.g. DateDurationUnit | DateDurationUnit[]
    const allLits = members.flatMap((m) => extractStringLiteralValues(m));
    if (allLits.length > 0) {
      return { type: "enum", options: [...new Set(allLits)] };
    }

    // Pure string-literal union
    if (stringLits.length === members.length && stringLits.length > 0) {
      return {
        type: "enum",
        options: stringLits.map((m) => (m as ts.StringLiteralType).value),
      };
    }
    // `boolean` is the union `true | false` under the hood.
    const bools = members.filter((m) => m.flags & ts.TypeFlags.BooleanLiteral);
    if (bools.length === members.length && bools.length > 0) {
      return { type: "boolean" };
    }
    // Pure number-literal union (e.g. `1 | 2 | 3` for fractionalSecondDigits)
    if (numberLits.length === members.length && numberLits.length > 0) {
      return { type: "number" };
    }
    return { type: "string" };
  }

  // Array type (number[], string[])
  const typeStr = _checker.typeToString(type);
  if (typeStr.endsWith("[]")) {
    const elemStr = typeStr.slice(0, -2).toLowerCase();
    return {
      type: "array",
      arrayType: elemStr.includes("number") ? "number" : "string",
    };
  }

  // Array<T> generic
  if (
    type.symbol &&
    type.symbol.name === "Array" &&
    (type as ts.GenericType).typeArguments &&
    (type as ts.GenericType).typeArguments!.length > 0
  ) {
    const elemType = (type as ts.GenericType).typeArguments![0];
    const elemStr = _checker.typeToString(elemType).toLowerCase();
    return {
      type: "array",
      arrayType: elemStr.includes("number") ? "number" : "string",
    };
  }

  if (type.flags & ts.TypeFlags.NumberLike) return { type: "number" };
  if (type.flags & ts.TypeFlags.BooleanLike) return { type: "boolean" };

  // Timezone detection (name-aware) — must come before generic StringLike
  if (
    _paramName &&
    /timezone|timeZone/i.test(_paramName) &&
    type.flags & ts.TypeFlags.StringLike
  ) {
    return { type: "enum", options: [...CURATED_TIMEZONES] };
  }

  // Calendar detection (name-aware) — typed as `string` in Intl types
  if (
    _paramName &&
    /^calendar$/i.test(_paramName) &&
    type.flags & ts.TypeFlags.StringLike
  ) {
    return { type: "enum", options: [...CURATED_CALENDARS] };
  }

  // Numbering system detection (name-aware) — typed as `string` in Intl types
  if (
    _paramName &&
    /numberingSystem/i.test(_paramName) &&
    type.flags & ts.TypeFlags.StringLike
  ) {
    return { type: "enum", options: [...CURATED_NUMBERING_SYSTEMS] };
  }

  if (type.flags & ts.TypeFlags.StringLike) return { type: "string" };
  if (type.flags & ts.TypeFlags.Object) {
    const props = type.getProperties();
    if (props.length > 0) {
      const propNames = props
        .map((p) => p.name)
        .filter(
          (n) => !Object.prototype.hasOwnProperty.call(Object.prototype, n),
        );

      const propNamesSet = new Set(propNames);
      const allDtSet = new Set(ALL_DT_UNITS);
      const dateSet = new Set(DATE_UNITS);
      const timeSet = new Set(TIME_UNITS);

      if (
        propNames.length > 0 &&
        (setEquals(propNamesSet, allDtSet) ||
          setEquals(propNamesSet, dateSet) ||
          setEquals(propNamesSet, timeSet))
      ) {
        let allNumber = true;
        for (const p of props) {
          const decl = p.declarations?.[0] as ts.Node | undefined;
          if (decl) {
            const pt = _checker.getTypeOfSymbolAtLocation(p, decl);
            if (!(pt.flags & ts.TypeFlags.NumberLike)) {
              allNumber = false;
              break;
            }
          }
        }
        if (allNumber) {
          return { type: "units", options: propNames };
        }
      }

      // Temporal field objects (setDate, setDateTime, setTime, setUtc, setZoned, setUnix)
      const temporalNumSet = new Set<string>(TEMPORAL_NUMBER_FIELDS);
      const temporalStrSet = new Set<string>(TEMPORAL_STRING_FIELDS);
      const allRecognized = propNames.every(
        (n) => temporalNumSet.has(n) || temporalStrSet.has(n),
      );
      const numberFields = propNames.filter((n) => temporalNumSet.has(n));
      if (allRecognized && numberFields.length > 0) {
        return { type: "units", options: numberFields };
      }
    }
  }

  return { type: "string" };
}

/** Classify a type from its string form (used for rest-tuple inner types). */
export function classifyTypeFromString(s: string): ClassifiedType {
  const t = s.trim();
  if (/^(number|Number|bigint)$/.test(t)) return { type: "number" };
  if (/^boolean$/.test(t)) return { type: "boolean" };
  if (t.endsWith("[]")) {
    const elem = t.slice(0, -2).trim();
    const arrayType = /^(number|Number|bigint)$/.test(elem)
      ? "number"
      : "string";
    return { type: "array", arrayType };
  }
  if (/^("[^"]*")(?:\s*\|\s*"[^"]*")+$/.test(t)) {
    const opts = [...t.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    if (opts.length > 0) return { type: "enum", options: opts };
  }
  // Mixed union: number literals + string literals
  const hasNumberLit = /\b\d+\b/.test(t);
  const hasStringLit = /"[^"]*"/.test(t);
  if (hasNumberLit && hasStringLit && t.includes("|")) {
    const opts: string[] = [];
    for (const part of t.split("|")) {
      const p = part.trim();
      if (/^\d+$/.test(p)) {
        opts.push(p);
      } else if (/^"[^"]*"$/.test(p)) {
        opts.push(p.slice(1, -1));
      }
    }
    if (opts.length > 0) return { type: "enum", options: opts };
  }
  return { type: "string" };
}

/**
 * Classify a function return type (string form) into the `returnType` used for
 * sentinel detection.
 */
export function classifyReturnTypeFromString(rs: string): ReturnTypeKind {
  if (rs.endsWith("[]") || rs.includes("[]")) return "array";
  if (rs.includes("boolean")) return "boolean";
  if (rs.includes("number")) return "number";
  return "string";
}

/** Classify a function's return type from its TS signature. */
export function classifyReturnType(
  checker: ts.TypeChecker,
  sig: ts.Signature | undefined,
): ReturnTypeKind {
  if (!sig) return "string";
  return classifyReturnTypeFromString(
    checker.typeToString(sig.getReturnType()),
  );
}

/**
 * Detect a rest tuple param (`...input: [stepDays?: number]`) and resolve it
 * to its element's name + TS type string. Multi-element rest tuples are split
 * into one element each. Returns `null` for non-rest types.
 */
export function resolveRestParam(
  typeStr: string,
): Array<{ name: string; inner: string }> | null {
  const m = typeStr.match(/^\[\s*([\s\S]+?)\s*\]$/);
  if (!m) return null;
  return splitTopLevel(m[1]).map((el) => {
    const mm = el.trim().match(/^([\w$]+)\s*\??\s*:\s*(.+)$/);
    return mm
      ? { name: mm[1], inner: mm[2].trim() }
      : { name: el.trim(), inner: "string" };
  });
}

/** Sensible JS-default seed value for a param type. */
export function defaultValue(kind: ParamType): string {
  if (kind === "number") return "0";
  if (kind === "boolean") return "false";
  return "";
}

// ---------------------------------------------------------------------------
// Example argument parsing
// ---------------------------------------------------------------------------

/** Parse `{ unit: amount }` for units params. */
export function parseUnitsArg(raw: string): { unit: string; amount: string } {
  const t = raw.trim();
  const m = t.match(/\{\s*(\w+)\s*:\s*(-?\d+(?:\.\d+)?)\s*\}/);
  if (m) return { unit: m[1], amount: m[2] };
  return { unit: "", amount: "1" };
}

/** Parse `[1, 2, 3]` for array params. */
export function parseArrayArg(raw: string): string[] {
  const t = raw.trim();
  const inner = t.replace(/^\[|\]$/g, "").trim();
  if (!inner) return [];
  return splitTopLevel(inner).map((s) => {
    const trimmed = s.trim();
    const unquoted = argToValue(trimmed);
    const n = Number(unquoted);
    return isNaN(n) ? unquoted : String(n);
  });
}

/** Pull a single property's raw value out of a trailing options object literal. */
export function optionValueFromCall(
  call: string,
  optName: string,
): string | undefined {
  const args = parseCallArgs(call);
  const objArg = [...args].reverse().find((a) => a.trim().startsWith("{"));
  if (!objArg) return undefined;
  const m = objArg.match(
    new RegExp(
      `\\b${optName}\\s*:\\s*("[^"]*"|'[^']*'|true|false|-?\\d+(?:\\.\\d+)?)`,
    ),
  );
  return m ? m[1] : undefined;
}

// ---------------------------------------------------------------------------
// Seed derivation
// ---------------------------------------------------------------------------

/** Seed value for a positional param; scans examples for one supplying it. */
export function seedForParam(
  examples: ExampleLike[],
  index: number,
  info: ClassifiedType,
): string {
  for (const ex of examples) {
    const args = parseCallArgs(ex.call);
    if (args.length > index) {
      const raw = args[index];
      if (info.type === "units") {
        const parsed = parseUnitsArg(raw);
        return parsed.amount;
      }
      if (info.type === "array") {
        const elements = parseArrayArg(raw);
        return elements.length > 0 ? elements.join(",") : "0,0,0";
      }
      const v = argToValue(raw);
      if (info.type === "enum" && info.options) {
        return info.options.includes(v) ? v : info.options[0];
      }
      return v;
    }
  }
  if (info.type === "units") return "1";
  if (info.type === "array") return "0,0,0";
  // Enum options default to empty (unset) — callers expecting a specific
  // default should seed it from examples. Intl options are optional and
  // passing the first enum value creates invalid option combinations.
  if (info.type === "enum") return "";
  return defaultValue(info.type);
}

/** Seed unit value for a units param; scans examples for the unit name. */
export function seedForUnitsParam(
  examples: ExampleLike[],
  index: number,
  info: ClassifiedType,
): string | undefined {
  if (info.type !== "units") return undefined;
  for (const ex of examples) {
    const args = parseCallArgs(ex.call);
    if (args.length > index) {
      const parsed = parseUnitsArg(args[index]);
      if (parsed.unit && info.options?.includes(parsed.unit)) {
        return parsed.unit;
      }
    }
  }
  return info.options?.[0];
}

/** Seed value for an option property; falls back to its type default. */
export function seedForOption(
  examples: ExampleLike[],
  optName: string,
  info: ClassifiedType,
): string {
  for (const ex of examples) {
    const raw = optionValueFromCall(ex.call, optName);
    if (raw !== undefined) {
      const v = argToValue(raw);
      if (info.type === "enum" && info.options) {
        return info.options.includes(v) ? v : info.options[0];
      }
      return v;
    }
  }
  // Enum options default to empty (unset) — Intl options are optional and
  // passing the first enum value creates invalid option combinations.
  if (info.type === "enum") return "";
  // roundingIncrement defaults to 1 (0 is invalid for Temporal round/normalize)
  if (info.type === "number" && optName === "roundingIncrement") return "1";
  return defaultValue(info.type);
}

// ---------------------------------------------------------------------------
// Option property type resolution (checker-backed)
// ---------------------------------------------------------------------------

/** Resolve a single option property's TS type from the signature. */
export function optionPropertyType(
  checker: ts.TypeChecker,
  sig: ts.Signature | undefined,
  node: ts.Node,
  optName: string,
): ts.Type | undefined {
  if (!sig) return undefined;
  for (const sp of sig.getParameters()) {
    if (!sp.name.toLowerCase().includes("options")) continue;
    const t = checker.getTypeOfSymbolAtLocation(sp, node);
    const prop = t.getProperty(optName) ?? t.getProperty(`${optName}?`);
    if (prop) return checker.getTypeOfSymbolAtLocation(prop, node);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Spec assembly
// ---------------------------------------------------------------------------

/**
 * Build a playground spec from an extracted function + injected classifiers.
 *
 * The injectable deps keep this fully testable: the caller wires real TS
 * compiler callbacks in `build-reference.ts`, while tests pass mocks.
 */
export function buildPlaygroundSpec(
  input: PlaygroundSpecInput,
  deps: PlaygroundSpecDeps,
): PlaygroundSpec {
  const module = playgroundModule(input.namespace, input.module);
  const params: ParamSpec[] = [];

  for (const p of input.params) {
    const rest = resolveRestParam(p.type);
    let name = p.name;
    let info: ClassifiedType;
    if (rest) {
      name = rest[0].name;
      info = classifyTypeFromString(rest[0].inner);
    } else {
      info = deps.classifyParamType(p.name);
    }
    const value = seedForParam(input.examples, params.length, info);
    const spec: ParamSpec = { name, type: info.type, value };
    if (info.options) spec.options = info.options;
    if (info.type === "units") {
      const unitValue = seedForUnitsParam(input.examples, params.length, info);
      spec.unitValue = unitValue ?? info.options?.[0] ?? "";
    }
    if (info.type === "array" && info.arrayType)
      spec.arrayType = info.arrayType;
    params.push(spec);
  }

  const options: ParamSpec[] = input.options.map((o) => {
    const optName = o.name.replace(/\?$/, "");
    const t = deps.optionPropertyType(optName);
    const info = deps.classifyType(t, optName);
    const value = seedForOption(input.examples, optName, info);
    const spec: ParamSpec = { name: optName, type: info.type, value };
    if (info.options) spec.options = info.options;
    return spec;
  });

  const returnType = deps.returnType;
  const allowEmptyArray =
    returnType === "array" &&
    input.examples.some((e) => e.result.trim() === "[]");

  const spec: PlaygroundSpec = { module, fn: input.name, params, returnType };
  if (options.length) spec.options = options;
  if (allowEmptyArray) spec.allowEmptyArray = true;
  return spec;
}
