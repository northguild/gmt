#!/usr/bin/env node
/**
 * Public-surface checks for `@northguild/gmt`.
 *
 *   node scripts/api-surface.mjs check   verify reachability, every documented example, and every
 *                                        documented import and reference link; exit 1 on drift
 *   node scripts/api-surface.mjs show    print what was checked, skipped and why
 *
 * Three defects shipped repeatedly because nothing derived them, and all were found by hand
 * (Story CORE-8):
 *
 *   1. **Unreachable functions.** `parseMillisecondFromUnix` and `parseMinuteFromUnix` shipped
 *      implemented, documented and tested, but their barrel never re-exported them — and the
 *      `exports` map blocks deeper paths, so nothing could import them. Meanwhile shared helpers
 *      lived beside public files instead of in `internal/`.
 *   2. **Documented results that were false.** Every public function carries `@example` lines in
 *      the `fn(args) // result` form, the docs site publishes them and seeds its playground from
 *      them, and nothing ran them. About seventy were wrong when this check was written.
 *   3. **Documented imports and reference links that did not exist.** The READMEs, the shipped
 *      agent skills and the docs site imported functions that never existed (`getNowZoned`,
 *      `addDays`), from the wrong subpath (`convertUtcToUnix` from `/unix`), or from namespace
 *      objects the root never exported (`import { plain } from "@northguild/gmt"`), and linked
 *      reference pages that 404 — 28 imports and 11 links when this check was written.
 *
 * Sources of truth, none of them hand-typed:
 *
 *   public surface   `apps/dox/src/generated/reference/gmt-corpus.json`, built by
 *                    `apps/dox/scripts/build-reference.ts` through the `exports` map and the
 *                    barrels with the TypeScript compiler, so membership *is* reachability
 *   examples         the same corpus, which already splits each `@example` into call and result
 *   behaviour        `packages/gmt/dist`, the built package a consumer imports
 *   documentation    `README.md`, `packages/gmt/README.md`, every `SKILL.md` under
 *                    `packages/gmt/skills/`, and every `.md`/`.mdx` page under
 *                    `apps/dox/src/content/docs/` except the generated `reference/` pages —
 *                    scanned as text, so an import in a code fence, a multi-line import and one
 *                    in a JSX template-literal prop (`rightCode={`…`}`) all count
 *
 * How a documented import is decided — every `import … from "@northguild/gmt[/subpath]"`:
 *
 *   subpath      resolved through `packages/gmt/package.json` `exports` by Node's own resolver
 *                (a package self-reference), so a subpath is valid exactly when a consumer's
 *                import would resolve — including an exported pattern with no file behind it
 *   value names  the keys of the subpath's `dist` module, imported
 *   type names   the exports of the subpath's `.d.ts`, read with the TypeScript checker over
 *                `dist`. Not the corpus: its type entries carry a docs-site namespace (`types`)
 *                rather than the subpath that exports them, and only the declaration files say
 *                what a consumer's type-check sees. A binding without `type` may still name a
 *                type, as TypeScript allows, so every binding is accepted from either set
 *
 * A reference link, site-relative or on the docs site's own origin, must be a corpus entry's
 * `url` — the same list `apps/dox/src/generated/reference/route-manifest.ts` is built from.
 *
 * Needs `pnpm build` first (exit 2 without `dist` or the corpus). Runs under `TZ=UTC`, re-executing
 * itself if needed, so an example never depends on the machine's time zone.
 *
 * What an example check skips, and why — `show` lists every skipped example:
 *
 *   clock        a `get/` accessor taking no argument or only a zone (coding-standards: `get/`
 *                holds current-moment and runtime accessors), and any other function whose source
 *                reads `Temporal.Now` (outside `parse/`) — unless the call pins `reference:`, or
 *                documents the `""` or `null` of an invalid input, neither of which reaches the
 *                clock: otherwise the output is the clock or the runtime, so no literal can match
 *   elided       a result that documents a shape, not a value: `["January", ... "December"]`
 *   prose        a result that is not a JavaScript literal once its trailing ` — aside` or
 *                `(aside)` is removed
 *
 * A documented result that throws is a failure, not a skip: an example must run.
 *
 * Documented results on the prose pages. The same documentation files also show results as
 * `call // result`; they are judged exactly like an `@example`, by the same function. Code is read
 * from fenced blocks and from JSX template-literal props (`rightCode={`…`}`, escapes undone). A
 * result qualifies when all of these hold:
 *
 *   - the block imports, with a value (not `import type`) named import from `@northguild/gmt` or a
 *     subpath, the function called — aliases included. A block with no such import (a `wrongCode`
 *     prop, a fragment continuing an earlier block) documents nothing this check can bind
 *   - a line starts with that call, optionally as `const name = call`, and the statement is that one
 *     call and nothing more (`fn(a).length` or `fn(a) === b` do not qualify). The call may span
 *     lines while its brackets are open
 *   - the result is a `// comment` on the statement's last line, or a line holding only a
 *     `// comment` directly after it
 *
 * Variables. The block is walked in order, and a `const name = …` binds `name` for later lines when
 * its value is a literal built only from earlier bindings, or a qualifying call. Anything else binds
 * nothing. A qualifying call that uses a name neither imported nor bound is skipped as `unbound`.
 *
 * What a documented-result check skips, beyond `clock`, `elided` and `prose` above — `show` lists
 * every one:
 *
 *   clock        the example rule for the called function, and also a call that nests a clock-reading
 *                function or uses a binding whose value came from one
 *   icu          a result whose aside (` — …` or a trailing `(…)`) says it depends on ICU: the page
 *                itself declares the text runtime-dependent
 *   unbound      a call using a name the block neither imports nor binds (`parseYearFromDate(input)`)
 *
 * Internal site links. Every link to a docs-site page must name a route that exists, `#fragment` and
 * `?query` ignored, trailing slash optional. Routes are derived without building: each content
 * page under `apps/dox/src/content/docs/` (its `slug:` frontmatter, else its path, lower-cased, minus
 * the extension, `index` naming its directory — Starlight's rule) and its `.md` twin, each static
 * page under `apps/dox/src/pages/`, and each file under `apps/dox/public/`. Checked: links on the
 * site's own origin in every documentation file; root-relative paths whose first segment is a
 * site section (`/guides/…`, `/tools/…`) in every documentation file; and, on docs-site pages, every
 * Markdown or `href` target that is root-relative or relative — the latter resolved against the
 * page's own trailing-slash URL, as a browser does. `/reference/…` links are the reference-link
 * check's.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspect } from "node:util";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CORPUS = join(ROOT, "apps/dox/src/generated/reference/gmt-corpus.json");
const DIST = join(ROOT, "packages/gmt/dist/index.js");
const SRC = join(ROOT, "packages/gmt/src");
/** Generated reference pages: built from the corpus, so they cannot drift from it. */
const DOX_REFERENCE = "apps/dox/src/content/docs/reference";
/** Directories under `src/` that are never public. */
const PRIVATE_DIRS = new Set(["internal", "test"]);

