/**
 * No-throw fuzz harness (CORE-8 row A1).
 *
 * GMT's contract: invalid input returns the return type's sentinel and never throws
 * (context/coding-standards.md § API Contract). This module builds, for every public function,
 * a valid baseline call and a set of garbage variants — each argument position replaced in turn
 * by `null`, `undefined`, `0`, `""`, `"x"`, `[]`, `{}` and `NaN` — so the harness tests can
 * assert that no call throws, that every result has the declared return type, and that a call
 * missing a required argument (absent, nullish, or a non-finite value for a numeric parameter)
 * returns the sentinel. Current-moment `get/` accessors are only checked for "no throw".
 *
 * Baselines come from the function's `@example` calls in the generated reference corpus
 * (`apps/dox/src/generated/reference/gmt-corpus.json`, built from the JSDoc). The declared return
 * type and the parameter count are read from the function's own source signature,
 * because the corpus signature drops `| null`.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import * as gmt from "../index";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../..");
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "../..");
const CORPUS_PATH = path.join(
  REPO_ROOT,
  "apps/dox/src/generated/reference/gmt-corpus.json",
);

type CorpusEntry = {
  name: string;
  namespace: string;
  module?: string;
  kind: string;
  sourcePath: string;
  examples?: { call: string }[];
};

/** The declared kind of a return type, one per row of the sentinel table. */
type ReturnKind =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "bigint";

export type DeclaredReturn = { kinds: ReturnKind[]; nullable: boolean };

/**
 * `missingRequired`: a required parameter is absent, `null` or `undefined`, or a required numeric
 * parameter is not a finite number — the input is invalid, so the sentinel is due.
 */
export type GarbageCall = {
  label: string;
  args: unknown[];
  missingRequired: boolean;
};

export type NoThrowCase = {
  name: string;
  fn: (...args: unknown[]) => unknown;
  declared: DeclaredReturn;
  /** Current-moment accessors: their result depends on the clock, so only "no throw" is checked. */
  readsClock: boolean;
  calls: GarbageCall[];
};

/** The garbage values each argument position is replaced with, in turn. */
const GARBAGE: [string, unknown][] = [
  ["null", null],
  ["undefined", undefined],
  ["0", 0],
  ['""', ""],
  ['"x"', "x"],
  ["[]", []],
  ["{}", {}],
  ["NaN", Number.NaN],
];

const SOURCE_ROOT = path.resolve(import.meta.dirname, "..");

/** Right-hand sides of every named type in the source tree (`interface` maps to an object literal). */
function namedTypes(): Map<string, string> {
  const types = new Map<string, string>();
  const files = readdirSync(SOURCE_ROOT, {
    recursive: true,
    encoding: "utf8",
  }).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
  for (const file of files) {
    const source = readFileSync(path.join(SOURCE_ROOT, file), "utf8");
    for (const match of source.matchAll(/^(?:export )?interface (\w+)/gm)) {
      types.set(match[1], "{}");
    }
    for (const match of source.matchAll(
      /^(?:export )?type (\w+)(?:<[^=]*>)? =/gm,
    )) {
      const start = match.index + match[0].length;
      const rhs = splitTopLevel(source.slice(start), ";")[0] ?? "";
      types.set(match[1], rhs);
    }
  }
  return types;
}

let namedTypeCache: Map<string, string> | null = null;

/**
 * Index just past the bracket that closes the one opened at `open`. Parameter lists hold no
 * bracket characters inside string literals, so quotes need no handling.
 */
function closeBracket(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if ("([{".includes(text[i])) depth++;
    else if (")]}".includes(text[i])) depth--;
    if (depth === 0) return i + 1;
  }
  return -1;
}

