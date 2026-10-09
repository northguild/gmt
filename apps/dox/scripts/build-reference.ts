#!/usr/bin/env node
/**
 * Build the docs-site reference corpus and MDX pages from `gmt` source JSDoc.
 *
 * Walks the gmt src tree with the TypeScript compiler API, extracts every
 * exported function/const/type, and emits — from a single extraction pass so
 * the four artifacts cannot drift:
 *   1. src/generated/reference/gmt-corpus.json  — CorpusEntry[]
 *   2. src/generated/reference/route-manifest.ts — ReadonlySet<string>
 *   3. content/docs/reference MDX            - one page per function, regex and shared
 *                                              type, plus the index pages
 *   4. public/_redirects                     - the old URL of every type that moved and of
 *                                              every renamed function
 *
 * Which public function uses which public type comes from `build-utils/type-usage.ts`. A
 * type two or more functions reach gets a page at `/reference/types/<Name>`; a type one
 * function reaches is documented on that function's page; a type none reaches is refused.
 * The URLs are in `build-utils/reference-urls.ts`, the Options and Members tables in
 * `build-utils/render-table.ts`, the index pages in `build-utils/index-pages.ts`, the
 * redirects in `build-utils/redirects.ts`, and the report of missing documentation in
 * `build-utils/doc-gate.ts`.
 *
 * Run as: node apps/dox/scripts/build-reference.ts
 * Generated MDX + src/generated/* are gitignored and produced by a prebuild step.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type {
  ChoiceSeed,
  ChoiceSeeds,
  LivePlaygroundTemplate,
  PlaygroundField,
} from "../src/lib/playground-spec";
import { argToValue, parseCallArgs } from "../src/lib/playground-parsers";
import { INDUSTRY_LAYER_IDS, industryTag } from "../src/lib/industry-tags";
import { INDUSTRY_OVERVIEWS } from "../src/lib/industry-overview";
import type { PlaygroundSpec } from "./build-utils/build-utils";
import * as BU from "./build-utils/build-utils";
import { NULL_IS_EMPTY } from "./build-utils/null-is-empty";
import {
  UNRELEASED_BADGE,
  baselineKey,
  insertAfterFrontmatter,
  isUnreleased,
  releasedBaseline,
  unreleasedNote,
  type ReleasedBaseline,
} from "./build-utils/released-exports";
import {
  hashFiles,
  syncTree,
  writeIfChanged,
} from "./build-utils/generated-files.mjs";
import {
  findGaps,
  formatGapReport,
  type GateInput,
} from "./build-utils/doc-gate";
import {
  renderIndexPages,
  type IndexedIndustry,
  type IndexedInlineType,
  type IndexedPage,
  type IndexedType,
  type IndexInput,
} from "./build-utils/index-pages";
import {
  mdCodeSpan,
  flattenRows,
  mdListItem,
  mdText,
  refTable,
  renderMembersTable,
  renderOptionsTable,
  renderParametersTable,
  type PropertyDoc,
  type TableContext,
} from "./build-utils/render-table";
import { buildRedirects } from "./build-utils/redirects";
import { RENAMED_FUNCTIONS } from "./build-utils/renamed-functions";
import {
  functionUrl,
  indexRoutes,
  typePageSlug,
  typePageUrl,
  typeRoute,
  typeUrl,
  TYPES_SECTION,
} from "./build-utils/reference-urls";
import {
  assignInlineAnchors,
  buildTypeUsage,
  inlineTypesOf,
  pageAnchors,
  publicTypeIndex,
  resolvePublicType,
  typeReferences,
  type PageHeadings,
  type PublicFunctionDecl,
  type PublicTypeDecl,
  type PublicTypeIndex,
  type TypeUsage,
} from "./build-utils/type-usage";

export type { PropertyDoc } from "./build-utils/render-table";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const repoRoot = resolve(appRoot, "..", "..");
const gmtSrc = resolve(repoRoot, "packages", "gmt", "src");
const outMdx = resolve(appRoot, "src", "content", "docs", "reference");
const outGen = resolve(appRoot, "src", "generated", "reference");
/** Cloudflare's redirect rules. Astro copies `public/` into `dist/`, where the Worker's
 * static assets read it. Gitignored, like the other generated files under `public/`. */
const outRedirects = resolve(appRoot, "public", "_redirects");

const SKIP_DIRS = ["test", "internal"];
const SKIP_EXTS = [".test.ts", ".spec.ts"];
const GH_BASE = "https://github.com/northguild/gmt/blob/main/packages/gmt/src";

// ---------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------

/**
 * Every file under `dir`, recursively, that `keepFile` accepts, skipping any directory
 * `skipDir` names. The one directory walker the generator's three file lists share.
 */
function listFiles(
  dir: string,
  keepFile: (name: string) => boolean,
  skipDir: (name: string) => boolean = () => false,
): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDir(entry.name)) out.push(...listFiles(full, keepFile, skipDir));
    } else if (entry.isFile() && keepFile(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** A gmt source file: `.ts`, and not a test or spec file. */
const isSourceFile = (name: string) =>
  name.endsWith(".ts") && !SKIP_EXTS.some((s) => name.endsWith(s));

function walk(dir: string): string[] {
  return listFiles(dir, isSourceFile, (name) => SKIP_DIRS.includes(name));
}

/**
 * Every declaration a user can import from `@northguild/gmt`.
 *
 * A top-level function without `export`, or an export no entry point re-exports, is an
 * implementation detail: `package.json` `exports` publishes only the root, namespace and
 * category barrels (deep file paths map to `null`), so nobody can import it. Walking source
 * files alone published 20 such helpers as reference pages and counted them as public
 * functions. The entry points come from the `exports` map itself, not a hand-kept list, and
 * the checker resolves each barrel's re-exports to the declarations they name.
 */
export function publicDeclarations(
  program: ts.Program,
  checker: ts.TypeChecker,
): ReadonlySet<ts.Node> {
  return new Set(publicExports(program, checker).keys());
}

/**
 * The specifier to import each public declaration from: the package root when the root
 * barrel exports it, which it does for every type today, and otherwise the shortest entry
 * point that does. Read from the barrels, so an import line on a page is never one that
 * fails to resolve.
 */
export function publicImportPaths(
  program: ts.Program,
  checker: ts.TypeChecker,
): ReadonlyMap<ts.Node, string> {
  const paths = new Map<ts.Node, string>();
  for (const [declaration, specifiers] of publicExports(program, checker)) {
    const best = specifiers.includes(ROOT)
      ? ROOT
      : [...specifiers].sort(
          (a, b) => a.length - b.length || a.localeCompare(b),
        )[0];
    paths.set(declaration, best);
  }
  return paths;
}

/** Each published entry point: the specifier a user imports, and its source file. */
function entryPoints(): Array<{ specifier: string; file: string }> {
  const pkg = JSON.parse(
    readFileSync(resolve(gmtSrc, "..", "package.json"), "utf8"),
  ) as { exports: Record<string, { default?: string } | null> };

  const entries: Array<{ specifier: string; file: string }> = [];
  for (const [key, target] of Object.entries(pkg.exports)) {
    const dist = target?.default;
    if (!dist) continue;
    const src = resolve(
      gmtSrc,
      dist.replace(/^\.\/dist\//, "").replace(/\.js$/, ".ts"),
    );
    // "." is the root; "./plain/calculate" is `@northguild/gmt/plain/calculate`.
    const specifier = `${ROOT}${key.slice(1)}`;
    if (!src.includes("*")) {
      entries.push({ specifier, file: src });
      continue;
    }
    const [before, after] = src.split("*");
    for (const dir of readdirSync(before, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      entries.push({
        specifier: specifier.replace("*", dir.name),
        file: `${before}${dir.name}${after}`,
      });
    }
  }
  return entries;
}

/** Every public declaration, with the entry points that export it. */
function publicExports(
  program: ts.Program,
  checker: ts.TypeChecker,
): Map<ts.Node, string[]> {
  const exportedFrom = new Map<ts.Node, string[]>();
  for (const { specifier, file } of entryPoints()) {
    const sourceFile = program.getSourceFile(file);
    const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) continue;
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const symbol =
        exported.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exported)
          : exported;
      for (const declaration of symbol.declarations ?? []) {
        const known = exportedFrom.get(declaration);
        if (!known) exportedFrom.set(declaration, [specifier]);
        else if (!known.includes(specifier)) known.push(specifier);
      }
    }
  }
  return exportedFrom;
}

function namespaceModule(file: string): { namespace: string; module: string } {
  const rel = relative(gmtSrc, file).split("/");
  const ns = rel[0].replace(/\.ts$/, "");
  const mod = rel.length > 1 ? rel[1].replace(/\.ts$/, "") : ns;
  return { namespace: ns, module: mod };
}

/**
 * Root-absolute page path of a function or regex, beside its source file. Used for every
 * in-page link and for the URL field in the corpus, route manifest, and widget seeds. Must
 * start with `/` — a bare-relative `reference/...` link resolves against the current page's
 * directory and doubles the path (e.g. from `/reference/utc/calculate/` you land on
 * `/reference/utc/calculate/reference/utc/calculate/addUtc`).
 *
 * A type is not placed by its source path: see `build-utils/reference-urls.ts`.
 */
function pageUrl(ns: string, mod: string, name: string): string {
  return `/reference/${ns}/${mod}/${name}`;
}

/** The usage-graph key of a function: `${ns}/${mod}/${name}`. */
function fnKey(doc: { namespace: string; module: string; name: string }) {
  return `${doc.namespace}/${doc.module}/${doc.name}`;
}

/** Starlight `slug:` frontmatter — relative, no leading slash. */
function pageSlug(ns: string, mod: string, name: string): string {
  return `reference/${ns}/${mod}/${name}`;
}

const ROOT = "@northguild/gmt";

// ---------------------------------------------------------------------------
// Docs
// ---------------------------------------------------------------------------

interface Example {
  call: string;
  result: string;
  note?: string;
}

interface ParamDoc {
  name: string;
  type: string;
  description: string;
}

/** One parameter expanded under `## Options`: its name, its `@param` text and its rows. */
export interface OptionsBlock {
  /** The real parameter name, which labels the block. */
  param: string;
  /** The parameter's `@param` text, shown above the table. Empty when undocumented. */
  lead: string;
  rows: PropertyDoc[];
  /** The public type the parameter is declared as, when it is a named reference. */
  typeName?: string;
  /**
   * Why it expands: 1, the declared type is an inline literal or an intersection; 2, it is
   * declared as a public object type and named as an options bag (`…options…`, or `props`).
   */
  rule: 1 | 2;
}

export interface FnDoc {
  name: string;
  namespace: string;
  module: string;
  kind: "function";
  signature: string;
  description: string;
  behavior: string[];
  /** The documented parameters that stay in the Parameters table. */
  params: ParamDoc[];
  /** One block per parameter expanded under `## Options`, in signature order. */
  options: OptionsBlock[];
  returns: string;
  /**
   * The members of an inline object literal in the return type (`{ year: number; quarter:
   * number } | null`), one row each. Empty when the function returns no literal. A named return
   * type documents its members on its own type entry instead.
   */
  returnMembers: PropertyDoc[];
  /** True when `returnMembers` are the members of each element of a returned array. */
  returnsItems: boolean;
  examples: Example[];
  /** Every public type the function reaches, from the usage graph. */
  relatedTypes: string[];
  sourcePath: string;
  /** 1-based line of the declaration, for the gate. */
  line: number;
  /** The real parameter names, named members of a rest tuple included. */
  declaredParams: string[];
  /** Each `@param` tag: the name it documents and its 1-based line. */
  documentedParams: Array<{ name: string; line: number }>;
  playgroundSpec?: PlaygroundSpec;
  livePlaygroundTemplate?: LivePlaygroundTemplate;
}

export interface TypeDoc {
  name: string;
  namespace: string;
  module: string;
  kind: "type";
  definition: string;
  description: string;
  /** The properties of an interface, an object-literal alias or an intersection alias. */
  members: PropertyDoc[];
  /** The values of an alias of a literal union, printed: `"constrain" | "reject"`. */
  literals?: string;
  /** The specifier the type is imported from: the package root, for every type today. */
  importFrom: string;
  sourcePath: string;
  /** 1-based line of the declaration, for the gate. */
  line: number;
}

export interface RegexDoc {
  name: string;
  namespace: string;
  module: string;
  kind: "regex";
  pattern: string;
  description: string;
  examples: Example[];
  sourcePath: string;
}

export type Doc = FnDoc | TypeDoc | RegexDoc;

// ---------------------------------------------------------------------------
// JSDoc parsing
// ---------------------------------------------------------------------------

interface ParsedJsDoc {
  description: string;
  behavior: string[];
  params: ParamDoc[];
  returns: string;
  examples: Example[];
}

/**
 * The symbol that carries a declaration's JSDoc. A function or variable
 * declaration carries its symbol on the name node, not on the declaration.
 * Missing the variable case cost every arrow-function export
 * (`export const f = (…) => …`) its whole JSDoc — description, params and
 * `@example`s alike.
 */
function jsDocSymbol(
  checker: ts.TypeChecker,
  node: ts.Node,
): ts.Symbol | undefined {
  const named =
    (ts.isFunctionDeclaration(node) ||
      ts.isVariableDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node)) &&
    node.name;
  return checker.getSymbolAtLocation(named || node);
}

/** A row of a Markdown table written in a doc comment. */
const isTableLine = (line: string) => line.startsWith("|");

/** True for a line that cannot be part of the summary paragraph. */
const endsSummary = (line: string) =>
  !line || line.startsWith("- ") || isTableLine(line);

/**
 * The opening paragraph of a doc comment, joined onto one line: every line up to the first
 * blank line, `- ` bullet or table row. JSDoc wraps a summary over several source lines, so
 * the first line alone would cut the sentence short.
 */
export function summaryParagraph(raw: string): string {
  const paragraph: string[] = [];
  for (const line of raw.split("\n")) {
    const l = line.trim();
    if (endsSummary(l)) break;
    paragraph.push(l);
  }
  return paragraph.join(" ");
}

/** The summary paragraph of a declaration's JSDoc, or "" when it has none. */
function jsDocSummary(checker: ts.TypeChecker, node: ts.Node): string {
  const symbol = jsDocSymbol(checker, node);
  if (!symbol) return "";
  return summaryParagraph(
    ts.displayPartsToString(symbol.getDocumentationComment(checker)),
  );
}

