#!/usr/bin/env node
/**
 * Build the docs-site reference corpus and MDX pages from `gmt` source JSDoc.
 *
 * Walks the gmt src tree with the TypeScript compiler API, extracts every
 * exported function/const/type, and emits — from a single extraction pass so
 * the four artifacts cannot drift:
 *   1. src/generated/reference/gmt-corpus.json  — CorpusEntry[]
 *   2. src/generated/reference/route-manifest.ts — ReadonlySet<string>
 *   3. src/generated/reference/widget-seeds.ts  — WidgetSeed[]
 *   4. content/docs/reference MDX            - one page per export + module indexes
 *
 * Run as: node apps/dox/scripts/build-reference.ts
 * Generated MDX + src/generated/* are gitignored and produced by a prebuild step.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const repoRoot = resolve(appRoot, "..", "..");
const gmtSrc = resolve(repoRoot, "packages", "gmt", "src");
const outMdx = resolve(appRoot, "src", "content", "docs", "reference");
const outGen = resolve(appRoot, "src", "generated", "reference");

const SKIP_DIRS = ["test", "internal"];
const SKIP_EXTS = [".test.ts", ".spec.ts"];
const GH_BASE = "https://github.com/northguild/gmt/blob/main/packages/gmt/src";

// ---------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      out.push(...walk(full));
    } else if (entry.isFile()) {
      if (!entry.name.endsWith(".ts")) continue;
      if (SKIP_EXTS.some((s) => entry.name.endsWith(s))) continue;
      out.push(full);
    }
  }
  return out;
}

function namespaceModule(file: string): { namespace: string; module: string } {
  const rel = relative(gmtSrc, file).split("/");
  const ns = rel[0].replace(/\.ts$/, "");
  const mod = rel.length > 1 ? rel[1].replace(/\.ts$/, "") : ns;
  return { namespace: ns, module: mod };
}

/**
 * Root-absolute page path. Used for every in-page link (module indexes,
 * "Related types", "Used by") and for the URL field in the corpus, route
 * manifest, and widget seeds. Must start with `/` — a bare-relative
 * `reference/...` link resolves against the current page's directory and
 * doubles the path (e.g. from `/reference/utc/calculate/` you land on
 * `/reference/utc/calculate/reference/utc/calculate/addUtc`).
 */
function pageUrl(ns: string, mod: string, name: string): string {
  return `/reference/${ns}/${mod}/${name}`;
}

/** Starlight `slug:` frontmatter — relative, no leading slash. */
function pageSlug(ns: string, mod: string, name: string): string {
  return `reference/${ns}/${mod}/${name}`;
}

function importPath(ns: string, mod: string): string {
  return `@northguild/gmt/${ns}/${mod}`;
}

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

interface FnDoc {
  name: string;
  namespace: string;
  module: string;
  kind: "function";
  signature: string;
  description: string;
  behavior: string[];
  params: ParamDoc[];
  options: ParamDoc[];
  returns: string;
  examples: Example[];
  relatedTypes: string[];
  sourcePath: string;
}

interface TypeDoc {
  name: string;
  namespace: string;
  module: string;
  kind: "type";
  definition: string;
  description: string;
  members: ParamDoc[];
  isColocated: boolean;
  sourcePath: string;
}

interface RegexDoc {
  name: string;
  namespace: string;
  module: string;
  kind: "regex";
  pattern: string;
  description: string;
  examples: Example[];
  sourcePath: string;
}

type Doc = FnDoc | TypeDoc | RegexDoc;

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

