/**
 * The documentation gate: which reference content the source does not yet supply.
 *
 * Pure: extracted docs in, gaps out. The renderer never invents text for a missing
 * description or default (it prints `—`), so this is the one place a gap is reported.
 * `build-reference.ts` logs the count on every generation and
 * `scripts/check-reference-docs.ts` prints the full report.
 */

import type { PropertyDoc } from "./render-table";

export type GapRule =
  | "type-description" // public type with an empty description
  | "member-description" // member of a public object type with no description
  | "option-description" // option property with no description
  | "default-value" // optional input property with no @defaultValue
  | "default-tag" // @default used instead of @defaultValue
  | "list-in-description" // a property description containing a Markdown list
  | "param-name" // @param naming no parameter of the function
  | "orphan-type"; // public type no public function reaches

export interface Gap {
  rule: GapRule;
  /** Repo-relative source file. */
  file: string;
  /** 1-based line. */
  line: number;
  /** `Type.member`, `fn.param.option`, `fn(@param name)` or a type name. */
  subject: string;
  namespace: string;
  reason: string;
}

export interface GateFunction {
  name: string;
  namespace: string;
  file: string;
  line: number;
  /** The real parameter names, named members of a rest tuple included. */
  declaredParams: string[];
  /** Each `@param` tag: the name it documents and the line it is on. */
  documentedParams: Array<{ name: string; line: number }>;
  /** Each parameter expanded under `## Options`, with its property rows. */
  options: Array<{ param: string; rows: PropertyDoc[] }>;
}

export interface GateType {
  name: string;
  namespace: string;
  file: string;
  line: number;
  description: string;
  members: PropertyDoc[];
  /** Reached from at least one parameter: its optional members need a default. */
  input: boolean;
  /** Reached by no public function. */
  orphan: boolean;
}

export interface GateInput {
  functions: GateFunction[];
  types: GateType[];
}

/** One property declaration, however many types and functions expose it. */
interface Declaration {
  row: PropertyDoc;
  file: string;
  line: number;
  subject: string;
  namespace: string;
  /** A member of a public type, as opposed to a property of an inline options literal. */
  member: boolean;
  /** An option of an expanded parameter. */
  option: boolean;
  /** A caller supplies it: an option, or a member of an input type. */
  input: boolean;
}

const GMT_SOURCE = /^packages\/gmt\/src\/([^/]+?)(?:\.ts)?(?:\/|$)/;

/** The namespace a source file belongs to, or `fallback` for a file outside gmt source. */
function namespaceOf(file: string, fallback: string): string {
  return GMT_SOURCE.exec(file)?.[1] ?? fallback;
}

/**
 * Every checked property, once per declaration (file and line). Lib-declared properties
 * cannot carry GMT's JSDoc and are never checked. Types are read before functions, so a
 * property of a named type is reported under the type's name.
 */
function declarations(input: GateInput): Map<string, Declaration> {
  const seen = new Map<string, Declaration>();
  const add = (
    row: PropertyDoc,
    owner: { file: string; line: number; namespace: string },
    subject: string,
    as: { member: boolean; option: boolean; input: boolean },
  ): void => {
    if (row.fromLib) return;
    const file = row.source?.file ?? owner.file;
    const line = row.source?.line ?? owner.line;
    // A property with no declaration of its own is told apart by its owner and name.
    const key = row.source ? `${file}:${line}` : `${file}:${line}:${subject}`;
    const known = seen.get(key);
    if (known) {
      known.member ||= as.member;
      known.option ||= as.option;
      known.input ||= as.input;
      return;
    }
    seen.set(key, {
      row,
      file,
      line,
      subject,
      namespace: namespaceOf(file, owner.namespace),
      ...as,
    });
  };

  for (const type of input.types) {
    for (const row of type.members) {
      add(row, type, `${type.name}.${row.name}`, {
        member: true,
        option: false,
        input: type.input,
      });
    }
  }
  for (const fn of input.functions) {
    for (const block of fn.options) {
      for (const row of block.rows) {
        add(row, fn, `${fn.name}.${block.param}.${row.name}`, {
          member: false,
          option: true,
          input: true,
        });
      }
    }
  }
  return seen;
}

