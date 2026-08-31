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