/**
 * What follows the summary paragraph of a doc comment, one item per `- ` bullet. The wrapped
 * lines of a bullet are joined onto one line.
 *
 * A Markdown table is kept as a table: each of its rows stays on a line of its own inside the
 * item it belongs to (`mdListItem` renders it), so an item is one line of prose, or prose and
 * table rows separated by newlines. Text before the first bullet (a second paragraph, or a
 * table directly under the summary) is an item too.
 */
export function behaviorItems(raw: string): string[] {
  const lines = raw.split("\n").map((l) => l.trim());
  let i = 0;
  while (i < lines.length && !endsSummary(lines[i])) i++;

  const items: string[][] = [];
  let cur: string[] | undefined;
  // Whether the last line of `cur` is prose a wrapped line continues.
  let inProse = false;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (l.startsWith("- ")) {
      cur = [l.slice(2)];
      items.push(cur);
      inProse = true;
      continue;
    }
    if (!cur) {
      cur = [];
      items.push(cur);
      inProse = false;
    }
    if (isTableLine(l)) {
      cur.push(l);
      inProse = false;
    } else if (inProse) {
      cur[cur.length - 1] += ` ${l}`;
    } else {
      cur.push(l);
      inProse = true;
    }
  }
  return items.map((item) => item.join("\n"));
}

/**
 * The text TypeScript reads as a JSDoc type rather than as prose, for the `@param` tags (in
 * order) and the `@returns` tag of a declaration.
 *
 * `@returns { year, quarter }, or null` and `@param options { inclusive?: boolean }` open
 * with a brace, which the parser takes for a type expression and drops from the tag's
 * comment, leaving ", or null". Each entry is that expression's source text, with a trailing
 * space when the source had one, ready to go back in front of the comment.
 */
function leadingTypeExpressions(node: ts.Node): {
  params: string[];
  returns: string;
} {
  const sf = node.getSourceFile();
  const source = sf.getFullText();
  const lead = (expression: ts.JSDocTypeExpression | undefined): string => {
    if (!expression) return "";
    const text = expression.getText(sf);
    return /\s/.test(source[expression.end] ?? "") ? `${text} ` : text;
  };
  const params: string[] = [];
  let returns = "";
  for (const tag of ts.getJSDocTags(node)) {
    if (ts.isJSDocParameterTag(tag)) {
      // `@param {string} name` is a real JSDoc type; only a brace after the name is prose.
      params.push(tag.isNameFirst ? lead(tag.typeExpression) : "");
    } else if (ts.isJSDocReturnTag(tag)) {
      returns = lead(tag.typeExpression);
    }
  }
  return { params, returns };
}

/** The `@param`, `@returns` and `@example` tags of a JSDoc block. */
function parseJsDocTags(
  tags: ts.JSDocTagInfo[],
  node: ts.Node,
): Pick<ParsedJsDoc, "params" | "returns" | "examples"> {
  const params: ParamDoc[] = [];
  let returns = "";
  const examples: Example[] = [];

  // The symbol's tags and the declaration's tag nodes list the same `@param` tags in the
  // same order. When they do not line up, nothing is put back.
  const braces = leadingTypeExpressions(node);
  const paramTags = tags.filter((t) => t.name === "param").length;
  const paramBrace = (i: number) =>
    braces.params.length === paramTags ? braces.params[i] : "";
  let paramIndex = 0;

  for (const tag of tags) {
    const text = tag.text ? ts.displayPartsToString(tag.text) : "";
    if (tag.name === "param") {
      const brace = paramBrace(paramIndex++);
      const m = text.match(/^(\w+)(?:\s+([\s\S]*))?$/);
      const description = `${brace}${m?.[2] ?? ""}`.trim();
      if (m && description) {
        params.push({ name: m[1], type: "", description });
      }
    } else if (tag.name === "returns") {
      returns = `${braces.returns}${text}`.trim();
    } else if (tag.name === "example") {
      const ex = parseExample(text);
      if (ex) examples.push(ex);
    }
  }

  return { params, returns, examples };
}

function parseJsDoc(
  checker: ts.TypeChecker,
  node: ts.Node,
): ParsedJsDoc | undefined {
  const symbol = jsDocSymbol(checker, node);
  if (!symbol) return undefined;

  const parts = symbol.getDocumentationComment(checker);
  const raw = ts.displayPartsToString(parts);
  if (!raw.trim() && symbol.getJsDocTags().length === 0) return undefined;

  const description = summaryParagraph(raw);
  const behavior = behaviorItems(raw);
  const { params, returns, examples } = parseJsDocTags(
    symbol.getJsDocTags(),
    node,
  );

  return { description, behavior, params, returns, examples };
}

function parseExample(text: string): Example | undefined {
  const lines = text.split("\n").map((l) => l.trim());
  if (lines.length === 0) return undefined;

  if (lines.length === 1) {
    const parts = text.split(/\s+\/\/\s+/);
    if (parts.length >= 2) {
      return { call: parts[0], result: parts[1], note: parts[2] };
    }
    return { call: text, result: "" };
  }

  // multi-line: first line is call, rest are //-prefixed result lines
  const call = lines[0];
  const result = lines.slice(1).join("\n");
  return { call, result };
}

/**
 * True if a variable initializer is a regex literal, `new RegExp(...)`, or an
 * identifier alias that resolves to one (e.g. `const millisecond = fractionalSecond`).
 */
function isRegexInit(expr: ts.Expression, depth = 0): boolean {
  if (depth > 3) return false;
  if (ts.isRegularExpressionLiteral(expr)) return true;
  if (ts.isNewExpression(expr) && expr.expression.getText() === "RegExp")
    return true;
  if (ts.isIdentifier(expr)) {
    const sf = expr.getSourceFile();
    let resolved: ts.Declaration | undefined;
    sf.forEachChild((node) => {
      if (!resolved && ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (
            ts.isIdentifier(d.name) &&
            d.name.text === expr.getText() &&
            d.parent.parent === node
          ) {
            resolved = d;
          }
        }
      }
    });
    if (resolved && (resolved as ts.VariableDeclaration).initializer) {
      return isRegexInit(
        (resolved as ts.VariableDeclaration).initializer!,
        depth + 1,
      );
    }
  }
  return false;
}

/** Follow identifier aliases to the underlying regex/new RegExp initializer. */
function resolveRegexInit(expr: ts.Expression, depth = 0): ts.Expression {
  if (depth > 3 || !ts.isIdentifier(expr)) return expr;
  const sf = expr.getSourceFile();
  let resolved: ts.VariableDeclaration | undefined;
  sf.forEachChild((node) => {
    if (!resolved && ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === expr.getText()) {
          resolved = d;
        }
      }
    }
  });
  if (resolved?.initializer)
    return resolveRegexInit(resolved.initializer, depth + 1);
  return expr;
}

/** Capture leading // line comment(s) immediately above a node. */
function leadingLineComment(node: ts.Node): string | undefined {
  const sf = node.getSourceFile();
  const lineStart = sf.getLineAndCharacterOfPosition(node.getStart()).line;
  // scan upward from the line above the node
  const lines: string[] = [];
  for (let l = lineStart - 1; l >= 0; l--) {
    const lineText = sf
      .getFullText()
      .slice(
        sf.getPositionOfLineAndCharacter(l, 0),
        sf.getPositionOfLineAndCharacter(l + 1, 0),
      );
    const trimmed = lineText.trim();
    if (trimmed.startsWith("//")) {
      lines.unshift(trimmed.replace(/^\/\/\s*/, ""));
    } else if (trimmed === "") {
      continue; // skip blank lines between comment and node
    } else {
      break;
    }
  }
  return lines.length > 0 ? lines.join(" ") : undefined;
}

// ---------------------------------------------------------------------------
// Properties: option rows and type members
// ---------------------------------------------------------------------------

/**
 * What extraction needs beyond the checker. Both fields are optional so a unit test can
 * extract one function from an in-memory source without building the whole context.
 */
export interface ExtractContext {
  /** For `isSourceFileDefaultLibrary`. Without it no property reads as lib-declared. */
  program?: ts.Program;
  /** Public type declarations by node. Without it no type is linked and rule 2 never fires. */
  publicTypes?: PublicTypeIndex;
  /** Where each public declaration is imported from. Without it, the package root. */
  importPaths?: ReadonlyMap<ts.Node, string>;
}

const NO_PUBLIC_TYPES: PublicTypeIndex = new Map();

function unparenthesized(
  node: ts.TypeNode | undefined,
): ts.TypeNode | undefined {
  let n = node;
  while (n && ts.isParenthesizedTypeNode(n)) n = n.type;
  return n;
}

/** Repo-relative path and 1-based line of a declaration. */
function sourcePosition(node: ts.Node): { file: string; line: number } {
  const sf = node.getSourceFile();
  return {
    file: relative(repoRoot, resolve(sf.fileName)).split("\\").join("/"),
    line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
  };
}

/** A doc comment's lines joined onto one, for a table cell. */
function joinedLines(raw: string): string {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
}

const LIST_LINE = /^(?:[-*+]|\d+[.)])\s/;

const LITERAL_FLAGS =
  ts.TypeFlags.StringLiteral |
  ts.TypeFlags.NumberLiteral |
  ts.TypeFlags.BigIntLiteral |
  ts.TypeFlags.BooleanLiteral;

/** True for a literal or a union of literals, `undefined` aside: `"constrain" | "reject"`. */
function isLiteralUnion(type: ts.Type): boolean {
  const members = (type.isUnion() ? type.types : [type]).filter(
    (t) => !(t.flags & ts.TypeFlags.Undefined),
  );
  return members.length > 0 && members.every((t) => t.flags & LITERAL_FLAGS);
}

/** The fully qualified name of the interface or alias that declares a property. */
function declaringTypeName(
  checker: ts.TypeChecker,
  decl: ts.Declaration,
): string | undefined {
  for (let n: ts.Node | undefined = decl.parent; n; n = n.parent) {
    if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) {
      const symbol = checker.getSymbolAtLocation(n.name);
      return symbol ? checker.getFullyQualifiedName(symbol) : n.name.text;
    }
  }
  return undefined;
}

/**
 * An inline object literal in a declared type, found through parentheses, unions and arrays.
 * `short` is the type as a Type cell prints it when the literal's members get rows of their
 * own: each literal reads `object`, the rest of the type stays as written.
 */
interface LiteralShape {
  literals: ts.TypeLiteralNode[];
  /** True when the literals are the elements of an array (`{ type: string }[]`). */
  items: boolean;
  short: string;
}

function literalShape(node: ts.TypeNode | undefined): LiteralShape | undefined {
  const n = unparenthesized(node);
  if (!n) return undefined;
  if (ts.isTypeLiteralNode(n)) {
    return { literals: [n], items: false, short: "object" };
  }
  const element = ts.isArrayTypeNode(n)
    ? n.elementType
    : ts.isTypeOperatorNode(n) && n.operator === ts.SyntaxKind.ReadonlyKeyword
      ? n.type
      : ts.isTypeReferenceNode(n) &&
          ts.isIdentifier(n.typeName) &&
          /^(?:Readonly)?Array$/.test(n.typeName.text) &&
          n.typeArguments?.length === 1
        ? n.typeArguments[0]
        : undefined;
  if (element) {
    const inner = literalShape(element);
    if (!inner || inner.items) return undefined;
    const wrapped = inner.short.includes(" | ")
      ? `(${inner.short})`
      : inner.short;
    return {
      literals: inner.literals,
      items: true,
      short: ts.isArrayTypeNode(n) ? `${wrapped}[]` : `Array<${inner.short}>`,
    };
  }
  if (ts.isUnionTypeNode(n)) {
    const shapes = n.types.map((t) => literalShape(t));
    if (shapes.every((x) => !x)) return undefined;
    return {
      literals: shapes.flatMap((x) => x?.literals ?? []),
      items: shapes.some((x) => x?.items),
      short: n.types.map((t, i) => shapes[i]?.short ?? t.getText()).join(" | "),
    };
  }
  return undefined;
}

/** The rows of the members of a literal shape's literals, once each by name. */
function literalMembers(
  checker: ts.TypeChecker,
  shape: LiteralShape,
  ctx: ExtractContext,
): PropertyDoc[] {
  const rows: PropertyDoc[] = [];
  for (const literal of shape.literals) {
    for (const row of extractProperties(
      checker,
      checker.getTypeFromTypeNode(literal),
      literal,
      ctx,
    )) {
      if (!rows.some((r) => r.name === row.name)) rows.push(row);
    }
  }
  return rows;
}

/**
 * The properties of an object type, one row each. Reading them from the checker rather than
 * from syntax is what makes an interface, an object-literal alias, an intersection and an
 * inline literal produce the same rows, inherited properties included.
 *
 * Descriptions and defaults come from each property's own JSDoc: its comment and its
 * `@defaultValue` tag. Nothing is read from the function's prose.
 */
export function extractProperties(
  checker: ts.TypeChecker,
  type: ts.Type,
  at: ts.Node,
  ctx: ExtractContext = {},
): PropertyDoc[] {
  const rows: PropertyDoc[] = [];
  for (const prop of checker.getPropertiesOfType(
    checker.getNonNullableType(type),
  )) {
    const decl = prop.valueDeclaration ?? prop.declarations?.[0];
    const typeNode =
      decl && (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl))
        ? decl.type
        : undefined;
    const optional = !!(prop.flags & ts.SymbolFlags.Optional);
    const propType = checker.getTypeOfSymbolAtLocation(prop, at);

    // A literal union prints its literals, not the alias that names them: the reader needs
    // the values, and the alias is linked beside them.
    let printed = checker.typeToString(
      propType,
      undefined,
      ts.TypeFormatFlags.NoTruncation |
        (isLiteralUnion(propType) ? ts.TypeFormatFlags.InTypeAlias : 0),
    );
    // The `?` already says it. An `undefined` written in the declared type is kept.
    if (optional && !(typeNode && writesUndefined(typeNode))) {
      printed = printed.replace(/ \| undefined$/, "");
    }

    const raw = ts.displayPartsToString(prop.getDocumentationComment(checker));
    const tags = prop.getJsDocTags(checker);
    const tagText = (name: string): string | undefined => {
      const tag = tags.find((t) => t.name === name);
      if (!tag) return undefined;
      return joinedLines(tag.text ? ts.displayPartsToString(tag.text) : "");
    };
    const defaultValue = tagText("defaultValue");
    const fromLib =
      !!decl && !!ctx.program?.isSourceFileDefaultLibrary(decl.getSourceFile());

    const row: PropertyDoc = {
      name: prop.name,
      optional,
      type: printed,
      typeRefs: typeReferences(
        checker,
        typeNode,
        ctx.publicTypes ?? NO_PUBLIC_TYPES,
      ),
      description: joinedLines(raw),
      fromLib,
    };
    if (defaultValue) row.defaultValue = defaultValue;
    const shape = fromLib ? undefined : literalShape(typeNode);
    if (shape) {
      row.type = shape.short;
      row.children = literalMembers(checker, shape, ctx);
      if (shape.items) row.childrenAreItems = true;
    }
    if (fromLib && decl) {
      const libType = declaringTypeName(checker, decl);
      if (libType) row.libType = libType;
    }
    if (tagText("default") !== undefined) row.usesDefaultTag = true;
    if (raw.split("\n").some((l) => LIST_LINE.test(l.trim()))) {
      row.hasList = true;
    }
    if (decl) row.source = sourcePosition(decl);
    rows.push(row);
  }
  return rows;
}