function parseJsDoc(
  checker: ts.TypeChecker,
  node: ts.Node,
): ParsedJsDoc | undefined {
  const symbol = checker.getSymbolAtLocation(
    ts.isFunctionDeclaration(node) ? (node.name ?? node) : node,
  );
  if (!symbol) return undefined;

  const parts = symbol.getDocumentationComment(checker);
  const raw = ts.displayPartsToString(parts);
  if (!raw.trim() && symbol.getJsDocTags().length === 0) return undefined;

  const lines = raw.split("\n");
  const description = lines[0]?.trim() ?? "";
  const behavior: string[] = [];
  let cur = "";
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith("- ")) {
      if (cur) behavior.push(cur);
      cur = l.slice(2);
    } else if (l) {
      cur = cur ? `${cur} ${l}` : l;
    }
  }
  if (cur) behavior.push(cur);

  const params: ParamDoc[] = [];
  let returns = "";
  const examples: Example[] = [];

  for (const tag of symbol.getJsDocTags()) {
    const text = tag.text ? ts.displayPartsToString(tag.text) : "";
    if (tag.name === "param") {
      const m = text.match(/^(\w+)\s+([\s\S]*)$/);
      if (m) {
        params.push({ name: m[1], type: "", description: m[2].trim() });
      }
    } else if (tag.name === "returns") {
      returns = text.trim();
    } else if (tag.name === "example") {
      const ex = parseExample(text);
      if (ex) examples.push(ex);
    }
  }

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

/**
 * Extract an options-object param's properties from the TS type.
 * The options param is identified by name (contains "options").
 * Returns the options list and the name of the param to remove from flat params.
 */
function extractOptions(
  checker: ts.TypeChecker,
  sig: ts.Signature,
  node: ts.Node,
  optionsDoc: string,
): { options: ParamDoc[]; removeParam: string | null } {
  const options: ParamDoc[] = [];
  let removeParam: string | null = null;
  for (const sp of sig.getParameters()) {
    if (!sp.name.toLowerCase().includes("options")) continue;
    const paramNode = sp.valueDeclaration as
      | ts.ParameterDeclaration
      | undefined;
    if (!paramNode) continue;
    const t = checker.getTypeOfSymbolAtLocation(sp, node);
    const props = t.getProperties();
    if (props.length === 0) continue;
    removeParam = sp.name;
    for (const prop of props) {
      const propType = checker.getTypeOfSymbolAtLocation(prop, node);
      const typeStr = checker.typeToString(propType);
      const defaultMatch = optionsDoc.match(
        new RegExp(`${prop.name}\\s*\\([^)]*default\\s+([^)]+)\\)`),
      );
      options.push({
        name: prop.name + (prop.flags & ts.SymbolFlags.Optional ? "?" : ""),
        type: typeStr,
        description: defaultMatch ? defaultMatch[1] : "",
      });
    }
    break;
  }
  return { options, removeParam };
}

// ---------------------------------------------------------------------------
// Regex example generation
// ---------------------------------------------------------------------------

function generateRegexExamples(pattern: string, name: string): Example[] {
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

function extractFromFile(
  checker: ts.TypeChecker,
  file: string,
  sourceFile: ts.SourceFile,
  knownTypes: Set<string>,
): { docs: Doc[]; types: string[] } {
  const { namespace: ns, module: mod } = namespaceModule(file);
  const docs: Doc[] = [];
  const types: string[] = [];

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const doc = extractFunction(checker, stmt, ns, mod, file, knownTypes);
      if (doc) docs.push(doc);
    } else if (ts.isTypeAliasDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text;
      types.push(name);
      docs.push(extractType(checker, stmt, ns, mod, file));
    } else if (ts.isInterfaceDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text;
      types.push(name);
      docs.push(extractInterface(checker, stmt, ns, mod, file));
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (isRegexInit(decl.initializer)) {
            const doc = extractRegex(checker, decl, ns, mod, file);
            if (doc) docs.push(doc);
          } else if (
            ts.isArrowFunction(decl.initializer) ||
            ts.isFunctionExpression(decl.initializer)
          ) {
            const doc = extractArrowFn(
              checker,
              decl,
              ns,
              mod,
              file,
              knownTypes,
            );
            if (doc) docs.push(doc);
          }
        }
      }
    }
  }

  return { docs, types };
}