// A Temporal/Intl result formatted by the runtime depends on the zone; examples document UTC.
if (process.env.TZ !== "UTC") {
  const run = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: "inherit",
    env: { ...process.env, TZ: "UTC" },
  });
  process.exit(run.status ?? 1);
}

const argv = process.argv.slice(2).filter((a) => a !== "--");
const command = argv[0] ?? "check";
if (command !== "check" && command !== "show") {
  console.error(
    `api-surface: unknown command "${command}" (expected check or show)`,
  );
  process.exit(1);
}
if (!existsSync(CORPUS) || !existsSync(DIST)) {
  console.error(
    "api-surface: needs packages/gmt/dist and the reference corpus — run `pnpm build` first",
  );
  process.exit(2);
}

const raw = JSON.parse(readFileSync(CORPUS, "utf8"));
const entries = Array.isArray(raw) ? raw : Object.values(raw)[0];

// ---------------------------------------------------------------------------------- reachability

/** Every non-test, non-barrel source file under a public namespace directory. */
function publicSourceFiles(dir = SRC) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dir === SRC && PRIVATE_DIRS.has(entry.name)) continue;
      out.push(...publicSourceFiles(path));
    } else if (
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      entry.name !== "index.ts" &&
      dir !== SRC
    ) {
      out.push(relative(ROOT, path).split("\\").join("/"));
    }
  }
  return out;
}

const reachable = new Set(entries.map((e) => e.sourcePath));
const unreachable = publicSourceFiles().filter((file) => {
  if (reachable.has(file)) return false;
  // A file with no runtime or type export has nothing to reach.
  return /^export\s+(?:async\s+)?(?:function|const|let|class|type|interface|enum)\b/m.test(
    readFileSync(join(ROOT, file), "utf8"),
  );
});

// -------------------------------------------------------------------------------------- examples