/**
 * One parameter as a caller sees it. A rest parameter typed as a named tuple
 * (`...input: [stepDays?: number, options?: …]`) is one slot per member, since each member
 * is an argument of its own.
 */
interface ParamSlot {
  name: string;
  typeNode: ts.TypeNode | undefined;
  type: ts.Type;
}

function paramSlots(checker: ts.TypeChecker, sig: ts.Signature): ParamSlot[] {
  const slots: ParamSlot[] = [];
  for (const sp of sig.getParameters()) {
    const decl = sp.valueDeclaration;
    if (!decl || !ts.isParameter(decl)) continue;
    const tuple = decl.dotDotDotToken && unparenthesized(decl.type);
    if (
      tuple &&
      ts.isTupleTypeNode(tuple) &&
      tuple.elements.length > 0 &&
      tuple.elements.every(ts.isNamedTupleMember)
    ) {
      for (const member of tuple.elements as readonly ts.NamedTupleMember[]) {
        slots.push({
          name: member.name.text,
          typeNode: member.type,
          type: checker.getTypeFromTypeNode(member.type),
        });
      }
      continue;
    }
    slots.push({
      name: sp.name,
      typeNode: decl.type,
      type: checker.getTypeOfSymbolAtLocation(sp, decl),
    });
  }
  return slots;
}

/**
 * Whether a parameter expands under `## Options`, and by which rule.
 *
 * 1. Its declared type is an inline type literal or an intersection: every `options`,
 *    `optionsArg` and literal `props`.
 * 2. Its declared type names a public object type **and its declared name says it is an
 *    options bag**: the name contains `options`, in any case, or is exactly `props`. The name
 *    is the one in the signature, never the `@param` text. Whether the parameter is optional
 *    plays no part: `chargeableDays(…, options: FreeTimeChargeOptions)` is a required bag,
 *    and `calendar?: BusinessCalendar` is optional data.
 *
 * Anything else stays a row in `## Parameters`: a named object under any other name is data
 * the caller supplies (`calendar: BusinessCalendar`), and `Partial<…>`, `Omit<…>`, an indexed
 * access, a Temporal or lib type, an array and a tuple are not bags of options.
 */
const OPTIONS_BAG_NAME = /options/i;

function expansion(
  checker: ts.TypeChecker,
  slot: ParamSlot,
  ctx: ExtractContext,
): { rule: 1 | 2; typeName?: string } | undefined {
  const node = unparenthesized(slot.typeNode);
  if (!node) return undefined;
  const type = checker.getNonNullableType(slot.type);
  if (checker.getPropertiesOfType(type).length === 0) return undefined;

  if (ts.isTypeLiteralNode(node) || ts.isIntersectionTypeNode(node)) {
    return { rule: 1 };
  }
  if (!ts.isTypeReferenceNode(node)) return undefined;
  if (!OPTIONS_BAG_NAME.test(slot.name) && slot.name !== "props") {
    return undefined;
  }
  // The reference itself must be the public type (`RoundingOptions<DateUnit>` is), not a
  // utility type wrapping one (`Partial<Opts>` is not).
  const typeName = resolvePublicType(
    checker,
    node.typeName,
    ctx.publicTypes ?? NO_PUBLIC_TYPES,
  );
  if (typeName === undefined) return undefined;
  const isObject =
    !!(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) &&
    !checker.isArrayType(type) &&
    !checker.isTupleType(type);
  return isObject ? { rule: 2, typeName } : undefined;
}

/**
 * Split the documented parameters into the Parameters table and the Options blocks.
 *
 * A `@param` tag belongs to the parameter it names, or to the one declared `<name>Input`.
 * Tags and parameters left over pair up in order when there are as many of one as of the
 * other, which is how `@param options` finds a parameter declared `optionsArg`. An expanded
 * parameter leaves the Parameters table by that pairing, and its `@param` text becomes the
 * lead line of its block.
 */
function splitParams(
  checker: ts.TypeChecker,
  sig: ts.Signature,
  documented: ParamDoc[],
  ctx: ExtractContext,
): { params: ParamDoc[]; options: OptionsBlock[]; declared: string[] } {
  const slots = paramSlots(checker, sig);
  const docOf = new Map<ParamSlot, ParamDoc>();
  const spare: ParamDoc[] = [];
  for (const doc of documented) {
    const slot =
      slots.find((s) => s.name === doc.name) ??
      slots.find((s) => s.name === `${doc.name}Input`);
    if (slot && !docOf.has(slot)) docOf.set(slot, doc);
    else spare.push(doc);
  }
  const undocumented = slots.filter((s) => !docOf.has(s));
  if (spare.length === undocumented.length) {
    undocumented.forEach((slot, i) => {
      const doc = spare[i];
      docOf.set(slot, doc);
      if (!doc.type) {
        doc.type = checker.typeToString(
          slot.type,
          undefined,
          ts.TypeFormatFlags.NoTruncation,
        );
      }
    });
  }

  const expanded = new Set<ParamDoc>();
  const options: OptionsBlock[] = [];
  for (const slot of slots) {
    const why = expansion(checker, slot, ctx);
    if (!why) continue;
    const doc = docOf.get(slot);
    if (doc) expanded.add(doc);
    options.push({
      param: slot.name,
      lead: doc?.description ?? "",
      rows: extractProperties(
        checker,
        slot.type,
        slot.typeNode ?? sig.getDeclaration(),
        ctx,
      ),
      ...(why.typeName !== undefined ? { typeName: why.typeName } : {}),
      rule: why.rule,
    });
  }

  return {
    params: documented.filter((d) => !expanded.has(d)),
    options,
    declared: slots.map((s) => s.name),
  };
}

/** Each `@param` tag of a declaration, with the name it documents and its 1-based line. */
function documentedParamTags(
  node: ts.Node,
): Array<{ name: string; line: number }> {
  const sf = node.getSourceFile();
  return ts
    .getJSDocTags(node)
    .filter(ts.isJSDocParameterTag)
    .map((tag) => ({
      name: tag.name.getText(sf),
      line: sf.getLineAndCharacterOfPosition(tag.getStart(sf)).line + 1,
    }));
}

/**
 * The parameters and option names the playground is built from.
 *
 * The playground models one trailing options object, found by a parameter name containing
 * "options", and treats every other documented parameter as a positional control. That is a
 * narrower reading than the page's (see `expansion`), kept apart on purpose: the form
 * builder and the `@example` parser depend on it, and the page layout must be free to change
 * without moving a single generated playground.
 */
function playgroundShape(
  checker: ts.TypeChecker,
  sig: ts.Signature | undefined,
  node: ts.Node,
  documented: readonly ParamDoc[],
): { params: ParamDoc[]; options: string[] } {
  const params = documented.map((p) => ({ ...p }));
  for (const sp of sig?.getParameters() ?? []) {
    if (!sp.name.toLowerCase().includes("options")) continue;
    if (!sp.valueDeclaration) continue;
    const props = checker
      .getNonNullableType(checker.getTypeOfSymbolAtLocation(sp, node))
      .getProperties();
    if (props.length === 0) continue;
    let idx = params.findIndex((p) => p.name === sp.name);
    if (idx < 0) idx = params.findIndex((p) => p.name === "options");
    if (idx < 0) {
      idx = params.findIndex((p) => p.name.toLowerCase().includes("options"));
    }
    if (idx >= 0) params.splice(idx, 1);
    return { params, options: props.map((p) => p.name) };
  }
  return { params, options: [] };
}

// ---------------------------------------------------------------------------
// Playground spec generation
// ---------------------------------------------------------------------------
//
// Every exported function gets a live playground spec built from the same
// extraction pass (no hand-maintained list). The heavy lifting lives in
// `build-utils/build-utils.ts` (pure + unit-tested); this wrapper only adapts
// an extracted FnDoc into that module's input shape and wires the real
// TypeScript compiler callbacks.

/** True when the signature parameter `sp` is declared `x?:`, `x = default`, `...rest` or optional. */
function isOptionalDeclaration(sp: ts.Symbol): boolean {
  const decl = sp.valueDeclaration;
  if (!decl || !ts.isParameter(decl)) return false;
  return (
    decl.questionToken !== undefined ||
    decl.initializer !== undefined ||
    decl.dotDotDotToken !== undefined ||
    !!(sp.flags & ts.SymbolFlags.Optional)
  );
}

/**
 * Whether the documented parameter `name` may be omitted as a trailing arg:
 * `x?:`, `x: T = default`, `x: T | undefined`, a rest parameter, or a
 * documented element of a trailing rest tuple
 * (`...input: [stepDays?: number, options?: …]`, which has no symbol of its
 * own).
 */
function isOptionalParam(sigParams: ts.Symbol[], name: string): boolean {
  const sp =
    sigParams.find((s) => s.name === name) ??
    sigParams.find((s) => s.name === `${name}Input`);
  if (sp) return isOptionalDeclaration(sp);
  const last = sigParams.at(-1)?.valueDeclaration;
  return !!last && ts.isParameter(last) && last.dotDotDotToken !== undefined;
}

function buildPlaygroundSpec(
  checker: ts.TypeChecker,
  sig: ts.Signature | undefined,
  node: ts.Node,
  doc: FnDoc,
  shape: { params: ParamDoc[]; options: string[] },
): PlaygroundSpec | undefined {
  try {
    const sigParams = sig?.getParameters() ?? [];
    const returnType = BU.classifyReturnType(checker, sig);
    return BU.buildPlaygroundSpec(
      {
        namespace: doc.namespace,
        module: doc.module,
        name: doc.name,
        params: shape.params.map((p) => ({
          name: p.name,
          type: p.type,
          optional: isOptionalParam(sigParams, p.name),
        })),
        options: shape.options.map((name) => ({ name })),
        examples: doc.examples,
      },
      {
        classifyParamType: (name) => {
          const sp = sigParams.find((s) => s.name === name);
          const t = sp
            ? checker.getTypeOfSymbolAtLocation(sp, node)
            : undefined;
          return BU.classifyType(checker, t, name);
        },
        optionPropertyType: (name) =>
          BU.optionPropertyType(checker, sig, node, name),
        classifyType: (t, name) => BU.classifyType(checker, t, name),
        returnType,
      },
    );
  } catch (e) {
    console.error("buildPlaygroundSpec error for", doc.name, e);
    return undefined;
  }
}

export function synthesizeTemplate(spec: PlaygroundSpec): string {
  const args: string[] = [];

  for (const p of spec.params) {
    switch (p.type) {
      case "string":
        args.push(JSON.stringify(p.value));
        break;
      case "number":
        args.push(p.value);
        break;
      case "bigint":
        args.push(`${p.value || "0"}n`);
        break;
      case "boolean":
        args.push(p.value === "true" ? "true" : "false");
        break;
      case "enum":
        args.push(JSON.stringify(p.value));
        break;
      case "array":
        args.push(
          `[${p.value
            .split(",")
            .map((v: string) => JSON.stringify(v.trim()))
            .join(", ")}]`,
        );
        break;
      case "units":
        args.push(`{ ${p.unitValue}: ${p.value} }`);
        break;
    }
  }

  if (spec.options?.length) {
    const opts: string[] = [];
    for (const o of spec.options) {
      let val: string;
      switch (o.type) {
        case "boolean":
          val = o.value === "true" ? "true" : "false";
          break;
        case "number":
          val = o.value || "0";
          break;
        case "enum":
          val = o.value
            ? JSON.stringify(o.value)
            : o.options?.[0]
              ? JSON.stringify(o.options[0])
              : JSON.stringify("");
          break;
        default:
          val = o.value ? JSON.stringify(o.value) : JSON.stringify("");
      }
      opts.push(`${o.name}: ${val}`);
    }
    if (opts.length) args.push(`{ ${opts.join(", ")} }`);
  }

  return `${spec.fn}(${args.join(", ")})`;
}