function extractFunction(
  checker: ts.TypeChecker,
  node: ts.FunctionDeclaration,
  ns: string,
  mod: string,
  file: string,
  knownTypes: Set<string>,
): FnDoc | undefined {
  const name = node.name!.text;
  const sig = checker.getSignatureFromDeclaration(node);
  const sigStr = sig ? checker.signatureToString(sig) : "(...)";
  const signature = `${name}${sigStr}`;

  const jsDoc = parseJsDoc(checker, node);
  const description = jsDoc?.description ?? "";
  const behavior = jsDoc?.behavior ?? [];
  const params = jsDoc?.params ?? [];
  const returns = jsDoc?.returns ?? "";
  const examples = jsDoc?.examples ?? [];

  // fill param types from signature
  const sigParams = sig?.getParameters() ?? [];
  for (const p of params) {
    const sp = sigParams.find((s) => s.name === p.name);
    if (sp) {
      const t = checker.getTypeOfSymbolAtLocation(sp, node);
      p.type = checker.typeToString(t);
    }
  }

  // detect options object param via its TS type
  const options: ParamDoc[] = [];
  if (sig) {
    const optionsDoc =
      jsDoc?.params.find((p) => p.name === "options")?.description ?? "";
    const extracted = extractOptions(checker, sig, node, optionsDoc);
    options.push(...extracted.options);
    // remove the options param from flat params (JSDoc name may differ from sig name)
    const rm = extracted.removeParam;
    if (rm) {
      let idx = params.findIndex((p) => p.name === rm);
      if (idx < 0) idx = params.findIndex((p) => p.name === "options");
      if (idx < 0)
        idx = params.findIndex((p) => p.name.toLowerCase().includes("options"));
      if (idx >= 0) params.splice(idx, 1);
    }
  }

  // related types: known type names appearing in the signature string
  const relatedTypes = [...knownTypes].filter((t) => signature.includes(t));

  return {
    name,
    namespace: ns,
    module: mod,
    kind: "function",
    signature,
    description,
    behavior,
    params,
    options,
    returns,
    examples,
    relatedTypes,
    sourcePath: relative(gmtSrc, file).split("/").join("/"),
  };
}

function extractArrowFn(
  checker: ts.TypeChecker,
  decl: ts.VariableDeclaration,
  ns: string,
  mod: string,
  file: string,
  knownTypes: Set<string>,
): FnDoc | undefined {
  const name = (decl.name as ts.Identifier).text;
  const type = checker.getTypeAtLocation(decl);
  const sig = type.getCallSignatures()[0];
  const sigStr = sig ? checker.signatureToString(sig) : "(...)";
  const signature = `${name}${sigStr}`;

  const jsDoc = parseJsDoc(checker, decl);
  const description = jsDoc?.description ?? "";
  const behavior = jsDoc?.behavior ?? [];
  const params = jsDoc?.params ?? [];
  const returns = jsDoc?.returns ?? "";
  const examples = jsDoc?.examples ?? [];

  const sigParams = sig?.getParameters() ?? [];
  for (const p of params) {
    const sp = sigParams.find((s) => s.name === p.name);
    if (sp) {
      const t = checker.getTypeOfSymbolAtLocation(sp, decl);
      p.type = checker.typeToString(t);
    }
  }

  const options: ParamDoc[] = [];
  if (sig) {
    const optionsDoc =
      jsDoc?.params.find((p) => p.name === "options")?.description ?? "";
    const extracted = extractOptions(checker, sig, decl, optionsDoc);
    options.push(...extracted.options);
    const rm = extracted.removeParam;
    if (rm) {
      let idx = params.findIndex((p) => p.name === rm);
      if (idx < 0) idx = params.findIndex((p) => p.name === "options");
      if (idx < 0)
        idx = params.findIndex((p) => p.name.toLowerCase().includes("options"));
      if (idx >= 0) params.splice(idx, 1);
    }
  }

  const relatedTypes = [...knownTypes].filter((t) => signature.includes(t));

  return {
    name,
    namespace: ns,
    module: mod,
    kind: "function",
    signature,
    description,
    behavior,
    params,
    options,
    returns,
    examples,
    relatedTypes,
    sourcePath: relative(gmtSrc, file).split("/").join("/"),
  };
}