const gmt = await import(pathToFileURL(DIST).href);
const names = Object.keys(gmt).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
/**
 * Evaluate a JavaScript expression with every public name in scope, plus `scope` — a documentation
 * code block's import aliases and the simple `const` bindings it declared before the expression.
 */
function evaluate(src, scope = {}) {
  const env = {
    ...Object.fromEntries(names.map((k) => [k, gmt[k]])),
    ...scope,
  };
  return new Function(...Object.keys(env), `"use strict"; return (${src});`)(
    ...Object.values(env),
  );
}
const inspectValue = (v) =>
  inspect(v, { depth: 8, sorted: true, breakLength: Infinity });

/** A call that pins the moment a relative formatter or predicate compares against. */
const PINS_REFERENCE = /\breference\s*:/;
const readsClockCache = new Map();
/**
 * A public function reads the clock when its source calls `Temporal.Now` — a `get/` accessor, a
 * relative or calendar formatter, a now-relative predicate. `parse/` is excluded: `parseHttp` reads
 * the clock only to window an obsolete two-digit year, and its documented results do not move.
 */
function readsClock(entry) {
  if (entry.module === "parse") return false;
  if (!readsClockCache.has(entry.sourcePath)) {
    readsClockCache.set(
      entry.sourcePath,
      /\bTemporal\.Now\b/.test(
        readFileSync(join(ROOT, entry.sourcePath), "utf8"),
      ),
    );
  }
  return readsClockCache.get(entry.sourcePath);
}
/** Examples are TypeScript; strip the type-only syntax a JavaScript evaluator cannot parse. */
const toJs = (src) =>
  src.replace(/\s+as\s+(never|const|unknown|any|string|number|boolean)\b/g, "");

/** A trailing parenthetical aside after a literal: `"…Z" (the local midnight — already 14 June)`. */
const TRAILING_ASIDE = /([\]}"'\w])\s*\([^()]*\)\s*$/;
/**
 * Strip the aside a documented result may carry: `3 — Tue, Wed, Fri`, `null (a moment …)`. The
 * trailing `(…)` goes first, so an em dash inside it does not cut the literal short.
 */
function literalOf(result) {
  let r = (result ?? "").trim().replace(TRAILING_ASIDE, "$1").trim();
  const dash = r.indexOf(" — ");
  if (dash !== -1) r = r.slice(0, dash).trim();
  return r.replace(TRAILING_ASIDE, "$1").trim();
}

function arity(call) {
  const args = call.slice(call.indexOf("(") + 1, call.lastIndexOf(")")).trim();
  if (args === "") return 0;
  let depth = 0;
  let count = 1;
  let quote = null;
  for (const c of args) {
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && depth === 0) count++;
  }
  return count;
}

/**
 * Whether one call to a public function reads the clock or the runtime: a `get/` accessor taking
 * no argument or only a zone, or a function whose source reads `Temporal.Now` — unless the call
 * pins `reference:` or the documented result is the `""`/`null` of an invalid input.
 */
function callReadsClock(entry, call, result) {
  // An invalid input returns its sentinel before any clock read, so check that first. A call with
  // no argument has no input to be invalid: its sentinel documents a runtime failure instead.
  if (arity(call) > 0 && ['""', "null"].includes(literalOf(result)))
    return false;
  return (
    (entry.module === "get" && arity(call) <= 1) ||
    (readsClock(entry) && !PINS_REFERENCE.test(call))
  );
}

/**
 * Judge one documented `call // result` and record it in `tally`: a skip under a named reason, a
 * failure, or a pass. `clock` is decided by the caller, which knows how the call was found.
 */
function judgeExample(tally, { where, call, result, clock, scope }) {
  if (clock) {
    tally.skipped.clock.push({ where, call });
    return;
  }
  const lit = literalOf(result);
  if (/(^|[,\s[])\.\.\.($|[,\s\]])/.test(lit)) {
    tally.skipped.elided.push({ where, call });
    return;
  }
  let expected;
  try {
    if (lit === "") throw new Error("empty");
    expected = evaluate(toJs(lit), scope);
  } catch {
    tally.skipped.prose.push({ where, call, result });
    return;
  }
  let actual;
  try {
    actual = evaluate(toJs(call), scope);
  } catch (error) {
    tally.failures.push({
      where,
      call,
      documented: result,
      actual: `threw ${String(error).split("\n")[0]}`,
    });
    return;
  }
  tally.checked++;
  if (inspectValue(actual) !== inspectValue(expected)) {
    tally.failures.push({
      where,
      call,
      documented: result,
      actual: inspectValue(actual),
    });
  }
}

