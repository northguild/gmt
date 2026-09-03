/**
 * Pure string parsers shared between the Node build pipeline and the browser
 * live-playground client.
 *
 * These functions intentionally have zero TypeScript or Node dependencies so
 * they can be imported directly in Astro components.
 */

export function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      cur += ch;
      if (ch === inStr && s[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      const trimmed = cur.trim();
      if (trimmed.length > 0) out.push(trimmed);
      cur = "";
      continue;
    }
    cur += ch;
  }
  const tail = cur.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

export function parseCallArgs(call: string): string[] {
  const open = call.indexOf("(");
  const close = call.lastIndexOf(")");
  if (open < 0 || close < 0 || close < open) return [];
  const inner = call.slice(open + 1, close);
  return splitTopLevel(inner)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

// ---------------------------------------------------------------------------
// Call assembly (shared: form playground client + build-reference generator)
// ---------------------------------------------------------------------------

export type PlaygroundArgKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "units"
  | "list"
  | "intervals";

export interface CallField {
  name: string;
  kind: PlaygroundArgKind;
  value?: string;
  unit?: string;
  /** `list` element type — numbers render bare, everything else is quoted. */
  element?: "string" | "number" | "enum";
  /** `list` current elements. */
  items?: string[];
  /** `intervals` current `[start, end]` pairs. */
  pairs?: Array<[string, string]>;
  /** `x?:` — a trailing optional field that is empty is dropped from the call. */
  optional?: boolean;
}

/** True when an optional field carries no value and can be dropped from the call. */
export function isEmptyField(f: CallField): boolean {
  switch (f.kind) {
    case "list":
      return (f.items ?? []).every((v) => v.trim() === "");
    case "intervals":
      return (f.pairs ?? []).every(([s, e]) => !s.trim() && !e.trim());
    case "units":
      return !(f.value ?? "").trim();
    default:
      return (f.value ?? "").trim() === "";
  }
}

/** Format one field as source text. */
export function formatArg(f: CallField): string {
  const v = (f.value ?? "").trim();
  switch (f.kind) {
    case "number":
      return v === "" ? "0" : v;
    case "boolean":
      return v === "true" ? "true" : "false";
    case "units":
      return `{ ${f.unit || "days"}: ${v === "" ? "0" : v} }`;
    case "list": {
      const num = f.element === "number";
      const els = (f.items ?? [])
        .filter((x) => x.trim() !== "")
        .map((x) => (num ? x.trim() : JSON.stringify(x)));
      return `[${els.join(", ")}]`;
    }
    case "intervals": {
      const items = (f.pairs ?? [])
        .filter(([s, e]) => s.trim() !== "" || e.trim() !== "")
        .map(
          ([s, e]) =>
            `{ start: ${JSON.stringify(s)}, end: ${JSON.stringify(e)} }`,
        );
      return `[${items.join(", ")}]`;
    }
    default:
      // string + enum
      return JSON.stringify(f.value ?? "");
  }
}

/**
 * Assemble a call string from ordered fields. Trailing optional fields that are
 * empty are dropped. `objectArg` rebuilds the call as `fn({ name: value, … })`
 * instead of positional args; `optionsSuffix` (positional only) is appended
 * verbatim.
 */
export function buildCall(
  fnName: string,
  fields: CallField[],
  opts: { optionsSuffix?: string; objectArg?: boolean } = {},
): string {
  const fs = [...fields];
  while (
    fs.length > 0 &&
    fs[fs.length - 1].optional &&
    isEmptyField(fs[fs.length - 1])
  ) {
    fs.pop();
  }

  if (opts.objectArg) {
    const body = fs.map((f) => `${f.name}: ${formatArg(f)}`).join(", ");
    return `${fnName}(${body ? `{ ${body} }` : ""})`;
  }

  const args = fs.map(formatArg);
  if (opts.optionsSuffix && opts.optionsSuffix.trim()) {
    args.push(opts.optionsSuffix.trim());
  }
  return `${fnName}(${args.join(", ")})`;
}

export function argToValue(raw: string): string {
  const t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  return t;
}