function extractType(
  checker: ts.TypeChecker,
  node: ts.TypeAliasDeclaration,
  ns: string,
  mod: string,
  file: string,
): TypeDoc {
  const name = node.name.text;
  const isColocated = ns !== "types";
  const definition = node.getText().replace(/^export\s*/, "");
  const jsDoc = parseJsDoc(checker, node);
  const lineComment = leadingLineComment(node);
  const description = jsDoc?.description ?? lineComment ?? `The ${name} type.`;

  return {
    name,
    namespace: ns,
    module: mod,
    kind: "type",
    definition,
    description,
    members: [],
    isColocated,
    sourcePath: relative(gmtSrc, file).split("/").join("/"),
  };
}

function extractInterface(
  checker: ts.TypeChecker,
  node: ts.InterfaceDeclaration,
  ns: string,
  mod: string,
  file: string,
): TypeDoc {
  const name = node.name.text;
  const isColocated = ns !== "types";
  const definition = node.getText().replace(/^export\s*/, "");
  const jsDoc = parseJsDoc(checker, node);
  const lineComment = leadingLineComment(node);
  const description = jsDoc?.description ?? lineComment ?? `The ${name} type.`;

  const members: ParamDoc[] = [];
  for (const prop of node.members) {
    if (ts.isPropertySignature(prop) && ts.isIdentifier(prop.name)) {
      const t = prop.type
        ? checker.typeToString(checker.getTypeAtLocation(prop))
        : "";
      members.push({
        name: prop.name.text + (prop.questionToken ? "?" : ""),
        type: t,
        description: "",
      });
    }
  }

  return {
    name,
    namespace: ns,
    module: mod,
    kind: "type",
    definition,
    description,
    members,
    isColocated,
    sourcePath: relative(gmtSrc, file).split("/").join("/"),
  };
}