const examples = {
  skipped: { clock: [], elided: [], prose: [] },
  failures: [],
  checked: 0,
};

for (const entry of entries) {
  for (const ex of entry.examples ?? []) {
    const call = (ex.call ?? "").trim();
    judgeExample(examples, {
      where: `${entry.name} [${entry.sourcePath}]`,
      call,
      result: ex.result,
      clock: callReadsClock(entry, call, ex.result),
    });
  }
}

// --------------------------------------------------------------------------------- documentation

/** Prose that documents public imports: READMEs, the shipped agent skills, the docs site. */
function documentationFiles() {
  const walk = (dir, keep) =>
    existsSync(join(ROOT, dir))
      ? readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
          const path = `${dir}/${e.name}`;
          if (e.isDirectory())
            return path === DOX_REFERENCE ? [] : walk(path, keep);
          return keep(e.name) ? [path] : [];
        })
      : [];
  return [
    "README.md",
    "packages/gmt/README.md",
    ...walk("packages/gmt/skills", (n) => n === "SKILL.md"),
    ...walk("apps/dox/src/content/docs", (n) => /\.mdx?$/.test(n)),
  ].filter((f) => existsSync(join(ROOT, f)));
}

const requireGmt = createRequire(join(ROOT, "packages/gmt/package.json"));
const subpathCache = new Map();
/** Resolve a specifier through the `exports` map exactly as Node does; `null` when it is not exported. */
async function subpath(specifier) {
  if (!subpathCache.has(specifier)) {
    let resolved = null;
    try {
      const js = requireGmt.resolve(specifier);
      resolved = {
        dts: js.replace(/\.js$/, ".d.ts"),
        runtime: new Set(Object.keys(await import(pathToFileURL(js).href))),
      };
    } catch {
      // ERR_PACKAGE_PATH_NOT_EXPORTED, or an exported pattern with no file behind it
    }
    subpathCache.set(specifier, resolved);
  }
  return subpathCache.get(specifier);
}

let declarationExports = null;
/**
 * Every name a subpath's `.d.ts` exports, types included. One TypeScript program covers every
 * resolved subpath, so it is built once, after all documented imports are resolved.
 */
async function typeNames(dts) {
  if (declarationExports === null) {
    const ts = (await import("typescript")).default;
    const roots = [...subpathCache.values()].filter(Boolean).map((s) => s.dts);
    const program = ts.createProgram(roots, {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noEmit: true,
      skipLibCheck: true,
      types: [],
    });
    const checker = program.getTypeChecker();
    declarationExports = new Map(
      roots.map((root) => {
        const file = program.getSourceFile(root);
        const symbol = file && checker.getSymbolAtLocation(file);
        return [
          root,
          new Set(
            symbol ? checker.getExportsOfModule(symbol).map((s) => s.name) : [],
          ),
        ];
      }),
    );
  }
  return declarationExports.get(dts) ?? new Set();
}

const IMPORT =
  /\bimport\s+(type\s+)?([\w$*\s{},]*?)\s*from\s*\\?["'`](@northguild\/gmt(?:\/[^"'`\\\s]*)?)\\?["'`]/g;
/** A site-relative or absolute link into the docs site's API reference. */
const REFERENCE_LINK =
  /(?:(?<=[(\s"'`=<])|(?<=https:\/\/gmt-dox\.northguild\.workers\.dev))\/reference\/[\w/-]*/g;
const routes = new Set(entries.map((e) => e.url));

const documentedImports = [];
const docImports = [];
const docLinks = [];
let linksChecked = 0;

for (const file of documentationFiles()) {
  const text = readFileSync(join(ROOT, file), "utf8");
  const lineOf = (index) => text.slice(0, index).split("\n").length;
  for (const m of text.matchAll(IMPORT)) {
    const [, typeOnly, clause, specifier] = m;
    documentedImports.push({
      where: `${file}:${lineOf(m.index)}`,
      typeOnly: Boolean(typeOnly),
      clause,
      specifier,
      target: await subpath(specifier),
    });
  }
  for (const m of text.matchAll(REFERENCE_LINK)) {
    linksChecked++;
    const url = m[0].replace(/\/+$/, "");
    if (!routes.has(url))
      docLinks.push({ where: `${file}:${lineOf(m.index)}`, url: m[0] });
  }
}