/** How many distinct option-property declarations the public functions expose. */
export function countOptionDeclarations(input: GateInput): number {
  let count = 0;
  for (const d of declarations(input).values()) if (d.option) count++;
  return count;
}

export function findGaps(input: GateInput): Gap[] {
  const gaps: Gap[] = [];

  for (const type of input.types) {
    const at = {
      file: type.file,
      line: type.line,
      subject: type.name,
      namespace: namespaceOf(type.file, type.namespace),
    };
    if (!type.description.trim()) {
      gaps.push({
        rule: "type-description",
        ...at,
        reason: "public type has no description",
      });
    }
    if (type.orphan) {
      gaps.push({
        rule: "orphan-type",
        ...at,
        reason: "no public function reaches this public type",
      });
    }
  }

  for (const d of declarations(input).values()) {
    const at = {
      file: d.file,
      line: d.line,
      subject: d.subject,
      namespace: d.namespace,
    };
    if (!d.row.description.trim()) {
      gaps.push(
        d.member
          ? {
              rule: "member-description",
              ...at,
              reason: "member has no description",
            }
          : {
              rule: "option-description",
              ...at,
              reason: "option has no description",
            },
      );
    }
    if (d.row.hasList) {
      gaps.push({
        rule: "list-in-description",
        ...at,
        reason: "description holds a list, which a table cell cannot show",
      });
    }
    if (d.row.usesDefaultTag) {
      gaps.push({
        rule: "default-tag",
        ...at,
        reason: "uses @default; write @defaultValue",
      });
    } else if (d.input && d.row.optional && !d.row.defaultValue?.trim()) {
      gaps.push({
        rule: "default-value",
        ...at,
        reason: "optional input property has no @defaultValue",
      });
    }
  }

  for (const fn of input.functions) {
    for (const doc of fn.documentedParams) {
      if (fn.declaredParams.includes(doc.name)) continue;
      const renamed = fn.declaredParams.includes(`${doc.name}Input`);
      gaps.push({
        rule: "param-name",
        file: fn.file,
        line: doc.line,
        subject: `${fn.name}(@param ${doc.name})`,
        namespace: namespaceOf(fn.file, fn.namespace),
        reason: renamed
          ? `@param ${doc.name} documents the parameter declared ${doc.name}Input`
          : doc.name.includes(".")
            ? `@param ${doc.name} is a dotted name; document the property on its declaration`
            : `@param ${doc.name} names no parameter (${fn.declaredParams.join(", ") || "none"})`,
      });
    }
  }

  return gaps.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.subject.localeCompare(b.subject) ||
      a.rule.localeCompare(b.rule),
  );
}

function tally(values: readonly string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}

/**
 * The report: one `file:line  subject  reason` row per gap, sorted by file then line, then
 * the total, a count per rule and a count per namespace.
 */
export function formatGapReport(gaps: readonly Gap[]): string {
  const sorted = [...gaps].sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
  );
  const lines = sorted.map(
    (g) => `${g.file}:${g.line}  ${g.subject}  ${g.reason}`,
  );
  if (lines.length > 0) lines.push("");
  lines.push(`${gaps.length} gap${gaps.length === 1 ? "" : "s"}`);
  if (gaps.length > 0) {
    lines.push("", "By rule:");
    for (const [rule, n] of tally(gaps.map((g) => g.rule))) {
      lines.push(`  ${rule}  ${n}`);
    }
    lines.push("", "By namespace:");
    for (const [ns, n] of tally(gaps.map((g) => g.namespace))) {
      lines.push(`  ${ns}  ${n}`);
    }
  }
  return lines.join("\n");
}
