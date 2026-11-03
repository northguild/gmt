/**
 * The Database Timestamps guide read as text, for the Database Timestamp Reader's tests: its
 * matrix rows, and each marked snippet's constants and expected literal. The guide's own test
 * (`databases-guide.test.ts`) runs the snippets; these tests hold the reader to the same page.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(
  join(__dirname, "../content/docs/guides/conversion/databases.mdx"),
  "utf8",
);
const lines = page.split("\n");

/** The whole page as written, for the guard that reads it as text. */
export const guideText = page;

/** One matrix row, cells as the page writes them with the backticks removed. */
export interface GuideRow {
  database: string;
  form: string;
  read: string;
  write: string;
  kind: string;
}

/**
 * One marked snippet: its imports, its code, the statement it ends on, its `const` values in
 * order, and the literal after `//`.
 */
export interface GuideSnippet {
  id: string;
  imports: { names: string[]; path: string }[];
  /** The code between the imports and the `//` line. */
  body: string;
  /** The text after the last top-level `;`, which is the statement the snippet evaluates. */
  last: string;
  constants: { name: string; literal: string }[];
  literal: string;
}

function lastStatement(body: string): string {
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0) start = i + 1;
  }
  return body.slice(start).trim();
}

/** A Read cell that is not an expression: the form has one direction only. */
export const ONE_WAY = ["input only", "write only"];

export function guideRows(): GuideRow[] {
  const start = lines.findIndex((l) => l.startsWith("| Database |"));
  if (start < 0) throw new Error("the guide has no matrix");
  const rows: GuideRow[] = [];
  for (let i = start + 2; lines[i]?.startsWith("|"); i++) {
    const cells = lines[i]
      .slice(1, -1)
      .split(/ \| /)
      .map((c) => c.trim());
    const [database, form, read, write, kind] = cells;
    rows.push({
      database,
      form: form.replaceAll("`", ""),
      read: read.replace(/^`|`$/g, ""),
      write: write.replace(/^`|`$/g, ""),
      kind,
    });
  }
  return rows;
}

export function guideSnippets(): GuideSnippet[] {
  const found: GuideSnippet[] = [];
  lines.forEach((line, index) => {
    const marker = /^\{\/\* db-row: ([a-z0-9-]+) \*\/\}$/.exec(line);
    if (!marker) return;
    let at = index + 1;
    while (lines[at].trim() === "") at++;
    if (lines[at] !== "```ts") {
      throw new Error(`${marker[1]}: the marker is not followed by a ts fence`);
    }
    const imports: GuideSnippet["imports"] = [];
    const rest: string[] = [];
    const constants: GuideSnippet["constants"] = [];
    let literal = "";
    for (at++; lines[at] !== "```"; at++) {
      const row = lines[at];
      const imported =
        /^import \{ ([^}]+) \} from "@northguild\/gmt\/([^"]+)";$/.exec(row);
      const constant = /^const (\w+) = (.+);$/.exec(row);
      const expected = /^\/\/ (.+)$/.exec(row);
      if (imported) {
        imports.push({
          names: imported[1].split(",").map((name) => name.trim()),
          path: imported[2],
        });
        continue;
      }
      if (expected) {
        literal = expected[1];
        continue;
      }
      if (constant) constants.push({ name: constant[1], literal: constant[2] });
      rest.push(row);
    }
    const body = rest.join("\n").trim();
    found.push({
      id: marker[1],
      imports,
      body,
      last: lastStatement(body),
      constants,
      literal,
    });
  });
  return found;
}