for (const {
  where,
  typeOnly,
  clause,
  specifier,
  target,
} of documentedImports) {
  if (target === null) {
    docImports.push({ where, specifier, name: null });
    continue;
  }
  if (/^\s*[\w$]+\s*(,|$)/.test(clause) && !target.runtime.has("default")) {
    docImports.push({ where, specifier, name: "default" });
  }
  const named = clause.match(/\{([^}]*)\}/)?.[1] ?? "";
  for (const binding of named.split(",")) {
    const parts = binding.trim().split(/\s+/);
    if (parts[0] === "") continue;
    const inlineType = parts[0] === "type" && parts.length > 1;
    const name = inlineType ? parts[1] : parts[0];
    if (!typeOnly && !inlineType && target.runtime.has(name)) continue;
    // A type imported without `type` is legal TypeScript, and `import type` may name a value.
    if ((await typeNames(target.dts)).has(name)) continue;
    docImports.push({ where, specifier, name });
  }
}

// ---------------------------------------------------------------------------- documented results

/** The code a documentation file shows, with the file line of each block's first line. */
function codeBlocks(text) {
  const blocks = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (!fence) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].trimStart().startsWith(fence)) j++;
    blocks.push({ line: i + 2, src: lines.slice(i + 1, j).join("\n") });
    i = j;
  }
  for (const m of text.matchAll(/\b\w+=\{`((?:\\[\s\S]|[^`\\])*)`\}/g)) {
    blocks.push({
      line: text.slice(0, m.index).split("\n").length,
      src: m[1].replace(/\\([`$\\])/g, "$1"),
    });
  }
  return blocks;
}

/** Each `[index, character]` of `text` from `from` that lies outside a string literal. */
function* unquoted(text, from) {
  let quote = null;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else yield [i, c];
  }
}

/** The end of the statement starting at `start`: a `;`, `//` or newline outside brackets and strings. */
function statementEnd(src, start) {
  let depth = 0;
  for (const [i, c] of unquoted(src, start)) {
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (
      depth <= 0 &&
      (c === ";" || c === "\n" || (c === "/" && src[i + 1] === "/"))
    )
      return i;
  }
  return src.length;
}

/** Whether `expr` is exactly one call: the bracket its first `(` opens closes at its last character. */
function isOneCall(expr) {
  let depth = 0;
  for (const [i, c] of unquoted(expr, expr.indexOf("("))) {
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c) && --depth === 0) return i === expr.length - 1;
  }
  return false;
}

/** Whether `text` leaves a bracket open, outside strings. */
function bracketsOpen(text) {
  let depth = 0;
  for (const [, c] of unquoted(text, 0)) {
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
  }
  return depth > 0;
}

const LITERAL_NAMES = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "NaN",
  "Infinity",
]);
/** The identifiers an expression reads: strings, property names and object keys removed. */
function namesRead(expr) {
  const code = expr
    .replace(/(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g, '""')
    .replace(/\.\s*[A-Za-z_$][\w$]*/g, "")
    .replace(/[A-Za-z_$][\w$]*\s*:/g, "");
  return [...code.matchAll(/(?<![\w$])[A-Za-z_$][\w$]*/g)]
    .map((m) => m[0])
    .filter((n) => !LITERAL_NAMES.has(n));
}

const functionEntries = new Map(
  entries.filter((e) => e.kind === "function").map((e) => [e.name, e]),
);
const BLOCK_IMPORT =
  /\bimport\s+(type\s+)?\{([^}]*)\}\s*from\s*["'](@northguild\/gmt(?:\/[^"']*)?)["']/g;
const HEAD =
  /^[ \t]*(?:const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[\w$<>[\]|, ]+)?=\s*)?/;

const docResults = {
  skipped: { clock: [], elided: [], prose: [], icu: [], unbound: [] },
  failures: [],
  checked: 0,
};

/** Local name → exported name, for the value bindings a code block imports. */
function blockImports(src) {
  const imported = new Map();
  for (const m of src.matchAll(BLOCK_IMPORT)) {
    if (m[1]) continue;
    for (const binding of m[2].split(",")) {
      const parts = binding.trim().split(/\s+/);
      if (parts[0] === "" || parts[0] === "type") continue;
      const local = parts[1] === "as" ? parts[2] : parts[0];
      if (Object.hasOwn(gmt, parts[0])) imported.set(local, parts[0]);
    }
  }
  return imported;
}

/** The index of the end of the line holding `from`. */
function lineEndIn(src, from) {
  const n = src.indexOf("\n", from);
  return n === -1 ? src.length : n;
}

