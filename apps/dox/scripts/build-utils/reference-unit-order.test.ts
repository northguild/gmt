import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { UNIT_ORDER } from "./build-utils";

const REFERENCE = resolve(__dirname, "../../src/content/docs/reference");

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? pages(join(dir, e.name))
      : e.name.endsWith(".mdx")
        ? [join(dir, e.name)]
        : [],
  );
}

/**
 * Every quoted member in `text`, in order of appearance, per `|`-joined run. A table Type cell
 * prints a union as `` `"a"` \| `"b"` ``, so the backticks and the escaped bar are dropped first.
 */
function unionRuns(text: string): string[][] {
  const runs: string[][] = [];
  const plain = text.replace(/\\\|/g, "|").replace(/`/g, "");
  const re = /"[^"\n]*"(?:\s*\|\s*(?:"[^"\n]*"|[A-Za-z_$][\w$<>[\]]*))*/g;
  for (const m of plain.matchAll(re)) {
    runs.push([...m[0].matchAll(/"([^"\n]*)"/g)].map((q) => q[1]));
  }
  return runs;
}

/**
 * A run with two or more unit names that breaks `orderUnitUnions`' order: the unit names out of
 * `UNIT_ORDER`, or one after another quoted literal (`"dayOfWeek"`). `""` is not checked here.
 */
function outOfOrder(run: string[]): boolean {
  const literals = run.filter((n) => n !== "");
  const isUnit = (n: string) => UNIT_ORDER.has(n);
  const idx = literals.filter(isUnit).map((n) => UNIT_ORDER.get(n)!);
  if (idx.length < 2) return false;
  const firstOther = literals.findIndex((n) => !isUnit(n));
  return (
    idx.some((v, i) => i > 0 && v < idx[i - 1]) ||
    (firstOther !== -1 && literals.slice(firstOther).some(isUnit))
  );
}

describe("generated reference pages", () => {
  it("print every union of unit names in unit order", () => {
    const files = existsSync(REFERENCE) ? pages(REFERENCE) : [];
    expect(files.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("|")) return;
        for (const run of unionRuns(line)) {
          if (outOfOrder(run))
            bad.push(
              `${relative(REFERENCE, file)}:${i + 1}: ${run.join(", ")}`,
            );
        }
      });
    }
    expect(bad).toEqual([]);
  });
});
