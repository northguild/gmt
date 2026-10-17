/**
 * Pure, unit-tested helpers for generating playground specs.
 *
 * These functions intentionally avoid depending on `build-reference.ts` so they
 * can be tested in isolation. The only TS-compiler coupling lives behind small
 * injectable callbacks (`classifyType`, `classifyParamType`, `optionPropertyType`,
 * `classifyReturnType`) so `buildPlaygroundSpec` can be exercised with mocks.
 */

import ts from "typescript";
import {
  argToValue,
  parseCallArgs,
  splitTopLevel,
} from "../../src/lib/playground-parsers";

/**
 * What a function returns, as far as sentinel detection cares.
 *
 * `object` covers results that are neither primitives nor arrays: an interface
 * (`Dwell`), a literal shape (`{ start, end }`), a class instance
 * (`Temporal.PlainDate`). Their sentinel is `null`.
 */
export type ReturnTypeKind =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "array"
  | "object";

export type ParamType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "enum"
  | "units"
  | "array"
  /**
   * A union that mixes string literals with a value no choice list can name: the open
   * `number` or `bigint`, or an object type (`number | "rolling" | { notBefore: string }`).
   * The reader types the argument as source text, so every form of the union is reachable.
   */
  | "expr";

export interface ParamSpec {
  name: string;
  label?: string;
  type: ParamType;
  value: string;
  options?: string[];
  unitValue?: string;
  arrayType?: "number" | "string";
  /** `x?:` in the signature — the example may legitimately omit it. */
  optional?: boolean;
  /** `array` params only: element type is `{ start, end }` interval objects. */
  intervalShape?: boolean;
}

export interface ClassifiedType {
  type: ParamType;
  options?: string[];
  arrayType?: "number" | "string";
  intervalShape?: boolean;
}