/**
 * A result may continue over further comment lines while its brackets are open. Each line may
 * carry its own ` — aside`; the asides move behind the joined literal. When the brackets never
 * close, the result and position come back unchanged.
 */
function joinContinuedResult(src, result, pos) {
  const asides = [];
  const unaside = (text) => {
    const dash = text.indexOf(" — ");
    if (dash === -1) return text;
    asides.push(text.slice(dash + 3).trim());
    return text.slice(0, dash);
  };
  let body = unaside(result);
  let next = pos;
  let more;
  while (
    bracketsOpen(body) &&
    (more = src.slice(next, lineEndIn(src, next)).match(/^\s*\/\/\s*(.*)$/))
  ) {
    body += ` ${unaside(more[1])}`;
    next = lineEndIn(src, next) + 1;
  }
  if (bracketsOpen(body)) return { result, pos };
  return {
    result: asides.length > 0 ? `${body} — ${asides.join("; ")}` : body,
    pos: next,
  };
}

/**
 * The `// result` documented for a statement ending at `end` — on its own line, else on the next
 * comment line — and the position to resume at. `skip` when code follows the statement.
 */
function documentedResult(src, end) {
  const stop = lineEndIn(src, end);
  const tail = src.slice(end, stop).match(/^\s*;?\s*(?:\/\/\s*(.*))?$/);
  let pos = stop + 1;
  if (!tail) return { skip: true, pos };
  let result = tail[1];
  if (result === undefined) {
    const next = src.slice(pos, lineEndIn(src, pos)).match(/^\s*\/\/\s*(.*)$/);
    if (next) {
      result = next[1];
      pos = lineEndIn(src, pos) + 1;
    }
  }
  if (result !== undefined && bracketsOpen(literalOf(result))) {
    return { skip: false, ...joinContinuedResult(src, result, pos) };
  }
  return { skip: false, result, pos };
}

/** Evaluate `js` into the block scope as `binding`; a throw leaves the name unbound. */
function bindValue(block, binding, js, clock) {
  try {
    block.scope[binding] = evaluate(js, block.scope);
    if (clock) block.clocked.add(binding);
  } catch {
    // not a literal after all, or a throwing call (reported when it documents a result)
  }
}

/** Whether a call's value depends on the clock: its own function, or a name it reads. */
function statementReadsClock(block, { callee, expr, result }, read) {
  const entry = functionEntries.get(block.imported.get(callee));
  return (
    (entry !== undefined && callReadsClock(entry, expr, result)) ||
    read.some((n) => {
      if (block.clocked.has(n)) return true;
      const nested = functionEntries.get(block.imported.get(n));
      return n !== callee && nested !== undefined && readsClock(nested);
    })
  );
}

/** Judge, or record as skipped, one call's documented result. */
function recordDocumentedResult(file, block, stmt, unbound, clock) {
  const { exprStart, expr, result } = stmt;
  const where = `${file}:${block.lineAt(exprStart)}`;
  const call = expr.replace(/\s*\n\s*/g, " ");
  const aside = result.trim().slice(literalOf(result).length);
  if (unbound.length > 0) {
    docResults.skipped.unbound.push({ where, call, result });
  } else if (!clock && /\bICU\b/.test(aside)) {
    docResults.skipped.icu.push({ where, call, result });
  } else {
    judgeExample(docResults, {
      where,
      call,
      result,
      clock,
      scope: block.scope,
    });
  }
}

/** Bind or judge one statement of a code block. */
function judgeStatement(file, block, stmt) {
  const { binding, callee, expr, result } = stmt;
  const js = toJs(expr);
  const read = namesRead(js);
  const unbound = read.filter((n) => !Object.hasOwn(block.scope, n));
  const isCall =
    callee !== undefined && block.imported.has(callee) && isOneCall(expr);

  if (!isCall) {
    // A literal built from earlier bindings binds its name; nothing else does.
    if (binding && callee === undefined && unbound.length === 0) {
      bindValue(
        block,
        binding,
        js,
        read.some((n) => block.clocked.has(n)),
      );
    }
    return;
  }

  const clock = statementReadsClock(block, stmt, read);
  if (result !== undefined) {
    recordDocumentedResult(file, block, stmt, unbound, clock);
  }
  if (binding && unbound.length === 0) {
    bindValue(block, binding, js, clock);
  }
}