const QUOTED_ARG = /^(['"])[\s\S]*\1$/;
const NUMERIC_ARG = /^-?\d+(?:\.\d+)?$/;
/** A BigInt literal as written in an `@example` — `0n`, `-1000000000n`. */
const BIGINT_ARG = /^-?\d+n$/;
/**
 * An object or array literal — the shapes that get a verbatim `expr` control
 * rather than a typed one: a `BusinessCalendar`, an `{ start, end }` interval,
 * a fiscal-pattern object, a nested array.
 */
const EXPRESSION_ARG = /^[{[][\s\S]*[}\]]$/;

interface FieldsResult {
  fields: PlaygroundField[];
  optionsSuffix?: string;
  objectArg?: boolean;
}

/**
 * Turn one param + its example arg (`raw`, `undefined` when the example omits an
 * optional trailing param) into a `PlaygroundField`, or `null` to bail.
 *
 * When `raw` is `undefined` the control is seeded empty — the initial call then
 * reads exactly like the `@example`, and the optional arg is only added once the
 * reader fills the control in.
 */
function fieldForParam(
  p: PlaygroundSpec["params"][number],
  raw: string | undefined,
): PlaygroundField | null {
  const opt = p.optional ? { optional: true as const } : {};
  const omitted = raw === undefined;

  if (p.type === "array") {
    if (raw !== undefined && !raw.startsWith("[")) return null;
    if (p.intervalShape) {
      return {
        name: p.name,
        kind: "intervals",
        seed: "",
        pairs: raw ? BU.parseIntervalArg(raw) : [],
        ...opt,
      };
    }
    const choices = p.options ?? [];
    const items = raw ? BU.parseArrayArg(raw) : [];
    // `parseArrayArg` unquotes each element, so an array of object literals
    // comes back as source text. Quoting it again would pass the source as a
    // string — `mergeCalendars([{ weekend: … }])` is the case.
    const objectElements = items.some((item) => item.trim().startsWith("{"));
    return {
      name: p.name,
      kind: "list",
      seed: "",
      element: choices.length
        ? "enum"
        : objectElements
          ? "expr"
          : p.arrayType === "number"
            ? "number"
            : "string",
      ...(choices.length ? { choices } : {}),
      items,
      ...opt,
    };
  }

  if (p.type === "units") {
    const unitKeys = p.options ?? [];
    if (!unitKeys.length) return null;
    if (raw !== undefined && !raw.startsWith("{")) return null;
    return {
      name: p.name,
      kind: "units",
      seed: omitted ? "" : p.value || "0",
      unitKeys,
      unitSeed: p.unitValue || unitKeys[0] || "",
      ...opt,
    };
  }

  if (p.type === "enum") {
    const choices = p.options ?? [];
    if (!choices.length) return null;
    if (raw !== undefined && !QUOTED_ARG.test(raw)) return null;
    const seed = omitted
      ? ""
      : p.value && choices.includes(p.value)
        ? p.value
        : choices[0];
    return { name: p.name, kind: "enum", seed, choices, ...opt };
  }

  if (p.type === "boolean") {
    if (raw !== undefined && raw !== "true" && raw !== "false") return null;
    return {
      name: p.name,
      kind: "boolean",
      seed: omitted ? "" : (raw ?? p.value ?? "false"),
      ...opt,
    };
  }

  if (p.type === "bigint") {
    // An `@example` may write the arg either way — `0n` (correct) or `0` (the
    // deliberate "number, not bigint" counter-examples). Accept both; the seed
    // is the digits alone.
    if (raw !== undefined && !BIGINT_ARG.test(raw) && !/^-?\d+$/.test(raw)) {
      return null;
    }
    return {
      name: p.name,
      kind: "bigint",
      seed: omitted ? "" : (raw ?? p.value ?? "0").replace(/n$/, ""),
      ...opt,
    };
  }

  if (p.type === "number") {
    if (raw !== undefined && !NUMERIC_ARG.test(raw)) return null;
    return {
      name: p.name,
      kind: "number",
      seed: omitted ? "" : (raw ?? p.value ?? ""),
      ...opt,
    };
  }

  // string — the catch-all, including `string | number` and types the checker
  // couldn't narrow. A bare-number example arg is promoted to a number field.
  if (omitted) return { name: p.name, kind: "string", seed: "", ...opt };
  if (QUOTED_ARG.test(raw)) {
    return { name: p.name, kind: "string", seed: p.value, ...opt };
  }
  if (NUMERIC_ARG.test(raw)) {
    return { name: p.name, kind: "number", seed: raw, ...opt };
  }
  if (BIGINT_ARG.test(raw)) {
    return { name: p.name, kind: "bigint", seed: raw.slice(0, -1), ...opt };
  }
  // A literal no scalar control models — an object (`{ weekend: [6, 7], … }`) or
  // a nested array. Before this fell through to `null`, which cost the whole
  // function its widget; keep the source text in an editable field instead.
  if (EXPRESSION_ARG.test(raw)) {
    return { name: p.name, kind: "expr", seed: raw, ...opt };
  }
  return null;
}

/**
 * Project a `PlaygroundSpec` + its first `@example` into form-control fields for
 * `<PlaygroundForm>`, or `undefined` when the example can't be modelled — the
 * reference page then shows just the static code block, no widget.
 *
 * Handles four shapes:
 *  - **positional** — `fn(a, b, c)`; each arg must line up with a param and be a
 *    literal of the expected shape (quoted string, bare number, `true`/`false`,
 *    `{ unit: n }`, `[…]`). The example may omit *optional* trailing params.
 *  - **object arg** — `fn({ value1, value2 })`; fields are the object's keys.
 *  - **no args** — `fn()`; a Run-button-only form.
 *  - a trailing options object is carried through verbatim as `optionsSuffix`.
 *
 * An arg that isn't a recognisable literal — a call expression, a bare
 * identifier, a nested object — sends the whole function back to the textarea.
 */
export function buildPlaygroundFields(
  spec: PlaygroundSpec,
  template: string,
): FieldsResult | undefined {
  const rawArgs = parseCallArgs(template).map((a) => a.trim());

  // --- object-arg form: fn({ value1: …, value2: … }) ---
  if (
    rawArgs.length === 1 &&
    rawArgs[0].startsWith("{") &&
    spec.params.length >= 1 &&
    !spec.params.some((p) => p.type === "units")
  ) {
    const entries = BU.parseObjectArgEntries(rawArgs[0]).filter(
      ([k]) => k !== "options",
    );
    if (!entries.length) return undefined;
    const fields: PlaygroundField[] = [];
    for (const [key, val] of entries) {
      const known = spec.params.find((sp) => sp.name === key);
      const p = {
        name: key,
        type: known?.type ?? ("string" as const),
        value: argToValue(val),
        options: known?.options,
        arrayType: known?.arrayType,
      };
      const f = fieldForParam(p, val);
      if (!f) return undefined;
      fields.push(f);
    }
    return { fields, objectArg: true };
  }

  // --- no-arg form: fn() → Run button + output only ---
  if (spec.params.length === 0) {
    return rawArgs.length === 0 ? { fields: [] } : undefined;
  }

  // --- positional form ---
  const hasOptions = !!spec.options?.length;
  let positional = rawArgs;
  let optionsSuffix: string | undefined;
  if (
    hasOptions &&
    rawArgs.length === spec.params.length + 1 &&
    rawArgs[spec.params.length].startsWith("{")
  ) {
    optionsSuffix = rawArgs[spec.params.length];
    positional = rawArgs.slice(0, spec.params.length);
  }

  if (positional.length > spec.params.length) return undefined; // too many args
  for (let i = positional.length; i < spec.params.length; i++) {
    if (!spec.params[i].optional) return undefined; // missing a required param
  }

  const fields: PlaygroundField[] = [];
  for (let i = 0; i < spec.params.length; i++) {
    const f = fieldForParam(spec.params[i], positional[i]);
    if (!f) return undefined;
    fields.push(f);
  }

  return optionsSuffix ? { fields, optionsSuffix } : { fields };
}

/** A documented result that means "invalid input", not an answer. */
function isSentinelResult(result: string): boolean {
  const t = result.replace(/^\s*\/\/\s*/, "").trim();
  // The literal may be followed by a note: `[] (start after end)`.
  return t === "" || /^(""|''|null|false|\[\])(\s|\(|$)/.test(t);
}

/** `spec` with each positional param's value taken from `call` instead of the first example. */
function specForCall(spec: PlaygroundSpec, call: string): PlaygroundSpec {
  const raw = parseCallArgs(call).map((a) => a.trim());
  return {
    ...spec,
    params: spec.params.map((p, i) => {
      const r = raw[i];
      if (r === undefined || (r.startsWith("{") && p.type !== "units"))
        return p;
      if (p.type === "units") {
        const { unit, amount } = BU.parseUnitsArg(r);
        return {
          ...p,
          value: amount,
          unitValue: p.options?.includes(unit) ? unit : p.unitValue,
        };
      }
      return { ...p, value: argToValue(r) };
    }),
  };
}

/** The ChoiceSeed a field carries when loaded from an example. */
function seedOfField(f: PlaygroundField): ChoiceSeed {
  const out: ChoiceSeed = { seed: f.seed };
  if (f.kind === "units") out.unitSeed = f.unitSeed;
  if (f.kind === "list") out.items = f.items ?? [];
  if (f.kind === "intervals") out.pairs = f.pairs ?? [];
  return out;
}

/**
 * Per-choice example values for each enum field of a playground.
 *
 * For every choice of an enum field, the first `@example` (JSDoc order) that
 * writes that choice as a quoted literal at the field's position, whose other
 * arguments are all literals the form can hold, and whose documented result is
 * not a sentinel. Its other fields' values are stored. A choice with no such
 * example has no entry; a field whose entries are fewer than two or all equal
 * contributes nothing, so a function whose examples do not vary by choice gets
 * no `choiceSeeds`.
 */
export function buildChoiceSeeds(
  spec: PlaygroundSpec,
  examples: Array<{ call: string; result: string }>,
  baseFields: PlaygroundField[],
): ChoiceSeeds | undefined {
  const enumFields = baseFields.filter(
    (f) => f.kind === "enum" && f.choices?.length,
  );
  if (!enumFields.length) return undefined;

  const out: ChoiceSeeds = {};
  for (const ef of enumFields) {
    const entries: Record<string, Record<string, ChoiceSeed>> = {};
    for (const ex of examples) {
      if (isSentinelResult(ex.result)) continue;
      const res = buildPlaygroundFields(specForCall(spec, ex.call), ex.call);
      if (!res || res.fields.length !== baseFields.length) continue;
      const idx = baseFields.indexOf(ef);
      // A field the example fills with another kind (a locale list where the
      // form holds a locale string) cannot be loaded into the form's control.
      if (res.fields.some((f, i) => f.kind !== baseFields[i].kind)) continue;
      const exField = res.fields[idx];
      if (exField?.name !== ef.name || exField.kind !== "enum") continue;

      // The choice as the example wrote it — `fieldForParam` falls back to the
      // first choice for a value outside the list, which is not this choice.
      const rawArgs = parseCallArgs(ex.call).map((a) => a.trim());
      const raw = res.objectArg
        ? BU.parseObjectArgEntries(rawArgs[0]).find(([k]) => k === ef.name)?.[1]
        : rawArgs[idx];
      if (raw === undefined || !QUOTED_ARG.test(raw)) continue;
      const choice = argToValue(raw);
      if (!ef.choices!.includes(choice) || entries[choice]) continue;

      const others: Record<string, ChoiceSeed> = {};
      res.fields.forEach((f, i) => {
        if (i !== idx) others[f.name] = seedOfField(f);
      });
      entries[choice] = others;
    }
    const seeds = Object.values(entries);
    if (
      seeds.length >= 2 &&
      seeds.some((s) => JSON.stringify(s) !== JSON.stringify(seeds[0]))
    ) {
      out[ef.name] = entries;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function buildLivePlaygroundTemplate(
  checker: ts.TypeChecker,
  sig: ts.Signature | undefined,
  doc: FnDoc,
  _node: ts.Node,
): LivePlaygroundTemplate | undefined {
  const returnType = BU.classifyReturnType(checker, sig);
  const module = BU.playgroundModule(doc.namespace, doc.module);

  let template: string | undefined;
  if (doc.examples.length > 0) {
    template = doc.examples[0].call;
  } else if (doc.playgroundSpec) {
    template = synthesizeTemplate(doc.playgroundSpec);
  }

  if (!template) return undefined;
  const allowEmptyArray =
    doc.playgroundSpec?.allowEmptyArray ??
    (returnType === "array" &&
      doc.examples.some((e) => e.result.trim() === "[]"));
  const nullIsEmpty = NULL_IS_EMPTY.has(doc.name);
  if (nullIsEmpty && returnType !== "object") {
    throw new Error(
      `[reference] ${doc.name} is in NULL_IS_EMPTY but returns ${returnType}, not an object. Remove it from scripts/build-utils/null-is-empty.ts.`,
    );
  }

  const formFields = doc.playgroundSpec
    ? buildPlaygroundFields(doc.playgroundSpec, template)
    : undefined;

  const choiceSeeds =
    formFields && doc.playgroundSpec
      ? buildChoiceSeeds(doc.playgroundSpec, doc.examples, formFields.fields)
      : undefined;

  return {
    module,
    fn: doc.name,
    template,
    returnType,
    allowEmptyArray,
    ...(nullIsEmpty ? { nullIsEmpty: true } : {}),
    ...(formFields
      ? {
          fields: formFields.fields,
          ...(formFields.optionsSuffix
            ? { optionsSuffix: formFields.optionsSuffix }
            : {}),
          ...(formFields.objectArg ? { objectArg: true } : {}),
          ...(choiceSeeds ? { choiceSeeds } : {}),
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Regex example generation
// ---------------------------------------------------------------------------

export function generateRegexExamples(
  pattern: string,
  name: string,
): Example[] {
  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch {
    return [];
  }

  const candidates = regexCandidates(pattern);
  const tr: Example[] = [];
  const fa: Example[] = [];
  for (const [input, expected] of candidates) {
    const actual = re.test(input);
    if (actual === expected) {
      if (expected)
        tr.push({
          call: `${name}.test(${JSON.stringify(input)})`,
          result: "true",
        });
      else
        fa.push({
          call: `${name}.test(${JSON.stringify(input)})`,
          result: "false",
        });
    }
  }

  const out: Example[] = [];
  if (tr.length > 0) out.push(tr[0]);
  if (tr.length > 1) out.push(tr[tr.length - 1]);
  if (fa.length > 0) out.push(fa[0]);
  if (fa.length > 1 && out.length < 4) out.push(fa[1]);
  return out;
}

function regexCandidates(pattern: string): Array<[string, boolean]> {
  // strip anchors for analysis
  const inner = pattern
    .replace(/^\^/, "")
    .replace(/\$$/, "")
    .replace(/^\(\?:/, "");
  const out: Array<[string, boolean]> = [];

  // digit-count patterns: \d{N}
  const digitCount = inner.match(/^\\(\d)\{(\d+)\}$/);
  if (digitCount) {
    const n = parseInt(digitCount[2]);
    out.push(["0".repeat(n), true]);
    out.push(["0".repeat(n - 1), false]);
    out.push(["not-a-match", false]);
    return out;
  }

  // specific known patterns — fall back to generic boundary probing
  const generic: Array<[string, boolean]> = [
    ["00", true],
    ["01", true],
    ["12", true],
    ["23", true],
    ["59", true],
    ["60", false],
    ["0000", true],
    ["2025", true],
    ["9999", true],
    ["000000", true],
    ["123456", true],
    ["000001", true],
    ["-000001", true],
    ["+001234", true],
    ["202", false],
    ["1234567", false],
    ["2025-03-10", true],
    ["2025-13-01", false],
    ["-000001-01-01", true],
    ["not-a-match", false],
    ["not-a-date", false],
    ["not-a-year", false],
    ["not-a-time", false],
    ["not-a-hour", false],
    ["not-a-minute", false],
    ["not-a-fraction", false],
    ["not-a-timestamp", false],
    ["T14:30:60", true],
    ["T14:30:60.5", true],
    ["T14:30:59", false],
    ["1707874200", true],
    ["0000000000", true],
    ["123456789", false],
    ["1", true],
    ["123456789", true],
    ["", false],
    ["14:30", true],
    ["14:30:00", true],
    ["14:30:00.123456789", true],
    ["24", false],
    ["13", false],
    ["00", false],
    ["32", false],
    ["-", false],
  ];
  return generic;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/** One extracted doc, with the symbol of the declaration it came from. */
export interface ExtractedDoc {
  doc: Doc;
  symbol: ts.Symbol | undefined;
}

export function extractFromFile(
  checker: ts.TypeChecker,
  file: string,
  sourceFile: ts.SourceFile,
  publicDecls: ReadonlySet<ts.Node>,
  ctx: ExtractContext = {},
): ExtractedDoc[] {
  const { namespace: ns, module: mod } = namespaceModule(file);
  const docs: ExtractedDoc[] = [];
  const add = (doc: Doc | undefined, name: ts.Node) => {
    if (doc) docs.push({ doc, symbol: checker.getSymbolAtLocation(name) });
  };

  // Only declarations importable from a published entry point get a page (see
  // publicDeclarations); a file-private helper or an unexported sibling is skipped.
  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      if (!publicDecls.has(stmt)) continue;
      add(extractFunction(checker, stmt, ns, mod, file, ctx), stmt.name);
    } else if (ts.isTypeAliasDeclaration(stmt) && stmt.name) {
      if (!publicDecls.has(stmt)) continue;
      add(extractType(checker, stmt, ns, mod, file, ctx), stmt.name);
    } else if (ts.isInterfaceDeclaration(stmt) && stmt.name) {
      if (!publicDecls.has(stmt)) continue;
      add(extractInterface(checker, stmt, ns, mod, file, ctx), stmt.name);
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!publicDecls.has(decl)) continue;
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (isRegexInit(decl.initializer)) {
            add(extractRegex(checker, decl, ns, mod, file), decl.name);
          } else if (
            ts.isArrowFunction(decl.initializer) ||
            ts.isFunctionExpression(decl.initializer)
          ) {
            add(extractArrowFn(checker, decl, ns, mod, file, ctx), decl.name);
          }
        }
      }
    }
  }

  return docs;
}

/**
 * One doc per export, keyed `ns/mod/name`.
 *
 * A merged interface is declared more than once and is still one type: its declarations
 * share a symbol and every one of them yields the same members, so the first is kept. Any
 * other pair with one key is two exports (a function `dwell` and a type `dwell` in one
 * module, say), and keeping one would drop the other from the reference without a word. That
 * throws, naming both and their files. The fix is a rename in `packages/gmt/src`.
 */
export function dedupeDocs(extracted: readonly ExtractedDoc[]): Doc[] {
  const first = new Map<string, ExtractedDoc>();
  const clashes: string[] = [];
  const where = (d: Doc) =>
    `${d.kind} ${d.name} (packages/gmt/src/${d.sourcePath})`;
  for (const entry of extracted) {
    const key = fnKey(entry.doc);
    const known = first.get(key);
    if (!known) {
      first.set(key, entry);
      continue;
    }
    const sameType =
      known.doc.kind === "type" &&
      entry.doc.kind === "type" &&
      known.symbol !== undefined &&
      known.symbol === entry.symbol;
    if (!sameType) clashes.push(`${where(known.doc)} and ${where(entry.doc)}`);
  }
  if (clashes.length > 0) {
    throw new Error(
      `[reference] two exports share one reference key, so one would be dropped: ${clashes.join("; ")}. Rename one of each pair.`,
    );
  }
  return [...first.values()].map((entry) => entry.doc);
}

/**
 * The public functions and types of the source files, as the usage graph takes them. The
 * same statements `extractFromFile` documents, so the graph and the pages cannot disagree
 * about what is public.
 */
export function publicEntries(
  program: ts.Program,
  files: readonly string[],
  publicDecls: ReadonlySet<ts.Node>,
): { functions: PublicFunctionDecl[]; types: PublicTypeDecl[] } {
  const functions: PublicFunctionDecl[] = [];
  const types: PublicTypeDecl[] = [];
  for (const file of files) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;
    const { namespace: ns, module: mod } = namespaceModule(file);
    for (const stmt of sf.statements) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        if (!publicDecls.has(stmt)) continue;
        functions.push({ key: `${ns}/${mod}/${stmt.name.text}`, node: stmt });
      } else if (
        ts.isTypeAliasDeclaration(stmt) ||
        ts.isInterfaceDeclaration(stmt)
      ) {
        if (!publicDecls.has(stmt)) continue;
        types.push({ name: stmt.name.text, node: stmt });
      } else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (!publicDecls.has(decl)) continue;
          if (
            ts.isIdentifier(decl.name) &&
            decl.initializer &&
            !isRegexInit(decl.initializer) &&
            (ts.isArrowFunction(decl.initializer) ||
              ts.isFunctionExpression(decl.initializer))
          ) {
            functions.push({
              key: `${ns}/${mod}/${decl.name.text}`,
              node: decl,
            });
          }
        }
      }
    }
  }
  return { functions, types };
}

export function extractFnBody(
  checker: ts.TypeChecker,
  sig: ts.Signature | undefined,
  node: ts.Node,
  name: string,
  ns: string,
  mod: string,
  file: string,
  ctx: ExtractContext = {},
): FnDoc {
  // `NoTruncation`: a reference signature is the whole type, never `… N more …`.
  let sigStr = sig
    ? checker.signatureToString(sig, undefined, ts.TypeFormatFlags.NoTruncation)
    : "(...)";
  for (const sp of sig?.getParameters() ?? []) {
    const spType = checker.getTypeOfSymbolAtLocation(sp, node);
    const full = checker.typeToString(
      spType,
      undefined,
      ts.TypeFormatFlags.NoTruncation,
    );
    const shown = declaredTypeString(checker, spType, sp.valueDeclaration);
    if (shown !== full) {
      sigStr = sigStr.replace(`${sp.name}?: ${full}`, `${sp.name}?: ${shown}`);
    }
  }
  const signature = `${name}${sigStr}`;

  const jsDoc = parseJsDoc(checker, node);
  const description = jsDoc?.description ?? "";
  const behavior = jsDoc?.behavior ?? [];
  const documented = jsDoc?.params ?? [];
  const returns = jsDoc?.returns ?? "";
  const examples = jsDoc?.examples ?? [];

  const sigParams = sig?.getParameters() ?? [];
  for (const p of documented) {
    const sp =
      sigParams.find((s) => s.name === p.name) ??
      sigParams.find((s) => s.name === `${p.name}Input`);
    if (sp) {
      const t = checker.getTypeOfSymbolAtLocation(sp, node);
      p.type = declaredTypeString(checker, t, sp.valueDeclaration);
    }
  }

  // Before `splitParams`, which fills in the types of parameters it pairs by position.
  const shape = playgroundShape(checker, sig, node, documented);
  const split = sig
    ? splitParams(checker, sig, documented, ctx)
    : { params: documented, options: [], declared: [] };

  const returned = literalShape(sig?.getDeclaration().type);

  const doc: FnDoc = {
    name,
    namespace: ns,
    module: mod,
    kind: "function",
    signature,
    description,
    behavior,
    params: split.params,
    options: split.options,
    returns,
    returnMembers: returned ? literalMembers(checker, returned, ctx) : [],
    returnsItems: !!returned?.items,
    examples,
    // Filled from the usage graph once every function is extracted (`extractReference`).
    relatedTypes: [],
    sourcePath: relative(gmtSrc, file).split("/").join("/"),
    line: sourcePosition(node).line,
    declaredParams: split.declared,
    documentedParams: documentedParamTags(node),
  };
  doc.playgroundSpec = buildPlaygroundSpec(checker, sig, node, doc, shape);
  doc.livePlaygroundTemplate = buildLivePlaygroundTemplate(
    checker,
    sig,
    doc,
    node,
  );
  return doc;
}

export function extractFunction(
  checker: ts.TypeChecker,
  node: ts.FunctionDeclaration,
  ns: string,
  mod: string,
  file: string,
  ctx: ExtractContext = {},
): FnDoc | undefined {
  const name = node.name!.text;
  const sig = checker.getSignatureFromDeclaration(node);
  return extractFnBody(checker, sig, node, name, ns, mod, file, ctx);
}

export function extractArrowFn(
  checker: ts.TypeChecker,
  decl: ts.VariableDeclaration,
  ns: string,
  mod: string,
  file: string,
  ctx: ExtractContext = {},
): FnDoc | undefined {
  const name = (decl.name as ts.Identifier).text;
  const type = checker.getTypeAtLocation(decl);
  const sig = type.getCallSignatures()[0];
  return extractFnBody(checker, sig, decl, name, ns, mod, file, ctx);
}

/**
 * A type's description: the summary paragraph of its JSDoc, else the `//` comment above it,
 * else nothing. A type with neither stays empty; the gate reports it, and the page does not
 * make up a sentence.
 */
function typeDescription(checker: ts.TypeChecker, node: ts.Node): string {
  return jsDocSummary(checker, node) || (leadingLineComment(node) ?? "");
}

export function extractType(
  checker: ts.TypeChecker,
  node: ts.TypeAliasDeclaration,
  ns: string,
  mod: string,
  file: string,
  ctx: ExtractContext = {},
): TypeDoc {
  // An alias of an object literal or an intersection has members, as an interface does. A
  // union or any other alias has none.
  const aliased = unparenthesized(node.type);
  const hasMembers =
    !!aliased &&
    (ts.isTypeLiteralNode(aliased) || ts.isIntersectionTypeNode(aliased));
  const type = checker.getTypeFromTypeNode(node.type);

  return {
    name: node.name.text,
    namespace: ns,
    module: mod,
    kind: "type",
    definition: node.getText().replace(/^export\s*/, ""),
    description: typeDescription(checker, node),
    members: hasMembers ? extractProperties(checker, type, node, ctx) : [],
    ...(isLiteralUnion(type)
      ? {
          literals: checker.typeToString(
            type,
            undefined,
            ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias,
          ),
        }
      : {}),
    importFrom: ctx.importPaths?.get(node) ?? ROOT,
    sourcePath: relative(gmtSrc, file).split("/").join("/"),
    line: sourcePosition(node).line,
  };
}

export function extractInterface(
  checker: ts.TypeChecker,
  node: ts.InterfaceDeclaration,
  ns: string,
  mod: string,
  file: string,
  ctx: ExtractContext = {},
): TypeDoc {
  return {
    name: node.name.text,
    namespace: ns,
    module: mod,
    kind: "type",
    definition: node.getText().replace(/^export\s*/, ""),
    description: typeDescription(checker, node),
    members: extractProperties(
      checker,
      checker.getTypeAtLocation(node.name),
      node,
      ctx,
    ),
    importFrom: ctx.importPaths?.get(node) ?? ROOT,
    sourcePath: relative(gmtSrc, file).split("/").join("/"),
    line: sourcePosition(node).line,
  };
}

export function extractRegex(
  checker: ts.TypeChecker,
  decl: ts.VariableDeclaration,
  ns: string,
  mod: string,
  file: string,
): RegexDoc | undefined {
  if (!ts.isIdentifier(decl.name)) return undefined;
  const name = decl.name.text;

  // only regex consts in regex/*
  if (ns !== "regex") return undefined;
  if (!decl.initializer) return undefined;

  let pattern: string | undefined;
  const init = resolveRegexInit(decl.initializer);
  if (ts.isRegularExpressionLiteral(init)) {
    pattern = init.getText();
  } else if (
    ts.isNewExpression(init) &&
    init.expression.getText() === "RegExp"
  ) {
    const args = init.arguments;
    if (!args || args.length === 0) return undefined;
    pattern = args[0].getText();
  } else {
    return undefined;
  }

  // Description and examples come from the const's own JSDoc, the same source function pages
  // use. Only a pattern with no JSDoc falls back to the line comment directly above it, and
  // only a pattern with no @example falls back to generated examples.
  const jsDoc = parseJsDoc(checker, decl.name);
  const description = jsDoc
    ? jsDocSummary(checker, decl.name)
    : (leadingLineComment(decl.parent.parent) ?? "");

  const inner = pattern.replace(/^\/|\/$/g, "");
  const examples = jsDoc?.examples.length
    ? jsDoc.examples
    : generateRegexExamples(inner, name);

  return {
    name,
    namespace: ns,
    module: mod,
    kind: "regex",
    pattern,
    description,
    examples,
    sourcePath: relative(gmtSrc, file).split("/").join("/"),
  };
}

// ---------------------------------------------------------------------------
// MDX generation
// ---------------------------------------------------------------------------

/** What a page needs to place and link the types around it. */
export interface PageContext {
  usage: TypeUsage;
  /** Every public type's doc, by name. */
  typeDocs: ReadonlyMap<string, TypeDoc>;
}

/** The widget a function's Examples section ends with, and the heading above it. */
const EXAMPLE_WIDGETS: Record<string, { heading: string; tag: string }> = {
  getDstTransitions: {
    heading: "DST Transition Inspector",
    tag: "<DstInspector />",
  },
  intervalIntersectionZoned: {
    heading: "Interval algebra visualizer",
    tag: "<IntervalVisualizer />",
  },
  intervalUnionZoned: {
    heading: "Interval algebra visualizer",
    tag: "<IntervalVisualizer />",
  },
  intervalDifferenceZoned: {
    heading: "Interval algebra visualizer",
    tag: "<IntervalVisualizer />",
  },
  intervalXorZoned: {
    heading: "Interval algebra visualizer",
    tag: "<IntervalVisualizer />",
  },
  convertZonedToZoned: {
    heading: "Converter + format bench",
    tag: "<ConverterBench />",
  },
};

/** The shared types a function reaches: the ones with a page to link to. */
function pageTypesOf(doc: FnDoc, usage: TypeUsage): string[] {
  return doc.relatedTypes.filter(
    (name) => usage.types.get(name)?.placement.kind === "page",
  );
}

/**
 * Every heading a function's page emits, in order, and where the headings of its inline types
 * start. Their anchors come from this list (`assignInlineAnchors`), so it must name exactly
 * what `renderFn` writes; `runGeneration` checks each rendered page against it.
 */
export function fnHeadings(doc: FnDoc, usage: TypeUsage): PageHeadings {
  const inOptions = optionTypesOf(doc, usage);
  const inline = inlineTypesOf(usage, fnKey(doc)).filter(
    (name) => !inOptions.includes(name),
  );
  const headings = ["Signature"];
  if (doc.params.length) headings.push("Parameters");
  if (doc.options.length) headings.push("Options");
  if (doc.returns || doc.returnMembers.length) headings.push("Returns");
  if (inline.length) headings.push("Types");
  const at = headings.length;
  headings.push(...inline);
  if (pageTypesOf(doc, usage).length) headings.push("Related types");
  if (doc.examples.length) {
    headings.push("Examples");
    const widget = EXAMPLE_WIDGETS[doc.name];
    if (widget) headings.push(widget.heading);
  }
  headings.push("Source");
  return { headings, at, inOptions };
}

/**
 * The inline types a function's Options blocks document: each is the declared type of an
 * expanded parameter and is used by this function alone. The block shows the type's rows
 * already, so the type gets no `### Name` section of its own; the block carries its anchor,
 * its description and its import line instead.
 */
export function optionTypesOf(doc: FnDoc, usage: TypeUsage): string[] {
  const key = fnKey(doc);
  const held: string[] = [];
  for (const block of doc.options) {
    const name = block.typeName;
    if (name === undefined || held.includes(name)) continue;
    const placement = usage.types.get(name)?.placement;
    if (placement?.kind === "inline" && placement.owner === key)
      held.push(name);
  }
  return held;
}

/** The element an Options block sets a type's anchor on. Not a heading: the table follows. */
function anchorElement(id: string): string {
  return `<a id="${id}"></a>`;
}

/**
 * Every id a page gives its content: the anchor of each heading, then each id set by hand
 * on an `<a id="…"></a>`, outside code fences.
 */
export function mdxIds(mdx: string): string[] {
  const ids = pageAnchors(mdxHeadings(mdx)).headings;
  let fenced = false;
  for (const line of mdx.split("\n")) {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    else if (!fenced) {
      for (const m of line.matchAll(/<a id="([^"]+)"><\/a>/g)) ids.push(m[1]);
    }
  }
  return ids;
}

/** The Markdown headings of a page, in order, skipping anything inside a code fence. */
export function mdxHeadings(mdx: string): string[] {
  const headings: string[] = [];
  let fenced = false;
  for (const line of mdx.split("\n")) {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    else if (!fenced) {
      const m = /^#{1,6}\s+(.*?)\s*$/.exec(line);
      if (m) headings.push(m[1]);
    }
  }
  return headings;
}

function importLine(doc: TypeDoc): string[] {
  return [
    "```ts",
    `import type { ${doc.name} } from "${doc.importFrom}";`,
    "```",
    "",
  ];
}

/**
 * One type documented on its function's page, under `### Name`: its description, its import
 * line, then its Members table, or the values of a literal union on one line, or the
 * definition of any other alias.
 */
function renderInlineType(doc: TypeDoc, table: TableContext): string[] {
  const lines: string[] = [];
  lines.push(`### ${doc.name}`);
  lines.push("");
  if (doc.description) {
    lines.push(mdText(doc.description));
    lines.push("");
  }
  lines.push(...importLine(doc));
  if (doc.members.length) {
    lines.push(refTable("members", renderMembersTable(doc.members, table)));
  } else {
    lines.push("```ts");
    lines.push(doc.literals ?? doc.definition);
    lines.push("```");
  }
  lines.push("");
  return lines;
}

export function renderFn(doc: FnDoc, page: PageContext): string {
  const { usage, typeDocs } = page;
  const key = fnKey(doc);
  const slug = pageSlug(doc.namespace, doc.module, doc.name);
  const src = `${GH_BASE}/${doc.sourcePath}`;
  // A type on this page is linked by its bare anchor.
  const table: TableContext = {
    typeUrl: (name) => typeUrl(usage, name, key),
  };
  // A type an Options block documents is not repeated under `## Types`.
  const inOptions = optionTypesOf(doc, usage);
  const inline = inlineTypesOf(usage, key).filter(
    (name) => !inOptions.includes(name),
  );
  const related = pageTypesOf(doc, usage);
  const docOf = (name: string): TypeDoc => {
    const typeDoc = typeDocs.get(name);
    if (!typeDoc) {
      throw new Error(
        `[reference] ${key} holds the inline type ${name}, which has no doc.`,
      );
    }
    return typeDoc;
  };
  const documented = new Set<string>();

  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`title: ${JSON.stringify(doc.name)}`);
  lines.push(`description: ${JSON.stringify(doc.description)}`);
  lines.push(`slug: ${JSON.stringify(slug)}`);
  lines.push(`---`);
  lines.push("");

  lines.push(`## Signature`);
  lines.push("");
  lines.push("```ts");
  lines.push(doc.signature);
  lines.push("```");
  lines.push("");

  if (doc.description) {
    lines.push(mdText(doc.description));
    lines.push("");
  }
  for (const b of doc.behavior) {
    const item = mdListItem(b);
    lines.push(item);
    // A table ends at a blank line; without one the next bullet would join it.
    if (item.includes("\n")) lines.push("");
  }
  if (doc.behavior.length && lines.at(-1) !== "") lines.push("");

  if (doc.params.length) {
    lines.push(`## Parameters`);
    lines.push("");
    lines.push(refTable("parameters", renderParametersTable(doc.params)));
    lines.push("");
  }

  if (doc.options.length) {
    lines.push(`## Options`);
    lines.push("");
    for (const block of doc.options) {
      lines.push(`**${block.param}**`);
      lines.push("");
      if (block.lead) {
        lines.push(mdText(block.lead));
        lines.push("");
      }
      const typeName = block.typeName;
      if (typeName !== undefined && inOptions.includes(typeName)) {
        // A named type only this function uses: this block is where it is documented. The
        // anchor goes on the first block that shows it; the table below is its members.
        if (!documented.has(typeName)) {
          documented.add(typeName);
          const placement = usage.types.get(typeName)!.placement;
          if (placement.kind === "inline") {
            lines.push(anchorElement(placement.anchor));
            lines.push("");
          }
        }
        const typeDoc = docOf(typeName);
        if (typeDoc.description) {
          lines.push(mdText(typeDoc.description));
          lines.push("");
        }
        lines.push(...importLine(typeDoc));
      } else if (typeName !== undefined) {
        // A shared options type has a page of its own: link to it.
        const typeLink = table.typeUrl(typeName);
        if (typeLink) {
          lines.push(`Type: [${mdCodeSpan(typeName)}](${typeLink}).`);
          lines.push("");
        }
      }
      lines.push(refTable("options", renderOptionsTable(block.rows, table)));
      lines.push("");
    }
  }

  if (doc.returns || doc.returnMembers.length) {
    lines.push(`## Returns`);
    lines.push("");
    if (doc.returns) {
      lines.push(mdText(doc.returns));
      lines.push("");
    }
    if (doc.returnMembers.length) {
      // The members of the inline literal the function returns, as a named return type's
      // Members table shows its own. A bold label, not a heading: nothing links to it.
      lines.push(doc.returnsItems ? "**Members of each item**" : "**Members**");
      lines.push("");
      lines.push(
        refTable("members", renderMembersTable(doc.returnMembers, table)),
      );
      lines.push("");
    }
  }

  if (inline.length) {
    lines.push(`## Types`);
    lines.push("");
    for (const name of inline) {
      lines.push(...renderInlineType(docOf(name), table));
    }
  }

  if (related.length) {
    lines.push(`## Related types`);
    lines.push("");
    for (const t of related) {
      lines.push(`- [\`${t}\`](${table.typeUrl(t)})`);
    }
    lines.push("");
  }

  if (doc.examples.length) {
    // A function gets the interactive `<PlaygroundForm>` when its first
    // `@example` survives `buildPlaygroundFields` (`fields` present — an empty
    // array is valid, a no-arg function). The rare function that doesn't just
    // shows the static code block above with no widget.
    const useForm = doc.livePlaygroundTemplate?.fields !== undefined;

    if (useForm) {
      lines.push(
        `import PlaygroundForm from "~/components/PlaygroundForm.astro";`,
      );
    }
    lines.push(`import DstInspector from "~/components/DstInspector.astro";`);
    lines.push(
      `import IntervalVisualizer from "~/components/IntervalVisualizer.astro";`,
    );
    lines.push(
      `import ConverterBench from "~/components/ConverterBench.astro";`,
    );
    lines.push("");
    lines.push(`## Examples`);
    lines.push("");
    const ex = doc.examples[0];
    lines.push("```ts");
    lines.push(
      `import { ${doc.name} } from "${ROOT}/${doc.namespace}/${doc.module}";`,
    );
    lines.push("");
    if (ex.result.includes("\n")) {
      lines.push(ex.call);
      lines.push(ex.result);
    } else {
      lines.push(ex.call + (ex.result ? ` // ${ex.result}` : ""));
    }
    lines.push("```");
    lines.push("");
    if (useForm) {
      lines.push(`<PlaygroundForm specId="${doc.name}" />`);
      lines.push("");
    }

    const widget = EXAMPLE_WIDGETS[doc.name];
    if (widget) {
      lines.push(`### ${widget.heading}`);
      lines.push("");
      lines.push(widget.tag);
      lines.push("");
    }
  }

  lines.push(`## Source`);
  lines.push("");
  lines.push(`[${doc.sourcePath}](${src})`);
  lines.push("");

  return lines.join("\n");
}

/** The page of a shared type: one that two or more public functions reach. */
export function renderType(doc: TypeDoc, page: PageContext): string {
  const { usage } = page;
  const src = `${GH_BASE}/${doc.sourcePath}`;
  const table: TableContext = { typeUrl: (name) => typeUrl(usage, name) };
  const used = [...(usage.types.get(doc.name)?.usedBy ?? [])]
    .map((key) => ({ key, name: key.split("/").pop()! }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));

  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`title: ${JSON.stringify(doc.name)}`);
  lines.push(`description: ${JSON.stringify(doc.description)}`);
  lines.push(`slug: ${JSON.stringify(typePageSlug(doc.name))}`);
  lines.push(`---`);
  lines.push("");

  if (doc.description) {
    lines.push(mdText(doc.description));
    lines.push("");
  }

  lines.push(...importLine(doc));

  if (doc.members.length) {
    lines.push(`## Members`);
    lines.push("");
    lines.push(refTable("members", renderMembersTable(doc.members, table)));
    lines.push("");
  }

  lines.push(`## Definition`);
  lines.push("");
  lines.push("```ts");
  lines.push(doc.definition);
  lines.push("```");
  lines.push("");

  if (used.length) {
    lines.push(`## Used by`);
    lines.push("");
    for (const { key, name } of used) {
      lines.push(`- [\`${name}\`](${functionUrl(key)})`);
    }
    lines.push("");
  }

  lines.push(`## Source`);
  lines.push("");
  lines.push(`[${doc.sourcePath}](${src})`);
  lines.push("");

  return lines.join("\n");
}

