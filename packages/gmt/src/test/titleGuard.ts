import { describe, it, test } from "vitest";

/*
 * Vitest 5 prints a string it interpolates into an `each` or `for` title as it is, with no
 * quotes. An empty string then leaves a blank: `returns $expected for $value` reads
 * `returns  for 2024-13-01`. The house form puts a string placeholder in single quotes,
 * `'$expected'`, which prints `''`. Quotes then promise a string: `'$value'` over `null`
 * prints `'null'`, which reads as the four-letter string.
 *
 * This guard fails a test file at collection, naming the row, when a title would
 * - print an empty string outside quotes, through a `$key`, a `%s` or a `%%`, or
 * - print a value that is not a string inside quotes, through a `$key` or a `%s`.
 *
 * It reads a title the way Vitest 5.0.5's `formatTitle` does: `%#` and `%$` become the row
 * number first; then every match of `/%[sdjifoOc%]/g`, `%%` included, takes the next row item;
 * `$key` placeholders are read only between those matches.
 *
 * It wraps `each` and `for` on `it`, `test` and `describe`. A chained form such as
 * `it.concurrent.each` builds its own copy and is not covered.
 */

type Collector = (name: unknown, ...rest: unknown[]) => unknown;
type Each = (this: unknown, cases: unknown, ...args: unknown[]) => Collector;
type Host = Record<"each" | "for", Each>;

const GUARDED = Symbol.for("gmt.titleGuard");
const NOT_READ = Symbol("not read");
const PRINTF = /%[sdjifoOc%]/g;
const PLACEHOLDER = /\$([$\p{ID_Continue}.]+)/gu;
const QUOTES = new Set(["'", '"', "`"]);

const isObject = (value: unknown): value is object =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The rows Vitest builds from a template-literal table or a plain array of cases. */
function rowsOf(cases: unknown, args: unknown[]): unknown[] {
  if (!Array.isArray(cases)) return [];
  if (args.length === 0) return cases;

  // Vitest's own header parse: the first line, spaces removed, split on `|`.
  const header =
    cases.join("").trim().replace(/ /g, "").split("\n")[0]?.split("|") ?? [];
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < Math.floor(args.length / header.length); i++) {
    rows.push(
      Object.fromEntries(
        header.map((column, j) => [column, args[i * header.length + j]]),
      ),
    );
  }
  return rows;
}

/** Vitest's `objectAttr`: reads `a.b` or `a[0]`, or gives `fallback` once a step is undefined. */
function objectAttr(
  source: unknown,
  path: string,
  fallback?: unknown,
): unknown {
  let result = source;
  for (const part of path.replace(/\[(\d+)\]/g, ".$1").split(".")) {
    result = (new Object(result) as Record<string, unknown>)[part];
    if (result === undefined) return fallback;
  }
  return result;
}

/** The value a `$key` prints for a row's items, or NOT_READ when Vitest leaves `$key` as text. */
function valueAt(items: unknown[], key: string): unknown {
  const isObjectItem = isObject(items[0]);
  const isArrayKey = /^\d+$/.test(key);
  if (!isObjectItem && !isArrayKey) return NOT_READ;
  const arrayElement = isArrayKey ? objectAttr(items, key) : undefined;
  return isObjectItem ? objectAttr(items[0], key, arrayElement) : arrayElement;
}

/** True when the text at `start`…`end` sits between a matching pair of quotes. */
function quoted(text: string, start: number, end: number): boolean {
  const before = text[start - 1];
  return before !== undefined && QUOTES.has(before) && text[end] === before;
}

/** The fault, if any, in printing `value` at `start`…`end` of `text`. */
function faultOf(
  text: string,
  start: number,
  end: number,
  value: unknown,
): string | undefined {
  if (quoted(text, start, end)) {
    return typeof value === "string"
      ? undefined
      : `quotes a non-string (${value === null ? "null" : typeof value})`;
  }
  return value === "" ? "prints a blank" : undefined;
}

/** Vitest 5.0.5's `formatTitle` template step: `%#` and `%$` become the row number. */
function numbered(name: string, index: number): string {
  if (!name.includes("%#") && !name.includes("%$")) return name;
  return name
    .replace(/%%/g, "__vitest_escaped_%__")
    .replace(/%#/g, `${index}`)
    .replace(/%\$/g, `${index + 1}`)
    .replace(/__vitest_escaped_%__/g, "%%");
}

/** Each fault in one row's title, as `row N: <placeholder> <fault>`. */
function rowFaults(name: string, row: unknown, index: number): string[] {
  const items = Array.isArray(row) ? row : [row];
  const text = numbered(name, index);
  const found: string[] = [];
  const report = (label: string, fault: string | undefined) => {
    if (fault !== undefined) found.push(`row ${index}: ${label} ${fault}`);
  };

  const readPlaceholders = (from: number, to: number) => {
    for (const match of text.slice(from, to).matchAll(PLACEHOLDER)) {
      const key = match[1] ?? "";
      const value = valueAt(items, key);
      if (value === NOT_READ) continue;
      const start = from + match.index;
      report(`$${key}`, faultOf(text, start, start + match[0].length, value));
    }
  };

  let item = 0;
  let last = 0;
  for (const match of text.matchAll(PRINTF)) {
    readPlaceholders(last, match.index);
    last = match.index + match[0].length;
    const value = items[item++];
    const spec = match[0];
    // `%%` prints `%`, then a space and the item it took: an empty string leaves a blank.
    if (spec === "%%" && value === "") report(spec, "prints a blank");
    if (spec === "%s") report(spec, faultOf(text, match.index, last, value));
  }
  readPlaceholders(last, text.length);
  return found;
}

/** Each fault in a title for these cases: an empty string outside quotes, a non-string inside. */
export function findTitleFaults(
  name: string,
  cases: unknown,
  args: unknown[] = [],
): string[] {
  return rowsOf(cases, args).flatMap((row, index) =>
    rowFaults(name, row, index),
  );
}

function guard(original: Each, label: string): Each {
  return function guarded(this: unknown, cases, ...args) {
    const collect = original.call(this, cases, ...args);
    return (name, ...rest) => {
      if (typeof name === "string") {
        const found = findTitleFaults(name, cases, args);
        if (found.length > 0) {
          throw new Error(
            `${label} title ${JSON.stringify(name)}: ${found.join(", ")}. Quote a placeholder ` +
              `that holds a string, '$name', so an empty one prints ''; leave a placeholder ` +
              `that holds anything else bare, or give the row a label column. See ` +
              `context/testing-standards/references/index.md#test-name-standards.`,
          );
        }
      }
      return collect(name, ...rest);
    };
  };
}

/** Wraps `each` and `for` on Vitest's `it`, `test` and `describe` once per module instance. */
export function installTitleGuard(): void {
  for (const [label, host] of [
    ["it", it],
    ["test", test],
    ["describe", describe],
  ] as const) {
    const target = host as unknown as Host & { [GUARDED]?: true };
    if (target[GUARDED]) continue;
    target.each = guard(target.each, `${label}.each`);
    if (typeof target.for === "function") {
      target.for = guard(target.for, `${label}.for`);
    }
    target[GUARDED] = true;
  }
}
