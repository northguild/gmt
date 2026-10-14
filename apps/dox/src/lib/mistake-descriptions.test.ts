/// <reference types="vitest/globals" />

/**
 * A `<Mistake>` card's `title` and `description` are plain strings.
 * `Mistake.astro` renders them as text, so a backtick in either prints as a
 * backtick on the page instead of formatting code. This scan fails on any
 * such value under `src/content/docs/`, naming the file and line.
 *
 * Generated reference pages are skipped: no `<Mistake>` is written there.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DOCS = path.resolve(import.meta.dirname, "..", "content", "docs");
const SKIPPED = path.join(DOCS, "reference");
const CHECKED_PROPS = new Set(["title", "description"]);

function mdxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (full === SKIPPED) continue;
    if (statSync(full).isDirectory()) out.push(...mdxFiles(full));
    else if (name.endsWith(".mdx")) out.push(full);
  }
  return out;
}

interface Prop {
  name: string;
  value: string;
  line: number;
}

/**
 * The string-valued props of every `<Mistake …>` element in `source`. Walks
 * each element to its closing `>`, skipping `{…}` expressions (which hold the
 * code samples) and the inside of quoted values.
 */
function mistakeProps(source: string): Prop[] {
  const props: Prop[] = [];
  const lineAt = (i: number) => source.slice(0, i).split("\n").length;
  let from = 0;
  for (;;) {
    const start = source.indexOf("<Mistake", from);
    if (start === -1) return props;
    let i = start + "<Mistake".length;
    let depth = 0;
    for (; i < source.length; i++) {
      const c = source[i];
      if (depth > 0) {
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === "`" || c === '"' || c === "'") {
          const end = source.indexOf(c, i + 1);
          i = end === -1 ? source.length : end;
        }
        continue;
      }
      if (c === "{") depth++;
      else if (c === ">") break;
      else if (c === '"') {
        const end = source.indexOf('"', i + 1);
        const name = /([A-Za-z]+)=$/.exec(source.slice(start, i))?.[1] ?? "";
        props.push({ name, value: source.slice(i + 1, end), line: lineAt(i) });
        i = end;
      }
    }
    from = i;
  }
}

describe("Mistake card titles and descriptions", () => {
  const files = mdxFiles(DOCS);

  it("finds the mistake pages", () => {
    expect(
      files.some((f) => f.includes(`${path.sep}mistakes${path.sep}`)),
    ).toBe(true);
  });

  it("holds no backtick, which would print as a literal backtick", () => {
    const faults: string[] = [];
    for (const file of files) {
      for (const prop of mistakeProps(readFileSync(file, "utf8"))) {
        if (CHECKED_PROPS.has(prop.name) && prop.value.includes("`")) {
          faults.push(`${path.relative(DOCS, file)}:${prop.line} ${prop.name}`);
        }
      }
    }
    expect(faults).toEqual([]);
  });
});
