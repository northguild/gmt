import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { astroFiles, findDroppedSpaces } from "./lib/inline-whitespace.mjs";

const root = resolve(import.meta.dirname, "..");

describe("inline whitespace in .astro templates", () => {
  it("finds a line break that Astro's JSX whitespace rules turn into a missing space", async () => {
    const source = [
      "---",
      "---",
      "<p>A row marked",
      "  <strong>Theirs</strong> is a report. <strong>Replies</strong>",
      "  counts comments</p>",
    ].join("\n");
    const found = await findDroppedSpaces(source);
    expect(found.map((f) => [f.line, f.before, f.after])).toEqual([
      [4, "text", "<strong>"],
      [4, "<strong>", "text"],
    ]);
  });

  it("accepts a space on the element's line, an explicit space, and a break before punctuation", async () => {
    const source = [
      "---",
      "const parts = ['a', 'b'];",
      "---",
      "<p>A row marked <strong>Theirs</strong> is",
      "  a report{' '}",
      "  <em>x</em>",
      "  {parts.map((p, i) => <>{i > 0 && ', '}",
      "  <a href={p}>{p}</a></>)}",
      "  .</p>",
    ].join("\n");
    expect(await findDroppedSpaces(source)).toEqual([]);
  });

  it("leaves no template in src/ that drops a space", async () => {
    const findings: string[] = [];
    for (const file of astroFiles(join(root, "src"))) {
      for (const f of await findDroppedSpaces(readFileSync(file, "utf8"))) {
        findings.push(
          `${relative(root, file)}:${f.line} ${f.before} | ${f.after}`,
        );
      }
    }
    expect(
      findings,
      'keep the space on the element\'s line, or write {" "}',
    ).toEqual([]);
  });
});