function renderRegex(doc: RegexDoc): string {
  const slug = pageSlug(doc.namespace, doc.module, doc.name);
  const ip = ROOT;
  const src = `${GH_BASE}/${doc.sourcePath}`;

  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`title: ${JSON.stringify(doc.name)}`);
  lines.push(`description: ${JSON.stringify(doc.description)}`);
  lines.push(`slug: ${JSON.stringify(slug)}`);
  lines.push(`---`);
  lines.push("");
  lines.push("```ts");
  lines.push(`const ${doc.name}: RegExp = ${doc.pattern};`);
  lines.push("```");
  lines.push("");
  if (doc.description) {
    lines.push(mdText(doc.description));
    lines.push("");
  }
  if (doc.examples.length) {
    lines.push(`## Examples`);
    lines.push("");
    lines.push("```ts");
    lines.push(`import { ${doc.name} } from "${ip}";`);
    lines.push("```");
    lines.push("");
    lines.push("```ts");
    for (const ex of doc.examples) {
      lines.push(`${ex.call} // ${ex.result}`);
    }
    lines.push("```");
    lines.push("");
  }
  lines.push(`## Source`);
  lines.push("");
  lines.push(`[${doc.sourcePath}](${src})`);
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Sidebar generation
// ---------------------------------------------------------------------------