/** Judge every qualifying `call // result` in one documentation file. */
function judgeDocumentedResults(file, text) {
  for (const codeBlock of codeBlocks(text)) {
    const { src } = codeBlock;
    const imported = blockImports(src);
    if (imported.size === 0) continue;
    const block = {
      imported,
      scope: Object.fromEntries(
        [...imported].map(([local, name]) => [local, gmt[name]]),
      ),
      /** Bindings whose value came from the clock. */
      clocked: new Set(),
      lineAt: (index) =>
        codeBlock.line + src.slice(0, index).split("\n").length - 1,
    };

    let pos = 0;
    while (pos < src.length) {
      const head = src.slice(pos, lineEndIn(src, pos)).match(HEAD);
      const binding = head[1];
      const exprStart = pos + head[0].length;
      const callee = src
        .slice(exprStart)
        .match(/^([A-Za-z_$][\w$]*)\s*\(/)?.[1];
      if (!binding && !imported.has(callee)) {
        pos = lineEndIn(src, pos) + 1;
        continue;
      }
      const end = statementEnd(src, exprStart);
      const expr = src.slice(exprStart, end).trim();
      const documented = documentedResult(src, end);
      pos = documented.pos;
      if (documented.skip) continue;
      judgeStatement(file, block, {
        binding,
        callee,
        expr,
        exprStart,
        result: documented.result,
      });
    }
  }
}

// ------------------------------------------------------------------------------------ site links

const SITE = "https://gmt-dox.northguild.workers.dev";
const DOX_CONTENT = "apps/dox/src/content/docs";
/** Every file under a repo directory, as paths relative to it. */
const filesUnder = (dir, base = dir) =>
  existsSync(join(ROOT, dir))
    ? readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? filesUnder(`${dir}/${e.name}`, base)
          : [`${dir}/${e.name}`.slice(base.length + 1)],
      )
    : [];
