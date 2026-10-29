// Meta-test: across all of apps/dox/src, the CSS-module class names are `gmt-<basename>__<local>`, so two
// `.module.css` files with the same basename would collide. This reads the
// file system only; it renders nothing, so it has no axe check.
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

describe("CSS module names", () => {
  it("never repeat a basename", () => {
    const names = walk(join(import.meta.dirname, ".."))
      .filter((file) => file.endsWith(".module.css"))
      .map((file) => basename(file, ".module.css"));
    const dupes = names.filter((name, i) => names.indexOf(name) !== i);
    expect(dupes).toEqual([]);
  });
});