function extractRegex(
  _checker: ts.TypeChecker,
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

  // description from leading line comment
  const sourceText = decl.getSourceFile().getFullText();
  const leading = sourceText.slice(0, decl.getFullStart());
  const commentMatch = leading.match(/\/\/\s*(.+)\s*$/m);
  const description = commentMatch ? commentMatch[1].trim() : "";

  const inner = pattern.replace(/^\/|\/$/g, "");
  const examples = generateRegexExamples(inner, name);

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
// Reverse lookup: type -> functions that use it
// ---------------------------------------------------------------------------

function buildUsedBy(docs: Doc[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const doc of docs) {
    if (doc.kind !== "function") continue;
    const url = pageUrl(doc.namespace, doc.module, doc.name);
    for (const t of doc.relatedTypes) {
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(url);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// MDX generation
// ---------------------------------------------------------------------------

function renderFn(doc: FnDoc, docs: Doc[]): string {
  const slug = pageSlug(doc.namespace, doc.module, doc.name);
  const ip = importPath(doc.namespace, doc.module);
  const src = `${GH_BASE}/${doc.sourcePath}`;

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
  lines.push("```ts");
  lines.push(`import { ${doc.name} } from "${ip}";`);
  lines.push("```");
  lines.push("");

  if (doc.description) {
    lines.push(escapeMd(doc.description));
    lines.push("");
  }
  for (const b of doc.behavior) {
    lines.push(`- ${escapeMd(b)}`);
  }
  if (doc.behavior.length) lines.push("");

  if (doc.params.length) {
    lines.push(`## Parameters`);
    lines.push("");
    lines.push(`| Parameter | Type | Description |`);
    lines.push(`| --- | --- | --- |`);
    for (const p of doc.params) {
      lines.push(
        `| \`${p.name}\` | \`${escapeMd(p.type)}\` | ${escapeMd(p.description)} |`,
      );
    }
    lines.push("");
  }

  if (doc.options.length) {
    lines.push(`## Options`);
    lines.push("");
    lines.push(`**options**`);
    lines.push("");
    lines.push(`| Option | Type | Default |`);
    lines.push(`| --- | --- | --- |`);
    for (const o of doc.options) {
      lines.push(`| \`${o.name}\` | \`${escapeMd(o.type)}\` | — |`);
    }
    lines.push("");
  }

  if (doc.returns) {
    lines.push(`## Returns`);
    lines.push("");
    lines.push(escapeMd(doc.returns));
    lines.push("");
  }

  if (doc.relatedTypes.length) {
    lines.push(`## Related types`);
    lines.push("");
    for (const t of doc.relatedTypes) {
      const tUrl = typeUrl(t, docs);
      lines.push(`- [\`${t}\`](${tUrl})`);
    }
    lines.push("");
  }

  if (doc.examples.length) {
    lines.push(`## Examples`);
    lines.push("");
    lines.push("```ts");
    for (const ex of doc.examples) {
      if (ex.result.includes("\n")) {
        lines.push(ex.call);
        lines.push(ex.result);
      } else {
        lines.push(ex.call + (ex.result ? ` // ${ex.result}` : ""));
      }
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

function typeUrl(t: string, docs: Doc[]): string {
  const found = docs.find((d) => d.kind === "type" && d.name === t);
  if (found) return pageUrl(found.namespace, found.module, found.name);
  return `#${t}`;
}

function renderType(doc: TypeDoc, usedBy: Map<string, string[]>): string {
  const slug = pageSlug(doc.namespace, doc.module, doc.name);
  const src = `${GH_BASE}/${doc.sourcePath}`;
  const used = usedBy.get(doc.name) ?? [];

  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`title: ${JSON.stringify(doc.name)}`);
  lines.push(`description: ${JSON.stringify(doc.description)}`);
  lines.push(`slug: ${JSON.stringify(slug)}`);
  lines.push(`---`);
  lines.push("");

  if (!doc.isColocated) {
    lines.push(
      `> \`${doc.name}\` is a structural type that appears in public signatures. It is not directly importable.`,
    );
    lines.push("");
  }

  if (doc.description) {
    lines.push(escapeMd(doc.description));
    lines.push("");
  }

  if (doc.isColocated && doc.members.length) {
    const ip = importPath(doc.namespace, doc.module);
    lines.push("```ts");
    lines.push(`import type { ${doc.name} } from "${ip}";`);
    lines.push("```");
    lines.push("");
    lines.push(`## Members`);
    lines.push("");
    lines.push(`| Member | Type | Description |`);
    lines.push(`| --- | --- | --- |`);
    for (const m of doc.members) {
      lines.push(`| \`${m.name}\` | \`${escapeMd(m.type)}\` | — |`);
    }
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
    for (const u of used) {
      const fnName = u.split("/").pop()!;
      lines.push(`- [\`${fnName}\`](${u})`);
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
  const ip = importPath(doc.namespace, doc.module);
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
  lines.push("```ts");
  lines.push(`import { ${doc.name} } from "${ip}";`);
  lines.push("```");
  lines.push("");
  if (doc.description) {
    lines.push(escapeMd(doc.description));
    lines.push("");
  }
  if (doc.examples.length) {
    lines.push(`## Examples`);
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

function escapeMd(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

// ---------------------------------------------------------------------------
// Sidebar generation
// ---------------------------------------------------------------------------

interface SymbolEntry {
  name: string;
  slug: string;
}

/**
 * Build a Starlight sidebar array from symbol entries grouped by namespace.
 *
 * Rules:
 * - One top-level group per namespace, `collapsed: true`.
 * - Modules with ≥ 2 symbols → nested collapsible group.
 * - Modules with exactly 1 symbol → hoisted directly into the namespace
 *   group (no module-wrapper accordion).
 * - Ordering inside a namespace: multi-symbol module groups first (alpha),
 *   then hoisted single-symbol items (alpha by symbol name).
 */
function buildSidebar(moduleSymbols: Map<string, SymbolEntry[]>): string {
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

  const sortedNs = [...byNs.keys()].sort();
  for (const ns of sortedNs) {
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

    lines.push("  {");
    lines.push(`    label: ${JSON.stringify(ns)},`);
    lines.push("    collapsed: true,");
    lines.push("    items: [");

    // Multi-symbol module groups first
    for (const { mod, syms } of multiMod) {
      const sortedSyms = [...syms].sort((a, b) => a.name.localeCompare(b.name));
      lines.push("      {");
      lines.push(`        label: ${JSON.stringify(mod)},`);
      lines.push("        collapsed: true,");
      lines.push("        items: [");
      for (const sym of sortedSyms) {
        lines.push(`          { slug: "${sym.slug}" },`);
      }
      lines.push("        ],");
      lines.push("      },");
    }

    // Then hoisted single-symbol items
    for (const sym of singleSyms) {
      lines.push(`      { slug: "${sym.slug}" },`);
    }

    lines.push("    ],");
    lines.push("  },");
  }

  lines.push("];\n");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const outputs = [
    join(outGen, "gmt-corpus.json"),
    join(outGen, "route-manifest.ts"),
    join(outGen, "widget-seeds.ts"),
    join(outGen, "corpus.ts"),
  ];
  for (const out of outputs) {
    if (!existsSync(out)) {
      runGeneration();
      return;
    }
  }
  const mdxDir = resolve(appRoot, "src", "content", "docs", "reference");
  // The MDX tree is gitignored, so a fresh checkout (or a manual `rm -rf`) can
  // leave the generated modules in place while this directory is gone.
  // `findMdx` would throw ENOENT on the missing dir — treat it as "regenerate".
  if (!existsSync(mdxDir)) {
    runGeneration();
    return;
  }
  const mdxFiles = findMdx(mdxDir);
  if (mdxFiles.length === 0) {
    runGeneration();
    return;
  }

  const allInputs = walk(gmtSrc).filter((f) => {
    const ext = f.endsWith(".ts");
    const skipTest = SKIP_EXTS.some((s) => f.endsWith(s));
    const rel = relative(gmtSrc, f);
    const inSkipDir = rel.split("/").some((part) => SKIP_DIRS.includes(part));
    return ext && !skipTest && !inSkipDir;
  });

  const newestInput = allInputs.reduce((a, b) =>
    statSync(a).mtime > statSync(b).mtime ? a : b,
  );
  const newestOutput = [...outputs, ...mdxFiles].reduce((a, b) =>
    statSync(a).mtime > statSync(b).mtime ? a : b,
  );

  if (statSync(newestOutput).mtime <= statSync(newestInput).mtime) {
    runGeneration();
    return;
  }
  console.log("[reference] outputs up-to-date, skipping");
}

function findMdx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findMdx(full));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      out.push(full);
    }
  }
  return out;
}

function runGeneration() {
  const files = walk(gmtSrc).sort();
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    allowJs: false,
    skipLibCheck: true,
    noEmit: true,
    strict: false,
  });
  const checker = program.getTypeChecker();

  // Pass 1: collect known type names
  const knownTypes = new Set<string>();
  for (const file of files) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;
    for (const stmt of sf.statements) {
      if (ts.isTypeAliasDeclaration(stmt) && stmt.name) {
        knownTypes.add(stmt.name.text);
      }
      if (ts.isInterfaceDeclaration(stmt) && stmt.name) {
        knownTypes.add(stmt.name.text);
      }
    }
  }

  // Pass 2: extract docs
  const allDocs: Doc[] = [];
  for (const file of files) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;
    const { docs } = extractFromFile(checker, file, sf, knownTypes);
    allDocs.push(...docs);
  }

  // Dedupe by url — some types (e.g. RelativeUnit) are re-declared across
  // files; keep the first occurrence.
  const seenUrls = new Set<string>();
  const dedupedDocs = allDocs.filter((d) => {
    const url = pageUrl(d.namespace, d.module, d.name);
    if (seenUrls.has(url)) return false;
    seenUrls.add(url);
    return true;
  });

  const usedBy = buildUsedBy(dedupedDocs);

  // Clean stale output (barrel pages, renamed/removed exports)
  rmSync(outMdx, { recursive: true, force: true });
  mkdirSync(outMdx, { recursive: true });

  const moduleSymbols = new Map<string, SymbolEntry[]>();

  for (const doc of dedupedDocs) {
    const slug = pageSlug(doc.namespace, doc.module, doc.name);
    const dir = resolve(outMdx, doc.namespace, doc.module);
    mkdirSync(dir, { recursive: true });

    let mdx: string;
    if (doc.kind === "function") mdx = renderFn(doc, dedupedDocs);
    else if (doc.kind === "type") mdx = renderType(doc, usedBy);
    else mdx = renderRegex(doc);

    writeFileSync(join(dir, `${doc.name}.mdx`), mdx);

    // collect for sidebar
    const key = `${doc.namespace}/${doc.module}`;
    if (!moduleSymbols.has(key)) moduleSymbols.set(key, []);
    moduleSymbols.get(key)!.push({ name: doc.name, slug });
  }

  // Write generated sidebar
  const sidebarMd = buildSidebar(moduleSymbols);
  writeFileSync(join(outGen, "sidebar.ts"), sidebarMd);

  // Write artifacts
  mkdirSync(outGen, { recursive: true });

  // 1. corpus
  const corpus = dedupedDocs.map((d) => ({
    url: pageUrl(d.namespace, d.module, d.name),
    name: d.name,
    namespace: d.namespace,
    module: d.module,
    kind: d.kind,
    signature: d.kind === "function" ? d.signature : "",
    description:
      d.kind === "function"
        ? d.description
        : d.kind === "type"
          ? d.description
          : d.description,
    sourcePath: `packages/gmt/src/${d.sourcePath}`,
  }));
  writeFileSync(
    join(outGen, "gmt-corpus.json"),
    JSON.stringify(corpus, null, 2) + "\n",
  );

  // 2. route manifest
  const routes = corpus.map((c) => c.url).sort();
  const manifestTs = `// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/build-reference.ts (\`nx run dox:generate\`).
import type { RouteManifest } from "~/reference-types";

export const referenceRoutes: RouteManifest = new Set([
${routes.map((r) => `  ${JSON.stringify(r)},`).join("\n")}
]);
`;
  writeFileSync(join(outGen, "route-manifest.ts"), manifestTs);

  // 3. widget seeds
  const seeds = dedupedDocs
    .filter((d): d is FnDoc => d.kind === "function")
    .map((d) => ({
      route: pageUrl(d.namespace, d.module, d.name),
      fnName: d.name,
      examples: d.examples,
    }));
  const seedsTs = `// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/build-reference.ts (\`nx run dox:generate\`).
import type { WidgetSeed } from "~/reference-types";

export const widgetSeeds: WidgetSeed[] = ${JSON.stringify(seeds, null, 2)};
`;
  writeFileSync(join(outGen, "widget-seeds.ts"), seedsTs);

  // 4. corpus.ts wrapper
  const corpusTs = `// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/build-reference.ts (\`nx run dox:generate\`).
import type { CorpusEntry } from "~/reference-types";
import data from "./gmt-corpus.json";

export const corpus: CorpusEntry[] = data as CorpusEntry[];
`;
  writeFileSync(join(outGen, "corpus.ts"), corpusTs);

  console.log(
    `[reference] wrote ${allDocs.length} pages, ${routes.length} routes, ${seeds.length} seeds`,
  );
}

main();