/** A content page's `slug:` frontmatter, if it declares one. */
const slugOf = (text) =>
  (text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "")
    .match(/^slug:\s*(.+?)\s*$/m)?.[1]
    ?.replace(/^["']|["']$/g, "");
/** A content page's route, Starlight's way: `slug:` frontmatter, else its lower-cased path. */
function pageRoute(rel, text) {
  const id = (slugOf(text) ?? rel.replace(/\.mdx?$/, "").toLowerCase())
    .replace(/(^|\/)index$/, "")
    .replace(/^\/+|\/+$/g, "");
  return `/${id}`;
}
const siteRoutes = new Set(["/"]);
for (const rel of filesUnder(DOX_CONTENT)) {
  if (!/\.mdx?$/.test(rel)) continue;
  const text = readFileSync(join(ROOT, DOX_CONTENT, rel), "utf8");
  siteRoutes.add(pageRoute(rel, text));
  // src/pages/[...slug].md.ts: `slug:` else the path as written, `index` kept; the home page has none.
  const twin = slugOf(text) ?? rel.replace(/\.mdx?$/, "");
  if (twin !== "index") siteRoutes.add(`/${twin}.md`);
}
for (const rel of filesUnder("apps/dox/src/pages")) {
  if (rel.includes("[")) continue; // dynamic: its routes are the `.md` twins above
  siteRoutes.add(
    `/${rel.replace(/\.(astro|mdx?|ts|js)$/, "").replace(/(^|\/)index$/, "")}`,
  );
}
for (const rel of filesUnder("apps/dox/public")) siteRoutes.add(`/${rel}`);
const siteSections = new Set(
  [...siteRoutes].map((r) => r.split("/")[1]).filter(Boolean),
);

const siteLinks = [];
let siteLinksChecked = 0;
/** Start index → [link as written, root-relative path], for every internal site link in a file. */
function siteLinksIn(file, text) {
  const found = new Map();
  for (const m of text.matchAll(
    /https:\/\/gmt-dox\.northguild\.workers\.dev(\/[^\s)"'`<>\]}]*)?/g,
  ))
    found.set(m.index, [m[0], m[1] ?? "/"]);
  for (const m of text.matchAll(
    /(?<=[(\s"'`=<[{])\/([\w.~-]+)[^\s)"'`<>\]}]*/g,
  ))
    if (siteSections.has(m[1])) found.set(m.index, [m[0], m[0]]);
  if (file.startsWith(`${DOX_CONTENT}/`)) {
    const pageUrl = `${pageRoute(file.slice(DOX_CONTENT.length + 1), text).replace(/\/$/, "")}/`;
    addPageRelativeLinks(found, text, pageUrl);
  }
  return found;
}

/** Add a content page's relative Markdown and `href` links, resolved against its own URL. */
function addPageRelativeLinks(found, text, pageUrl) {
  for (const m of text.matchAll(
    /\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\bhref=["']([^"']+)["']/g,
  )) {
    const target = m[1] ?? m[2];
    if (/^(?:[a-z][\w+.-]*:|#|\/\/|\{)/i.test(target)) continue;
    const index = m.index + m[0].indexOf(target);
    if (found.has(index)) continue;
    found.set(index, [target, new URL(target, `${SITE}${pageUrl}`).pathname]);
  }
}

/** Check every internal site link in one documentation file. */
function checkSiteLinks(file, text) {
  const lineOf = (index) => text.slice(0, index).split("\n").length;
  for (const [index, [written, path]] of siteLinksIn(file, text)) {
    const route = decodeURI(path.replace(/[?#].*$/, "")).replace(
      /(.)\/+$/,
      "$1",
    );
    if (route === "/reference" || route.startsWith("/reference/")) continue;
    siteLinksChecked++;
    if (!siteRoutes.has(route))
      siteLinks.push({
        where: `${file}:${lineOf(index)}`,
        url: written,
        route,
      });
  }
}

for (const file of documentationFiles()) {
  const text = readFileSync(join(ROOT, file), "utf8");
  judgeDocumentedResults(file, text);
  checkSiteLinks(file, text);
}

// ---------------------------------------------------------------------------------------- report

const { failures, checked } = examples;
/** Every judged item: checked, thrown, or skipped. */
const judged = (tally) =>
  tally.checked +
  tally.failures.filter((f) => f.actual.startsWith("threw")).length +
  Object.values(tally.skipped).reduce((n, list) => n + list.length, 0);
const total = judged(examples);
const skipCounts = (tally) =>
  Object.entries(tally.skipped)
    .map(([reason, list]) => `${reason} ${list.length}`)
    .join(", ");

if (command === "show") {
  for (const [label, tally] of [
    ["", examples],
    ["documented result ", docResults],
  ]) {
    for (const [reason, list] of Object.entries(tally.skipped)) {
      console.log(`\n${label}skipped — ${reason} (${list.length})`);
      for (const s of list)
        console.log(
          `  ${s.where}\n    ${s.call}${s.result ? `  =>  ${s.result}` : ""}`,
        );
    }
  }
}

for (const file of unreachable) {
  console.log(
    `  unreachable: ${file} exports a declaration no public subpath reaches — re-export it from its barrel, or move it to internal/`,
  );
}
for (const f of failures) {
  console.log(
    `  example: ${f.where}\n    call:       ${f.call}\n    documented: ${f.documented}\n    actual:     ${f.actual}`,
  );
}

for (const d of docImports) {
  console.log(
    d.name === null
      ? `  doc import: ${d.where} "${d.specifier}" is not in the exports map of packages/gmt/package.json`
      : `  doc import: ${d.where} "${d.specifier}" does not export ${d.name}`,
  );
}
for (const f of docResults.failures) {
  console.log(
    `  doc result: ${f.where}\n    call:       ${f.call}\n    documented: ${f.documented}\n    actual:     ${f.actual}`,
  );
}
for (const d of siteLinks) {
  console.log(
    `  site link: ${d.where} ${d.url} names no page (${d.route} is not a content page, src/pages route or public file)`,
  );
}
for (const d of docLinks) {
  console.log(
    `  doc link: ${d.where} ${d.url} names no reference page (gmt-corpus.json)`,
  );
}

const skipTotal = (tally) =>
  Object.values(tally.skipped).reduce((n, list) => n + list.length, 0);
console.log(
  `api-surface: ${reachable.size} public source files, ${unreachable.length} unreachable file(s); ` +
    `${checked} of ${total} examples checked, ${failures.length} failing, ${skipTotal(examples)} skipped ` +
    `(${skipCounts(examples)}); ` +
    `${docResults.checked} of ${judged(docResults)} documented results checked, ${docResults.failures.length} failing, ` +
    `${skipTotal(docResults)} skipped (${skipCounts(docResults)}); ` +
    `${documentedImports.length} documented imports, ${docImports.length} unresolved; ` +
    `${linksChecked} reference links, ${docLinks.length} broken; ` +
    `${siteLinksChecked} site links, ${siteLinks.length} broken`,
);
if (
  unreachable.length > 0 ||
  failures.length > 0 ||
  docResults.failures.length > 0 ||
  docImports.length > 0 ||
  docLinks.length > 0 ||
  siteLinks.length > 0
)
  process.exit(1);
