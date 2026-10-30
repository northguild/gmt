// Meta-test: every component test under src/widgets runs axe. Exempt: this file
// and module-names.test.ts, which render nothing.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EXEMPT = new Set(["axe-guard.test.ts", "module-names.test.ts"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

describe("widget tests", () => {
  it("each call expectNoAxeViolations", () => {
    const missing = walk(import.meta.dirname)
      .filter(
        (file) =>
          file.endsWith(".test.ts") && !EXEMPT.has(file.split("/").pop()!),
      )
      .filter(
        (file) =>
          !readFileSync(file, "utf8").includes("await expectNoAxeViolations("),
      );
    expect(missing).toEqual([]);
  });
});