export interface PlaygroundSpec {
  module: string;
  fn: string;
  params: ParamSpec[];
  options?: ParamSpec[];
  returnType: ReturnTypeKind;
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
  params: Array<{ name: string; type: string; optional?: boolean }>;
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
 * Resolve the GMT_MODULES key a function's playground imports from: its own
 * module subpath (`<ns>/<mod>`), never a namespace barrel.
 */
export function playgroundModule(namespace: string, mod: string): string {
  return `${namespace}/${mod}`;
}

// ---------------------------------------------------------------------------
// Type classification
// ---------------------------------------------------------------------------

/* Re-exported, not defined here. This file imports the TypeScript compiler at
   its top level, so anything defined in it is unreachable from the browser —
   and `DOX-C3b` needs this list in a client-side widget template. The data now
   lives in `src/lib/curated-timezones.ts`; the dependency points that way and
   must not be reversed. */
import { CURATED_TIMEZONES } from "../../src/lib/curated-timezones";

export { CURATED_TIMEZONES };

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

// The 17-locale test matrix from packages/gmt/src/test/localeMatrix.ts
// (MustTestLocales). Kept in sync by hand — mirrored in
// src/components/ConverterBench.astro.
export const CURATED_LOCALES = [
  "en-US",
  "en-GB",
  "de-DE",
  "fr-FR",
  "es-ES",
  "it-IT",
  "pt-PT",
  "sv-SE",
  "is-IS",
  "zh-CN",
  "zh-TW",
  "ja-JP",
  "ko-KR",
  "ar-SA",
  "he-IL",
  "ru-RU",
  "tr-TR",
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

/**
 * The units with an exact length: a day, which is 24 hours when nothing anchors it (as
 * `Temporal.Duration.prototype.total` reads one without `relativeTo`), and the time units.
 * The keys of `ExactDurationUnit`, which `totalUnits` takes.
 */
export const EXACT_UNITS = ["days", ...TIME_UNITS] as const;

/**
 * The rank of each unit name, by descending magnitude, as the Temporal specification's table of
 * units orders them: the plural names `years` … `nanoseconds` (their index in `ALL_DT_UNITS`),
 * then the singular names `year` … `nanosecond`, each 10 places after its plural. The empty
 * string, the sentinel a function returns for invalid input (`DateDurationUnit | ""`), ranks
 * last, as the source writes it.
 */
export const UNIT_ORDER: ReadonlyMap<string, number> = new Map([
  ...ALL_DT_UNITS.flatMap((plural, i) => [
    [plural, i] as const,
    [plural.slice(0, -1), i + ALL_DT_UNITS.length] as const,
  ]),
  ["", 2 * ALL_DT_UNITS.length],
]);

/**
 * `names` in `UNIT_ORDER` when there are two or more, at least one is a unit name, and every
 * one is a unit name or `""`; otherwise `names` unchanged.
 */
export function orderUnitNames(names: readonly string[]): string[] {
  if (
    names.length < 2 ||
    !names.every((n) => UNIT_ORDER.has(n)) ||
    names.every((n) => n === "")
  )
    return [...names];
  return [...names].sort((a, b) => UNIT_ORDER.get(a)! - UNIT_ORDER.get(b)!);
}

const OPEN = "([{<";
const CLOSE = ")]}>";
const QUOTED = /^"[^"]*"$/;

/** The end index of the string literal that opens at `i`, or the text's end. */
function stringEnd(text: string, i: number): number {
  const j = text.indexOf(text[i], i + 1);
  return j === -1 ? text.length - 1 : j;
}

/**
 * The aliases the printer gives a type of unit names, in a union beside quoted unit names or the
 * `""` sentinel. They count as unit members when the sentinel rule decides where `""` goes.
 */
const UNIT_TYPE_TOKENS: ReadonlySet<string> = new Set([
  "keyof DurationLike",
  "DateUnit",
  "TimeUnit",
  "DateTimeUnit",
]);

/** A quoted member that names a unit (`"days"`), not the `""` sentinel or another literal. */
function isQuotedUnit(m: string): boolean {
  return QUOTED.test(m) && m !== '""' && UNIT_ORDER.has(m.slice(1, -1));
}

/** A quoted member other than the `""` sentinel. */
function isQuotedLiteral(m: string): boolean {
  return QUOTED.test(m) && m !== '""';
}

/**
 * One union's members with its quoted literals in `orderUnitChoices` order: the unit names first,
 * by `UNIT_ORDER`, then every other quoted literal (`"dayOfWeek"`) in the order it had. They fill
 * the quoted slots, so `""`, an alias, `null` and a bracketed type keep their places. Fewer than
 * two unit names leave the union unchanged.
 */
function orderQuoted(members: string[]): string[] {
  const units = members.filter(isQuotedUnit);
  if (units.length < 2) return members;
  const ordered = [
    ...[...units].sort(
      (a, b) =>
        UNIT_ORDER.get(a.slice(1, -1))! - UNIT_ORDER.get(b.slice(1, -1))!,
    ),
    ...members.filter((m) => isQuotedLiteral(m) && !isQuotedUnit(m)),
  ];
  let next = 0;
  return members.map((m) => (isQuotedLiteral(m) ? ordered[next++] : m));
}

/**
 * One union's members in unit order. A union holding the `""` sentinel whose every other member
 * is a quoted unit name or a `UNIT_TYPE_TOKENS` alias sorts its unit names into their quoted
 * slots, keeps the aliases in place, and puts `""` last. A union with any other member
 * (`null`, `"reject"`, `DateUnit[]`) is treated like one without `""`: the unit slots sort, and
 * `""` and the rest stay where they were printed.
 */
function orderMembers(members: string[]): string[] {
  const sentinel = '""';
  if (!members.includes(sentinel)) return orderQuoted(members);
  const rest = members.filter((m) => m !== sentinel);
  const isUnit = (m: string) => UNIT_TYPE_TOKENS.has(m) || isQuotedUnit(m);
  if (rest.length === 0 || !rest.every(isUnit)) return orderQuoted(members);
  return [...orderQuoted(rest), ...members.filter((m) => m === sentinel)];
}

/** Every bracket group inside one member, processed. */
function orderInside(member: string): string {
  let out = "";
  for (let i = 0; i < member.length; i++) {
    const c = member[i];
    if (c === '"' || c === "'" || c === "`") {
      const j = stringEnd(member, i);
      out += member.slice(i, j + 1);
      i = j;
    } else if (c === "=" && member[i + 1] === ">") {
      out += "=>";
      i++;
    } else if (OPEN.includes(c)) {
      let depth = 0;
      let j = i;
      for (; j < member.length; j++) {
        const x = member[j];
        if (x === '"' || x === "'" || x === "`") j = stringEnd(member, j);
        else if (x === "=" && member[j + 1] === ">") j++;
        else if (OPEN.includes(x)) depth++;
        else if (CLOSE.includes(x) && --depth === 0) break;
      }
      out += c + orderUnitUnions(member.slice(i + 1, j)) + (member[j] ?? "");
      i = j;
    } else out += c;
  }
  return out;
}

/**
 * Printed type text with each union of unit names in `UNIT_ORDER`. The TypeScript printer lists
 * a union in the checker's internal order, which changes with what else the program holds.
 *
 * Only a union with two or more quoted unit names is reordered, and only its quoted slots move:
 * the unit names first, then any other quoted literal (`"dayOfWeek"`), the order a select lists
 * them in (`orderUnitChoices`). An alias (`TimeUnit`), a `keyof` type, `null` or a bracketed
 * member keeps its place, and the brackets inside every member are still walked. The `""`
 * sentinel goes last when every other member is a unit name or a unit alias (`orderMembers`).
 */
export function orderUnitUnions(text: string): string {
  let out = "";
  let segment: string[] = [];
  let current = "";
  let depth = 0;
  const endMember = () => {
    segment.push(current);
    current = "";
  };
  const endSegment = () => {
    endMember();
    if (segment.length > 1) {
      const trimmed = segment.map((m) => m.trim());
      const ordered = orderMembers(trimmed.map(orderInside));
      out += segment.map((m, i) => m.replace(trimmed[i], ordered[i])).join("|");
    } else out += orderInside(segment[0]);
    segment = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      const j = stringEnd(text, i);
      current += text.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === "=" && text[i + 1] === ">") {
      if (depth === 0) {
        endSegment();
        out += "=>";
      } else current += "=>";
      i++;
      continue;
    }
    if (OPEN.includes(c)) depth++;
    if (CLOSE.includes(c)) depth--;
    if (depth === 0 && c === "|") {
      endMember();
      continue;
    }
    if (depth === 0 && (c === "," || c === ";" || c === ":")) {
      endSegment();
      out += c;
      continue;
    }
    current += c;
    // A type predicate's subject (`unit is …`, `asserts unit is …`) is not a union member.
    if (
      depth === 0 &&
      segment.length === 0 &&
      /^\s*(?:asserts\s+)?[A-Za-z_$][\w$]*\s+is\s+$/.test(current)
    ) {
      out += current;
      current = "";
    }
  }
  endSegment();
  return out;
}