interface SymbolEntry {
  name: string;
  slug: string;
  /** Documented but not in the newest published release: badged in the sidebar. */
  unreleased?: boolean;
}

/** The text of the divider that separates the industry namespaces from the general ones. */
export const INDUSTRY_DIVIDER_LABEL = "By industry";
/** The attribute that marks the divider entry for `SidebarSublist.astro`. */
export const INDUSTRY_DIVIDER_ATTR = "data-gmt-divider";

/**
 * Build a Starlight sidebar array from symbol entries grouped by namespace.
 *
 * Rules:
 * - An `Overview` link to `/reference/` comes first.
 * - One top-level group per general namespace, `collapsed: true`, opening with an `Overview`
 *   link to the namespace's index page. Module groups get no such link.
 * - One flat `types` group: `Overview`, then every shared type, alphabetical. A type
 *   documented on its function's page is not in the sidebar.
 * - Then a divider entry reading `By industry` (a link entry with `data-gmt-divider`, drawn as
 *   a label by the `SidebarSublist` override, not a link), followed by the namespace group of
 *   each industry in `industries`, in the order given, as siblings of the general groups.
 *   Each industry's Overview link carries `data-gmt-industry`, which the stylesheet reads to
 *   draw the industry's icon beside the group's label (Starlight's groups take no icon).
 * - Modules with ≥ 2 symbols → nested collapsible group.
 * - Modules with exactly 1 symbol → hoisted directly into the namespace
 *   group (no module-wrapper accordion).
 * - Ordering inside a namespace: multi-symbol module groups first (alpha),
 *   then hoisted single-symbol items (alpha by symbol name).
 *
 * `industries` is the namespaces that are industries; one with no symbols is left out.
 */