/** Split `text` on `separator` at bracket depth zero (never on the `=` of `=>`). */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ("([{<".includes(ch)) depth++;
    else if (")]}>".includes(ch) && text[i - 1] !== "=") depth--;
    else if (
      depth === 0 &&
      text.startsWith(separator, i) &&
      !text.startsWith("=>", i)
    ) {
      parts.push(text.slice(start, i));
      start = i + separator.length;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

const PRIMITIVE_KINDS: ReadonlySet<string> = new Set([
  "string",
  "number",
  "boolean",
  "bigint",
]);

/** The kinds of one member of a return-type union, resolving named types from the source. */
function classifyMember(member: string): ReturnKind[] {
  const bare = member.replace(/^readonly /, "");
  if (bare.endsWith("[]") || /^(Readonly)?Array</.test(bare)) return ["array"];
  if (bare.startsWith("{") || bare.startsWith("Record<")) return ["object"];
  if (PRIMITIVE_KINDS.has(bare)) return [bare as ReturnKind];
  // String literals, `keyof T` and `(typeof CONST)[number]` unit lists are all strings.
  if (/^("|keyof |\(typeof \w+\)\[number\]$)/.test(bare)) return ["string"];
  namedTypeCache ??= namedTypes();
  const resolved = namedTypeCache.get(bare);
  if (resolved === undefined) {
    throw new Error(`noThrow: unclassified return type member "${bare}"`);
  }
  return classify(resolved).kinds;
}

function classify(returnType: string): DeclaredReturn {
  const type = returnType.replace(/\s+/g, " ").trim();
  if (/^\w+ is /.test(type)) return { kinds: ["boolean"], nullable: false };
  const members = splitTopLevel(type, "|");
  const kinds = members
    .filter((member) => member !== "null")
    .flatMap(classifyMember);
  return { kinds: [...new Set(kinds)], nullable: members.includes("null") };
}

type Signature = {
  declared: DeclaredReturn;
  arity: number;
  required: boolean[];
};

/** Whether the function body starts at `rest[end]`: a `{` after a complete type, or `=>`. */
function startsBody(rest: string, end: number): boolean {
  if (rest.startsWith("=>", end)) return true;
  const previous = rest.slice(0, end).trimEnd().at(-1);
  return (
    rest[end] === "{" && previous !== undefined && !"|:(<,&".includes(previous)
  );
}

/** Length of the return-type annotation at the start of `rest` (the text after `: `). */
function returnTypeLength(rest: string): number {
  let depth = 0;
  for (let end = 0; end < rest.length; end++) {
    const ch = rest[end];
    if (depth === 0 && startsBody(rest, end)) return end;
    if ("([{<".includes(ch)) depth++;
    else if (")]}>".includes(ch) && rest[end - 1] !== "=") depth--;
  }
  return rest.length;
}

function readSignature(entry: CorpusEntry): Signature {
  const source = readFileSync(path.join(REPO_ROOT, entry.sourcePath), "utf8");
  const header = new RegExp(
    `export (?:function ${entry.name}\\s*|const ${entry.name}\\s*=\\s*)(<[^(]*>)?\\(`,
  ).exec(source);
  if (!header) throw new Error(`noThrow: no signature for ${entry.name}`);
  const open = header.index + header[0].length - 1;
  const close = closeBracket(source, open);
  const params = splitTopLevel(source.slice(open + 1, close - 1), ",");
  const colon = /^\s*:\s*/.exec(source.slice(close));
  if (!colon) throw new Error(`noThrow: no return type for ${entry.name}`);
  const rest = source.slice(close + colon[0].length);
  return {
    declared: classify(rest.slice(0, returnTypeLength(rest))),
    arity: params.length,
    required: params.map(
      (param) =>
        !/^\w+\?/.test(param) && splitTopLevel(param, "=").length === 1,
    ),
  };
}

/**
 * The argument list of the corpus example for `entry` that passes the most arguments (so option
 * objects are exercised) and evaluates cleanly. Evaluated with `Function` in this realm, so
 * object and array literals share this realm's prototypes.
 */
function baselineArgs(entry: CorpusEntry): unknown[] | null {
  const scope = { ...(gmt as unknown as Record<string, unknown>) };
  const names = Object.keys(scope).filter((name) =>
    /^[A-Za-z_$][\w$]*$/.test(name),
  );
  const candidates: unknown[][] = [];
  for (const example of entry.examples ?? []) {
    let captured: unknown[] | null = null;
    const capture = (...args: unknown[]) => {
      captured ??= args;
    };
    try {
      // Evaluates the function's own JSDoc example, with every GMT export in scope.
      const run = new Function(...names, example.call);
      run(
        ...names.map((name) => (name === entry.name ? capture : scope[name])),
      );
    } catch {
      continue;
    }
    if (captured) candidates.push(captured);
  }
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ?? null;
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function garbageCalls(
  baseline: unknown[],
  arity: number,
  required: boolean[],
): GarbageCall[] {
  const calls: GarbageCall[] = [];
  const positions = Math.max(arity, baseline.length);
  for (let position = 0; position < positions; position++) {
    for (const [label, value] of GARBAGE) {
      const args = baseline.slice();
      args[position] = value;
      const missingRequired =
        Boolean(required[position]) &&
        (value == null ||
          (typeof baseline[position] === "number" && !isFiniteNumber(value)));
      calls.push({ label: `arg${position}=${label}`, args, missingRequired });
    }
  }
  calls.push({
    label: "no arguments",
    args: [],
    missingRequired: required.some(Boolean),
  });
  return calls;
}

function loadCorpus(): CorpusEntry[] {
  return (
    JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as CorpusEntry[]
  ).filter((entry) => entry.kind === "function");
}

/** Every public function of `namespace`, with its garbage calls. */
export function noThrowCases(namespace: string): NoThrowCase[] {
  const exports = gmt as unknown as Record<string, unknown>;
  return loadCorpus()
    .filter((entry) => entry.namespace === namespace)
    .map((entry) => {
      const fn = exports[entry.name];
      if (typeof fn !== "function") {
        throw new Error(
          `noThrow: ${entry.name} is in the corpus but not exported`,
        );
      }
      const { declared, arity, required } = readSignature(entry);
      const baseline = baselineArgs(entry);
      if (!baseline)
        throw new Error(`noThrow: no evaluable @example for ${entry.name}`);
      return {
        name: entry.name,
        fn: fn as (...args: unknown[]) => unknown,
        declared,
        readsClock: entry.module === "get",
        calls: garbageCalls(baseline, arity, required),
      };
    });
}

/** Names of every exported function, so a function missing from the corpus is caught. */
export function exportedFunctionNames(): string[] {
  const polyfill = new Set(["toTemporalInstant"]);
  return Object.entries(gmt)
    .filter(
      ([name, value]) => typeof value === "function" && !polyfill.has(name),
    )
    .map(([name]) => name)
    .filter((name) => /^[a-z]/.test(name));
}

export function corpusFunctionNames(): string[] {
  return loadCorpus().map((entry) => entry.name);
}

function matchesKind(result: unknown, kind: ReturnKind): boolean {
  switch (kind) {
    case "array":
      return Array.isArray(result);
    case "object":
      return (
        typeof result === "object" && result !== null && !Array.isArray(result)
      );
    case "number":
      return typeof result === "number" && Number.isFinite(result);
    default:
      return typeof result === kind;
  }
}

function describeDeclared(declared: DeclaredReturn): string {
  return [...declared.kinds, ...(declared.nullable ? ["null"] : [])].join(
    " | ",
  );
}

function show(value: unknown): string {
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || value === undefined) return String(value);
  return JSON.stringify(value) ?? String(value);
}

/**
 * The sentinel for a declared return type (context/coding-standards.md sentinel table): `null` for
 * any nullable type, otherwise `""`, `false`, `[]` or `0n`. A non-nullable `number` has none.
 */
function sentinelOf(declared: DeclaredReturn): {
  known: boolean;
  value?: unknown;
} {
  if (declared.nullable) return { known: true, value: null };
  if (declared.kinds.length !== 1) return { known: false };
  const [kind] = declared.kinds;
  const sentinels: Partial<Record<ReturnKind, unknown>> = {
    string: "",
    boolean: false,
    array: [],
    bigint: 0n,
  };
  return kind in sentinels
    ? { known: true, value: sentinels[kind] }
    : { known: false };
}

/**
 * Functions whose documented result for "no valid input" is a default value rather than the
 * sentinel (their JSDoc: "Defaults to … if no valid unit is found"). The owner kept that behaviour
 * (CORE-8 row A1); the harness still checks they never throw and return their declared type.
 */
const DOCUMENTED_DEFAULT_RESULT = new Set([
  "getLargestDateDurationUnit",
  "getLargestDateTimeDurationUnit",
  "getLargestTimeDurationUnit",
]);

/** A description of every garbage call that threw or returned something outside its declared type. */
export function noThrowFailures(testCase: NoThrowCase): string[] {
  const failures: string[] = [];
  for (const { label, args, missingRequired } of testCase.calls) {
    let result: unknown;
    try {
      result = testCase.fn(...args);
    } catch (error) {
      failures.push(`${label}: threw ${String(error)}`);
      continue;
    }
    if (testCase.readsClock) continue;
    const { kinds, nullable } = testCase.declared;
    const typed =
      (nullable && result === null) ||
      kinds.some((kind) => matchesKind(result, kind));
    if (!typed) {
      failures.push(
        `${label}: returned ${show(result)}, declared ${describeDeclared(testCase.declared)}`,
      );
      continue;
    }
    const sentinel = sentinelOf(testCase.declared);
    if (
      missingRequired &&
      sentinel.known &&
      !DOCUMENTED_DEFAULT_RESULT.has(testCase.name) &&
      !isDeepStrictEqual(result, sentinel.value)
    ) {
      failures.push(
        `${label}: returned ${show(result)}, expected the sentinel ${show(sentinel.value)}`,
      );
    }
  }
  return failures;
}