/**
 * A select's choices with the unit names first, largest first (`UNIT_ORDER`), then every other
 * choice in the order it had (`"dayOfWeek"`, `"timeZone"`), then `""`. The source writes these
 * types the same way (`DateTimeUnit | "dayOfWeek"`). A list with no unit name is unchanged.
 * A printed union gets the same order in its quoted slots (`orderQuoted`).
 */
export function orderUnitChoices(choices: readonly string[]): string[] {
  const isUnit = (c: string) => c !== "" && UNIT_ORDER.has(c);
  if (!choices.some(isUnit)) return [...choices];
  return [
    ...orderUnitNames(choices.filter(isUnit)),
    ...choices.filter((c) => !isUnit(c) && c !== ""),
    ...choices.filter((c) => c === ""),
  ];
}

/** `info` with an enum's or a list's choices in `orderUnitChoices` order. */
function withUnitOrder(info: ClassifiedType): ClassifiedType {
  return (info.type === "enum" || info.type === "array") && info.options
    ? { ...info, options: orderUnitChoices(info.options) }
    : info;
}

/** The key sets a unit object control recognises, each in display order. */
const UNIT_KEY_SETS: readonly (readonly string[])[] = [
  ALL_DT_UNITS,
  DATE_UNITS,
  EXACT_UNITS,
  TIME_UNITS,
];

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
 * `type` without `null` and `undefined`. The reference program runs with `strictNullChecks`, so
 * an optional parameter or property reads `T | undefined`; the playground classifies `T`. A
 * checker without `getNonNullableType` (a test double) returns the type unchanged.
 */