export function buildSidebar(
  moduleSymbols: Map<string, SymbolEntry[]>,
  sharedTypes: readonly SymbolEntry[] = [],
  industries: readonly string[] = [],
): string {
  const item = (sym: SymbolEntry) =>
    sym.unreleased
      ? `{ slug: "${sym.slug}", badge: ${UNRELEASED_BADGE} }`
      : `{ slug: "${sym.slug}" }`;
  /* Groups start collapsed, so a group whose every page is unreleased (a new
     namespace) carries the badge too, or nobody sees it until they expand it. */
  const groupBadge = (syms: readonly SymbolEntry[]) =>
    syms.length > 0 && syms.every((s) => s.unreleased)
      ? `badge: ${UNRELEASED_BADGE}, `
      : "";

  // Group symbols by namespace
  const byNs = new Map<string, Map<string, SymbolEntry[]>>();
  for (const [key, syms] of moduleSymbols) {
    const [ns, mod] = key.split("/");
    if (!byNs.has(ns)) byNs.set(ns, new Map());
    byNs.get(ns)!.set(mod, syms);
  }

  const lines: string[] = [];
  lines.push("// GENERATED FILE — do not edit by hand.");
  lines.push("// Produced by apps/dox/scripts/build-reference.ts.");
  lines.push(
    'import type { StarlightUserConfig } from "@astrojs/starlight/types";',
  );
  lines.push("");
  lines.push(
    'type SidebarItem = NonNullable<StarlightUserConfig["sidebar"]>[number];',
  );
  lines.push("");
  lines.push("export const referenceSidebar: SidebarItem[] = [");
  const overview = (slug: string, attrs = "") =>
    `{ label: "Overview", slug: "${slug}"${attrs} }`;
  lines.push(`  ${overview("reference")},`);

  /** One namespace's group, `depth` levels in (a top-level group is 1). */
  const namespaceGroup = (ns: string, depth: number, industry: boolean) => {
    const pad = (n: number) => "  ".repeat(depth + n);
    const mods = byNs.get(ns)!;
    // Split into multi-symbol modules and single-symbol hoisted items
    const multiMod: Array<{ mod: string; syms: SymbolEntry[] }> = [];
    const singleSyms: SymbolEntry[] = [];

    for (const [mod, syms] of mods) {
      if (syms.length >= 2) {
        multiMod.push({ mod, syms });
      } else if (syms.length === 1) {
        singleSyms.push(syms[0]);
      }
    }

    multiMod.sort((a, b) => a.mod.localeCompare(b.mod));
    singleSyms.sort((a, b) => a.name.localeCompare(b.name));

    lines.push(`${pad(0)}{`);
    lines.push(`${pad(1)}label: ${JSON.stringify(ns)},`);
    const nsBadge = groupBadge([...mods.values()].flat());
    if (nsBadge) lines.push(`${pad(1)}${nsBadge.trim()}`);
    lines.push(`${pad(1)}collapsed: true,`);
    lines.push(`${pad(1)}items: [`);
    lines.push(
      `${pad(2)}${overview(
        `reference/${ns}`,
        industry
          ? `, attrs: { "data-gmt-industry": ${JSON.stringify(ns)} }`
          : "",
      )},`,
    );

    // Multi-symbol module groups first
    for (const { mod, syms } of multiMod) {
      const sortedSyms = [...syms].sort((a, b) => a.name.localeCompare(b.name));
      lines.push(`${pad(2)}{`);
      lines.push(`${pad(3)}label: ${JSON.stringify(mod)},`);
      const modBadge = groupBadge(syms);
      if (modBadge) lines.push(`${pad(3)}${modBadge.trim()}`);
      lines.push(`${pad(3)}collapsed: true,`);
      lines.push(`${pad(3)}items: [`);
      for (const sym of sortedSyms) {
        lines.push(`${pad(4)}${item(sym)},`);
      }
      lines.push(`${pad(3)}],`);
      lines.push(`${pad(2)}},`);
    }

    // Then hoisted single-symbol items
    for (const sym of singleSyms) {
      lines.push(`${pad(2)}${item(sym)},`);
    }

    lines.push(`${pad(1)}],`);
    lines.push(`${pad(0)}},`);
  };

  // The shared types are one flat group, sorted among the general namespaces.
  // `runGeneration` refuses a function or regex in a `types` namespace, so the name is free.
  const sortedTypes = [...sharedTypes].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const industryNs = industries.filter((ns) => byNs.has(ns));
  const groups = new Set(
    [...byNs.keys()].filter((ns) => !industryNs.includes(ns)),
  );
  if (sortedTypes.length > 0) groups.add(TYPES_SECTION);

  for (const ns of [...groups].sort()) {
    if (ns === TYPES_SECTION && sortedTypes.length > 0) {
      lines.push("  {");
      lines.push(`    label: ${JSON.stringify(TYPES_SECTION)},`);
      const typesBadge = groupBadge(sortedTypes);
      if (typesBadge) lines.push(`    ${typesBadge.trim()}`);
      lines.push("    collapsed: true,");
      lines.push("    items: [");
      lines.push(`      ${overview(`reference/${TYPES_SECTION}`)},`);
      for (const sym of sortedTypes) lines.push(`      ${item(sym)},`);
      lines.push("    ],");
      lines.push("  },");
      continue;
    }
    namespaceGroup(ns, 1, false);
  }

  if (industryNs.length > 0) {
    // A divider, not a group: nothing to open. Starlight's sidebar knows only links and
    // groups, so it is a link entry the `SidebarSublist` override draws as a labelled
    // list (src/components/SidebarSublist.astro). The industries follow as siblings.
    lines.push(
      `  { label: ${JSON.stringify(INDUSTRY_DIVIDER_LABEL)}, link: "#by-industry", attrs: { "${INDUSTRY_DIVIDER_ATTR}": "true" } },`,
    );
    for (const ns of industryNs) namespaceGroup(ns, 1, true);
  }

  lines.push("];\n");
  return lines.join("\n");
}

/**
 * Add `industries: [<id>]` to a page's frontmatter, which `PageTitle.astro` shows as the
 * industry tag under the title. No industry: the page is returned unchanged.
 */
export function withIndustry(
  mdx: string,
  industry: string | undefined,
): string {
  if (!industry) return mdx;
  const close = mdx.indexOf("\n---\n", 4);
  if (!mdx.startsWith("---\n") || close < 0) {
    throw new Error("[reference] a page has no frontmatter to tag.");
  }
  return `${mdx.slice(0, close)}\nindustries: [${industry}]${mdx.slice(close)}`;
}

/**
 * The industry a shared type's page is tagged with: the namespace every public function
 * that reaches the type belongs to, when that is one industry namespace. A type any general
 * function reaches, or two industries share, is general and has no tag.
 */
export function typeIndustry(
  usedBy: readonly string[],
  industries: readonly string[],
): string | undefined {
  const namespaces = new Set(usedBy.map((key) => key.split("/")[0]!));
  if (namespaces.size !== 1) return undefined;
  const [ns] = [...namespaces];
  return industries.includes(ns!) ? ns : undefined;
}

