/**
 * Finds a line break in an `.astro` template that Astro deletes along with a space the reader
 * needed.
 *
 * Astro 7 compresses HTML with the JSX whitespace rules (`compressHTML: "jsx"`, the default):
 * whitespace that holds a line break is removed where it meets an element or an `{expression}`,
 * and multi-line text collapses onto one line. So
 *
 *   A row marked
 *   <strong>Theirs</strong> is a report
 *
 * builds as `A row marked<strong>Theirs</strong> is a report`, and the reader sees "markedTheirs".
 * A space on the same line as the element survives; a line break does not.
 *
 * `findDroppedSpaces(source)` returns one finding per such break, found from the compiler's own
 * parse tree rather than from a pattern, so quoting, comments, `<pre>` and expressions are read
 * the way the build reads them. The fix for a finding is to keep the space on the line of the
 * element (`marked <strong>Theirs</strong>`), or to write `{" "}` where the line must break.
 *
 * Usage: node scripts/lib/inline-whitespace.mjs [file.astro ...]   (default: every src/**.astro)
 */
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Elements that sit in a line of text, so a space beside one is part of the sentence. */
const INLINE = new Set(
  "a abbr b bdi bdo cite code data del dfn em i img ins kbd label mark q s samp small span strong sub sup time u var wbr button input select textarea output".split(
    " ",
  ),
);

let parseAstro;
/** The compiler's `parse`, loaded from where `astro` keeps it (it is not a direct dependency). */
async function loadParse() {
  if (parseAstro) return parseAstro;
  const fromAstro = createRequire(
    realpathSync(join(root, "node_modules", "astro", "package.json")),
  );
  const mod = await import(
    pathToFileURL(fromAstro.resolve("@astrojs/compiler-rs")).href
  );
  parseAstro = mod.parse;
  return parseAstro;
}

/** The first element inside a subtree, in source order, or `null` when it holds only values. */
function firstElement(node) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = firstElement(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (node.type === "JSXElement") return node;
  for (const [key, value] of Object.entries(node)) {
    if (key === "start" || key === "end") continue;
    const found = firstElement(value);
    if (found) return found;
  }
  return null;
}

/**
 * How a child sits in its parent's line: `text` (words, or an `{expression}` that prints a value),
 * `inline` (a text-level HTML element, or an expression whose markup starts with one) or `block`
 * (anything else, beside which a break changes nothing). A component is `block`: what it prints is
 * not known here, and the ones in prose are icons in a flex row. A comment `{/* *\/}` is not a child.
 */
function kind(node) {
  if (node.type === "JSXText") return node.raw.trim() === "" ? "space" : "text";
  if (node.type === "JSXExpressionContainer") {
    if (node.expression.type === "JSXEmptyExpression") return "none";
    const first = firstElement(node.expression);
    return first ? kind(first) : "text";
  }
  if (node.type !== "JSXElement") return "block";
  const name = node.openingElement.name;
  return name.type === "JSXIdentifier" && INLINE.has(name.name)
    ? "inline"
    : "block";
}

/** `{" "}` or `{", "}`: the author already wrote the space the break would remove. */
function spaced(node, edge) {
  let e = node?.type === "JSXExpressionContainer" ? node.expression : null;
  if (e?.type === "LogicalExpression") e = e.right; // `{index > 0 && ", "}`
  if (e?.type !== "Literal" || typeof e.value !== "string") return false;
  return edge === "end" ? /\s$/.test(e.value) : /^\s/.test(e.value);
}

function describe(node) {
  if (node.type === "JSXText") return "text";
  if (node.type === "JSXExpressionContainer") return "{expression}";
  const name = node.openingElement.name;
  return `<${name.name ?? "component"}>`;
}

function walk(node, visit) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
  } else if (node && typeof node === "object") {
    if (Array.isArray(node.children)) visit(node.children);
    for (const key of Object.keys(node)) {
      if (key !== "start" && key !== "end") walk(node[key], visit);
    }
  }
}

/**
 * @param {string} source an `.astro` file
 * @returns {Promise<{ line: number, before: string, after: string, text: string }[]>}
 */
export async function findDroppedSpaces(source) {
  const parse = await loadParse();
  const { ast } = parse(source);
  const lineOf = (offset) => source.slice(0, offset).split("\n").length;
  const findings = [];
  const note = (offset, before, after) =>
    findings.push({
      line: lineOf(offset),
      before,
      after,
      text: source.split("\n")[lineOf(offset) - 1].trim(),
    });

  walk(ast.body, (all) => {
    const children = all.filter((c) => kind(c) !== "none");
    // `edge` is the break's side of a text node, or `null` for a node that is only whitespace.
    const check = (left, right, offset) => {
      const l = kind(left);
      const r = kind(right);
      if (l === "block" || r === "block" || (l !== "text" && r !== "text"))
        return;
      if (spaced(left, "end") || spaced(right, "start")) return;
      // A break before `.` or `,` or after `(` is meant to join.
      if (
        r === "text" &&
        right.type === "JSXText" &&
        /^[.,;:!?)\]]/.test(right.raw.trim())
      )
        return;
      if (
        l === "text" &&
        left.type === "JSXText" &&
        /[([]$/.test(left.raw.trim())
      )
        return;
      note(offset, describe(left), describe(right));
    };
    children.forEach((child, i) => {
      const prev = children[i - 1];
      const next = children[i + 1];
      if (kind(child) === "space") {
        if (child.raw.includes("\n") && prev && next)
          check(prev, next, child.start);
      } else if (child.type === "JSXText") {
        if (/^\s*\n/.test(child.raw) && prev) check(prev, child, child.start);
        if (/\n\s*$/.test(child.raw) && next) check(child, next, child.end);
      }
    });
  });
  return findings;
}

/** Every `.astro` file under `dir`, sorted. */
export function astroFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...astroFiles(path));
    else if (entry.name.endsWith(".astro")) out.push(path);
  }
  return out.sort();
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const files =
    process.argv.length > 2
      ? process.argv.slice(2)
      : astroFiles(join(root, "src"));
  let count = 0;
  for (const file of files) {
    for (const f of await findDroppedSpaces(readFileSync(file, "utf8"))) {
      count += 1;
      console.log(
        `${relative(root, file)}:${f.line}  ${f.before} | ${f.after}  ${f.text}`,
      );
    }
  }
  console.log(`${count} dropped space(s) in ${files.length} file(s)`);
  process.exitCode = count === 0 ? 0 : 1;
}
