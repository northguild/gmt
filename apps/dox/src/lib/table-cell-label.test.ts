/**
 * A label drawn into a table cell stays out of the cell's accessible name.
 *
 * Text that `::before` or `::after` generates is part of an element's accessible name (AccName
 * 1.2, name from content), joined to the cell's own text with no space: a Note cell read
 * `NoteThe string is…`. The tables that draw a column label into each cell keep their header
 * row for screen readers, so the label repeats what the header already says. Each such rule
 * gives the generated text an empty alternative (`content: attr(data-col) / ""`, CSS Generated
 * Content Level 3 § 1.2), after a plain `content` declaration that a browser without the `/`
 * syntax keeps.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const STYLES = path.resolve(import.meta.dirname, "..", "styles");

interface Rule {
  file: string;
  selector: string;
  body: string;
}

/** Every innermost rule in every stylesheet, comments removed. */
function rules(): Rule[] {
  const out: Rule[] = [];
  for (const file of readdirSync(STYLES).filter((f) => f.endsWith(".css"))) {
    const css = readFileSync(path.join(STYLES, file), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      out.push({ file, selector: m[1]!.trim(), body: m[2]! });
    }
  }
  return out;
}

/** The `content` values a rule declares. */
const contents = (body: string): string[] =>
  [...body.matchAll(/(?:^|;)\s*content:\s*([^;]+)/g)].map((m) => m[1]!.trim());

/** True when a `content` value draws text: not empty, not a lone zero-width space. */
const drawsText = (value: string): boolean =>
  !/^(?:""|''|"\\200b"|none|normal)$/i.test(value);

/** A selector that generates content inside a table cell. */
const inCell = (selector: string): boolean =>
  selector
    .split(",")
    .some((part) =>
      /(?:^|[\s>+~(])(?:td|th)\b[^\s>+~]*::?(?:before|after)\b/.test(
        part.trim(),
      ),
    );

describe("labels drawn into table cells", () => {
  const labelled = rules().filter(
    (rule) =>
      inCell(rule.selector) && contents(rule.body).some((v) => drawsText(v)),
  );

  it("finds the labelled cells", () => {
    expect(labelled.length).toBeGreaterThanOrEqual(12);
  });

  it("gives every label an empty alternative after a plain fallback", () => {
    for (const rule of labelled) {
      const values = contents(rule.body);
      const where = `${rule.file}: ${rule.selector}`;
      expect(values, where).toHaveLength(2);
      expect(values[0], where).not.toMatch(/\/\s*""$/);
      expect(values[1], where).toBe(`${values[0]} / ""`);
    }
  });
});