/** What the root page and an industry's overview say about each industry. */
function industryIndex(): IndexedIndustry[] {
  return INDUSTRY_LAYER_IDS.map((id) => {
    const tag = industryTag(id);
    const overview = INDUSTRY_OVERVIEWS[id];
    if (!tag || !overview) {
      throw new Error(
        `[reference] the industry layer ${id} has no tag or no overview text. Add it to src/lib/industry-tags.ts and src/lib/industry-overview.ts.`,
      );
    }
    return {
      id,
      label: tag.label,
      definition: tag.definition,
      icon: tag.icon,
      guide: tag.guide,
      guideTitle: overview.guideTitle,
      about: overview.about,
      solves: overview.solves,
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Content hash of every input, recorded after a successful generation. Unchanged inputs
 * skip the TypeScript program entirely — a hash, not mtimes, so a checkout, formatter or
 * `touch` that leaves the bytes alone does not cost a regeneration.
 */
const inputsStamp = join(outGen, ".inputs-hash");

function main() {
  const outputs = [
    join(outGen, "gmt-corpus.json"),
    join(outGen, "route-manifest.ts"),
    join(outGen, "corpus.ts"),
    join(outGen, "live-playground-templates.ts"),
    join(outGen, "sidebar.ts"),
    outRedirects,
  ];
  /* The newest published tag decides which pages are badged Unreleased. It is
     part of the hash so a release, which pushes a tag and changes no source,
     still regenerates. */
  const baseline = releasedBaseline(repoRoot);
  if ("none" in baseline) {
    console.log(
      `[reference] no published gmt tag (${baseline.none}); no Unreleased badges`,
    );
  }
  const hash = `${hashFiles(referenceInputs())}|${baselineKey(baseline)}`;
  // The MDX tree is gitignored, so a fresh checkout (or a manual `rm -rf`) can
  // leave the generated modules in place while this directory is gone.
  const upToDate =
    outputs.every((out) => existsSync(out)) &&
    existsSync(outMdx) &&
    findMdx(outMdx).length > 0 &&
    existsSync(inputsStamp) &&
    readFileSync(inputsStamp, "utf8") === hash;

  if (upToDate) {
    console.log("[reference] outputs up-to-date, skipping");
    return;
  }
  runGeneration(baseline);
  writeIfChanged(inputsStamp, hash);
}

/**
 * Every file whose content can change the generated output: all non-test gmt source
 * outside `src/test/` (internal modules included — the checker resolves the types they declare), the
 * `exports` map `publicDeclarations` reads, and the generator itself, so changing how a
 * page is emitted invalidates the output just as changing the source does.
 */
function referenceInputs(): string[] {
  const source = allSourceFiles(gmtSrc);
  return [
    ...source,
    resolve(gmtSrc, "..", "package.json"),
    fileURLToPath(import.meta.url),
    resolve(appRoot, "scripts", "build-utils", "build-utils.ts"),
    resolve(appRoot, "scripts", "build-utils", "doc-gate.ts"),
    resolve(appRoot, "scripts", "build-utils", "index-pages.ts"),
    resolve(appRoot, "scripts", "build-utils", "null-is-empty.ts"),
    resolve(appRoot, "scripts", "build-utils", "redirects.ts"),
    resolve(appRoot, "scripts", "build-utils", "renamed-functions.ts"),
    resolve(appRoot, "scripts", "build-utils", "reference-urls.ts"),
    resolve(appRoot, "scripts", "build-utils", "released-exports.ts"),
    resolve(appRoot, "scripts", "build-utils", "render-table.ts"),
    resolve(appRoot, "scripts", "build-utils", "type-usage.ts"),
    resolve(appRoot, "src", "lib", "playground-parsers.ts"),
    // The industry namespaces, their tags and the text of their overview pages.
    resolve(appRoot, "src", "lib", "industry-tags.ts"),
    resolve(appRoot, "src", "lib", "industry-overview.ts"),
    resolve(appRoot, "src", "data", "gmt-stats.json"),
  ];
}

function allSourceFiles(dir: string): string[] {
  return listFiles(dir, isSourceFile, (name) => name === "test");
}

function findMdx(dir: string): string[] {
  return listFiles(dir, (name) => name.endsWith(".mdx"));
}

export const REFERENCE_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowJs: false,
  skipLibCheck: true,
  noEmit: true,
  strict: false,
  // Without it the checker erases `null` and `undefined` from every type, so a signature
  // written `): number | null` would read `): number` on the reference page.
  strictNullChecks: true,
  // An optional property reads `T`, not `T | undefined`, inside an inline options type too.
  exactOptionalPropertyTypes: true,
};

/** True when a type annotation lists `undefined` as one of its own union members. */
function writesUndefined(node: ts.TypeNode): boolean {
  if (ts.isParenthesizedTypeNode(node)) return writesUndefined(node.type);
  if (ts.isUnionTypeNode(node)) return node.types.some(writesUndefined);
  return node.kind === ts.SyntaxKind.UndefinedKeyword;
}

/** True when a parameter (`?` or a default) or a property (`?`) is declared optional. */
function declaresOptional(decl: ts.Declaration): boolean {
  if (ts.isParameter(decl)) {
    return decl.questionToken !== undefined || decl.initializer !== undefined;
  }
  return (
    (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl)) &&
    decl.questionToken !== undefined
  );
}

/**
 * `typeToString` for a declared parameter or property, without the `| undefined` the checker adds
 * to an optional one (`x?: string` reads `string | undefined` under `strictNullChecks`). The `?`
 * already says it, and the source never wrote it. An `undefined` written in the declared type is
 * kept.
 */
export function declaredTypeString(
  checker: ts.TypeChecker,
  type: ts.Type,
  decl: ts.Declaration | undefined,
): string {
  const text = checker.typeToString(
    type,
    undefined,
    ts.TypeFormatFlags.NoTruncation,
  );
  if (!decl || !declaresOptional(decl)) return text;
  const typeNode = (decl as ts.ParameterDeclaration | ts.PropertySignature)
    .type;
  if (typeNode && writesUndefined(typeNode)) return text;
  return text.replace(/ \| undefined$/, "");
}

/** Everything one pass over the gmt source yields: the docs, and who uses which type. */
export interface ReferenceExtraction {
  /** One doc per public function, type and regex, in source order. */
  docs: Doc[];
  usage: TypeUsage;
}

/**
 * The single extraction: build the program, find the public declarations, build the usage
 * graph, and extract a doc for every public function, type and regex. `runGeneration` and
 * `scripts/check-reference-docs.ts` both call it, so the gate reports on exactly what the
 * pages are built from. It writes nothing.
 */
export function extractReference(): ReferenceExtraction {
  const files = walk(gmtSrc).sort();
  const program = ts.createProgram(files, REFERENCE_COMPILER_OPTIONS);
  const checker = program.getTypeChecker();
  const publicDecls = publicDeclarations(program, checker);

  // Pass 1: the usage graph, over public declarations only, so a page never links to a type
  // that has no documentation.
  const entries = publicEntries(program, files, publicDecls);
  const usage = buildTypeUsage(checker, entries.functions, entries.types);
  const ctx: ExtractContext = {
    program,
    publicTypes: publicTypeIndex(entries.types),
    importPaths: publicImportPaths(program, checker),
  };

  // Pass 2: extract docs
  const allDocs: ExtractedDoc[] = [];
  for (const file of files) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;
    allDocs.push(...extractFromFile(checker, file, sf, publicDecls, ctx));
  }

  const docs = dedupeDocs(allDocs);

  const functions = new Map<string, FnDoc>();
  for (const d of docs) {
    if (d.kind !== "function") continue;
    d.relatedTypes = usage.reach.get(fnKey(d)) ?? [];
    functions.set(fnKey(d), d);
  }

  // An inline type's anchor depends on every heading of the page above it, so it is set
  // here, once the pages' sections are known, and not by the graph.
  assignInlineAnchors(usage, (key, inline) => {
    const doc = functions.get(key);
    return doc ? fnHeadings(doc, usage) : { headings: inline, at: 0 };
  });

  return { docs, usage };
}

/** The extraction as the documentation gate reads it. */
export function gateInput(extraction: ReferenceExtraction): GateInput {
  const { docs, usage } = extraction;
  const input: GateInput = { functions: [], types: [] };
  for (const d of docs) {
    const file = `packages/gmt/src/${d.sourcePath}`;
    if (d.kind === "function") {
      input.functions.push({
        name: d.name,
        namespace: d.namespace,
        file,
        line: d.line,
        declaredParams: d.declaredParams,
        documentedParams: d.documentedParams,
        options: d.options,
        returnMembers: d.returnMembers,
        returnsItems: d.returnsItems,
      });
    } else if (d.kind === "type") {
      input.types.push({
        name: d.name,
        namespace: d.namespace,
        file,
        line: d.line,
        description: d.description,
        members: d.members,
        input: usage.types.get(d.name)?.input ?? false,
        orphan: usage.orphans.includes(d.name),
      });
    }
  }
  return input;
}

/**
 * Refuse a public type no public function reaches. It has nowhere to be documented: it is on
 * no function's page, and no function's reader would ever be sent to a page of its own.
 * Either a public function should take or return it, or it should not be exported. One
 * error names every such type and its file.
 */
export function refuseOrphans(usage: TypeUsage, docs: readonly Doc[]): void {
  if (usage.orphans.length === 0) return;
  const where = new Map(
    docs.flatMap((d) =>
      d.kind === "type"
        ? [[d.name, `packages/gmt/src/${d.sourcePath}`] as const]
        : [],
    ),
  );
  const named = [...usage.orphans]
    .sort()
    .map((name) => `${name} (${where.get(name) ?? "unknown file"})`);
  throw new Error(
    `[reference] public types no public function reaches: ${named.join(", ")}. Use each in a public signature, or stop exporting it from packages/gmt/src.`,
  );
}

/** Refuse two routes that differ only by case: on macOS and Windows they are one file. */
export function refuseCaseClash(routes: readonly string[]): void {
  const byFolded = new Map<string, string>();
  for (const url of routes) {
    const clash = byFolded.get(url.toLowerCase());
    if (clash !== undefined) {
      throw new Error(
        `[reference] two pages would share one file on a case-insensitive filesystem: ${clash} and ${url}. Rename one of them.`,
      );
    }
    byFolded.set(url.toLowerCase(), url);
  }
}

function runGeneration(baseline: ReleasedBaseline) {
  const extraction = extractReference();
  const { docs: dedupedDocs, usage } = extraction;

  refuseOrphans(usage, dedupedDocs);

  const typeDocs = new Map<string, TypeDoc>();
  for (const d of dedupedDocs) if (d.kind === "type") typeDocs.set(d.name, d);
  const page: PageContext = { usage, typeDocs };

  // `/reference/types/` is the flat section of shared types. A function or regex whose source
  // sits in a `types` namespace would need a module level under the same path.
  const misplaced = dedupedDocs.filter(
    (d) => d.kind !== "type" && d.namespace === TYPES_SECTION,
  );
  if (misplaced.length > 0) {
    throw new Error(
      `[reference] /reference/${TYPES_SECTION}/ holds shared types only, but packages/gmt/src/${TYPES_SECTION} exports: ${misplaced.map((d) => d.name).join(", ")}. Move them to another namespace.`,
    );
  }

  // The gate owns missing docs: a gap fails the build before anything is written, so no page
  // ships with an empty description or default. `pnpm dox:docs-check` prints the same list.
  const gaps = findGaps(gateInput(extraction));
  if (gaps.length > 0) {
    throw new Error(
      `[reference] ${gaps.length} documentation gap${gaps.length === 1 ? "" : "s"} (context/jsdoc-standards.md § Options and members):\n${formatGapReport(gaps)}`,
    );
  }

  // Every page this run emits, keyed by its path under `outMdx`. `syncTree` writes only the
  // ones that changed and deletes the rest (barrel pages, renamed/removed exports), so an
  // unchanged regeneration leaves the tree — and every watcher on it — alone.
  const pages = new Map<string, string>();
  /** The route of every page in `pages`. */
  const pageRoutes: string[] = [];

  const moduleSymbols = new Map<string, SymbolEntry[]>();
  const sharedTypes: SymbolEntry[] = [];
  /** The industry namespaces, whose pages carry the industry tag. */
  const industryLayers = INDUSTRY_LAYER_IDS;
  const industryOf = (namespace: string) =>
    industryLayers.includes(namespace) ? namespace : undefined;

  for (const doc of dedupedDocs) {
    const unreleased = isUnreleased(baseline, doc.name);
    const withNote = (mdx: string) =>
      unreleased && "tag" in baseline
        ? insertAfterFrontmatter(mdx, unreleasedNote(baseline.version))
        : mdx;

    if (doc.kind === "type") {
      // A single-use type has no page: its function's page documents it.
      if (usage.types.get(doc.name)?.placement.kind !== "page") continue;
      // Tagged only when every function that reaches the type is in one industry namespace.
      const typeTag = typeIndustry(
        usage.types.get(doc.name)?.usedBy ?? [],
        industryLayers,
      );
      pages.set(
        join(TYPES_SECTION, `${doc.name}.mdx`),
        withIndustry(withNote(renderType(doc, page)), typeTag),
      );
      pageRoutes.push(typePageUrl(doc.name));
      sharedTypes.push({
        name: doc.name,
        slug: typePageSlug(doc.name),
        unreleased,
      });
      continue;
    }

    let mdx: string;
    if (doc.kind === "function") {
      mdx = renderFn(doc, page);
      // The anchors of the page's inline types were computed from `fnHeadings`. If the page
      // emits different headings, those anchors point at the wrong place.
      const emitted = mdxHeadings(mdx);
      const layout = fnHeadings(doc, usage);
      const expected = layout.headings;
      if (emitted.join("\n") !== expected.join("\n")) {
        throw new Error(
          `[reference] ${fnKey(doc)} emits the headings [${emitted.join(", ")}] but fnHeadings lists [${expected.join(", ")}]. Keep fnHeadings in step with renderFn.`,
        );
      }
      // Every id on the page once, and every inline type's anchor among them.
      const ids = mdxIds(mdx);
      const wanted = inlineTypesOf(usage, fnKey(doc)).map((name) => {
        const placement = usage.types.get(name)!.placement;
        return placement.kind === "inline" ? placement.anchor : "";
      });
      const missing = wanted.filter((id) => !ids.includes(id));
      const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
      if (missing.length > 0 || repeated.length > 0) {
        throw new Error(
          `[reference] ${fnKey(doc)} must carry each inline type's anchor once: missing [${missing.join(", ")}], repeated [${repeated.join(", ")}].`,
        );
      }
    } else {
      mdx = renderRegex(doc);
    }

    pages.set(
      join(doc.namespace, doc.module, `${doc.name}.mdx`),
      withIndustry(withNote(mdx), industryOf(doc.namespace)),
    );
    pageRoutes.push(pageUrl(doc.namespace, doc.module, doc.name));

    // collect for sidebar
    const key = `${doc.namespace}/${doc.module}`;
    if (!moduleSymbols.has(key)) moduleSymbols.set(key, []);
    moduleSymbols.get(key)!.push({
      name: doc.name,
      slug: pageSlug(doc.namespace, doc.module, doc.name),
      unreleased,
    });
  }

  // Two pages whose paths differ only by case (a `dwellTime` function beside a `DwellTime`
  // regex) are one file on a case-insensitive filesystem, so one page silently overwrites the
  // other and the sidebar then points at a slug that does not exist. Refuse before anything
  // is written: the fix is a rename in `packages/gmt/src`.
  // The index pages: the root, the types section, each namespace and each module.
  const indexed = {
    pages: [] as IndexedPage[],
    sharedTypes: [] as IndexedType[],
    inlineTypes: [] as IndexedInlineType[],
    industries: industryIndex(),
  } satisfies IndexInput;
  for (const d of dedupedDocs) {
    if (d.kind !== "type") {
      indexed.pages.push({
        namespace: d.namespace,
        module: d.module,
        name: d.name,
        url: pageUrl(d.namespace, d.module, d.name),
        description: d.description,
      });
      continue;
    }
    const placement = usage.types.get(d.name)!.placement;
    const entry = {
      name: d.name,
      url: typeUrl(usage, d.name)!,
      description: d.description,
    };
    if (placement.kind === "page") {
      indexed.sharedTypes.push(entry);
    } else {
      // Listed under the module of the function whose page holds it.
      const [namespace, module] = placement.owner.split("/");
      indexed.inlineTypes.push({ ...entry, namespace, module });
    }
  }
  const indexPages = renderIndexPages(indexed);
  for (const index of indexPages) {
    pages.set(join(...index.file.split("/")), index.mdx);
  }
  // An index route is every proper prefix of a page route, which is how
  // `scripts/api-surface.mjs` derives them too. Anything else is a page with no index above
  // it, or an index with no page under it.
  const expectedIndexes = indexRoutes(pageRoutes);
  const emittedIndexes = indexPages.map((p) => p.route).sort();
  if (expectedIndexes.join("\n") !== emittedIndexes.join("\n")) {
    throw new Error(
      `[reference] the index pages [${emittedIndexes.join(", ")}] are not the prefixes of the page routes [${expectedIndexes.join(", ")}].`,
    );
  }

  const routes = [...pageRoutes, ...emittedIndexes].sort();
  refuseCaseClash(routes);

  const pageChanges = syncTree(outMdx, pages);

  // Write generated sidebar
  const sidebarMd = buildSidebar(moduleSymbols, sharedTypes, industryLayers);
  writeIfChanged(join(outGen, "sidebar.ts"), sidebarMd);

  // Write artifacts

  // 1. corpus: one entry per public function, type and regex, whether or not it has a page of
  // its own.
  const corpus = dedupedDocs.map((d) => {
    const placement =
      d.kind === "type" ? usage.types.get(d.name)?.placement : undefined;
    const own = pageUrl(d.namespace, d.module, d.name);
    return {
      // The canonical link. For a type on a function's page it carries the anchor.
      url: d.kind === "type" ? (typeUrl(usage, d.name) ?? own) : own,
      // The route that serves it: never a fragment.
      page: d.kind === "type" ? (typeRoute(usage, d.name) ?? own) : own,
      name: d.name,
      namespace: d.namespace,
      module: d.module,
      kind: d.kind,
      signature: d.kind === "function" ? d.signature : "",
      description: d.description,
      sourcePath: `packages/gmt/src/${d.sourcePath}`,
      // DOX-C1 (#137): retrieval chunks need real examples, not just a
      // signature + one-line description. `TypeDoc` carries no `examples`
      // field at all (types have no @example tags); function and regex docs
      // both do.
      examples: d.kind === "type" ? [] : d.examples,
      ...(placement?.kind === "inline"
        ? { inlineOn: placement.owner.split("/").pop()! }
        : {}),
      // Lib-declared members carry no description of ours and are folded into one row on the
      // page, so they are left out here too.
      ...(d.kind === "type" && d.members.some((m) => !m.fromLib)
        ? {
            members: flattenRows(d.members)
              .filter((m) => !m.fromLib)
              .map((m) => ({ name: m.name, description: m.description })),
          }
        : {}),
    };
  });
  writeIfChanged(
    join(outGen, "gmt-corpus.json"),
    JSON.stringify(corpus, null, 2) + "\n",
  );

  // 2. route manifest: every route that serves a page, each once, index pages included. An
  // inline type shares its function's route.
  const manifestTs = `// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/build-reference.ts (\`pnpm dox:generate\`).
import type { RouteManifest } from "~/reference-types";

export const referenceRoutes: RouteManifest = new Set([
${routes.map((r) => `  ${JSON.stringify(r)},`).join("\n")}
]);
`;
  writeIfChanged(join(outGen, "route-manifest.ts"), manifestTs);

  // 3. redirects: the old URL of every type, to its page or to its anchor, and of every
  // renamed function.
  writeIfChanged(
    outRedirects,
    buildRedirects(
      dedupedDocs.filter((d) => d.kind === "type"),
      usage,
      RENAMED_FUNCTIONS,
    ),
  );

  // 4. corpus.ts wrapper
  const corpusTs = `// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/build-reference.ts (\`pnpm dox:generate\`).
import type { CorpusEntry } from "~/reference-types";
import data from "./gmt-corpus.json";

export const corpus: CorpusEntry[] = data as CorpusEntry[];
`;
  writeIfChanged(join(outGen, "corpus.ts"), corpusTs);

  // 5. live playground templates — one template per function.
  const templatesRecord: Record<string, LivePlaygroundTemplate> = {};
  for (const d of dedupedDocs) {
    if (d.kind === "function" && d.livePlaygroundTemplate) {
      templatesRecord[d.name] = d.livePlaygroundTemplate;
    }
  }
  const staleNullIsEmpty = [...NULL_IS_EMPTY.keys()].filter(
    (name) => !templatesRecord[name]?.nullIsEmpty,
  );
  if (staleNullIsEmpty.length > 0) {
    throw new Error(
      `[reference] NULL_IS_EMPTY names functions with no playground: ${staleNullIsEmpty.join(", ")}. Rename or remove them in scripts/build-utils/null-is-empty.ts.`,
    );
  }
  const templatesTs = `// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/build-reference.ts (\`pnpm dox:generate\`).
import type { LivePlaygroundTemplate } from "../../lib/playground-spec";

export const LIVE_PLAYGROUND_TEMPLATES: Record<string, LivePlaygroundTemplate> = ${JSON.stringify(
    templatesRecord,
    null,
    2,
  )};
`;
  writeIfChanged(join(outGen, "live-playground-templates.ts"), templatesTs);

  console.log(
    `[reference] ${pages.size} pages (${pageChanges.written} written, ${pageChanges.removed} removed), ${routes.length} routes, ${corpus.length} corpus entries, ${Object.keys(templatesRecord).length} live playground templates`,
  );
}

// Generate only when run as a script. A test that imports this module for its
// helpers must not regenerate (and delete) the MDX tree another test reads.
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) main();