function nonNullable(checker: ts.TypeChecker, type: ts.Type): ts.Type {
  return typeof checker?.getNonNullableType === "function"
    ? checker.getNonNullableType(type)
    : type;
}

/**
 * Classify a TS type into a `ParamType`, resolving string-literal unions into
 * enums with their option lists. Unit names among the choices read largest
 * first (`orderUnitChoices`), never in the checker's order.
 */
export function classifyType(
  checker: ts.TypeChecker,
  type: ts.Type | undefined,
  paramName?: string,
): ClassifiedType {
  return withUnitOrder(classifyTypeAsPrinted(checker, type, paramName));
}

/**
 * True for a union member that no list of choices can name: the open `number` or `bigint`, or
 * an object type. An array is not one: `DateDurationUnit | DateDurationUnit[]` is still a choice
 * of units.
 */
function isOpenMember(type: ts.Type): boolean {
  if (type.flags & (ts.TypeFlags.Number | ts.TypeFlags.BigInt)) return true;
  if (!(type.flags & ts.TypeFlags.Object)) return false;
  const name = type.symbol?.name;
  return name !== "Array" && name !== "ReadonlyArray";
}

/** `classifyType`, with any choices in the order the checker holds them. */
function classifyTypeAsPrinted(
  _checker: ts.TypeChecker,
  type: ts.Type | undefined,
  _paramName?: string,
): ClassifiedType {
  if (!type) return { type: "string" };
  type = nonNullable(_checker, type);

  // A parameter typed with exactly one string literal (`format: "102"`) is not a union to
  // TypeScript, but the reader still has to pick from the codes the function takes: one choice.
  if (type.flags & ts.TypeFlags.StringLiteral) {
    return { type: "enum", options: [(type as ts.StringLiteralType).value] };
  }

  if (type.flags & ts.TypeFlags.Union) {
    const members = (type as ts.UnionType).types;

    const stringLits = members.filter(
      (m) => m.flags & ts.TypeFlags.StringLiteral,
    );
    // String literals beside a member no choice can name (`number`, `bigint`, an object
    // type) are source text, not an enum: a choice list would offer `number` as a value.
    if (stringLits.length > 0 && members.some(isOpenMember)) {
      return { type: "expr" };
    }

    // Mixed union: string-literal + number-literal → enum
    const numberLits = members.filter(
      (m) => m.flags & ts.TypeFlags.NumberLiteral,
    );
    if (stringLits.length > 0 && numberLits.length > 0) {
      const allLiterals: string[] = [];
      for (const m of members) {
        if (m.flags & ts.TypeFlags.StringLiteral) {
          allLiterals.push((m as ts.StringLiteralType).value);
        } else if (m.flags & ts.TypeFlags.NumberLiteral) {
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

  // Array type (number[], string[], ("a" | "b")[], { start, end }[])
  const typeStr = _checker.typeToString(type);
  const isBracketArray = typeStr.endsWith("[]");
  const isGenericArray =
    !!type.symbol &&
    type.symbol.name === "Array" &&
    !!(type as ts.GenericType).typeArguments &&
    (type as ts.GenericType).typeArguments!.length > 0;
  if (isBracketArray || isGenericArray) {
    const elemType = isGenericArray
      ? (type as ts.GenericType).typeArguments![0]
      : (type.getNumberIndexType() ?? undefined);
    const elemStr = (
      isBracketArray ? typeStr.slice(0, -2) : _checker.typeToString(elemType!)
    ).toLowerCase();

    // `{ start, end }[]` — interval-object lists. A third member is allowed only when it is
    // optional: the interval editor keeps `start` and `end` alone, so a required member such
    // as a duty entry's `status` would be dropped and every seeded call would fail.
    if (elemType && elemType.flags & ts.TypeFlags.Object) {
      const members = elemType.getProperties();
      const props = new Set(members.map((p) => p.name));
      const othersOptional = members.every(
        (p) =>
          p.name === "start" ||
          p.name === "end" ||
          (p.flags & ts.SymbolFlags.Optional) !== 0,
      );
      if (
        props.has("start") &&
        props.has("end") &&
        props.size <= 3 &&
        othersOptional
      ) {
        return { type: "array", arrayType: "string", intervalShape: true };
      }
    }

    // `("years" | "months")[]` — string-literal element unions become an enum list
    const lits = elemType ? extractStringLiteralValues(elemType) : [];
    if (lits.length > 0) {
      return {
        type: "array",
        arrayType: "string",
        options: [...new Set(lits)],
      };
    }

    return {
      type: "array",
      arrayType: elemStr.includes("number") ? "number" : "string",
    };
  }

  if (type.flags & ts.TypeFlags.BigIntLike) return { type: "bigint" };
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

  // Locale detection (name-aware) — a BCP-47 `string` in Intl types; surface the
  // 17-locale test matrix as a dropdown rather than a free-text field.
  if (
    _paramName &&
    /^locale$/i.test(_paramName) &&
    type.flags & ts.TypeFlags.StringLike
  ) {
    return { type: "enum", options: [...CURATED_LOCALES] };
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
      const keySet = UNIT_KEY_SETS.find((k) =>
        setEquals(propNamesSet, new Set(k)),
      );

      if (propNames.length > 0 && keySet) {
        let allNumber = true;
        for (const p of props) {
          // A mapped type (`Partial<Record<Unit, number>>`) has no declarations.
          const decl = p.declarations?.[0] as ts.Node | undefined;
          let raw: ts.Type | undefined;
          if (
            decl &&
            typeof _checker.getTypeOfSymbolAtLocation === "function"
          ) {
            raw = _checker.getTypeOfSymbolAtLocation(p, decl);
          } else if (typeof _checker.getTypeOfSymbol === "function") {
            raw = _checker.getTypeOfSymbol(p);
          }
          if (!raw) continue;
          const pt = nonNullable(_checker, raw);
          if (!(pt.flags & ts.TypeFlags.NumberLike)) {
            allNumber = false;
            break;
          }
        }
        if (allNumber) {
          // The constant's order, never the checker's: it changes with the program.
          return { type: "units", options: [...keySet] };
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
        return {
          type: "units",
          options: TEMPORAL_NUMBER_FIELDS.filter((n) => propNamesSet.has(n)),
        };
      }
    }
  }

  return { type: "string" };
}

/**
 * Classify a type from its string form (used for rest-tuple inner types).
 * Unit names among the choices read largest first (`orderUnitChoices`).
 */
export function classifyTypeFromString(s: string): ClassifiedType {
  return withUnitOrder(classifyTypeFromStringAsWritten(s));
}

/** `classifyTypeFromString`, with any choices in the order the text lists them. */
function classifyTypeFromStringAsWritten(s: string): ClassifiedType {
  const t = s.trim();
  if (/^bigint$/.test(t)) return { type: "bigint" };
  if (/^(number|Number)$/.test(t)) return { type: "number" };
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
  // `number | "rolling"` and the like: string literals beside an open `number`, `bigint` or
  // object type are source text, not choices.
  const members = unionMembers(t);
  if (
    members.length > 1 &&
    members.some((m) => /^"[^"]*"$/.test(m)) &&
    members.some((m) => /^(number|bigint)$/.test(m) || m.startsWith("{"))
  ) {
    return { type: "expr" };
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
  /* Before the substring checks: `{ year: number; … } | null` contains the word
     "number" and is still an object. */
  const members = unionMembers(rs).filter(
    (m) => m !== "null" && m !== "undefined",
  );
  if (members.length > 0 && members.every((m) => m.startsWith("{"))) {
    return "object";
  }
  if (rs.includes("boolean")) return "boolean";
  if (rs.includes("bigint")) return "bigint";
  if (rs.includes("number")) return "number";
  return "string";
}

/** Split a printed type on its top-level `|`, ignoring any inside brackets. */
function unionMembers(rs: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of rs) {
    if ("{[(<".includes(ch)) depth++;
    if ("}])>".includes(ch)) depth--;
    if (ch === "|" && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out.filter((m) => m !== "");
}

/** Classify a function's return type from its TS signature. */
export function classifyReturnType(
  checker: ts.TypeChecker,
  sig: ts.Signature | undefined,
): ReturnTypeKind {
  if (!sig) return "string";
  const type = sig.getReturnType();
  if (isObjectResult(checker, type)) return "object";
  return classifyReturnTypeFromString(checker.typeToString(type));
}

/**
 * True when every non-null member of the return type is an object type that is
 * not an array or tuple.
 *
 * Decided from type flags rather than the printed type, because the printed
 * form cannot tell an interface from a string-literal alias: `Dwell | null` and
 * `LocalTimeClassification | null` look alike, and only the first is an object.
 */
function isObjectResult(checker: ts.TypeChecker, type: ts.Type): boolean {
  const members = (type.isUnion() ? type.types : [type]).filter(
    (m) => (m.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) === 0,
  );
  return (
    members.length > 0 &&
    members.every(
      (m) =>
        (m.flags & ts.TypeFlags.Object) !== 0 &&
        !checker.isArrayType(m) &&
        !checker.isTupleType(m),
    )
  );
}

/**
 * Detect a rest tuple param (`...input: [stepDays?: number]`) and resolve it
 * to its element's name + TS type string. Multi-element rest tuples are split
 * into one element each. Returns `null` for non-rest types.
 */
export function resolveRestParam(
  typeStr: string,
): Array<{ name: string; inner: string; optional?: boolean }> | null {
  const m = typeStr.match(/^\[\s*([\s\S]+?)\s*\]$/);
  if (!m) return null;
  return splitTopLevel(m[1]).map((el) => {
    const mm = el.trim().match(/^([\w$]+)(\s*\?)?\s*:\s*(.+)$/);
    return mm
      ? { name: mm[1], inner: mm[3].trim(), optional: mm[2] !== undefined }
      : { name: el.trim(), inner: "string", optional: true };
  });
}

/** Sensible JS-default seed value for a param type. */
export function defaultValue(kind: ParamType): string {
  if (kind === "number" || kind === "bigint") return "0";
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

/** Parse `[{ start: "a", end: "b" }, …]` into start/end string pairs. */
export function parseIntervalArg(raw: string): Array<[string, string]> {
  const t = raw.trim();
  const inner = t.replace(/^\[|\]$/g, "").trim();
  if (!inner) return [];
  const pairs: Array<[string, string]> = [];
  for (const item of splitTopLevel(inner)) {
    const s = item.match(/start\s*:\s*("[^"]*"|'[^']*')/);
    const e = item.match(/end\s*:\s*("[^"]*"|'[^']*')/);
    pairs.push([s ? argToValue(s[1]) : "", e ? argToValue(e[1]) : ""]);
  }
  return pairs;
}

/**
 * Split a trailing object-literal arg (`{ value1: "a", value2: "b" }`) into
 * top-level `key → raw value` entries. Nested objects (an `options: { … }` key)
 * come back with the brace-wrapped value untouched.
 */
export function parseObjectArgEntries(raw: string): Array<[string, string]> {
  const t = raw.trim();
  const m = t.match(/^\{\s*([\s\S]*?)\s*\}$/);
  if (!m || !m[1].trim()) return [];
  const out: Array<[string, string]> = [];
  for (const part of splitTopLevel(m[1])) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    out.push([part.slice(0, colon).trim(), part.slice(colon + 1).trim()]);
  }
  return out;
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
      // Source text keeps its quotes: `"rolling"` and `0` are different arguments.
      if (info.type === "expr") return raw.trim();
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
    const t = nonNullable(checker, checker.getTypeOfSymbolAtLocation(sp, node));
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
    if (p.optional || rest?.[0]?.optional) spec.optional = true;
    if (info.type === "units") {
      const unitValue = seedForUnitsParam(input.examples, params.length, info);
      spec.unitValue = unitValue ?? info.options?.[0] ?? "";
    }
    if (info.type === "array" && info.arrayType)
      spec.arrayType = info.arrayType;
    if (info.type === "array" && info.intervalShape) spec.intervalShape = true;
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
