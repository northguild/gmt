import { describe, it, test } from "vitest";

/*
 * Vitest 5 prints a string it interpolates into an `each` or `for` title as it is, with no
 * quotes. An empty string then leaves a blank: `returns $expected for $value` reads
 * `returns  for 2024-13-01`. The house form puts the placeholder in single quotes,
 * `'$expected'`, which prints `''`. This guard fails a test file at collection when a
 * placeholder outside quotes, or a `%s`, would print an empty string, and names the row.
 *
 * It wraps `each` and `for` on `it`, `test` and `describe`. A chained form such as
 * `it.concurrent.each` builds its own copy and is not covered.
 */

type Collector = (name: unknown, ...rest: unknown[]) => unknown;
type Each = (this: unknown, cases: unknown, ...args: unknown[]) => Collector;
type Host = Record<"each" | "for", Each>;

const GUARDED = Symbol.for("gmt.titleGuard");

/** The rows Vitest builds from a template-literal table or a plain array of cases. */
function rowsOf(cases: unknown, args: unknown[]): unknown[] {
  if (!Array.isArray(cases)) return [];
  if (args.length === 0) return cases;

  const header = String(cases[0])
    .split("|")
    .map((column) => column.trim())
    .filter((column) => column.length > 0);
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i + header.length <= args.length; i += header.length) {
    rows.push(
      Object.fromEntries(header.map((column, j) => [column, args[i + j]])),
    );
  }
  return rows;
}

/** Reads `a.b` or `0` from a row the way Vitest does for a `$` placeholder. */
function valueAt(row: unknown, key: string): unknown {
  const items = Array.isArray(row) ? row : [row];
  const first: unknown = items[0];
  const isObjectRow =
    typeof first === "object" && first !== null && !Array.isArray(first);
  if (/^\d+$/.test(key) && !isObjectRow) return items[Number(key)];
  if (!isObjectRow) return undefined;

  let value: unknown = first;
  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

const QUOTES = new Set(["'", '"', "`"]);

/** True when the placeholder at `start`…`end` sits between a matching pair of quotes. */
function quoted(name: string, start: number, end: number): boolean {
  const before = name[start - 1];
  return before !== undefined && QUOTES.has(before) && name[end] === before;
}

/** Each place the title would print an empty string for these cases, as `row N: $key`. */
export function findBlanks(
  name: string,
  cases: unknown,
  args: unknown[] = [],
): string[] {
  const rows = rowsOf(cases, args);
  const found: string[] = [];

  for (const match of name.matchAll(/\$([$\p{ID_Continue}.]+)/gu)) {
    const start = match.index;
    const end = start + match[0].length;
    if (quoted(name, start, end)) continue;
    const key = match[1] ?? "";
    rows.forEach((row, index) => {
      if (valueAt(row, key) === "") found.push(`row ${index}: $${key}`);
    });
  }

  // printf specifiers take the row's items in order; `%%` takes none.
  let item = 0;
  for (const match of name.matchAll(/%[sdifjoO%#$]/g)) {
    const spec = match[0];
    if (spec === "%%" || spec === "%#" || spec === "%$") continue;
    const at = item++;
    if (spec !== "%s") continue;
    if (quoted(name, match.index, match.index + 2)) continue;
    rows.forEach((row, index) => {
      const items = Array.isArray(row) ? row : [row];
      if (items[at] === "") found.push(`row ${index}: %s`);
    });
  }

  return found;
}

function guard(original: Each, label: string): Each {
  return function guarded(this: unknown, cases, ...args) {
    const collect = original.call(this, cases, ...args);
    return (name, ...rest) => {
      if (typeof name === "string") {
        const found = findBlanks(name, cases, args);
        if (found.length > 0) {
          throw new Error(
            `${label} title ${JSON.stringify(name)} prints a blank for an empty string ` +
              `(${found.join(", ")}). Write the placeholder in single quotes, '$name', ` +
              `so it prints ''. See context/testing-standards/references/index.md#test-name-standards.`,
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
