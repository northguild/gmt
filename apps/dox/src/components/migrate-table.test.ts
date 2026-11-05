import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(
  join(import.meta.dirname, "migrate-table.css"),
  "utf8",
);

describe("the call-by-call table's layout", () => {
  it("gives its cells a tighter side padding so the widest unbreakable pieces fit the content column", () => {
    expect(css).toMatch(
      /\.gmt-migrate-table :is\(th, td\) \{\s*padding-inline: var\(--gmt-space-2\);/,
    );
  });

  it("keeps the note's floor below the width of the widest method name it holds", () => {
    // `ZonedDateTime.prototype.equals` is about 246 px wide and never breaks; a floor above
    // that width, not the word, would set the column and push the table past its box.
    expect(css).toMatch(/min-inline-size:\s*14rem;/);
    expect(css).not.toMatch(/min-inline-size:\s*16rem;/);
  });
});
